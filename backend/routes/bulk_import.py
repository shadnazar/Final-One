"""Bulk product import API routes — admin-only.

Endpoints:
  POST   /api/admin/bulk-import/upload        Upload xlsx, create job (queued)
  POST   /api/admin/bulk-import/{job}/start   Begin background processing
  POST   /api/admin/bulk-import/{job}/pause   Pause processing
  POST   /api/admin/bulk-import/{job}/resume  Resume a paused job
  POST   /api/admin/bulk-import/{job}/cancel  Cancel a job
  GET    /api/admin/bulk-import/{job}         Get job + last 10 items (live progress)
  GET    /api/admin/bulk-import/jobs          List all jobs (no items)
  DELETE /api/admin/bulk-import/{job}         Delete a job (does not delete imported products)
"""
from __future__ import annotations
from fastapi import APIRouter, UploadFile, File, Header, HTTPException, Cookie

router = APIRouter(prefix="/api/admin/bulk-import", tags=["bulk-import"])

_service = None  # injected from server.py
_admin_sessions = None  # injected SessionStore
_verify_admin = None


def setup(service, admin_sessions, verify_admin_fn):
    global _service, _admin_sessions, _verify_admin
    _service = service
    _admin_sessions = admin_sessions
    _verify_admin = verify_admin_fn


def _auth(x_admin_token: str = None, admin_session: str = None):
    if _verify_admin is None:
        raise HTTPException(status_code=500, detail="auth not wired")
    _verify_admin(x_admin_token=x_admin_token, admin_session=admin_session)


@router.post("/upload")
async def upload_excel(
    file: UploadFile = File(...),
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    admin_session: str = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx / .xls supported")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    try:
        job = await _service.create_job(file.filename, content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse Excel: {e}")
    return {"success": True, "job": job}


@router.post("/{job_id}/start")
async def start_job(
    job_id: str,
    concurrency: int = 5,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    admin_session: str = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    ok = await _service.start_job(job_id, concurrency=concurrency)
    if not ok:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"success": True, "status": "running"}


@router.post("/{job_id}/pause")
async def pause_job(
    job_id: str,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    admin_session: str = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    ok = await _service.pause_job(job_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"success": True, "status": "paused"}


@router.post("/{job_id}/resume")
async def resume_job(
    job_id: str,
    concurrency: int = 5,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    admin_session: str = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    ok = await _service.start_job(job_id, concurrency=concurrency)
    if not ok:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"success": True, "status": "running"}


@router.post("/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    admin_session: str = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    ok = await _service.cancel_job(job_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"success": True, "status": "cancelled"}


@router.get("/jobs")
async def list_jobs(
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    admin_session: str = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    return {"jobs": await _service.list_jobs()}


@router.get("/{job_id}")
async def get_job(
    job_id: str,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    admin_session: str = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    job = await _service.get_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/refetch-images")
async def refetch_images_bulk(
    only_needs_image: bool = True,
    limit: int = 500,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    admin_session: str = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    return await _service.refetch_images_bulk(only_needs_image=only_needs_image, limit=limit)


@router.post("/refetch-image/{slug}")
async def refetch_image_single(
    slug: str,
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    admin_session: str = Cookie(None),
):
    _auth(x_admin_token, admin_session)
    return await _service.refetch_image(slug)


@router.get("/stats/image-coverage")
async def image_coverage_stats(
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    admin_session: str = Cookie(None),
):
    """Counts: how many imported products have verified brand images vs need manual upload."""
    _auth(x_admin_token, admin_session)
    db = _service.db
    total = await db.products.count_documents({"import_source": "bulk-excel"})
    verified = await db.products.count_documents({"import_source": "bulk-excel", "image_verified": True})
    needs = await db.products.count_documents({"import_source": "bulk-excel", "$or": [
        {"needs_image": True},
        {"image_source": {"$in": ["unsplash", "needs_manual", "none"]}},
    ]})
    by_source = await db.products.aggregate([
        {"$match": {"import_source": "bulk-excel"}},
        {"$group": {"_id": "$image_source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]).to_list(None)
    return {
        "total": total,
        "verified_brand_images": verified,
        "needs_manual_upload": needs,
        "by_source": [{"source": x["_id"] or "unknown", "count": x["count"]} for x in by_source],
    }
