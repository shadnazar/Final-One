"""
Location Model - MongoDB schema for location-based pages
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone


class LocationContent(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    climate: Optional[str] = None
    skin_issues: List[str] = []
    recommendations: Optional[str] = None


class LocationCreate(BaseModel):
    state: str
    city: Optional[str] = None


class Location(BaseModel):
    id: Optional[str] = None
    state: str
    city: Optional[str] = None
    slug: str
    content: Optional[LocationContent] = None
    view_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def generate_location_slug(state: str, city: Optional[str] = None) -> str:
    """Generate URL-friendly slug from location"""
    import re
    slug = state.lower()
    if city:
        slug = f"{city.lower()}-{slug}"
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = re.sub(r'^-|-$', '', slug)
    return slug


def location_to_dict(location: Location) -> dict:
    """Convert Location model to dictionary for MongoDB"""
    data = location.model_dump()
    data['created_at'] = data['created_at'].isoformat()
    data['updated_at'] = data['updated_at'].isoformat()
    return data


def dict_to_location(data: dict) -> Location:
    """Convert MongoDB document to Location model"""
    if isinstance(data.get('created_at'), str):
        data['created_at'] = datetime.fromisoformat(data['created_at'])
    if isinstance(data.get('updated_at'), str):
        data['updated_at'] = datetime.fromisoformat(data['updated_at'])
    return Location(**data)
