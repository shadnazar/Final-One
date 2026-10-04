"""
Landing Page Models
Stores problem-specific landing page configurations
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

class LandingPageContent(BaseModel):
    """Content for a problem-specific landing page"""
    # Hero Section
    hero_headline: str = ""
    hero_subheadline: str = ""
    hero_problem_statement: str = ""
    
    # Dynamic Product Details (generated based on problem)
    product_name: str = "Celesta Glow Anti-Aging Serum"
    product_tagline: str = "4-in-1 Advanced Formula"
    product_description: str = ""
    
    # Problem Section
    problem_title: str = ""
    problem_points: List[str] = []
    
    # Solution Section
    solution_title: str = ""
    solution_description: str = ""
    solution_benefits: List[str] = []
    
    # Testimonials (optional override)
    testimonials: List[dict] = []
    
    # CTA Text
    cta_primary: str = "Get Your Solution Now"
    cta_secondary: str = "Start Your Transformation"
    
    # SEO
    meta_title: str = ""
    meta_description: str = ""
    meta_keywords: List[str] = []

class LandingPageCreate(BaseModel):
    """Create a new landing page"""
    problem_title: str = Field(..., description="The problem/concern title")
    problem_slug: str = Field(..., description="URL slug for the landing page")
    category: str = Field(..., description="Category: early_aging, wrinkles, under_eye, dry_skin, lifestyle, preventive, results, psychological")
    content: Optional[LandingPageContent] = None
    is_active: bool = True
    
class LandingPageUpdate(BaseModel):
    """Update an existing landing page"""
    problem_title: Optional[str] = None
    content: Optional[LandingPageContent] = None
    is_active: Optional[bool] = None

class LandingPageInDB(BaseModel):
    """Landing page as stored in database"""
    id: str
    problem_title: str
    problem_slug: str
    category: str
    content: LandingPageContent
    is_active: bool
    created_at: datetime
    updated_at: datetime
    views: int = 0
    conversions: int = 0
    
    class Config:
        json_encoders = {
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }

# Predefined categories with their problems
LANDING_PAGE_PROBLEMS = {
    "early_aging": [
        {"title": "Why Do You Look Older Than Your Age in Your 20s?", "slug": "look-older-than-age-20s"},
        {"title": "Aging Faster Than Your Friends? Here's Why", "slug": "aging-faster-than-friends"},
        {"title": "First Signs of Aging at 25? Fix It Before 30", "slug": "signs-aging-at-25"},
        {"title": "Stop Early Aging Before It Becomes Permanent", "slug": "stop-early-aging"},
    ],
    "wrinkles": [
        {"title": "Forehead Wrinkles at 25? Remove Them Before They Stay", "slug": "forehead-wrinkles-25"},
        {"title": "Fine Lines Turning Into Wrinkles? Stop It Now", "slug": "fine-lines-to-wrinkles"},
        {"title": "Wrinkles Starting Early? Reverse Them Fast", "slug": "reverse-early-wrinkles"},
        {"title": "Why Your Wrinkles Are Appearing Too Early", "slug": "wrinkles-appearing-early"},
    ],
    "under_eye": [
        {"title": "Why Your Face Looks Tired and Older Every Day", "slug": "tired-older-face"},
        {"title": "Fix Under-Eye Hollows That Add Years to Your Face", "slug": "under-eye-hollows"},
        {"title": "Dark Circles Are Making You Look Older — Fix Them", "slug": "dark-circles-older"},
        {"title": "Tired Face Even After Sleep? Here's the Real Reason", "slug": "tired-face-after-sleep"},
    ],
    "dry_skin": [
        {"title": "Dry Skin Is Making You Look Older Than You Are", "slug": "dry-skin-aging"},
        {"title": "Dull Skin = Early Aging (Here's How to Fix It)", "slug": "dull-skin-early-aging"},
        {"title": "Your Skin Lost Glow? That's Aging Starting", "slug": "lost-glow-aging"},
        {"title": "Dehydrated Skin Is Causing Fine Lines — Not Age", "slug": "dehydrated-skin-fine-lines"},
    ],
    "lifestyle": [
        {"title": "Stress Is Aging Your Face Faster Than Time", "slug": "stress-aging-face"},
        {"title": "Lack of Sleep Is Making You Look Older Daily", "slug": "lack-sleep-aging"},
        {"title": "Screen Time Is Quietly Aging Your Skin", "slug": "screen-time-aging"},
        {"title": "Sun Exposure Is Aging You Faster Than You Think", "slug": "sun-exposure-aging"},
    ],
    "preventive": [
        {"title": "Start Anti-Aging Before 30 — Or Regret Later", "slug": "anti-aging-before-30"},
        {"title": "Prevent Aging Before It Starts (Most People Don't)", "slug": "prevent-aging-early"},
        {"title": "Don't Wait for Wrinkles — Stop Aging Early", "slug": "dont-wait-wrinkles"},
        {"title": "Early Prevention Is the Only Real Anti-Aging", "slug": "early-prevention-anti-aging"},
    ],
    "results": [
        {"title": "Reduce Wrinkles in 14 Days — Visible Change", "slug": "reduce-wrinkles-14-days"},
        {"title": "Look Younger in 7 Days — Start Today", "slug": "look-younger-7-days"},
        {"title": "Reverse Early Aging Before It Gets Worse", "slug": "reverse-early-aging"},
        {"title": "See Younger Skin in Just 2 Weeks", "slug": "younger-skin-2-weeks"},
    ],
    "psychological": [
        {"title": "People Think You're Older Than You Are?", "slug": "people-think-older"},
        {"title": "Why Do You Always Look Older in Photos?", "slug": "look-older-photos"},
        {"title": "Your Face Is Aging Faster Than Your Age", "slug": "face-aging-faster"},
        {"title": "You Look Older — Here's the Real Reason", "slug": "look-older-real-reason"},
    ],
}

# Category display names
CATEGORY_NAMES = {
    "early_aging": "Early Aging",
    "wrinkles": "Wrinkles",
    "under_eye": "Under-Eye / Tired Look",
    "dry_skin": "Dry / Dull Skin",
    "lifestyle": "Lifestyle Aging",
    "preventive": "Preventive Aging",
    "results": "Speed / Results",
    "psychological": "Psychological Triggers",
}
