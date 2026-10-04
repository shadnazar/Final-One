"""Admin endpoints for the Master List bulk upload + product-group system.

  POST /api/admin/master-import/upload     Upload xlsx, wipe+import in one shot
  GET  /api/admin/product-groups            List groups (with pagination, filters)
  GET  /api/admin/product-groups/{group_id} Products in a group
  POST /api/admin/products/margin-bulk      Apply +/- % margin to a scope
  POST /api/admin/products/wipe-niche       Wipe products in a niche (admin tool)
"""
from __future__ import annotations
from fastapi import APIRouter, UploadFile, File, Header, HTTPException, Cookie, Body, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["master-import"])

_db = None
_admin_sessions = None
_verify_admin = None


def setup(db, admin_sessions, verify_admin_fn):
    global _db, _admin_sessions, _verify_admin
    _db = db
    _admin_sessions = admin_sessions
    _verify_admin = verify_admin_fn


def _auth(x_admin_token, admin_session):
    if _verify_admin is None:
        raise HTTPException(status_code=500, detail="auth not wired")
    _verify_admin(x_admin_token=x_admin_token, admin_session=admin_session)


@router.post("/master-import/analyze")
async def master_import_analyze(
    file: UploadFile = File(...),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """AI sheet pre-analysis — scans the Excel BEFORE inserting anything.

    Returns:
      • Per-niche row counts (cosmetics vs skincare).
      • Unique Product Types in the file (and how many are already mapped to a
        taxonomy_v2 category vs. how many would fall back to the niche default).
      • Unique Concerns in the file (mapped vs. unknown — those would be
        auto-created on actual upload).
      • Sample misclassification warnings (e.g. a skincare-shaped Product Type
        appearing in a row with Main Category=cosmetics).

    Admin sees this preview, decides whether to proceed, then uploads for real.
    """
    _auth(x_admin_token, admin_session)
    from services.fast_bulk_import import (
        parse_master_excel, PRODUCT_TYPE_TO_CATEGORY, CONCERN_MAP, SKIN_TYPE_MAP, NICHE_MAP,
    )
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx / .xls supported")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    try:
        rows = parse_master_excel(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parse failed: {e}")

    niche_counts: dict = {}
    product_types: dict = {}
    concerns: dict = {}
    skin_types: dict = {}
    brands = set()
    misclass = []

    skincare_types = {k for k, v in PRODUCT_TYPE_TO_CATEGORY.items() if v in {
        "cleansers","exfoliators","toners-mists","serums-treatments","essences-ampoules",
        "spot-treatments","moisturizers","face-oils","sunscreens","eye-care","lip-care",
        "masks-packs","body-skincare",
    }}
    cosmetics_types = {k for k, v in PRODUCT_TYPE_TO_CATEGORY.items() if v in {
        "face-makeup","foundation","concealer","face-primer","compact","loose-powder","blush",
        "bb-cc-cream","tinted-moisturizer","bronzer","contour","highlighter","setting-spray",
        "makeup-remover","lipstick","liquid-lipstick","lip-crayon","lip-gloss","lip-liner","lip-tint",
        "eye-shadow","kajal","eyeliner","mascara","eye-brow","false-lashes","nail-polish",
        "makeup-brush","beauty-sponge","makeup-kits",
    }}

    for r in rows:
        n = NICHE_MAP.get(r["main_category"], "skincare")
        niche_counts[n] = niche_counts.get(n, 0) + 1
        pt = r["product_type"] or "(empty)"
        product_types[pt] = product_types.get(pt, 0) + 1
        if r["concern"]:
            concerns[r["concern"]] = concerns.get(r["concern"], 0) + 1
        if r["skin_type"]:
            skin_types[r["skin_type"]] = skin_types.get(r["skin_type"], 0) + 1
        if r["brand"]:
            brands.add(r["brand"])
        # Cross-niche check
        if n == "cosmetics" and pt in skincare_types:
            misclass.append({"name": r["name"], "main_category": r["main_category"], "product_type": pt, "issue": "skincare-shaped product in cosmetics row"})
        if n == "skincare" and pt in cosmetics_types:
            misclass.append({"name": r["name"], "main_category": r["main_category"], "product_type": pt, "issue": "cosmetics-shaped product in skincare row"})

    # Compute which Product Types are unmapped (would fall back to niche default category)
    unmapped_types = sorted([
        {"name": k, "count": v} for k, v in product_types.items()
        if k != "(empty)" and k not in PRODUCT_TYPE_TO_CATEGORY
    ], key=lambda x: -x["count"])
    unmapped_concerns = sorted([
        {"name": k, "count": v} for k, v in concerns.items()
        if k not in CONCERN_MAP
    ], key=lambda x: -x["count"])

    # Need-to-create lists for auto-create-on-import. We compare against existing DB.
    existing_cat_slugs = set([
        c["slug"] async for c in _db.categories.find({}, {"_id": 0, "slug": 1})
    ])
    existing_concern_slugs = set([
        c["slug"] async for c in _db.concerns.find({}, {"_id": 0, "slug": 1})
    ])
    target_cats = set()
    for pt, _ in product_types.items():
        slug = PRODUCT_TYPE_TO_CATEGORY.get(pt)
        if slug:
            target_cats.add(slug)
    cats_to_create = sorted(list(target_cats - existing_cat_slugs))
    target_concerns = set()
    for c in concerns:
        s = CONCERN_MAP.get(c)
        if s:
            target_concerns.add(s)
    for st in skin_types:
        s = SKIN_TYPE_MAP.get(st)
        if s:
            target_concerns.add(s)
    concerns_to_create = sorted(list(target_concerns - existing_concern_slugs))

    return {
        "total_rows": len(rows),
        "unique_brands": len(brands),
        "by_niche": niche_counts,
        "top_product_types": sorted(
            [{"name": k, "count": v, "mapped_category": PRODUCT_TYPE_TO_CATEGORY.get(k)} for k, v in product_types.items() if k != "(empty)"],
            key=lambda x: -x["count"]
        )[:25],
        "top_concerns": sorted(
            [{"name": k, "count": v, "mapped_slug": CONCERN_MAP.get(k)} for k, v in concerns.items()],
            key=lambda x: -x["count"]
        )[:25],
        "unmapped_product_types": unmapped_types[:30],
        "unmapped_concerns": unmapped_concerns[:20],
        "auto_will_create": {
            "categories": cats_to_create,
            "concerns": concerns_to_create,
        },
        "potential_misclassifications": misclass[:25],
        "misclassification_total": len(misclass),
    }


@router.post("/master-import/upload")
async def master_import_upload(
    file: UploadFile = File(...),
    wipe_first: bool = Query(False, description="If true, deletes existing cosmetics+skincare products before import. Default false — dedup-by-slug prevents duplicates on re-upload."),
    use_ai: bool = Query(False, description="If true, attempt inline AI classification during import (slow). DEFAULT FALSE — run the one-click `/admin/taxonomy/ai-audit` after upload for proper AI classification + new sub-category creation."),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Upload the ULTRA_GRANULAR_MASTER_LIST.xlsx and import.

    DEDUP CONTRACT: re-uploading the same file is safe — products are uniquely
    keyed by `slug` (derived from brand + name). Re-runs return imported=0 if
    nothing new exists.

    use_ai=True routes unknown product types through Claude Haiku and
    auto-creates the matching concern / category / subcategory rows with proper
    metadata (icon, parent link).
    """
    _auth(x_admin_token, admin_session)
    from services.fast_bulk_import import FastBulkImportService
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx / .xls supported")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    svc = FastBulkImportService(_db)
    wipe_result = None
    if wipe_first:
        wipe_result = await svc.wipe_niches(["cosmetics", "skincare"])
    try:
        result = await svc.import_from_bytes(content, batch_size=500, use_ai=use_ai)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {e}")
    return {"success": True, "wipe": wipe_result, "import": result}


@router.get("/product-groups")
async def list_product_groups(
    niche: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """List product groups with pagination."""
    _auth(x_admin_token, admin_session)
    q = {}
    if niche:
        q["niche"] = niche
    total = await _db.product_groups.count_documents(q)
    cur = _db.product_groups.find(q, {"_id": 0}).sort([("niche", 1), ("group_no", 1)]).skip((page - 1) * limit).limit(limit)
    items = await cur.to_list(limit)
    return {"items": items, "total": total, "page": page, "limit": limit, "has_next": page * limit < total}


@router.get("/product-groups/{group_id}")
async def get_group_products(
    group_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(80, ge=1, le=200),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Get products in a specific group (paginated)."""
    _auth(x_admin_token, admin_session)
    q = {"product_group_id": group_id}
    total = await _db.products.count_documents(q)
    group = await _db.product_groups.find_one({"group_id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    cur = _db.products.find(q, {"_id": 0}).sort("product_group_index", 1).skip((page - 1) * limit).limit(limit)
    items = await cur.to_list(limit)
    return {"group": group, "items": items, "total": total, "page": page, "limit": limit, "has_next": page * limit < total}


class GroupRenameRequest(BaseModel):
    name: str


@router.patch("/product-groups/{group_id}")
async def rename_product_group(
    group_id: str,
    body: GroupRenameRequest,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Rename a product group (admin edits the label shown above the 80-product chunk)."""
    _auth(x_admin_token, admin_session)
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if len(name) > 120:
        raise HTTPException(status_code=400, detail="Name too long (max 120 chars)")
    result = await _db.product_groups.update_one(
        {"group_id": group_id},
        {"$set": {"name": name, "renamed_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"success": True, "group_id": group_id, "name": name}


class MarginBulkRequest(BaseModel):
    delta_percent: float  # +5 means raise price by 5%, -5 means lower by 5%
    scope: str  # "all" | "niche" | "group" | "category"
    niche: Optional[str] = None
    group_id: Optional[str] = None
    category: Optional[str] = None
    apply_to_mrp: bool = False  # If true, MRP also updates; otherwise only listing prices change
    update_dealer: bool = False  # If true, dealer_price also changes (rare)


@router.post("/products/margin-bulk")
async def apply_bulk_margin(
    req: MarginBulkRequest = Body(...),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Apply a +/-% margin shift across a scope.

    Example: scope=group, group_id=grp-cosmetics-001, delta_percent=5
    → raises every product in that group's listing price by 5%.
    """
    _auth(x_admin_token, admin_session)
    q = {}
    if req.scope == "all":
        pass
    elif req.scope == "niche":
        if not req.niche:
            raise HTTPException(status_code=400, detail="niche required")
        q["niche"] = req.niche
    elif req.scope == "group":
        if not req.group_id:
            raise HTTPException(status_code=400, detail="group_id required")
        q["product_group_id"] = req.group_id
    elif req.scope == "category":
        if not req.category:
            raise HTTPException(status_code=400, detail="category required")
        q["category"] = req.category
    else:
        raise HTTPException(status_code=400, detail="Invalid scope")

    factor = 1 + (req.delta_percent / 100.0)
    if factor <= 0:
        raise HTTPException(status_code=400, detail="Resulting factor must be positive")

    affected = 0
    async for prod in _db.products.find(q, {"_id": 0, "slug": 1, "prepaid_price": 1, "cod_price": 1, "mrp": 1, "dealer_price": 1}):
        upd = {}
        new_prepaid = max(1, int(round((prod.get("prepaid_price") or 0) * factor)))
        new_cod = max(1, int(round((prod.get("cod_price") or 0) * factor)))
        upd["prepaid_price"] = new_prepaid
        upd["cod_price"] = new_cod
        if req.apply_to_mrp:
            upd["mrp"] = max(1, int(round((prod.get("mrp") or 0) * factor)))
        if req.update_dealer:
            upd["dealer_price"] = max(0, int(round((prod.get("dealer_price") or 0) * factor)))
        # Recompute discount % if mrp is unchanged
        new_mrp = upd.get("mrp", prod.get("mrp") or 0)
        if new_mrp > 0 and new_prepaid > 0 and new_prepaid < new_mrp:
            upd["discount_percent"] = int(round((new_mrp - new_prepaid) / new_mrp * 100))
        else:
            upd["discount_percent"] = 0
        upd["updated_at"] = datetime.now(timezone.utc).isoformat()
        await _db.products.update_one({"slug": prod["slug"]}, {"$set": upd})
        affected += 1

    return {
        "success": True,
        "affected": affected,
        "scope": req.scope,
        "delta_percent": req.delta_percent,
    }


@router.post("/products/wipe-niche")
async def wipe_niche(
    niches: List[str] = Body(..., embed=True),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Wipe all products + groups in given niches (dangerous; admin tool)."""
    _auth(x_admin_token, admin_session)
    from services.fast_bulk_import import FastBulkImportService
    svc = FastBulkImportService(_db)
    return await svc.wipe_niches(niches)


# ============================================================
# Niche-segmented order download (3 niches × dealer/in-house)
# ============================================================

@router.get("/orders/export-sheet")
async def export_orders(
    niche: str = Query("all", description="anti-aging | skincare | cosmetics | all"),
    sheet_type: str = Query("inhouse", description="inhouse | dealer"),
    status: Optional[str] = Query(None, description="optional status filter"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD (IST) — restrict to orders placed on this day. Defaults to today (IST) if omitted."),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Generate HTML invoice/list for download (browser saves as PDF).

    sheet_type=inhouse: full details (name, phone, full address, prices, AWB)
    sheet_type=dealer:  customer name + products + qty (one row per ORDER)

    `date` is interpreted as an IST (UTC+5:30) calendar day. Default = today IST.
    """
    _auth(x_admin_token, admin_session)
    q = {}
    if status:
        q["status"] = status
    # Niche filter: load product slugs from this niche, then filter orders that contain them
    if niche != "all":
        prod_slugs = [p["slug"] async for p in _db.products.find({"niche": niche}, {"_id": 0, "slug": 1})]
        q["items.slug"] = {"$in": prod_slugs}

    # --- Date filter (IST day → UTC window) ---
    from datetime import timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    if not date:
        # Default to today IST
        date = datetime.now(IST).strftime("%Y-%m-%d")
    try:
        y, m, d = (int(x) for x in date.split("-"))
        day_start_ist = datetime(y, m, d, 0, 0, 0, tzinfo=IST)
        day_end_ist = day_start_ist + timedelta(days=1)
        q["created_at"] = {
            "$gte": day_start_ist.astimezone(timezone.utc).isoformat(),
            "$lt": day_end_ist.astimezone(timezone.utc).isoformat(),
        }
        date_label = day_start_ist.strftime("%d %b %Y")
    except Exception:
        date_label = date

    orders = await _db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)

    # Filter items per niche too (so dealer sheets only contain niche-relevant products)
    if niche != "all":
        slug_set = set(prod_slugs)
        for o in orders:
            if o.get("items"):
                o["items"] = [it for it in o["items"] if (it.get("slug") or it.get("product_slug")) in slug_set]

    title = f"{niche.title()} – {sheet_type.title()} Sheet"
    now = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")

    if sheet_type == "dealer":
        # ONE row per order. Products + qty are grouped in a single cell so each
        # order takes exactly one line — much easier for dealers to pick & pack.
        rows_html = []
        for o in orders:
            items = o.get("items") or []
            products_html = "<br/>".join(
                f"• {it.get('name','')} <span style='color:#666'>×{it.get('quantity',1)}</span>"
                for it in items
            ) or "<span style='color:#999'>—</span>"
            total_qty = sum(int(it.get('quantity') or 1) for it in items)
            rows_html.append(
                f"<tr><td style='font-family:monospace;font-size:12px'>{o.get('order_id','')}</td>"
                f"<td>{o.get('name','')}</td>"
                f"<td style='font-size:12px'>{products_html}</td>"
                f"<td style='text-align:center'>{len(items)}</td>"
                f"<td style='text-align:center'><b>{total_qty}</b></td></tr>"
            )
        headers = ["Order ID", "Customer Name", "Products", "Items", "Total Qty"]
    else:
        # In-house: full details, ALREADY one row per order. Keep grouping consistent
        # with the dealer sheet: list each product on its own line with × qty.
        rows_html = []
        for o in orders:
            items = o.get("items") or []
            items_html = "<br/>".join(
                f"• {it.get('name','')} <span style='color:#666'>×{it.get('quantity',1)}</span>"
                for it in items
            ) or "<span style='color:#999'>—</span>"
            total_qty = sum(int(it.get('quantity') or 1) for it in items)
            addr = f"{o.get('house_number','')}, {o.get('area','')}, {o.get('state','')} - {o.get('pincode','')}"
            rows_html.append(
                f"<tr><td style='font-family:monospace;font-size:12px'>{o.get('order_id','')}</td>"
                f"<td>{o.get('name','')}<br/><span style='color:#888;font-size:11px'>+91 {o.get('phone','')}</span></td>"
                f"<td style='font-size:12px'>{addr}</td>"
                f"<td style='font-size:12px'>{items_html}<div style='color:#666;font-size:11px;margin-top:4px'>Items: {len(items)} · Qty: {total_qty}</div></td>"
                f"<td style='text-align:right'><b>₹{o.get('amount',0)}</b></td>"
                f"<td>{o.get('payment_method','')}</td>"
                f"<td>{o.get('status','')}</td>"
                f"<td style='font-family:monospace;font-size:11px'>{o.get('awb_number','-')}</td></tr>"
            )
        headers = ["Order ID", "Customer", "Address", "Items (× qty)", "Amount", "Payment", "Status", "AWB"]

    th_html = "".join(f"<th>{h}</th>" for h in headers)
    body_html = "".join(rows_html) or "<tr><td colspan='10' style='text-align:center;padding:30px;color:#888'>No orders found</td></tr>"

    html = f"""<!DOCTYPE html>
<html><head><meta charset='utf-8'>
<title>{title}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; color:#222 }}
  .header {{ display:flex; justify-content:space-between; align-items:end; border-bottom:3px solid #047857; padding-bottom:14px; margin-bottom:24px; }}
  h1 {{ color:#047857; margin:0; font-size:24px; letter-spacing:-0.5px }}
  .meta {{ color:#666; font-size:13px }}
  table {{ width:100%; border-collapse:collapse; font-size:13px }}
  th {{ background:#047857; color:white; padding:10px 12px; text-align:left; font-size:11px; letter-spacing:0.6px; text-transform:uppercase }}
  td {{ padding:10px 12px; border-bottom:1px solid #eee; vertical-align:top }}
  tr:hover td {{ background:#fafafa }}
  .footer {{ margin-top:30px; color:#888; font-size:11px; text-align:center }}
  @media print {{ body {{ margin:20px }} }}
</style></head>
<body>
  <div class='header'>
    <div>
      <h1>Celesta Glow — {title}</h1>
      <div class='meta'>{len(orders)} orders • Date: <b>{date_label}</b> (IST) • Generated {now}</div>
    </div>
    <button onclick='window.print()' style='background:#047857;color:white;border:0;padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer'>Print / Save PDF</button>
  </div>
  <table>
    <thead><tr>{th_html}</tr></thead>
    <tbody>{body_html}</tbody>
  </table>
  <div class='footer'>Celesta Glow Pvt Ltd • Generated on {now}</div>
</body></html>"""

    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html)


# ============================================================
# Delhivery auto-status sync — fetch latest tracking for all shipped orders
# ============================================================

@router.post("/orders/sync-delhivery")
async def sync_delhivery_status(
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    admin_session: Optional[str] = Cookie(None),
):
    """Pull latest status from Delhivery for every order with an AWB.

    Updates order.status when Delhivery says delivered / in-transit / returned.
    Safe to call repeatedly — it's idempotent.
    """
    _auth(x_admin_token, admin_session)
    from services.delhivery_service import delhivery_service
    if delhivery_service is None or not delhivery_service.api_key:
        return {"success": False, "error": "Delhivery API key not configured", "synced": 0}

    # Only orders with AWB and not yet 'delivered'/'cancelled'
    q = {
        "awb_number": {"$exists": True, "$ne": ""},
        "status": {"$nin": ["delivered", "cancelled"]},
    }
    synced = 0
    updated = 0
    errors = 0
    async for o in _db.orders.find(q, {"_id": 0, "order_id": 1, "awb_number": 1, "status": 1}):
        synced += 1
        try:
            tracking = await delhivery_service.track_shipment(o["awb_number"])
            if not tracking.get("success"):
                continue
            dstat = (tracking.get("status") or "").lower()
            new_status = None
            if "delivered" in dstat:
                new_status = "delivered"
            elif "rto" in dstat or "return" in dstat:
                new_status = "returned"
            elif "out for delivery" in dstat or "in transit" in dstat or "manifested" in dstat or "dispatched" in dstat:
                new_status = "shipped"
            if new_status and new_status != o.get("status"):
                await _db.orders.update_one(
                    {"order_id": o["order_id"]},
                    {"$set": {
                        "status": new_status,
                        "delivery_status": dstat,
                        "delivery_location": tracking.get("status_location", ""),
                        "last_tracking_update": datetime.now(timezone.utc).isoformat(),
                    }},
                )
                updated += 1
        except Exception as e:
            errors += 1
            logger.warning(f"[delhivery-sync] {o['order_id']}: {e}")

    return {"success": True, "synced": synced, "updated": updated, "errors": errors}
