from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone
from typing import Dict

class AnalyticsTracker:
    def __init__(self, db):
        self.db = db
    
    async def track_visit(self, page: str, session_id: str = None):
        """Track a page visit"""
        visit_data = {
            "page": page,
            "session_id": session_id,
            "timestamp": datetime.now(timezone.utc),
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }
        await self.db.analytics.insert_one(visit_data)
    
    async def get_stats(self, start_date: datetime = None) -> Dict:
        """Get analytics statistics"""
        pipeline = [
            {"$group": {
                "_id": "$page",
                "count": {"$sum": 1}
            }}
        ]
        
        if start_date:
            pipeline.insert(0, {"$match": {"timestamp": {"$gte": start_date}}})
        
        page_stats = {}
        async for stat in self.db.analytics.aggregate(pipeline):
            page_stats[stat["_id"]] = stat["count"]
        
        total_visits = await self.db.analytics.count_documents(
            {"timestamp": {"$gte": start_date}} if start_date else {}
        )
        
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_visits = await self.db.analytics.count_documents({"date": today})
        
        unique_sessions = len(await self.db.analytics.distinct(
            "session_id",
            {"timestamp": {"$gte": start_date}} if start_date else {}
        ))
        
        return {
            "total_visits": total_visits,
            "today_visits": today_visits,
            "unique_sessions": unique_sessions,
            "page_breakdown": {
                "product_page": page_stats.get("product", 0),
                "address_page": page_stats.get("checkout", 0),
                "payment_page": page_stats.get("payment", 0)
            }
        }
