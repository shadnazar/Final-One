"""
Blog Model - MongoDB schema for blog posts
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone


class BlogFAQ(BaseModel):
    question: str
    answer: str


class BlogSections(BaseModel):
    introduction: Optional[str] = None
    problem: Optional[str] = None
    causes: Optional[str] = None
    solutions: Optional[str] = None
    routine: Optional[str] = None
    ingredients: Optional[str] = None
    faqs: List[BlogFAQ] = []


class InternalLink(BaseModel):
    title: str
    url: str


class BlogCreate(BaseModel):
    title: str
    content: str
    meta_description: Optional[str] = None
    keywords: List[str] = []
    status: str = "published"


class Blog(BaseModel):
    id: Optional[str] = None
    title: str
    slug: str
    meta_description: Optional[str] = None
    content: str
    sections: Optional[BlogSections] = None
    keywords: List[str] = []
    related_products: List[str] = []
    internal_links: List[InternalLink] = []
    status: str = "published"
    view_count: int = 0
    generated_by: str = "AI"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def generate_slug(title: str) -> str:
    """Generate URL-friendly slug from title"""
    import re
    slug = title.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = re.sub(r'^-|-$', '', slug)
    return slug


def blog_to_dict(blog: Blog) -> dict:
    """Convert Blog model to dictionary for MongoDB"""
    data = blog.model_dump()
    data['created_at'] = data['created_at'].isoformat()
    data['updated_at'] = data['updated_at'].isoformat()
    return data


def dict_to_blog(data: dict) -> Blog:
    """Convert MongoDB document to Blog model"""
    if isinstance(data.get('created_at'), str):
        data['created_at'] = datetime.fromisoformat(data['created_at'])
    if isinstance(data.get('updated_at'), str):
        data['updated_at'] = datetime.fromisoformat(data['updated_at'])
    return Blog(**data)
