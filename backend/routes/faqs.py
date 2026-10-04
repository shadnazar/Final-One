"""FAQ routes — public read + admin force-refresh."""
from fastapi import APIRouter, HTTPException, Header, Query
from typing import Optional

router = APIRouter(prefix="/api/faqs", tags=["faqs"])

_faq_service = None
_admin_sessions = None


def set_faq_service(svc):
    global _faq_service
    _faq_service = svc


def set_admin_sessions(sessions):
    global _admin_sessions
    _admin_sessions = sessions


@router.get("/{niche}")
async def get_niche_faqs(niche: str):
    """Public: return cached or freshly-generated FAQs for a niche."""
    if _faq_service is None:
        raise HTTPException(status_code=503, detail="FAQ service not initialised")
    faqs = await _faq_service.get_faqs(niche)
    return {"niche": niche, "faqs": faqs, "count": len(faqs)}


@router.post("/{niche}/refresh")
async def refresh_niche_faqs(
    niche: str,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
):
    """Admin: force regenerate FAQs from AI (bypasses 7-day cache)."""
    if _faq_service is None:
        raise HTTPException(status_code=503, detail="FAQ service not initialised")
    # Centralised admin check — uses active-hash cache so env-seed becomes
    # inert once a custom admin password is saved (security fix).
    import hashlib
    from services.admin_auth import get_cached_active_admin_hash
    valid = False
    if x_admin_token:
        if _admin_sessions and x_admin_token in _admin_sessions:
            valid = True
        elif hashlib.sha256(x_admin_token.encode()).hexdigest() == get_cached_active_admin_hash():
            valid = True
    if not valid:
        raise HTTPException(status_code=401, detail="Admin authentication required")
    faqs = await _faq_service.get_faqs(niche, force_refresh=True)
    return {"niche": niche, "faqs": faqs, "count": len(faqs), "refreshed": True}
