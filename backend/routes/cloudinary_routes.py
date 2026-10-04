"""
Cloudinary admin + upload endpoints.

Routes (all mounted under /api):
  GET  /admin/cloudinary/settings         -> returns saved cloud_name + api_key (secret masked)
  POST /admin/cloudinary/settings         -> saves cloud_name / api_key / api_secret
  POST /admin/cloudinary/upload           -> upload a single image (multipart/form-data, field=file, optional folder)
  POST /upload-image                      -> public alias used by routine + skin-consultation flows so users can
                                             attach photos directly to Cloudinary without an admin token.
                                             (Stored in folder=user-uploads to keep them isolated.)
"""
from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Form
from typing import Optional

from services import cloudinary_service

router = APIRouter()
db = None


def set_db(database):
    global db
    db = database


def _verify_admin(token: Optional[str]):
    """Reuse the products router's verify_auth for consistency."""
    from routes import products
    products.verify_auth(x_admin_token=token)


@router.get("/admin/cloudinary/settings")
async def get_cloudinary_settings(x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token")):
    _verify_admin(x_admin_token)
    creds = await cloudinary_service.get_cloudinary_credentials(db)
    api_secret = creds.get("api_secret") or ""
    return {
        "cloud_name": creds.get("cloud_name") or "",
        "api_key": creds.get("api_key") or "",
        # Never reveal full secret — show last 4 chars only
        "api_secret_masked": ("•" * max(0, len(api_secret) - 4) + api_secret[-4:]) if api_secret else "",
        "configured": cloudinary_service.is_configured(),
        "loaded_from": creds.get("loaded_from"),
    }


@router.post("/admin/cloudinary/settings")
async def save_cloudinary_settings(
    payload: dict,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    _verify_admin(x_admin_token)
    cloud_name = (payload.get("cloud_name") or "").strip()
    api_key = (payload.get("api_key") or "").strip()
    api_secret = (payload.get("api_secret") or "").strip()
    if not cloud_name or not api_key or not api_secret:
        raise HTTPException(status_code=400, detail="cloud_name, api_key and api_secret are all required")
    return await cloudinary_service.save_cloudinary_credentials(db, cloud_name, api_key, api_secret)


@router.post("/admin/cloudinary/upload")
async def admin_upload_image(
    file: UploadFile = File(...),
    folder: str = Form("celesta-glow"),
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
):
    _verify_admin(x_admin_token)
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")
    try:
        return await cloudinary_service.upload_image(db, contents, folder=folder)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Cloudinary upload failed: {exc}")


@router.post("/upload-image")
async def public_upload_image(
    file: UploadFile = File(...),
    folder: str = Form("user-uploads"),
):
    """Public upload used by Routine builder + Skin consultation photo flows.
    Falls back gracefully if Cloudinary isn't configured yet — returns 503 so the
    UI can show a friendly message instead of a hard crash.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")
    if not await cloudinary_service.ensure_configured(db):
        raise HTTPException(status_code=503, detail="Image hosting not configured yet. Please try again later.")
    # Sandbox public uploads to a single folder so admin can audit them
    safe_folder = "user-uploads"
    if folder in {"user-uploads/routine", "user-uploads/skin-consultation"}:
        safe_folder = folder
    try:
        return await cloudinary_service.upload_image(db, contents, folder=safe_folder)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upload failed: {exc}")
