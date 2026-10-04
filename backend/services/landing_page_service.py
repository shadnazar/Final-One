"""
Landing Page Service
Handles CRUD operations and AI content generation for problem-specific landing pages
"""
import os
from datetime import datetime, timezone
from typing import List, Optional, Dict
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from models.landing_page import (
    LandingPageContent, LandingPageCreate, LandingPageInDB,
    LANDING_PAGE_PROBLEMS, CATEGORY_NAMES
)

class LandingPageService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.landing_pages
        
    async def get_all_landing_pages(self, include_inactive: bool = False) -> List[dict]:
        """Get all landing pages"""
        query = {} if include_inactive else {"is_active": True}
        cursor = self.collection.find(query).sort("created_at", -1)
        pages = []
        async for page in cursor:
            page["id"] = str(page["_id"])
            del page["_id"]
            pages.append(page)
        return pages
    
    async def get_landing_page_by_slug(self, slug: str) -> Optional[dict]:
        """Get a landing page by its URL slug"""
        page = await self.collection.find_one({"problem_slug": slug, "is_active": True})
        if page:
            page["id"] = str(page["_id"])
            del page["_id"]
            # Increment view count
            await self.collection.update_one(
                {"problem_slug": slug},
                {"$inc": {"views": 1}}
            )
        return page
    
    async def get_landing_page_by_id(self, page_id: str) -> Optional[dict]:
        """Get a landing page by ID"""
        try:
            page = await self.collection.find_one({"_id": ObjectId(page_id)})
            if page:
                page["id"] = str(page["_id"])
                del page["_id"]
            return page
        except Exception:
            return None
    
    async def create_landing_page(self, data: LandingPageCreate) -> dict:
        """Create a new landing page"""
        # Check if slug already exists
        existing = await self.collection.find_one({"problem_slug": data.problem_slug})
        if existing:
            raise ValueError(f"Landing page with slug '{data.problem_slug}' already exists")
        
        # Generate default content if not provided
        content = data.content or self._generate_default_content(data.problem_title, data.category)
        
        doc = {
            "problem_title": data.problem_title,
            "problem_slug": data.problem_slug,
            "category": data.category,
            "content": content.dict() if hasattr(content, 'dict') else content,
            "is_active": data.is_active,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "views": 0,
            "conversions": 0
        }
        
        result = await self.collection.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        if "_id" in doc:
            del doc["_id"]
        return doc
    
    async def update_landing_page(self, page_id: str, data: dict) -> Optional[dict]:
        """Update a landing page"""
        try:
            update_data = {k: v for k, v in data.items() if v is not None}
            update_data["updated_at"] = datetime.now(timezone.utc)
            
            result = await self.collection.find_one_and_update(
                {"_id": ObjectId(page_id)},
                {"$set": update_data},
                return_document=True
            )
            if result:
                result["id"] = str(result["_id"])
                del result["_id"]
            return result
        except Exception:
            return None
    
    async def delete_landing_page(self, page_id: str) -> bool:
        """Delete a landing page"""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(page_id)})
            return result.deleted_count > 0
        except Exception:
            return False
    
    async def record_conversion(self, slug: str) -> bool:
        """Record a conversion (purchase) from a landing page"""
        result = await self.collection.update_one(
            {"problem_slug": slug},
            {"$inc": {"conversions": 1}}
        )
        return result.modified_count > 0
    
    async def get_analytics(self) -> dict:
        """Get analytics for all landing pages"""
        pipeline = [
            {
                "$group": {
                    "_id": "$category",
                    "total_views": {"$sum": "$views"},
                    "total_conversions": {"$sum": "$conversions"},
                    "pages_count": {"$sum": 1}
                }
            }
        ]
        
        results = {}
        async for item in self.collection.aggregate(pipeline):
            category = item["_id"]
            results[category] = {
                "name": CATEGORY_NAMES.get(category, category),
                "views": item["total_views"],
                "conversions": item["total_conversions"],
                "pages": item["pages_count"],
                "conversion_rate": round((item["total_conversions"] / item["total_views"] * 100), 2) if item["total_views"] > 0 else 0
            }
        
        # Get top performing pages
        top_pages = await self.collection.find(
            {"views": {"$gt": 0}}
        ).sort("conversions", -1).limit(10).to_list(10)
        
        for page in top_pages:
            page["id"] = str(page["_id"])
            del page["_id"]
        
        return {
            "by_category": results,
            "top_pages": top_pages,
            "total_pages": await self.collection.count_documents({})
        }
    
    async def bulk_create_from_predefined(self, categories: List[str] = None) -> dict:
        """Bulk create landing pages from predefined problems"""
        categories = categories or list(LANDING_PAGE_PROBLEMS.keys())
        created = []
        skipped = []
        
        for category in categories:
            if category not in LANDING_PAGE_PROBLEMS:
                continue
                
            for problem in LANDING_PAGE_PROBLEMS[category]:
                # Check if already exists
                existing = await self.collection.find_one({"problem_slug": problem["slug"]})
                if existing:
                    skipped.append(problem["slug"])
                    continue
                
                try:
                    data = LandingPageCreate(
                        problem_title=problem["title"],
                        problem_slug=problem["slug"],
                        category=category,
                        is_active=True
                    )
                    await self.create_landing_page(data)
                    created.append(problem["slug"])
                except Exception as e:
                    skipped.append(f"{problem['slug']} (error: {str(e)})")
        
        return {
            "created": len(created),
            "skipped": len(skipped),
            "created_slugs": created,
            "skipped_slugs": skipped
        }
    
    def _generate_dynamic_product_name(self, problem_title: str, category: str) -> dict:
        """Generate a professional product name and tagline based on the problem category"""
        # Map categories to professional skincare product naming - ALL include "Anti-Aging"
        product_name_map = {
            "early_aging": {
                "name": "Celesta Glow Youth Revival Serum",
                "tagline": "Advanced Anti-Aging Formula",
                "description": "Specifically formulated to combat early signs of aging with powerful youth-preserving ingredients."
            },
            "wrinkles": {
                "name": "Celesta Glow Wrinkle Repair Serum",
                "tagline": "Deep Anti-Aging Correction Complex",
                "description": "Targets and reduces the appearance of fine lines and wrinkles with clinical-strength retinol."
            },
            "under_eye": {
                "name": "Celesta Glow Eye Revitalizer Serum",
                "tagline": "Anti-Aging Eye Rescue Formula",
                "description": "Specially designed to brighten dark circles, reduce puffiness, and refresh tired-looking eyes."
            },
            "dry_skin": {
                "name": "Celesta Glow Hydra-Glow Serum",
                "tagline": "Anti-Aging Moisture Lock Technology",
                "description": "Deep hydration serum that restores your skin's natural radiance and healthy glow."
            },
            "lifestyle": {
                "name": "Celesta Glow Urban Shield Serum",
                "tagline": "Anti-Aging Lifestyle Defense",
                "description": "Protects your skin from stress, pollution, and screen damage while reversing lifestyle-induced aging."
            },
            "preventive": {
                "name": "Celesta Glow Prevention Serum",
                "tagline": "Early Action Anti-Aging Formula",
                "description": "Start your anti-aging journey early with this proactive defense formula for lasting youth."
            },
            "results": {
                "name": "Celesta Glow Fast-Action Serum",
                "tagline": "Anti-Aging Results in 14 Days",
                "description": "Our most powerful formula for those who want to see dramatic results quickly."
            },
            "psychological": {
                "name": "Celesta Glow Confidence Serum",
                "tagline": "Anti-Aging for Confidence",
                "description": "Transform how you look and feel with our premium age-reversing formula."
            }
        }
        
        # Get the product details for this category
        product_details = product_name_map.get(category, {
            "name": "Celesta Glow Anti-Aging Serum",
            "tagline": "4-in-1 Advanced Formula",
            "description": "Premium anti-aging serum with clinically proven ingredients."
        })
        
        return product_details
    
    def _generate_hero_problem_statement(self, problem_title: str, category: str) -> str:
        """Generate a grammatically correct hero problem statement based on the category"""
        # Create proper, grammatically correct problem statements
        problem_statement_map = {
            "early_aging": "If you're noticing early signs of aging appearing sooner than expected, you're not alone",
            "wrinkles": "If fine lines and wrinkles are becoming more visible, you're not alone",
            "under_eye": "If dark circles and tired eyes are making you look older, you're not alone",
            "dry_skin": "If your skin feels dry, dull, and has lost its natural glow, you're not alone",
            "lifestyle": "If your busy lifestyle is taking a toll on your skin, you're not alone",
            "preventive": "If you want to prevent aging before it becomes visible, you're making the right choice",
            "results": "If you want visible anti-aging results fast, you've come to the right place",
            "psychological": "If people think you look older than your actual age, you're not alone"
        }
        
        return problem_statement_map.get(category, f"If you're dealing with {problem_title.lower().replace('?', '')}, you're not alone")
    
    def _generate_default_content(self, problem_title: str, category: str) -> dict:
        """Generate default content based on problem title"""
        # Get dynamic product details
        product_details = self._generate_dynamic_product_name(problem_title, category)
        
        # Default problem points based on category
        problem_points_map = {
            "early_aging": [
                "Fine lines appearing around eyes and forehead",
                "Skin losing its natural bounce and firmness",
                "Uneven skin tone and dullness",
                "Collagen breakdown starting earlier than expected"
            ],
            "wrinkles": [
                "Deep lines forming on forehead and around mouth",
                "Crow's feet becoming more prominent",
                "Expression lines staying even when relaxed",
                "Skin texture becoming rougher"
            ],
            "under_eye": [
                "Dark circles that makeup can't hide",
                "Puffiness that makes you look tired",
                "Hollow under-eye area adding years",
                "Fine lines around the eye area"
            ],
            "dry_skin": [
                "Skin feeling tight and uncomfortable",
                "Flaky patches appearing on face",
                "Makeup not sitting well on skin",
                "Loss of natural radiance and glow"
            ],
            "lifestyle": [
                "Visible effects of daily stress on skin",
                "Premature aging from environmental factors",
                "Skin looking tired despite rest",
                "Accelerated aging from modern lifestyle"
            ],
            "preventive": [
                "Early signs that need immediate attention",
                "Prevention is easier than correction",
                "Small changes can make big difference",
                "Acting now saves years of aging later"
            ],
            "results": [
                "Fast-acting formula for visible results",
                "Clinically proven ingredients",
                "See transformation in weeks, not months",
                "Real results from real customers"
            ],
            "psychological": [
                "First impressions matter more than we think",
                "Confidence affected by how we look",
                "Social situations becoming uncomfortable",
                "Photos revealing what mirrors hide"
            ]
        }
        
        # Dynamic solution benefits based on category
        solution_benefits_map = {
            "early_aging": [
                "Reverses early aging signs visibly",
                "Boosts collagen production naturally",
                "Restores youthful skin bounce",
                "Clinically proven age-defense formula",
                "Safe for all Indian skin types",
                "Results visible in 2-3 weeks"
            ],
            "wrinkles": [
                "Reduces fine lines and wrinkles by up to 40%",
                "Fills and smooths deep wrinkles",
                "Prevents new wrinkle formation",
                "Retinol-powered correction formula",
                "Gentle yet effective for daily use",
                "See smoother skin in 14 days"
            ],
            "under_eye": [
                "Brightens dark circles visibly",
                "Reduces under-eye puffiness",
                "Firms hollow under-eye area",
                "Specialized eye-area formula",
                "Safe for sensitive eye region",
                "Wake up looking refreshed"
            ],
            "dry_skin": [
                "Deep hydration that lasts 48 hours",
                "Restores skin's natural glow",
                "Locks in moisture at cellular level",
                "Hyaluronic Acid powered formula",
                "No more flaky or tight skin",
                "See radiant skin in 1 week"
            ],
            "lifestyle": [
                "Shields against stress damage",
                "Reverses screen-time aging",
                "Repairs environmental damage",
                "Urban protection formula",
                "Perfect for busy lifestyles",
                "Combat modern-day aging"
            ],
            "preventive": [
                "Prevents aging before it starts",
                "Builds long-term skin resilience",
                "Preserves youthful collagen",
                "Early-action defense system",
                "Investment in future skin health",
                "Stay ahead of aging"
            ],
            "results": [
                "Visible results in just 14 days",
                "Clinically proven 40% wrinkle reduction",
                "Fast-acting concentrated formula",
                "Before-after proof from real users",
                "High-performance ingredients",
                "See dramatic transformation"
            ],
            "psychological": [
                "Look younger, feel more confident",
                "No more avoiding photos",
                "Reclaim your youthful appearance",
                "Boost self-confidence daily",
                "Feel good about your skin",
                "Transform how others see you"
            ]
        }
        
        solution_benefits = solution_benefits_map.get(category, solution_benefits_map["early_aging"])
        
        return {
            "hero_headline": problem_title,
            "hero_subheadline": f"{product_details['tagline']} — India's #1 Choice",
            "hero_problem_statement": self._generate_hero_problem_statement(problem_title, category),
            "product_name": product_details["name"],
            "product_tagline": product_details["tagline"],
            "product_description": product_details["description"],
            "problem_title": "Sound Familiar?",
            "problem_points": problem_points_map.get(category, problem_points_map["early_aging"]),
            "solution_title": "The Science-Backed Solution",
            "solution_description": f"{product_details['name']} combines Retinol, Hyaluronic Acid, Niacinamide, and Vitamin E — {product_details['description'].lower()}",
            "solution_benefits": solution_benefits,
            "testimonials": [],
            "cta_primary": f"Get {product_details['name'].replace('Celesta Glow ', '')} Now",
            "cta_secondary": "Start Your Transformation Today",
            "meta_title": f"{problem_title} | {product_details['name']}",
            "meta_description": f"{problem_title} Discover how {product_details['name']}'s clinically proven formula helps thousands of Indians. {product_details['tagline']}. Free shipping. COD available.",
            "meta_keywords": ["anti-aging", "serum", "wrinkles", "fine lines", category.replace("_", " "), "celesta glow", product_details['name'].lower()]
        }
    
    def get_predefined_problems(self) -> dict:
        """Get all predefined problems organized by category"""
        return {
            "categories": CATEGORY_NAMES,
            "problems": LANDING_PAGE_PROBLEMS
        }
