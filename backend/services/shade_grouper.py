"""Auto-group shade-variant SKUs into one parent product with a shade picker.

Many imported rows in `ULTRA_GRANULAR_MASTER_LIST.xlsx` are the SAME lipstick /
nail-polish / eyeshadow line, just in different shades. They were ingested as
distinct products, which is bad UX (one "Auric Matte Creme Lipstick" line ends
up as 30+ products in the listing). This service collapses them.

Algorithm:
  1. For each "shade-bearing" category (lipstick, nail-polish, kajal, etc.),
     bucket products by (brand_lower, prefix_words) where prefix_words = the
     first N significant tokens of the product name with trailing
     shade-tokens, hex-codes, and SKU numerics stripped.
  2. Buckets with ≥2 members become a shade group.
  3. The lowest-sort-order / first product becomes the *parent*. Each other
     member is converted into a shade entry inside parent.shades and then
     deactivated (is_active=False). We don't hard-delete so admins can review.
  4. Shade name = whatever text was stripped to derive the prefix. Shade hex
     defaults to a curated palette lookup (best-effort).

Idempotent: products already absorbed (have shade_parent_slug set) are skipped.
Safe to run multiple times.
"""
from __future__ import annotations
import asyncio
import logging
import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Categories whose products typically come in shade variants.
SHADE_CATEGORIES = [
    "lipstick", "liquid-lipstick", "lip-crayon", "lip-gloss", "lip-liner", "lip-tint",
    "kajal", "eyeliner", "eye-shadow", "eye-brow",
    "blush", "highlighter", "foundation", "concealer", "compact", "contour",
    "bronzer", "loose-powder",
    "nail-polish",
]

# Curated palette → hex (best-effort lookup). Matched case-insensitively to
# shade names extracted from product titles.
SHADE_HEX = {
    "red": "#dc2626", "ruby": "#9f1239", "wine": "#7f1d1d",
    "pink": "#ec4899", "rose": "#f43f5e", "blush": "#fbcfe8", "fuchsia": "#d946ef", "magenta": "#c026d3",
    "nude": "#e9c2a6", "beige": "#e8d5b7", "peach": "#fdba74", "coral": "#fb7185",
    "berry": "#9d174d", "burgundy": "#6b0f1a", "maroon": "#7f1d1d", "plum": "#86198f",
    "brown": "#78350f", "chocolate": "#5b2a14", "caramel": "#a16207", "mocha": "#7c2d12",
    "mauve": "#a78bfa", "purple": "#7c3aed", "lavender": "#c4b5fd", "violet": "#8b5cf6",
    "black": "#0f172a", "blue": "#1d4ed8", "navy": "#1e3a8a", "teal": "#0d9488",
    "green": "#15803d", "olive": "#3f6212", "emerald": "#047857", "turquoise": "#0d9488",
    "gold": "#ca8a04", "bronze": "#a16207", "copper": "#b45309", "silver": "#9ca3af",
    "orange": "#f97316", "amber": "#d97706", "yellow": "#facc15",
    "white": "#f8fafc", "cream": "#fef3c7", "ivory": "#fef9c3", "champagne": "#fde68a",
    "grey": "#6b7280", "gray": "#6b7280", "neutral": "#a8a29e", "tan": "#d2a679",
}

# Token stripping regexes — run in order on each name token.
_RE_SKU_HEAD = re.compile(r"^[a-z]{1,4}\d{2,4}[a-z-]*$", re.I)      # "asn08", "mtmn004", "3211"
_RE_PURE_NUM = re.compile(r"^[0-9]+[a-z]?$", re.I)                  # "008", "13a"
_RE_HEX_LIKE = re.compile(r"^[0-9]+g$", re.I)                       # "9g" (weight noise)
_RE_DASH_NUM = re.compile(r"^-?\d{1,3}-?$")                         # "-35", "06-"


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _is_shade_token(tok: str) -> bool:
    t = tok.strip("-.,()[]").lower()
    if not t:
        return False
    if t in SHADE_HEX:
        return True
    if _RE_PURE_NUM.match(t) or _RE_SKU_HEAD.match(t) or _RE_DASH_NUM.match(t) or _RE_HEX_LIKE.match(t):
        return True
    return False


def _shade_hex_for(name: str) -> Optional[str]:
    n = name.lower()
    for kw, hx in SHADE_HEX.items():
        if re.search(rf"\b{kw}\b", n):
            return hx
    return None


def _split_prefix_shade(name: str) -> Tuple[str, str]:
    """Return (prefix_normalised, shade_label).

    Splits at the right-most run of shade-like tokens.
    """
    tokens = name.split()
    if not tokens:
        return "", ""
    # Find split point: longest trailing run of shade tokens
    i = len(tokens)
    while i > 1 and _is_shade_token(tokens[i - 1]):
        i -= 1
    prefix = " ".join(tokens[:i]).strip("- ").lower()
    shade = " ".join(tokens[i:]).strip("- ").title()
    # If we trimmed everything, treat last word as shade and rest as prefix
    if not shade and len(tokens) >= 2:
        shade = tokens[-1].title()
        prefix = " ".join(tokens[:-1]).lower()
    return prefix, shade


def _bucket_key(brand: str, name: str) -> Tuple[str, str]:
    prefix, _ = _split_prefix_shade(name)
    # Drop punctuation/extra whitespace
    prefix = re.sub(r"[^\w\s]", " ", prefix)
    prefix = re.sub(r"\s+", " ", prefix).strip()
    return (_norm(brand), prefix)


async def preview_grouping(db) -> Dict[str, dict]:
    """Dry run — returns proposed groups without mutating products."""
    buckets: Dict[Tuple[str, str], List[dict]] = defaultdict(list)
    cur = db.products.find(
        {"category": {"$in": SHADE_CATEGORIES}, "is_active": True, "shade_parent_slug": {"$exists": False}},
        {"_id": 0, "slug": 1, "name": 1, "brand": 1, "category": 1, "shade_hint": 1, "sort_order": 1, "stock_qty": 1, "images": 1},
    )
    async for p in cur:
        key = _bucket_key(p.get("brand", ""), p.get("name", ""))
        if not key[1]:  # skip empty prefix
            continue
        buckets[key].append(p)

    groups = {k: v for k, v in buckets.items() if len(v) >= 2}
    summary = {
        "categories_scanned": SHADE_CATEGORIES,
        "groups_found": len(groups),
        "members_to_collapse": sum(len(v) - 1 for v in groups.values()),
        "sample": [
            {
                "brand": k[0], "prefix": k[1],
                "members": [{"slug": p["slug"], "name": p["name"]} for p in v[:4]],
                "total": len(v),
            }
            for k, v in list(groups.items())[:8]
        ],
    }
    return summary


async def apply_grouping(db, dry_run: bool = False) -> dict:
    """Collapse shade-variant SKUs. Returns counts."""
    buckets: Dict[Tuple[str, str], List[dict]] = defaultdict(list)
    cur = db.products.find(
        {"category": {"$in": SHADE_CATEGORIES}, "is_active": True, "shade_parent_slug": {"$exists": False}},
        {"_id": 0, "slug": 1, "name": 1, "brand": 1, "category": 1,
         "shade_hint": 1, "sort_order": 1, "stock_qty": 1, "images": 1,
         "shades": 1, "mrp": 1, "prepaid_price": 1, "cod_price": 1},
    )
    async for p in cur:
        key = _bucket_key(p.get("brand", ""), p.get("name", ""))
        if not key[1]:
            continue
        buckets[key].append(p)

    groups_processed = 0
    children_absorbed = 0
    now = datetime.now(timezone.utc).isoformat()

    for (brand_l, prefix), members in buckets.items():
        if len(members) < 2:
            continue
        # Sort: lowest sort_order, then alphabetic
        members.sort(key=lambda x: (x.get("sort_order", 99), x.get("slug", "")))
        parent = members[0]
        children = members[1:]

        # Build shades list from parent + children
        existing_shades = list(parent.get("shades") or [])
        existing_ids = {s.get("id") for s in existing_shades}

        # Add parent itself as the first shade if it has none yet
        parent_prefix, parent_shade = _split_prefix_shade(parent["name"])
        if not existing_shades:
            shade_id = f"sh-{uuid.uuid4().hex[:6]}"
            existing_shades.append({
                "id": shade_id,
                "name": parent_shade or "Default",
                "hex": _shade_hex_for(parent_shade or parent["name"]) or "#a8a29e",
                "sku": parent["slug"],
                "stock_qty": int(parent.get("stock_qty", 100)),
                "image": (parent.get("images") or [""])[0],
            })

        for ch in children:
            _, ch_shade = _split_prefix_shade(ch["name"])
            shade_id = f"sh-{uuid.uuid4().hex[:6]}"
            if shade_id in existing_ids:
                continue
            existing_shades.append({
                "id": shade_id,
                "name": ch_shade or f"Variant {len(existing_shades) + 1}",
                "hex": _shade_hex_for(ch_shade or ch["name"]) or "#a8a29e",
                "sku": ch["slug"],
                "stock_qty": int(ch.get("stock_qty", 100)),
                "image": (ch.get("images") or [""])[0],
            })

        if dry_run:
            groups_processed += 1
            children_absorbed += len(children)
            continue

        # 1) update parent — set shades + a clean parent name
        clean_parent_name = parent_prefix.title() if parent_prefix else parent["name"]
        await db.products.update_one(
            {"slug": parent["slug"]},
            {"$set": {
                "name": clean_parent_name,
                "short_name": clean_parent_name[:60],
                "shades": existing_shades,
                "shade_parent": True,
                "shade_count": len(existing_shades),
                "updated_at": now,
            }},
        )

        # 2) deactivate children & link them to parent (audit trail)
        for ch in children:
            await db.products.update_one(
                {"slug": ch["slug"]},
                {"$set": {
                    "is_active": False,
                    "shade_parent_slug": parent["slug"],
                    "absorbed_at": now,
                }},
            )

        groups_processed += 1
        children_absorbed += len(children)

    return {
        "groups_processed": groups_processed,
        "children_absorbed": children_absorbed,
        "dry_run": dry_run,
    }
