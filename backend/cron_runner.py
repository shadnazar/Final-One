#!/usr/bin/env python3
"""
Background cron runner for blog generation
NEW SCHEDULE: Every 2 hours, with 5-minute intervals between each blog type
- Minute 0: Trending News Blogs (3 blogs)
- Minute 5: Topic Blogs (Load topics + generate)
- Minute 10: Auto Blog Generator (12 blogs)
- Minute 15: Location Blogs (All states)
Repeats every 2 hours forever
"""
import asyncio
import time
from datetime import datetime, timedelta
import subprocess
import sys
import os

# Track last cycle start to avoid overlapping
last_cycle_start = None

def run_blog_generation(job_type, count=None):
    """Execute blog generation based on job type"""
    print(f"[{datetime.now()}] Running {job_type} blog generation...")
    
    if job_type == "trending":
        script = '''
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys
sys.path.insert(0, '/app/backend')

async def generate():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client[os.environ.get('DB_NAME', 'serum_ecommerce')]
    
    try:
        from services.trending_news_generator import TrendingNewsBlogGenerator
        trending = TrendingNewsBlogGenerator(db)
        result = await trending.generate_trending_blogs(count=3)
        print(f"Trending blogs: {result.get('successful', 0)} generated")
        
        from datetime import datetime, timezone
        await db.cron_logs.insert_one({
            "job": "trending_blog_generation",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "generated": result.get('successful', 0),
            "job_type": "trending"
        })
    except Exception as e:
        print(f"Trending generation error: {e}")

asyncio.run(generate())
'''
    elif job_type == "topic":
        script = '''
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys
sys.path.insert(0, '/app/backend')

async def generate():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client[os.environ.get('DB_NAME', 'serum_ecommerce')]
    
    try:
        from services.auto_blog_generator import AutoBlogGenerator
        generator = AutoBlogGenerator(db)
        
        # Default trending topics for skincare
        default_topics = [
            "Best anti-aging ingredients for Indian skin",
            "How to reduce wrinkles naturally",
            "Night skincare routine for 30+",
            "Benefits of retinol serum",
            "Korean skincare routine for beginners",
            "How to get glowing skin in summer"
        ]
        
        # Generate topic blogs
        result = await generator.generate_topic_blogs(topics=default_topics, count=6, force=True)
        print(f"Topic blogs: {result.get('generated', 0)} generated")
        
        from datetime import datetime, timezone
        await db.cron_logs.insert_one({
            "job": "topic_blog_generation",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "generated": result.get('generated', 0),
            "job_type": "topic"
        })
    except Exception as e:
        print(f"Topic generation error: {e}")

asyncio.run(generate())
'''
    elif job_type == "auto":
        script = '''
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys
sys.path.insert(0, '/app/backend')

async def generate():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client[os.environ.get('DB_NAME', 'serum_ecommerce')]
    
    try:
        from services.auto_blog_generator import AutoBlogGenerator
        generator = AutoBlogGenerator(db)
        
        # Generate 12 auto blogs using generate_and_save_blogs
        result = await generator.generate_and_save_blogs(count=12)
        print(f"Auto blogs: {result.get('generated', 0)} generated")
        
        from datetime import datetime, timezone
        await db.cron_logs.insert_one({
            "job": "auto_blog_generation",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "generated": result.get('generated', 0),
            "job_type": "auto"
        })
    except Exception as e:
        print(f"Auto generation error: {e}")

asyncio.run(generate())
'''
    elif job_type == "location":
        script = '''
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys
sys.path.insert(0, '/app/backend')

async def generate():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client[os.environ.get('DB_NAME', 'serum_ecommerce')]
    
    try:
        from services.auto_blog_generator import AutoBlogGenerator
        generator = AutoBlogGenerator(db)
        
        # Generate for ALL states (select all)
        result = await generator.generate_location_blogs(count=15)
        print(f"Location blogs: {result.get('generated', 0)} generated")
        
        from datetime import datetime, timezone
        await db.cron_logs.insert_one({
            "job": "location_blog_generation",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "generated": result.get('generated', 0),
            "job_type": "location"
        })
    except Exception as e:
        print(f"Location generation error: {e}")

asyncio.run(generate())
'''
    else:
        print(f"Unknown job type: {job_type}")
        return
    
    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        cwd="/app/backend",
        env={**os.environ}
    )
    print(result.stdout)
    if result.stderr:
        print(f"Errors: {result.stderr[:500]}")

def run_cycle():
    """Run one complete blog generation cycle with 5-minute intervals"""
    print(f"\n{'='*60}")
    print(f"[{datetime.now()}] Starting new blog generation cycle")
    print(f"{'='*60}")
    
    # Step 1: Trending Blogs (Minute 0)
    print(f"\n[Step 1/4] Generating Trending News Blogs...")
    run_blog_generation("trending")
    
    # Wait 5 minutes
    print(f"[{datetime.now()}] Waiting 5 minutes before next generation...")
    time.sleep(300)
    
    # Step 2: Topic Blogs (Minute 5)
    print(f"\n[Step 2/4] Generating Topic-Based Blogs...")
    run_blog_generation("topic")
    
    # Wait 5 minutes
    print(f"[{datetime.now()}] Waiting 5 minutes before next generation...")
    time.sleep(300)
    
    # Step 3: Auto Blogs (Minute 10)
    print(f"\n[Step 3/4] Generating Auto Blogs (12 blogs)...")
    run_blog_generation("auto")
    
    # Wait 5 minutes
    print(f"[{datetime.now()}] Waiting 5 minutes before next generation...")
    time.sleep(300)
    
    # Step 4: Location Blogs (Minute 15)
    print(f"\n[Step 4/4] Generating Location-Based Blogs (All States)...")
    run_blog_generation("location")
    
    print(f"\n{'='*60}")
    print(f"[{datetime.now()}] Cycle complete! All 4 blog types generated.")
    print(f"{'='*60}")

def main():
    """Main loop - runs blog generation every 2 hours with 5-minute intervals"""
    print(f"\n{'*'*60}")
    print(f"[{datetime.now()}] BLOG CRON RUNNER STARTED")
    print(f"{'*'*60}")
    print("Schedule: Every 2 hours")
    print("  - Minute 0: Trending News Blogs (3)")
    print("  - Minute 5: Topic-Based Blogs (6)")
    print("  - Minute 10: Auto Blogs (12)")
    print("  - Minute 15: Location Blogs (All States)")
    print(f"{'*'*60}\n")
    
    global last_cycle_start
    
    while True:
        now = datetime.now()
        
        # Check if it's time for a new cycle (every 2 hours)
        # Run at even hours: 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22
        should_run = (
            now.hour % 2 == 0 and 
            now.minute < 5 and
            (last_cycle_start is None or (now - last_cycle_start).total_seconds() >= 7000)
        )
        
        if should_run:
            last_cycle_start = now
            run_cycle()
            
            # Calculate time until next cycle
            next_cycle = (now + timedelta(hours=2)).replace(minute=0, second=0, microsecond=0)
            wait_seconds = (next_cycle - datetime.now()).total_seconds()
            
            print(f"\n[{datetime.now()}] Next cycle at {next_cycle.strftime('%H:%M')}")
            print(f"Sleeping for {wait_seconds/60:.1f} minutes...")
            
            # Sleep until next cycle (minus some buffer)
            if wait_seconds > 60:
                time.sleep(wait_seconds - 60)
        else:
            # Calculate when next cycle will be
            if now.hour % 2 == 0:
                next_hour = now.hour + 2
            else:
                next_hour = now.hour + 1
            
            if next_hour >= 24:
                next_hour = next_hour % 24
            
            print(f"[{now.strftime('%H:%M:%S')}] Waiting... Next cycle at {next_hour:02d}:00")
            time.sleep(60)  # Check every minute

if __name__ == "__main__":
    main()
