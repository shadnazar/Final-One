#!/usr/bin/env python3
"""
Cron job script for auto-generating blogs every 12 hours
Run with: python blog_cron.py
Schedule with crontab: 0 */12 * * * cd /app/backend && python blog_cron.py

Blog Generation Strategy:
- Generates 12 blogs per run (every 12 hours = 24 blogs/day)
- Uses cycling logic: Rotates through Indian states without repeating recently used ones
- Automatically avoids duplicate content
"""
import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from services.auto_blog_generator import AutoBlogGenerator


async def run_blog_generation():
    """Run the automated blog generation with state cycling"""
    print(f"[{datetime.now()}] Starting auto blog generation...")
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME')
    
    if not mongo_url or not db_name:
        print("Error: MONGO_URL or DB_NAME not set")
        return
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Initialize generator
    generator = AutoBlogGenerator(db)
    
    # Check what type of blogs to generate based on current hour
    current_hour = datetime.now().hour
    
    if current_hour < 12:
        # Morning run (6 AM or similar): Generate location-based blogs
        print("Morning run: Generating location-based blogs with state cycling...")
        result = await generator.generate_location_blogs(states=None, count=12)
        blog_type = "Location"
    else:
        # Evening run (6 PM or similar): Generate topic-based blogs
        print("Evening run: Generating auto SEO blogs...")
        result = await generator.generate_and_save_blogs(count=12)
        blog_type = "Auto SEO"
    
    if result.get("success") or result.get("generated", 0) > 0:
        print(f"✅ Generated {result.get('generated', 0)} {blog_type} blogs")
        if result.get('failed', 0) > 0:
            print(f"   ⚠️ {result['failed']} blogs failed")
        if result.get('skipped_states'):
            print(f"   ℹ️ Skipped states (already have recent blogs): {', '.join(result['skipped_states'][:5])}")
        for blog in result.get("blogs", [])[:5]:  # Show first 5
            location = blog.get('location_target', blog.get('category', ''))
            print(f"   - {blog['title'][:50]}... [{location}]")
        if len(result.get("blogs", [])) > 5:
            print(f"   ... and {len(result['blogs']) - 5} more")
    else:
        print(f"❌ Generation failed: {result.get('error', result.get('message', 'Unknown error'))}")
    
    # Log to database
    await db.cron_logs.insert_one({
        "job": "auto_blog_generation",
        "timestamp": datetime.now().isoformat(),
        "blog_type": blog_type,
        "generated": result.get("generated", 0),
        "failed": result.get("failed", 0),
        "skipped": len(result.get("skipped_states", [])),
        "success": result.get("generated", 0) > 0
    })
    
    client.close()
    print(f"[{datetime.now()}] Blog generation complete")


if __name__ == "__main__":
    asyncio.run(run_blog_generation())
