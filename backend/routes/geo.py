"""Google Maps proxy (Feb-2026).

Browser calls to Google Places/Geocoding APIs blow up with CORS errors
(the JS APIs need to be loaded from Google's own CDN, and the REST APIs
don't send CORS headers). We proxy from FastAPI so:
  1. The API key never leaks to the browser.
  2. Referrer restrictions on the key don't block us.
  3. We can lightly cache & rate-limit later.
"""
from __future__ import annotations
import os
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/geo", tags=["geo"])


def _get_key() -> str:
    # Read at call-time — the module is imported before load_dotenv() runs.
    return os.environ.get("GOOGLE_MAPS_API_KEY", "")


def _require_key() -> str:
    key = _get_key()
    if not key:
        raise HTTPException(500, "Google Maps API key not configured on server")
    return key


@router.get("/autocomplete")
async def autocomplete(
    q: str = Query(..., min_length=2, description="User's typed query"),
    country: str = Query("in", description="ISO country code"),
):
    """Places Autocomplete → suggestion list for the location modal."""
    key = _require_key()
    url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
    params = {
        "input": q,
        "components": f"country:{country}",
        "types": "geocode",
        "key": key,
    }
    async with httpx.AsyncClient(timeout=8.0) as client:
        r = await client.get(url, params=params)
        data = r.json()
    preds = data.get("predictions") or []
    return {
        "status": data.get("status"),
        "predictions": [
            {
                "place_id": p.get("place_id"),
                "description": p.get("description"),
                "main_text": (p.get("structured_formatting") or {}).get("main_text"),
                "secondary_text": (p.get("structured_formatting") or {}).get("secondary_text"),
            }
            for p in preds
        ],
    }


@router.get("/place-details")
async def place_details(place_id: str = Query(...)):
    """Resolve a place_id → coordinates + a full formatted address."""
    key = _require_key()
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {"place_id": place_id, "fields": "geometry,formatted_address,address_component", "key": key}
    async with httpx.AsyncClient(timeout=8.0) as client:
        r = await client.get(url, params=params)
        data = r.json()
    result = data.get("result") or {}
    geom = (result.get("geometry") or {}).get("location") or {}
    return _shape_geocode(geom.get("lat"), geom.get("lng"), result.get("address_components") or [], result.get("formatted_address"))


@router.get("/reverse-geocode")
async def reverse_geocode(lat: float, lng: float):
    """Coordinates → human-readable address (used by 'Use my current location')."""
    key = _require_key()
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"latlng": f"{lat},{lng}", "key": key}
    async with httpx.AsyncClient(timeout=8.0) as client:
        r = await client.get(url, params=params)
        data = r.json()
    results = data.get("results") or []
    if not results:
        raise HTTPException(404, "No address found for these coordinates")
    first = results[0]
    return _shape_geocode(lat, lng, first.get("address_components") or [], first.get("formatted_address"))


def _shape_geocode(lat: Optional[float], lng: Optional[float], comps, formatted: Optional[str]):
    """Normalize the messy address_components array into flat fields we render."""
    def grab(types):
        for c in comps:
            if any(t in (c.get("types") or []) for t in types):
                return c.get("long_name")
        return ""

    return {
        "lat": lat,
        "lng": lng,
        "formatted": formatted,
        "locality": grab(["sublocality_level_1", "sublocality", "neighborhood"]) or grab(["locality"]),
        "city": grab(["locality"]) or grab(["administrative_area_level_2"]),
        "district": grab(["administrative_area_level_2"]),
        "state": grab(["administrative_area_level_1"]),
        "pincode": grab(["postal_code"]),
    }
