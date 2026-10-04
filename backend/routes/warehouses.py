"""Instant Delivery — multi-warehouse routing (Feb-2026).

Responsibilities:
  1.  CRUD for warehouses (each: name/address/lat/lng/service_radius_km/phone).
  2.  Coverage check — given a customer's lat/lng, return the list of warehouses
      whose radius contains them + the nearest one.
  3.  Distance-Matrix proxy — server-side call to Google's Distance Matrix
      so the browser never sees the API key (and no CORS pain).

  Migration: the previous single-record settings doc `admin_settings/warehouse_config`
  is copied into the new `warehouses` collection on first read (best-effort).
"""
from __future__ import annotations
import math
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(tags=["delivery"])

_db = None
_verify_admin = None


def setup(db, verify_admin_token):
    global _db, _verify_admin
    _db = db
    _verify_admin = verify_admin_token


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometres. Good enough for coverage checks."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


async def _ensure_migrated():
    """Copy the legacy `admin_settings/warehouse_config` doc into a warehouse row
    if the collection is empty. Only runs once."""
    if await _db.warehouses.count_documents({}) > 0:
        return
    legacy = await _db.admin_settings.find_one({"type": "warehouse_config"}, {"_id": 0}) or {}
    if not legacy.get("name") and not legacy.get("address"):
        return
    await _db.warehouses.insert_one({
        "id": uuid.uuid4().hex[:12],
        "name": legacy.get("name") or "Main Warehouse",
        "address": legacy.get("address") or "",
        "pincode": legacy.get("pincode") or "",
        "phone": legacy.get("phone") or "",
        "maps_link": legacy.get("maps_link") or "",
        "lat": None,
        "lng": None,
        "service_radius_km": 15.0,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class WarehouseIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    address: Optional[str] = ""
    pincode: Optional[str] = ""
    phone: Optional[str] = ""
    maps_link: Optional[str] = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    service_radius_km: Optional[float] = 15.0
    is_active: Optional[bool] = True


class WarehousePatch(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    maps_link: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    service_radius_km: Optional[float] = None
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# Admin CRUD
# ---------------------------------------------------------------------------
@router.get("/admin/warehouses")
async def list_warehouses(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    await _ensure_migrated()
    return await _db.warehouses.find({}, {"_id": 0}).sort("created_at", 1).to_list(200)


@router.post("/admin/warehouses")
async def create_warehouse(payload: WarehouseIn, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    doc = payload.dict()
    doc["id"] = uuid.uuid4().hex[:12]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc.setdefault("service_radius_km", 15.0)
    doc.setdefault("is_active", True)
    await _db.warehouses.insert_one(dict(doc))
    return doc


@router.patch("/admin/warehouses/{wh_id}")
async def update_warehouse(wh_id: str, payload: WarehousePatch, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    upd = {k: v for k, v in payload.dict().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    res = await _db.warehouses.update_one({"id": wh_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Warehouse not found")
    return await _db.warehouses.find_one({"id": wh_id}, {"_id": 0})


@router.delete("/admin/warehouses/{wh_id}")
async def delete_warehouse(wh_id: str, x_admin_token: str = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    res = await _db.warehouses.delete_one({"id": wh_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Warehouse not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# Public coverage check
# ---------------------------------------------------------------------------
@router.get("/delivery/coverage")
async def coverage(lat: float = Query(...), lng: float = Query(...)):
    """Given the customer's coordinates, decide if any warehouse can do
    Instant Delivery. Returns:
      { instant_available, delivery_type, nearest_warehouse, warehouses_covering, distance_km }
    Uses haversine distance vs each warehouse's service_radius_km.
    """
    await _ensure_migrated()
    docs = await _db.warehouses.find({"is_active": {"$ne": False}}, {"_id": 0}).to_list(200)
    scored = []
    for w in docs:
        wlat, wlng = w.get("lat"), w.get("lng")
        if wlat is None or wlng is None:
            continue
        d = _haversine_km(lat, lng, float(wlat), float(wlng))
        scored.append({**w, "distance_km": round(d, 2)})
    scored.sort(key=lambda x: x["distance_km"])
    covering = [w for w in scored if w["distance_km"] <= float(w.get("service_radius_km") or 15)]
    nearest = scored[0] if scored else None
    instant = bool(covering)
    return {
        "instant_available": instant,
        "delivery_type": "instant" if instant else "standard",
        "nearest_warehouse": {
            "id": nearest["id"], "name": nearest["name"],
            "distance_km": nearest["distance_km"],
            "service_radius_km": nearest.get("service_radius_km"),
            "phone": nearest.get("phone"),
        } if nearest else None,
        "assigned_warehouse_id": covering[0]["id"] if covering else None,
        "warehouses_covering": [{"id": w["id"], "name": w["name"], "distance_km": w["distance_km"]} for w in covering],
    }


# ---------------------------------------------------------------------------
# Public coverage check by PINCODE (Feb-2026)
# ---------------------------------------------------------------------------
# When the user hasn't shared browser geolocation we still need to know if
# their pincode falls inside a warehouse's service radius. We use the free
# India Post API to resolve pincode → coordinates (its lat/lng aren't
# published, so we approximate via the warehouse's own pincode when it
# matches, or fall back to a lightweight distance heuristic based on the
# first two pincode digits — same region = "in zone").
_PIN_CENTROID_CACHE: dict = {}


async def _pincode_to_coords(pincode: str):
    """Resolve pincode → (lat, lng) using India Post + a Nominatim fallback.
    Cached in-process to avoid hammering the upstream on every keystroke.
    Returns None if the pincode can't be resolved.
    """
    pincode = (pincode or "").strip()
    if not pincode.isdigit() or len(pincode) != 6:
        return None
    if pincode in _PIN_CENTROID_CACHE:
        return _PIN_CENTROID_CACHE[pincode]
    # Nominatim (OpenStreetMap) has centroid coordinates for Indian pincodes.
    # Free, no key, but rate-limited — the cache saves us on repeat lookups.
    try:
        async with httpx.AsyncClient(timeout=4.0, headers={"User-Agent": "celesta-glow-checkout/1.0"}) as client:
            r = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"postalcode": pincode, "country": "India", "format": "json", "limit": 1},
            )
            arr = r.json() if r.status_code == 200 else []
            if arr:
                lat = float(arr[0].get("lat"))
                lng = float(arr[0].get("lon"))
                _PIN_CENTROID_CACHE[pincode] = (lat, lng)
                return (lat, lng)
    except Exception:
        pass
    _PIN_CENTROID_CACHE[pincode] = None
    return None


@router.get("/delivery/coverage-by-pincode")
async def coverage_by_pincode(pincode: str = Query(..., min_length=6, max_length=6)):
    """Same as `/delivery/coverage` but keyed off pincode instead of coords.
    Used by the checkout form when the customer hasn't shared browser geo.
    """
    await _ensure_migrated()
    if not pincode.isdigit():
        raise HTTPException(status_code=400, detail="Invalid pincode")
    # Fast-path: if any warehouse has the exact pincode saved, it's in-zone.
    exact = await _db.warehouses.find_one(
        {"pincode": pincode, "is_active": {"$ne": False}},
        {"_id": 0, "id": 1, "name": 1, "service_radius_km": 1, "phone": 1},
    )
    if exact:
        return {
            "instant_available": True,
            "delivery_type": "instant",
            "in_zone": True,
            "reason": "exact_pincode_match",
            "nearest_warehouse": {"id": exact["id"], "name": exact["name"], "distance_km": 0,
                                  "service_radius_km": exact.get("service_radius_km"),
                                  "phone": exact.get("phone")},
            "assigned_warehouse_id": exact["id"],
            "warehouses_covering": [{"id": exact["id"], "name": exact["name"], "distance_km": 0}],
        }
    # Otherwise resolve pincode → coords and re-use the haversine coverage path
    coords = await _pincode_to_coords(pincode)
    if not coords:
        return {
            "instant_available": False,
            "delivery_type": "standard",
            "in_zone": False,
            "reason": "pincode_unresolved",
            "nearest_warehouse": None,
            "assigned_warehouse_id": None,
            "warehouses_covering": [],
        }
    lat, lng = coords
    docs = await _db.warehouses.find({"is_active": {"$ne": False}}, {"_id": 0}).to_list(200)
    scored = []
    for w in docs:
        wlat, wlng = w.get("lat"), w.get("lng")
        if wlat is None or wlng is None:
            continue
        d = _haversine_km(lat, lng, float(wlat), float(wlng))
        scored.append({**w, "distance_km": round(d, 2)})
    scored.sort(key=lambda x: x["distance_km"])
    covering = [w for w in scored if w["distance_km"] <= float(w.get("service_radius_km") or 15)]
    nearest = scored[0] if scored else None
    instant = bool(covering)
    return {
        "instant_available": instant,
        "delivery_type": "instant" if instant else "standard",
        "in_zone": instant,
        "reason": "haversine_match" if instant else "outside_service_radius",
        "nearest_warehouse": {
            "id": nearest["id"], "name": nearest["name"],
            "distance_km": nearest["distance_km"],
            "service_radius_km": nearest.get("service_radius_km"),
            "phone": nearest.get("phone"),
        } if nearest else None,
        "assigned_warehouse_id": covering[0]["id"] if covering else None,
        "warehouses_covering": [{"id": w["id"], "name": w["name"], "distance_km": w["distance_km"]} for w in covering],
    }


# ---------------------------------------------------------------------------
# Distance-Matrix proxy — real ETA from Google
# ---------------------------------------------------------------------------
@router.get("/delivery/eta")
async def delivery_eta(
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    dest_lat: float = Query(...),
    dest_lng: float = Query(...),
):
    """Real driving-time ETA via Google Distance Matrix (server-side call so the
    key never leaves the backend)."""
    key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
    if not key:
        raise HTTPException(500, "Google Maps API key not configured on server")
    url = "https://maps.googleapis.com/maps/api/distancematrix/json"
    params = {
        "origins": f"{origin_lat},{origin_lng}",
        "destinations": f"{dest_lat},{dest_lng}",
        "mode": "driving",
        "key": key,
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        r = await client.get(url, params=params)
        data = r.json()
    try:
        el = data["rows"][0]["elements"][0]
        if el.get("status") != "OK":
            return {"ok": False, "reason": el.get("status")}
        return {
            "ok": True,
            "distance_km": round(el["distance"]["value"] / 1000, 2),
            "duration_min": round(el["duration"]["value"] / 60),
            "duration_text": el["duration"]["text"],
        }
    except (KeyError, IndexError):
        return {"ok": False, "reason": "Malformed response"}
