"""
Landing Page Routes
API endpoints for managing problem-specific landing pages
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import List, Optional
import os

from models.landing_page import LandingPageCreate, LandingPageContent
from services.landing_page_service import LandingPageService

router = APIRouter(prefix="/landing-pages", tags=["Landing Pages"])

# Will be set by server.py
landing_page_service: LandingPageService = None
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'celestaglow2024')

# Reference to admin_sessions and employee_sessions from server.py
admin_sessions = {}
employee_sessions = {}

def set_landing_page_service(service: LandingPageService):
    global landing_page_service
    landing_page_service = service

def set_admin_sessions(sessions_dict):
    """Set reference to admin_sessions from server.py"""
    global admin_sessions
    admin_sessions = sessions_dict

def set_employee_sessions(sessions_dict):
    """Set reference to employee_sessions from server.py"""
    global employee_sessions
    employee_sessions = sessions_dict

def verify_admin_or_employee(
    x_admin_token: str = Header(None, alias="X-Admin-Token"),
    x_employee_token: str = Header(None, alias="X-Employee-Token")
):
    """Verify admin token or employee token with landing_pages permission"""
    from datetime import datetime, timezone
    import hashlib
    from services.admin_auth import get_cached_active_admin_hash

    # Check admin token first
    if x_admin_token:
        # Check if it's a valid session token
        if x_admin_token in admin_sessions:
            session = admin_sessions[x_admin_token]
            expires_at = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) < expires_at:
                return {"type": "admin"}
            else:
                del admin_sessions[x_admin_token]

        # Check if it's the *active* admin password (env-seed inert after change)
        token_hash = hashlib.sha256(x_admin_token.encode()).hexdigest()
        if token_hash == get_cached_active_admin_hash():
            return {"type": "admin"}

    # Check employee token
    if x_employee_token:
        if x_employee_token in employee_sessions:
            session = employee_sessions[x_employee_token]
            if session["permissions"].get("landing_pages"):
                return {"type": "employee", "permissions": session["permissions"]}
            else:
                raise HTTPException(status_code=403, detail="No permission to view landing pages")

    raise HTTPException(status_code=403, detail="Admin or employee token required")

def verify_admin(x_admin_token: str = Header(None, alias="X-Admin-Token")):
    """Verify admin token - checks session tokens and the *active* admin password.

    Once a custom admin password is saved, the env-seed value is no longer
    accepted (security fix).
    """
    from datetime import datetime, timezone
    import hashlib
    from services.admin_auth import get_cached_active_admin_hash

    if not x_admin_token:
        raise HTTPException(status_code=403, detail="Admin token required")

    # First check if it's a valid session token
    if x_admin_token in admin_sessions:
        session = admin_sessions[x_admin_token]
        expires_at = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) < expires_at:
            return True
        else:
            # Remove expired session
            del admin_sessions[x_admin_token]

    # Check if it matches the active admin hash
    token_hash = hashlib.sha256(x_admin_token.encode()).hexdigest()
    if token_hash == get_cached_active_admin_hash():
        return True

    raise HTTPException(status_code=403, detail="Invalid admin token")

# ==================
# PUBLIC ROUTES
# ==================

@router.get("/public/{slug}")
async def get_public_landing_page(slug: str):
    """Get a landing page by slug (public access)"""
    page = await landing_page_service.get_landing_page_by_slug(slug)
    if not page:
        raise HTTPException(status_code=404, detail="Landing page not found")
    return page

# ==================
# ADMIN ROUTES
# ==================

@router.get("/admin/all")
async def get_all_landing_pages(
    include_inactive: bool = False,
    auth: dict = Depends(verify_admin_or_employee)
):
    """Get all landing pages (admin or employee with permission)"""
    return await landing_page_service.get_all_landing_pages(include_inactive)

@router.get("/admin/predefined")
async def get_predefined_problems(admin: bool = Depends(verify_admin)):
    """Get all predefined problems by category"""
    return landing_page_service.get_predefined_problems()

@router.get("/admin/analytics")
async def get_landing_page_analytics(admin: bool = Depends(verify_admin)):
    """Get analytics for all landing pages"""
    return await landing_page_service.get_analytics()

@router.get("/admin/{page_id}")
async def get_landing_page_by_id(
    page_id: str,
    admin: bool = Depends(verify_admin)
):
    """Get a specific landing page by ID"""
    page = await landing_page_service.get_landing_page_by_id(page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Landing page not found")
    return page

@router.post("/admin/create")
async def create_landing_page(
    data: LandingPageCreate,
    admin: bool = Depends(verify_admin)
):
    """Create a new landing page"""
    try:
        return await landing_page_service.create_landing_page(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/admin/bulk-create")
async def bulk_create_landing_pages(
    categories: List[str] = None,
    admin: bool = Depends(verify_admin)
):
    """Bulk create landing pages from predefined problems"""
    return await landing_page_service.bulk_create_from_predefined(categories)

@router.put("/admin/{page_id}")
async def update_landing_page(
    page_id: str,
    data: dict,
    admin: bool = Depends(verify_admin)
):
    """Update a landing page"""
    result = await landing_page_service.update_landing_page(page_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Landing page not found")
    return result

@router.delete("/admin/{page_id}")
async def delete_landing_page(
    page_id: str,
    admin: bool = Depends(verify_admin)
):
    """Delete a landing page"""
    success = await landing_page_service.delete_landing_page(page_id)
    if not success:
        raise HTTPException(status_code=404, detail="Landing page not found")
    return {"success": True, "message": "Landing page deleted"}

@router.post("/admin/{page_id}/toggle")
async def toggle_landing_page(
    page_id: str,
    admin: bool = Depends(verify_admin)
):
    """Toggle landing page active status"""
    page = await landing_page_service.get_landing_page_by_id(page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Landing page not found")
    
    new_status = not page.get("is_active", True)
    await landing_page_service.update_landing_page(page_id, {"is_active": new_status})
    return {"success": True, "is_active": new_status}

@router.post("/track-conversion/{slug}")
async def track_conversion(slug: str):
    """Track a conversion from a landing page"""
    success = await landing_page_service.record_conversion(slug)
    return {"success": success}

@router.post("/public/{slug}/convert")
async def track_public_conversion(slug: str):
    """Track a conversion from a landing page (public endpoint)"""
    success = await landing_page_service.record_conversion(slug)
    return {"success": success}


@router.post("/admin/{page_id}/regenerate")
async def regenerate_landing_page_content(
    page_id: str,
    admin: bool = Depends(verify_admin)
):
    """Regenerate content for an existing landing page with updated formatting"""
    page = await landing_page_service.get_landing_page_by_id(page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Landing page not found")
    
    # Regenerate content using the current problem_title and category
    new_content = landing_page_service._generate_default_content(
        page.get("problem_title", ""),
        page.get("category", "early_aging")
    )
    
    # Update the page with new content
    result = await landing_page_service.update_landing_page(page_id, {"content": new_content})
    return {"success": True, "message": "Content regenerated", "content": new_content}

@router.post("/admin/regenerate-all")
async def regenerate_all_landing_pages(
    admin: bool = Depends(verify_admin)
):
    """Regenerate content for ALL landing pages with updated formatting"""
    pages = await landing_page_service.get_all_landing_pages(include_inactive=True)
    updated_count = 0
    
    for page in pages:
        # The service converts _id to id already
        page_id = page.get("id")
        if not page_id:
            continue
            
        # Regenerate content using the current problem_title and category
        new_content = landing_page_service._generate_default_content(
            page.get("problem_title", ""),
            page.get("category", "early_aging")
        )
        
        # Update the page with new content
        await landing_page_service.update_landing_page(page_id, {"content": new_content})
        updated_count += 1
    
    return {"success": True, "message": f"Regenerated content for {updated_count} landing pages"}
