"""Brand-diversified ordering for product list responses.

Goal (user request Feb-2026): when the customer browses a concern, category,
brand, search result, or any product list, two products of the SAME brand
must not appear more than twice in a row. This keeps the carousel feeling
varied instead of "Aqualogica × 8, then Plum × 6, then Lakmé × 4 …".

Constraints:
  - Image-first preference must be preserved — products with at least one
    image stay above imageless ones (this matches the existing
    `images_first` sort already used by /api/products and /api/concerns).
  - Stable: when a swap isn't needed, we keep the original order. Only
    re-shuffle the bare minimum needed to break a brand streak.
  - Pagination-safe: applied to the page slice as returned (so brand
    distribution within each page is good — across pages the brand
    distribution naturally averages out).
"""
from __future__ import annotations
from typing import List, Dict, Any


def _has_image(item: Dict[str, Any]) -> bool:
    imgs = item.get("images")
    if isinstance(imgs, list) and any(isinstance(u, str) and u.strip() for u in imgs):
        return True
    for f in ("image_url", "image", "thumbnail"):
        v = item.get(f)
        if isinstance(v, str) and v.strip():
            return True
    return False


def diversify_by_brand(
    items: List[Dict[str, Any]],
    brand_key: str = "brand",
    max_consecutive: int = 2,
) -> List[Dict[str, Any]]:
    """Reorder so no more than `max_consecutive` products of the same brand
    appear in a row. Image-first preference is preserved by partitioning the
    list into "with image" + "without image" and diversifying each partition
    independently, then concatenating.
    """
    if not items or len(items) < 3:
        return list(items)

    with_image: List[Dict[str, Any]] = [p for p in items if _has_image(p)]
    no_image:   List[Dict[str, Any]] = [p for p in items if not _has_image(p)]

    def _diversify(seq: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if len(seq) < 3:
            return list(seq)
        result: List[Dict[str, Any]] = []
        remaining = list(seq)
        while remaining:
            if len(result) < max_consecutive:
                result.append(remaining.pop(0))
                continue
            # Brand of the last `max_consecutive` results
            recent = [(r.get(brand_key) or "").strip().lower() for r in result[-max_consecutive:]]
            if recent and all(b == recent[0] and b for b in recent):
                # Streak detected — find the next candidate with a different brand
                picked_idx = None
                for i, cand in enumerate(remaining):
                    cb = (cand.get(brand_key) or "").strip().lower()
                    if cb != recent[0]:
                        picked_idx = i
                        break
                if picked_idx is None:
                    # No alternative brand remaining — accept as-is
                    picked_idx = 0
                result.append(remaining.pop(picked_idx))
            else:
                result.append(remaining.pop(0))
        return result

    return _diversify(with_image) + _diversify(no_image)
