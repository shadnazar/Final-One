"""
Auto Blog Generator Service - Automated SEO blog generation every 12 hours
Generates beauty news, celebrity topics, tips, current affairs - all conversion optimized
"""
import os
import json
import uuid
import re
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List
from emergentintegrations.llm.chat import LlmChat, UserMessage
from services.image_service import get_image_for_category, get_image_for_keywords

# Indian locations for SEO targeting
INDIAN_LOCATIONS = [
    "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad",
    "Jaipur", "Lucknow", "Chandigarh", "Kochi", "Indore", "Bhopal", "Coimbatore", "Surat",
    "Nagpur", "Visakhapatnam", "Patna", "Vadodara", "Goa", "Mysore", "Mangalore", "Thiruvananthapuram",
    "Nashik", "Aurangabad", "Rajkot", "Varanasi", "Amritsar", "Noida", "Gurgaon", "Faridabad"
]

# Beauty blog categories for variety
BLOG_CATEGORIES = [
    {"type": "news", "description": "Latest beauty industry news, product launches, brand updates"},
    {"type": "celebrity", "description": "Celebrity skincare secrets, routines, and transformations"},
    {"type": "tips", "description": "Practical skincare tips and how-to guides"},
    {"type": "mistakes", "description": "Common skincare mistakes to avoid"},
    {"type": "trends", "description": "Current beauty trends in India"},
    {"type": "ingredients", "description": "Deep dives into skincare ingredients"},
    {"type": "seasonal", "description": "Seasonal skincare advice for Indian climate"},
    {"type": "age-specific", "description": "Age-specific skincare routines (30s, 40s, 50s)"},
    {"type": "diy", "description": "DIY skincare recipes and home remedies"},
    {"type": "science", "description": "Science behind anti-aging and skincare"},
    {"type": "regional", "description": "Regional skincare traditions and practices"},
    {"type": "comparison", "description": "Product comparisons and reviews"}
]


class AutoBlogGenerator:
    def __init__(self, db):
        self.db = db
        self.api_key = os.environ.get('EMERGENT_LLM_KEY')
        
    def generate_slug(self, title: str) -> str:
        """Generate URL-friendly slug from title"""
        slug = title.lower()
        slug = re.sub(r'[^a-z0-9]+', '-', slug)
        slug = re.sub(r'^-|-$', '', slug)
        return slug[:80]  # Limit slug length
    
    async def get_trending_topics(self) -> List[dict]:
        """Get current trending beauty topics for blog generation"""
        if not self.api_key:
            raise ValueError("EMERGENT_LLM_KEY not configured")
        
        current_month = datetime.now().strftime("%B %Y")
        
        prompt = f"""Generate 12 unique, trending beauty and skincare blog topics for {current_month} in India.

Mix these categories: beauty news, celebrity skincare secrets, tips, common mistakes, trends, ingredients education, seasonal advice, DIY remedies, anti-aging science.

Each topic should:
1. Be highly searchable and SEO-friendly
2. Target Indian audience (mention Indian cities, climate, or preferences where relevant)
3. Be timely and relevant to current season/trends
4. Have potential to convert readers to anti-aging product buyers

Return as JSON array:
[
    {{
        "title": "Compelling SEO title (50-60 chars)",
        "category": "news|celebrity|tips|mistakes|trends|ingredients|seasonal|diy|science",
        "target_location": "City name or 'India'",
        "keywords": ["keyword1", "keyword2", "keyword3"],
        "hook": "One line teaser to grab attention"
    }}
]

Make topics diverse - include celebrity news, practical tips, seasonal advice, and trending ingredients."""

        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"topics-{uuid.uuid4().hex[:8]}",
                system_message="You are a beauty content strategist who understands Indian skincare trends and SEO."
            ).with_model("gemini", "gemini-2.5-flash")
            
            response = await chat.send_message(UserMessage(text=prompt))
            
            json_match = re.search(r'\[[\s\S]*\]', response)
            if json_match:
                return json.loads(json_match.group())
            return []
        except Exception as e:
            print(f"Error getting trending topics: {e}")
            return []
    
    async def generate_single_blog(self, topic: dict) -> dict:
        """Generate a complete blog article from a topic"""
        if not self.api_key:
            raise ValueError("EMERGENT_LLM_KEY not configured")
        
        location_mention = f" (with focus on {topic.get('target_location', 'India')})" if topic.get('target_location') else ""
        keywords_str = ", ".join(topic.get('keywords', []))
        
        prompt = f"""Write a complete, SEO-optimized blog article.

Title: {topic['title']}{location_mention}
Category: {topic.get('category', 'tips')}
Target Keywords: {keywords_str}
Hook: {topic.get('hook', '')}

IMPORTANT WRITING GUIDELINES:
1. Write 800-1200 words in SIMPLE, conversational language
2. Write like you're talking to a friend - warm, friendly, relatable
3. Use short paragraphs (2-3 sentences max)
4. Use bullet points and numbered lists for easy reading
5. Include subheadings every 150-200 words
6. Use proper HTML formatting (h2, h3, p, ul, li, strong)
7. Avoid jargon - explain any technical terms simply
8. Include practical, actionable advice anyone can follow
9. Naturally mention how a complete anti-aging routine can help
10. Add a subtle CTA for Celesta Glow's 5-product anti-aging range
11. Make it feel like advice from a caring friend, not a textbook

Return as JSON:
{{
    "title": "Final SEO-optimized title (catchy, under 60 chars)",
    "meta_description": "150-160 character meta description that makes people want to read",
    "content": "Full HTML content - organized, easy to scan, human-friendly",
    "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
    "category": "{topic.get('category', 'tips')}",
    "read_time": "X min read",
    "image_prompt": "A detailed prompt to generate a relevant blog header image"
}}

Remember: Write like a helpful friend sharing beauty secrets, not like a corporate blog!"""

        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"blog-{uuid.uuid4().hex[:8]}",
                system_message="""You are an expert beauty and skincare content writer for Indian audience.
                Your content is engaging, informative, and subtly promotes anti-aging skincare without being pushy.
                You write in a warm, relatable tone that resonates with Indian women aged 28-50."""
            ).with_model("gemini", "gemini-2.5-flash")
            
            response = await chat.send_message(UserMessage(text=prompt))
            
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                return json.loads(json_match.group())
            return None
        except Exception as e:
            print(f"Error generating blog: {e}")
            return None
    
    async def generate_and_save_blogs(self, count: int = 12) -> dict:
        """Generate multiple blogs and save them to database"""
        results = {
            "success": True,
            "generated": 0,
            "failed": 0,
            "blogs": []
        }
        
        # Track used images to avoid duplicates
        used_images = []
        
        try:
            # Get trending topics
            topics = await self.get_trending_topics()
            if not topics:
                return {"success": False, "error": "Failed to get topics"}
            
            topics = topics[:count]  # Limit to requested count
            
            for topic in topics:
                try:
                    # Generate blog content
                    blog_data = await self.generate_single_blog(topic)
                    if not blog_data:
                        results["failed"] += 1
                        continue
                    
                    # Create slug
                    slug = self.generate_slug(blog_data.get('title', topic['title']))
                    
                    # Check for duplicate slug
                    existing = await self.db.blogs.find_one({"slug": slug})
                    if existing:
                        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
                    
                    # Get relevant image for this blog
                    category = blog_data.get('category', topic.get('category', 'tips'))
                    keywords = blog_data.get('keywords', topic.get('keywords', []))
                    title = blog_data.get('title', topic['title'])
                    
                    # Try category-based image first, then keywords
                    image_url = get_image_for_category(category, used_images)
                    if not image_url:
                        image_url = get_image_for_keywords(keywords, title)
                    
                    used_images.append(image_url)
                    
                    # Save to database
                    now = datetime.now(timezone.utc).isoformat()
                    blog_doc = {
                        "id": str(uuid.uuid4()),
                        "title": blog_data.get('title', topic['title']),
                        "slug": slug,
                        "meta_description": blog_data.get('meta_description', ''),
                        "content": blog_data.get('content', ''),
                        "keywords": blog_data.get('keywords', topic.get('keywords', [])),
                        "category": blog_data.get('category', topic.get('category', 'tips')),
                        "read_time": blog_data.get('read_time', '5 min read'),
                        "status": "published",  # Auto-publish
                        "language": "en",
                        "view_count": 0,
                        "generated_by": "AI-Auto",
                        "target_location": topic.get('target_location', 'India'),
                        "image_url": image_url,  # Add image URL
                        "created_at": now,
                        "updated_at": now,
                        "published_at": now
                    }
                    
                    await self.db.blogs.insert_one(blog_doc)
                    results["generated"] += 1
                    results["blogs"].append({
                        "title": blog_doc["title"],
                        "slug": blog_doc["slug"],
                        "category": blog_doc["category"],
                        "image_url": image_url
                    })
                    
                    # Small delay between generations to avoid rate limits
                    await asyncio.sleep(1)
                    
                except Exception as e:
                    print(f"Error saving blog: {e}")
                    results["failed"] += 1
            
            # Log the generation
            await self.db.blog_generation_logs.insert_one({
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "generated": results["generated"],
                "failed": results["failed"],
                "trigger": "auto"
            })
            
            return results
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_generation_history(self, limit: int = 10):
        """Get recent blog generation history"""
        logs = await self.db.blog_generation_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
        return logs

    async def get_used_states(self, days: int = 30) -> List[str]:
        """Get states that have been used for location blogs recently"""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        blogs = await self.db.blogs.find(
            {
                "generated_by": {"$in": ["AI-Location", "AI-Auto"]},
                "location_target": {"$exists": True, "$ne": None},
                "created_at": {"$gte": cutoff.isoformat()}
            },
            {"_id": 0, "location_target": 1}
        ).to_list(500)
        return list(set(b.get("location_target") for b in blogs if b.get("location_target")))

    async def get_used_topics(self, days: int = 30) -> List[str]:
        """Get topics that have been used recently to avoid duplicates"""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        blogs = await self.db.blogs.find(
            {
                "generated_by": {"$in": ["AI-Topic", "AI-Auto"]},
                "created_at": {"$gte": cutoff.isoformat()}
            },
            {"_id": 0, "title": 1, "original_topic": 1}
        ).to_list(500)
        topics = []
        for b in blogs:
            if b.get("original_topic"):
                topics.append(b["original_topic"].lower())
            if b.get("title"):
                topics.append(b["title"].lower())
        return list(set(topics))

    async def get_next_states_for_cycling(self, count: int = 12) -> List[str]:
        """Get next states for auto-generation using cycling logic
        
        Cycles through all Indian states, avoiding recently used ones.
        When all states are used, starts fresh from the beginning.
        """
        all_states = [
            'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat', 
            'West Bengal', 'Rajasthan', 'Uttar Pradesh', 'Kerala', 'Telangana',
            'Andhra Pradesh', 'Punjab', 'Haryana', 'Bihar', 'Madhya Pradesh',
            'Odisha', 'Jharkhand', 'Chhattisgarh', 'Assam', 'Uttarakhand',
            'Himachal Pradesh', 'Goa', 'Tripura', 'Manipur', 'Meghalaya'
        ]
        
        # Get recently used states (last 60 days to ensure full cycle)
        used_states = await self.get_used_states(days=60)
        
        # Find unused states
        unused_states = [s for s in all_states if s not in used_states]
        
        # If all states used, reset and start fresh
        if len(unused_states) < count:
            # Clear the cycle - use states not used in last 7 days only
            recent_used = await self.get_used_states(days=7)
            unused_states = [s for s in all_states if s not in recent_used]
            
            if len(unused_states) < count:
                # If still not enough, just use all states
                unused_states = all_states.copy()
        
        return unused_states[:count]

    async def generate_location_blogs(self, states: List[str] = None, count: int = 12, force: bool = False) -> dict:
        """Generate SEO blogs targeting specific Indian states
        
        Args:
            states: List of states to generate blogs for. If None, uses cycling logic.
            count: Maximum number of blogs to generate (default 12)
            force: If True, generate even for states that have recent blogs
        """
        results = {
            "success": True,
            "generated": 0,
            "failed": 0,
            "blogs": [],
            "skipped_states": []
        }
        
        # If no states provided, get next states using cycling logic
        if not states:
            states = await self.get_next_states_for_cycling(count)
        
        # Filter out already used states (avoid duplicates) - unless force is True
        if force:
            # When force=True (manual trigger), allow regeneration
            states_to_generate = states[:count]
        else:
            used_states = await self.get_used_states(days=30)
            states_to_generate = []
            for state in states:
                if state not in used_states:
                    states_to_generate.append(state)
                else:
                    results["skipped_states"].append(state)
        
        # Limit to count
        states_to_generate = states_to_generate[:count]
        
        if not states_to_generate:
            return {
                "success": True,
                "generated": 0,
                "failed": 0,
                "blogs": [],
                "message": "All selected states have blogs generated in the last 30 days. Try different states or wait for the cycle to reset."
            }
        
        used_images = []
        
        for state in states_to_generate:
            try:
                topic = {
                    "title": f"Anti-Aging Skincare Guide for {state}",
                    "category": "regional",
                    "target_location": state,
                    "keywords": [f"skincare {state}", f"anti-aging {state}", f"beauty tips {state}", "face serum"],
                    "hook": f"Discover the best skincare routine designed for {state}'s unique climate and lifestyle"
                }
                
                prompt = f"""Write a complete, SEO-optimized blog article about anti-aging skincare specifically for people living in {state}, India.

FOCUS ON:
1. {state}'s unique climate and weather conditions
2. Specific skin concerns people in {state} face
3. Local beauty traditions and ingredients
4. How the lifestyle in {state} affects skin health
5. Tailored skincare routine for {state} residents

IMPORTANT WRITING GUIDELINES:
1. Write 800-1000 words in SIMPLE, conversational language
2. Use short paragraphs (2-3 sentences max)
3. Use bullet points and numbered lists
4. Include subheadings every 150-200 words
5. Use proper HTML formatting (h2, h3, p, ul, li, strong)
6. Naturally mention how a complete anti-aging routine can help
7. Add a subtle CTA for Celesta Glow's anti-aging range
8. Make it locally relevant to {state}

Return as JSON:
{{
    "title": "Best Anti-Aging Skincare Tips for {state} [SEO title under 60 chars]",
    "meta_description": "150-160 character meta description targeting {state} audience",
    "content": "Full HTML content with {state}-specific advice",
    "keywords": ["skincare {state}", "anti-aging {state}", "plus 3 more relevant keywords"],
    "category": "regional",
    "read_time": "X min read"
}}"""

                chat = LlmChat(
                    api_key=self.api_key,
                    session_id=f"location-{uuid.uuid4().hex[:8]}",
                    system_message="You are an expert beauty content writer specializing in regional skincare advice for Indian audiences."
                ).with_model("gemini", "gemini-2.5-flash")
                
                response = await chat.send_message(UserMessage(text=prompt))
                
                json_match = re.search(r'\{[\s\S]*\}', response)
                if json_match:
                    blog_data = json.loads(json_match.group())
                    
                    slug = self.generate_slug(blog_data.get('title', topic['title']))
                    existing = await self.db.blogs.find_one({"slug": slug})
                    if existing:
                        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
                    
                    # Get image
                    image_url = get_image_for_category('regional', used_images)
                    if not image_url:
                        image_url = get_image_for_keywords(['skincare', state.lower()], blog_data.get('title', ''))
                    used_images.append(image_url)
                    
                    now = datetime.now(timezone.utc).isoformat()
                    blog_doc = {
                        "id": str(uuid.uuid4()),
                        "title": blog_data.get('title', topic['title']),
                        "slug": slug,
                        "meta_description": blog_data.get('meta_description', ''),
                        "content": blog_data.get('content', ''),
                        "keywords": blog_data.get('keywords', topic['keywords']),
                        "category": "regional",
                        "read_time": blog_data.get('read_time', '5 min read'),
                        "status": "published",
                        "language": "en",
                        "view_count": 0,
                        "generated_by": "AI-Location",
                        "location_target": state,
                        "image_url": image_url,
                        "created_at": now,
                        "updated_at": now,
                        "published_at": now
                    }
                    
                    await self.db.blogs.insert_one(blog_doc)
                    results["generated"] += 1
                    results["blogs"].append({
                        "title": blog_doc["title"],
                        "slug": blog_doc["slug"],
                        "location_target": state,
                        "image_url": image_url
                    })
                else:
                    results["failed"] += 1
                    
                await asyncio.sleep(1)
                
            except Exception as e:
                print(f"Error generating location blog for {state}: {e}")
                results["failed"] += 1
        
        # Log generation
        await self.db.blog_generation_logs.insert_one({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "generated": results["generated"],
            "failed": results["failed"],
            "trigger": "location-batch",
            "states": states_to_generate,
            "skipped_states": results.get("skipped_states", [])
        })
        
        return results

    async def generate_topic_blogs(self, topics: List[str], count: int = 12, force: bool = False) -> dict:
        """Generate SEO blogs for specific user-defined topics
        
        Args:
            topics: List of topics to generate blogs for
            count: Maximum number of blogs to generate (default 12)
            force: If True, generate even for similar topics that have recent blogs
        """
        results = {
            "success": True,
            "generated": 0,
            "failed": 0,
            "blogs": [],
            "skipped_topics": []
        }
        
        # Filter and prepare topics
        topics_to_generate = []
        
        if force:
            # When force=True (manual trigger), skip duplicate check
            for topic_text in topics:
                topic_text = topic_text.strip()
                if topic_text:
                    topics_to_generate.append(topic_text)
        else:
            # Get recently used topics to avoid duplicates
            used_topics = await self.get_used_topics(days=30)
            
            for topic_text in topics:
                topic_text = topic_text.strip()
                if not topic_text:
                    continue
                
                # Check if similar topic was already generated
                topic_lower = topic_text.lower()
                is_duplicate = False
                for used in used_topics:
                    # Check for significant overlap (more than 60% word match)
                    topic_words = set(topic_lower.split())
                    used_words = set(used.split())
                    if len(topic_words & used_words) / max(len(topic_words), 1) > 0.6:
                        is_duplicate = True
                        break
                
                if is_duplicate:
                    results["skipped_topics"].append(topic_text)
                else:
                    topics_to_generate.append(topic_text)
        
        # Limit to count
        topics_to_generate = topics_to_generate[:count]
        
        if not topics_to_generate:
            return {
                "success": True,
                "generated": 0,
                "failed": 0,
                "blogs": [],
                "message": "All topics have similar blogs generated in the last 30 days. Try different topics."
            }
        
        used_images = []
        
        for topic_text in topics_to_generate:
                
            try:
                prompt = f"""Write a complete, SEO-optimized blog article about: {topic_text}

Target audience: Indian women aged 28-50 interested in anti-aging skincare

IMPORTANT WRITING GUIDELINES:
1. Write 800-1000 words in SIMPLE, conversational language
2. Use short paragraphs (2-3 sentences max)
3. Use bullet points and numbered lists
4. Include subheadings every 150-200 words
5. Use proper HTML formatting (h2, h3, p, ul, li, strong)
6. Naturally mention how a complete anti-aging routine can help
7. Add a subtle CTA for Celesta Glow's anti-aging range
8. Make it practical and actionable

Return as JSON:
{{
    "title": "SEO-optimized title under 60 characters",
    "meta_description": "150-160 character meta description",
    "content": "Full HTML content",
    "keywords": ["5 relevant SEO keywords"],
    "category": "tips|ingredients|diy|science|trends",
    "read_time": "X min read"
}}"""

                chat = LlmChat(
                    api_key=self.api_key,
                    session_id=f"topic-{uuid.uuid4().hex[:8]}",
                    system_message="You are an expert beauty content writer for Indian audience. Write engaging, helpful skincare content."
                ).with_model("gemini", "gemini-2.5-flash")
                
                response = await chat.send_message(UserMessage(text=prompt))
                
                json_match = re.search(r'\{[\s\S]*\}', response)
                if json_match:
                    blog_data = json.loads(json_match.group())
                    
                    slug = self.generate_slug(blog_data.get('title', topic_text))
                    existing = await self.db.blogs.find_one({"slug": slug})
                    if existing:
                        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
                    
                    # Get image
                    category = blog_data.get('category', 'tips')
                    image_url = get_image_for_category(category, used_images)
                    if not image_url:
                        image_url = get_image_for_keywords(blog_data.get('keywords', []), blog_data.get('title', ''))
                    used_images.append(image_url)
                    
                    now = datetime.now(timezone.utc).isoformat()
                    blog_doc = {
                        "id": str(uuid.uuid4()),
                        "title": blog_data.get('title', topic_text[:60]),
                        "slug": slug,
                        "meta_description": blog_data.get('meta_description', ''),
                        "content": blog_data.get('content', ''),
                        "keywords": blog_data.get('keywords', []),
                        "category": category,
                        "read_time": blog_data.get('read_time', '5 min read'),
                        "status": "published",
                        "language": "en",
                        "view_count": 0,
                        "generated_by": "AI-Topic",
                        "original_topic": topic_text,
                        "image_url": image_url,
                        "created_at": now,
                        "updated_at": now,
                        "published_at": now
                    }
                    
                    await self.db.blogs.insert_one(blog_doc)
                    results["generated"] += 1
                    results["blogs"].append({
                        "title": blog_doc["title"],
                        "slug": blog_doc["slug"],
                        "original_topic": topic_text,
                        "image_url": image_url
                    })
                else:
                    results["failed"] += 1
                    
                await asyncio.sleep(1)
                
            except Exception as e:
                print(f"Error generating topic blog for '{topic_text}': {e}")
                results["failed"] += 1
        
        # Log generation
        await self.db.blog_generation_logs.insert_one({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "generated": results["generated"],
            "failed": results["failed"],
            "trigger": "topic-batch",
            "topics_count": len(topics)
        })
        
        return results
