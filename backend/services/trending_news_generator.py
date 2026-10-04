"""
Trending News Blog Generator
Fetches trending celebrity/entertainment news and creates skincare-related blogs
Uses free RSS feeds from Google News
"""
import os
import logging
import httpx
import xml.etree.ElementTree as ET
from typing import List, Dict, Optional
from datetime import datetime, timezone
import json
import re

logger = logging.getLogger(__name__)

# Google News RSS feeds for entertainment/celebrity news
NEWS_FEEDS = {
    "celebrity_india": "https://news.google.com/rss/search?q=bollywood+celebrity+skincare&hl=en-IN&gl=IN&ceid=IN:en",
    "beauty_trends": "https://news.google.com/rss/search?q=beauty+skincare+trends+india&hl=en-IN&gl=IN&ceid=IN:en",
    "celebrity_beauty": "https://news.google.com/rss/search?q=celebrity+beauty+secrets&hl=en-IN&gl=IN&ceid=IN:en",
    "anti_aging": "https://news.google.com/rss/search?q=anti+aging+skincare+news&hl=en-IN&gl=IN&ceid=IN:en"
}

# Blog generation prompt template
TRENDING_BLOG_PROMPT = """You are an expert beauty and skincare blogger for Celesta Glow, a complete anti-aging skincare brand with 5 products (Serum, Night Cream, Under Eye Cream, Sunscreen, Cleanser).

Based on this trending news headline and summary, create an engaging skincare blog post that:
1. References the trending topic/celebrity naturally
2. Connects it to anti-aging skincare tips
3. Subtly promotes Celesta Glow serum as a solution
4. Is SEO optimized with relevant keywords
5. Appeals to Indian women aged 28+

TRENDING NEWS:
Title: {news_title}
Summary: {news_summary}
Published: {pub_date}

Create a blog post in this JSON format:
{{
    "title": "<catchy title connecting trend to skincare, max 70 chars>",
    "slug": "<url-friendly-slug>",
    "meta_description": "<SEO meta description, max 160 chars>",
    "excerpt": "<engaging excerpt, 2-3 sentences>",
    "content": "<full HTML blog content with h2, h3 headings, paragraphs, bullet points. Min 800 words>",
    "tags": ["<tag1>", "<tag2>", "<tag3>"],
    "category": "<Anti-Aging|Celebrity Beauty|Skincare Tips|Beauty Trends>",
    "trending_source": "<original news source>",
    "celebrity_mentioned": "<celebrity name if any, else null>"
}}

Make the content informative, engaging, and naturally incorporate Celesta Glow mentions without being too promotional."""


class TrendingNewsBlogGenerator:
    """Generates skincare blogs based on trending news"""
    
    def __init__(self, db, api_key: str = None):
        self.db = db
        self.api_key = api_key or os.environ.get('EMERGENT_LLM_KEY')
    
    async def fetch_trending_news(self, feed_type: str = "celebrity_india", limit: int = 5) -> List[Dict]:
        """Fetch trending news from Google News RSS"""
        feed_url = NEWS_FEEDS.get(feed_type, NEWS_FEEDS["celebrity_india"])
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(feed_url, headers={
                    "User-Agent": "Mozilla/5.0 (compatible; CelestaGlow/1.0)"
                })
                
                if response.status_code != 200:
                    logger.error(f"Failed to fetch news: {response.status_code}")
                    return []
                
                # Parse RSS XML
                root = ET.fromstring(response.text)
                items = root.findall('.//item')
                
                news_items = []
                for item in items[:limit]:
                    title = item.find('title')
                    link = item.find('link')
                    pub_date = item.find('pubDate')
                    description = item.find('description')
                    source = item.find('source')
                    
                    news_items.append({
                        "title": title.text if title is not None else "",
                        "link": link.text if link is not None else "",
                        "pub_date": pub_date.text if pub_date is not None else "",
                        "summary": self._clean_html(description.text) if description is not None else "",
                        "source": source.text if source is not None else "Google News"
                    })
                
                return news_items
                
        except Exception as e:
            logger.error(f"Error fetching news: {str(e)}")
            return []
    
    def _clean_html(self, text: str) -> str:
        """Remove HTML tags from text"""
        if not text:
            return ""
        clean = re.sub(r'<[^>]+>', '', text)
        return clean.strip()
    
    async def generate_blog_from_news(self, news_item: Dict) -> Optional[Dict]:
        """Generate a skincare blog from a news item using AI"""
        if not self.api_key:
            logger.error("No API key available")
            return None
        
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            import uuid
            
            prompt = TRENDING_BLOG_PROMPT.format(
                news_title=news_item.get("title", ""),
                news_summary=news_item.get("summary", ""),
                pub_date=news_item.get("pub_date", "")
            )
            
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"trending-{uuid.uuid4().hex[:8]}",
                system_message="You are an expert beauty blogger who connects trending news to skincare advice."
            ).with_model("gemini", "gemini-2.5-flash")
            
            response_text = await chat.send_message(UserMessage(text=prompt))
            
            # Extract JSON from response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start != -1 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                blog_data = json.loads(json_str)
                
                # Add metadata
                blog_data["news_source_url"] = news_item.get("link", "")
                blog_data["news_source_name"] = news_item.get("source", "")
                blog_data["is_trending"] = True
                blog_data["generated_from"] = "trending_news"
                blog_data["created_at"] = datetime.now(timezone.utc).isoformat()
                
                return blog_data
            
            return None
            
        except Exception as e:
            logger.error(f"Error generating blog: {str(e)}")
            return None
    
    async def save_trending_blog(self, blog_data: Dict) -> Dict:
        """Save trending blog to database"""
        # Check for duplicates
        existing = await self.db.blogs.find_one({
            "$or": [
                {"slug": blog_data.get("slug")},
                {"title": blog_data.get("title")}
            ]
        })
        
        if existing:
            return {"success": False, "error": "Similar blog already exists"}
        
        # Ensure proper fields
        blog_doc = {
            "id": f"trend_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "title": blog_data.get("title", ""),
            "slug": blog_data.get("slug", ""),
            "meta_description": blog_data.get("meta_description", ""),
            "excerpt": blog_data.get("excerpt", ""),
            "content": blog_data.get("content", ""),
            "tags": blog_data.get("tags", []),
            "category": blog_data.get("category", "Beauty Trends"),
            "trending_source": blog_data.get("trending_source", ""),
            "celebrity_mentioned": blog_data.get("celebrity_mentioned"),
            "news_source_url": blog_data.get("news_source_url", ""),
            "news_source_name": blog_data.get("news_source_name", ""),
            "is_trending": True,
            "generated_from": "trending_news",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "views": 0,
            "shares": 0
        }
        
        await self.db.blogs.insert_one(blog_doc)
        
        # Remove _id for response
        if "_id" in blog_doc:
            del blog_doc["_id"]
        
        return {"success": True, "blog": blog_doc}
    
    async def generate_trending_blogs(self, count: int = 3) -> Dict:
        """Generate multiple blogs from trending news"""
        results = {
            "total_attempted": 0,
            "successful": 0,
            "failed": 0,
            "blogs": [],
            "errors": []
        }
        
        # Fetch news from multiple feeds
        all_news = []
        for feed_type in NEWS_FEEDS.keys():
            news = await self.fetch_trending_news(feed_type, limit=2)
            all_news.extend(news)
        
        # Remove duplicates based on title
        seen_titles = set()
        unique_news = []
        for item in all_news:
            title_key = item.get("title", "").lower()[:50]
            if title_key not in seen_titles:
                seen_titles.add(title_key)
                unique_news.append(item)
        
        # Generate blogs
        for news_item in unique_news[:count]:
            results["total_attempted"] += 1
            
            try:
                blog_data = await self.generate_blog_from_news(news_item)
                
                if blog_data:
                    save_result = await self.save_trending_blog(blog_data)
                    
                    if save_result.get("success"):
                        results["successful"] += 1
                        results["blogs"].append({
                            "title": blog_data.get("title"),
                            "slug": blog_data.get("slug"),
                            "category": blog_data.get("category"),
                            "news_source": news_item.get("title")[:50]
                        })
                    else:
                        results["failed"] += 1
                        results["errors"].append(save_result.get("error", "Save failed"))
                else:
                    results["failed"] += 1
                    results["errors"].append(f"Failed to generate from: {news_item.get('title', '')[:30]}")
                    
            except Exception as e:
                results["failed"] += 1
                results["errors"].append(str(e)[:100])
        
        return results
    
    async def get_trending_stats(self) -> Dict:
        """Get statistics about trending blogs"""
        total_trending = await self.db.blogs.count_documents({"is_trending": True})
        
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_trending = await self.db.blogs.count_documents({
            "is_trending": True,
            "created_at": {"$regex": f"^{today}"}
        })
        
        # Get recent trending blogs
        recent = await self.db.blogs.find(
            {"is_trending": True},
            {"_id": 0, "title": 1, "category": 1, "created_at": 1, "celebrity_mentioned": 1}
        ).sort("created_at", -1).limit(5).to_list(5)
        
        return {
            "total_trending_blogs": total_trending,
            "today_trending_blogs": today_trending,
            "recent_trending": recent
        }
