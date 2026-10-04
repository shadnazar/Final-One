"""
User Behavior Tracking Service
Tracks visitor behavior, page visits, time spent, and actions
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
import uuid


class UserBehaviorTracker:
    def __init__(self, db):
        self.db = db
    
    async def track_page_visit(self, data: dict):
        """Track a page visit with visitor details"""
        now = datetime.now(timezone.utc)
        page = data.get("page")
        
        visit_doc = {
            "id": str(uuid.uuid4()),
            "visitor_id": data.get("visitor_id"),
            "session_id": data.get("session_id"),
            "page": page,
            "referrer": data.get("referrer"),
            "user_agent": data.get("user_agent"),
            "screen_width": data.get("screen_width"),
            "screen_height": data.get("screen_height"),
            "timestamp": data.get("timestamp") or now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "hour": now.hour
        }
        
        await self.db.user_page_visits.insert_one(visit_doc)
        
        # Build profile update
        profile_update = {
            "last_page": page,
            "last_seen": now.isoformat(),
            "user_agent": data.get("user_agent"),
            "screen_size": f"{data.get('screen_width')}x{data.get('screen_height')}"
        }
        
        # Track checkout reached
        if page == "checkout":
            profile_update["reached_checkout"] = True
            profile_update["checkout_reached_at"] = now.isoformat()
        
        # Update visitor profile
        await self._update_visitor_profile(data.get("visitor_id"), profile_update)
        
        return {"tracked": True}
    
    async def track_time_spent(self, data: dict):
        """Track time spent on a page"""
        now = datetime.now(timezone.utc)
        
        time_doc = {
            "id": str(uuid.uuid4()),
            "visitor_id": data.get("visitor_id"),
            "session_id": data.get("session_id"),
            "page": data.get("page"),
            "time_spent": data.get("time_spent", 0),
            "timestamp": data.get("timestamp") or now.isoformat(),
            "date": now.strftime("%Y-%m-%d")
        }
        
        await self.db.user_time_spent.insert_one(time_doc)
        
        # Update visitor total time
        await self.db.visitor_profiles.update_one(
            {"visitor_id": data.get("visitor_id")},
            {"$inc": {"total_time_spent": data.get("time_spent", 0)}}
        )
        
        return {"tracked": True}
    
    async def track_action(self, data: dict):
        """Track user action (clicks, scrolls, form fills, etc.)"""
        now = datetime.now(timezone.utc)
        
        action_doc = {
            "id": str(uuid.uuid4()),
            "visitor_id": data.get("visitor_id"),
            "session_id": data.get("session_id"),
            "action": data.get("action"),
            "details": data.get("details", {}),
            "page": data.get("page"),
            "timestamp": data.get("timestamp") or now.isoformat(),
            "date": now.strftime("%Y-%m-%d")
        }
        
        await self.db.user_actions.insert_one(action_doc)
        
        # Update visitor profile based on action
        update_data = {"last_action": data.get("action"), "last_action_time": now.isoformat()}
        
        action = data.get("action", "")
        details = data.get("details", {})
        
        # Track address entry
        if details.get("has_address") or details.get("address_entered") or action == "address_complete":
            update_data["address_entered"] = True
        
        # Track phone entry
        if details.get("has_phone"):
            update_data["phone_entered"] = True
        
        # Track checkout visit
        if action == "view_checkout" or details.get("step") == "checkout_started":
            update_data["reached_checkout"] = True
        
        if details.get("form_name") == "checkout":
            update_data["reached_checkout"] = True
        
        # Track payment method selection
        if action == "payment_method_selected":
            update_data["payment_method_selected"] = details.get("method")
        
        # Track order completion
        if action == "order_complete":
            update_data["order_completed"] = True
        
        if update_data:
            await self.db.visitor_profiles.update_one(
                {"visitor_id": data.get("visitor_id")},
                {"$set": update_data}
            )
        
        return {"tracked": True}
    
    async def _update_visitor_profile(self, visitor_id: str, data: dict):
        """Update or create visitor profile"""
        if not visitor_id:
            return
        
        now = datetime.now(timezone.utc)
        
        # Check if profile exists
        existing = await self.db.visitor_profiles.find_one({"visitor_id": visitor_id})
        
        if existing:
            # Update existing profile
            await self.db.visitor_profiles.update_one(
                {"visitor_id": visitor_id},
                {
                    "$set": data,
                    "$inc": {"total_visits": 1}
                }
            )
        else:
            # Create new profile
            new_profile = {
                "visitor_id": visitor_id,
                "first_seen": now.isoformat(),
                "total_visits": 1,
                "total_time_spent": 0,
                **data
            }
            await self.db.visitor_profiles.insert_one(new_profile)
    
    async def get_visitor_journey(self, visitor_id: str) -> dict:
        """Get complete journey of a visitor"""
        profile = await self.db.visitor_profiles.find_one(
            {"visitor_id": visitor_id}, 
            {"_id": 0}
        )
        
        page_visits = await self.db.user_page_visits.find(
            {"visitor_id": visitor_id},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(1000)
        
        actions = await self.db.user_actions.find(
            {"visitor_id": visitor_id},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(1000)
        
        time_spent = await self.db.user_time_spent.find(
            {"visitor_id": visitor_id},
            {"_id": 0}
        ).to_list(1000)
        
        # Calculate time spent per page
        time_by_page = {}
        for t in time_spent:
            page = t.get("page", "unknown")
            time_by_page[page] = time_by_page.get(page, 0) + t.get("time_spent", 0)
        
        return {
            "profile": profile or {},
            "page_visits": page_visits,
            "actions": actions,
            "time_by_page": time_by_page,
            "total_pages_visited": len(set(v.get("page") for v in page_visits))
        }
    
    async def get_all_visitors(self, date: str = None, days: int = 7, limit: int = 1000) -> List[dict]:
        """Get all visitors with summary
        
        When filtering by date: Shows ALL visitors who had ANY activity on that date
        When using days: Shows visitors active in the last N days
        """
        query = {}
        
        if date:
            # For specific date: Get ALL visitors who had ANY activity on that date
            visitor_ids_on_date = await self.db.user_page_visits.distinct("visitor_id", {"date": date})
            
            if visitor_ids_on_date:
                query["visitor_id"] = {"$in": visitor_ids_on_date}
            else:
                return []
        else:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            query["last_seen"] = {"$gte": cutoff}
        
        visitors = await self.db.visitor_profiles.find(
            query,
            {"_id": 0}
        ).sort("last_seen", -1).limit(limit).to_list(limit)
        
        # Enrich with page count for the specific date if filtering
        for visitor in visitors:
            vid = visitor.get("visitor_id")
            if date:
                # Show page count for that specific date
                page_count = await self.db.user_page_visits.count_documents({"visitor_id": vid, "date": date})
                action_count = await self.db.user_actions.count_documents({"visitor_id": vid, "date": date})
                
                # Check if reached checkout on this date
                checkout_on_date = await self.db.user_page_visits.count_documents({"visitor_id": vid, "date": date, "page": "checkout"})
                visitor["reached_checkout_today"] = checkout_on_date > 0
            else:
                page_count = await self.db.user_page_visits.count_documents({"visitor_id": vid})
                action_count = await self.db.user_actions.count_documents({"visitor_id": vid})
            visitor["pages_visited"] = page_count
            visitor["actions_count"] = action_count
            # Ensure first_seen is accessible at top level
            if not visitor.get("first_seen"):
                visitor["first_seen"] = visitor.get("profile", {}).get("first_seen")
        
        return visitors
    
    async def get_visitor_stats(self, days: int = 7, date: str = None) -> dict:
        """Get visitor statistics - supports both days range and single date
        
        When filtering by date: Shows ALL visitors who had ANY activity on that date
        """
        if date:
            # For specific date - get ALL visitors who had any activity on this date
            all_visitor_ids = await self.db.user_page_visits.distinct("visitor_id", {"date": date})
            
            if all_visitor_ids:
                query = {"visitor_id": {"$in": all_visitor_ids}}
            else:
                return {
                    "total_visitors": 0,
                    "returning_visitors": 0,
                    "new_visitors": 0,
                    "reached_checkout": 0,
                    "address_entered": 0,
                    "avg_time_spent": 0,
                    "checkout_rate": 0,
                    "period_days": days,
                    "selected_date": date
                }
            
            # Count new vs returning for this specific date
            total_visitors = len(all_visitor_ids)
            
            # New visitors = those whose first visit was on this date
            new_visitors = 0
            for vid in all_visitor_ids:
                earliest = await self.db.user_page_visits.find_one(
                    {"visitor_id": vid},
                    sort=[("timestamp", 1)]
                )
                if earliest and earliest.get("date") == date:
                    new_visitors += 1
            
            returning_visitors = total_visitors - new_visitors
            
            # Checkout count for this specific date
            checkout_visits = await self.db.user_page_visits.distinct(
                "visitor_id", 
                {"date": date, "page": "checkout"}
            )
            reached_checkout = len(checkout_visits)
            
            # Address entered (from visitor_profiles with activity on this date)
            address_entered = await self.db.visitor_profiles.count_documents({
                "visitor_id": {"$in": all_visitor_ids},
                "address_entered": True
            })
            
            # Conversions (order_completed) from visitor_profiles
            conversions = await self.db.visitor_profiles.count_documents({
                "visitor_id": {"$in": all_visitor_ids},
                "order_completed": True
            })
            
            # Average time spent (from profiles)
            pipeline = [
                {"$match": {"visitor_id": {"$in": all_visitor_ids}}},
                {"$group": {"_id": None, "avg_time": {"$avg": "$total_time_spent"}}}
            ]
            avg_result = await self.db.visitor_profiles.aggregate(pipeline).to_list(1)
            avg_time = avg_result[0]["avg_time"] if avg_result else 0
            
            return {
                "total_visitors": total_visitors,
                "returning_visitors": returning_visitors,
                "new_visitors": new_visitors,
                "reached_checkout": reached_checkout,
                "address_entered": address_entered,
                "conversions": conversions,
                "conversion_rate": round((conversions / max(total_visitors, 1)) * 100, 1),
                "avg_time_spent": round(avg_time or 0, 1),
                "checkout_rate": round((reached_checkout / max(total_visitors, 1)) * 100, 1),
                "period_days": days,
                "selected_date": date
            }
        else:
            # Filter for last N days
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            query = {"last_seen": {"$gte": cutoff}}
        
        total_visitors = await self.db.visitor_profiles.count_documents(query)
        
        returning_query = {"$and": [query, {"total_visits": {"$gt": 1}}]}
        returning_visitors = await self.db.visitor_profiles.count_documents(returning_query)
        
        checkout_query = {"$and": [query, {"reached_checkout": True}]}
        reached_checkout = await self.db.visitor_profiles.count_documents(checkout_query)
        
        address_query = {"$and": [query, {"address_entered": True}]}
        address_entered = await self.db.visitor_profiles.count_documents(address_query)
        
        # Count conversions (order_completed)
        conversion_query = {"$and": [query, {"order_completed": True}]}
        conversions = await self.db.visitor_profiles.count_documents(conversion_query)
        
        # Average time spent
        pipeline = [
            {"$match": query},
            {"$group": {"_id": None, "avg_time": {"$avg": "$total_time_spent"}}}
        ]
        avg_result = await self.db.visitor_profiles.aggregate(pipeline).to_list(1)
        avg_time = avg_result[0]["avg_time"] if avg_result else 0
        
        return {
            "total_visitors": total_visitors,
            "returning_visitors": returning_visitors,
            "new_visitors": total_visitors - returning_visitors,
            "reached_checkout": reached_checkout,
            "address_entered": address_entered,
            "conversions": conversions,
            "conversion_rate": round((conversions / max(total_visitors, 1)) * 100, 1),
            "avg_time_spent": round(avg_time or 0, 1),
            "checkout_rate": round((reached_checkout / max(total_visitors, 1)) * 100, 1),
            "period_days": days,
            "selected_date": None
        }
    
    async def get_visitors_by_date(self, date: str, limit: int = 1000) -> List[dict]:
        """Get all visitors who FIRST visited on a specific date"""
        # Get all visitors who had page visits on this date
        page_visits = await self.db.user_page_visits.find(
            {"date": date},
            {"_id": 0, "visitor_id": 1}
        ).to_list(50000)
        
        all_visitor_ids = list(set(v.get("visitor_id") for v in page_visits if v.get("visitor_id")))
        
        if not all_visitor_ids:
            return []
        
        # Get profiles for ALL visitors who had activity on this date
        visitors = await self.db.visitor_profiles.find(
            {"visitor_id": {"$in": all_visitor_ids}},
            {"_id": 0}
        ).sort("last_seen", -1).limit(limit).to_list(limit)
        
        # Enrich with page/action counts for that date
        for visitor in visitors:
            vid = visitor.get("visitor_id")
            page_count = await self.db.user_page_visits.count_documents({"visitor_id": vid, "date": date})
            action_count = await self.db.user_actions.count_documents({"visitor_id": vid, "date": date})
            visitor["pages_visited"] = page_count
            visitor["actions_count"] = action_count
            
            # Check if this was their first visit
            earliest = await self.db.user_page_visits.find_one(
                {"visitor_id": vid},
                sort=[("timestamp", 1)]
            )
            visitor["is_new_visitor"] = earliest and earliest.get("date") == date
            
            # Check if reached checkout on this date
            checkout_on_date = await self.db.user_page_visits.count_documents({"visitor_id": vid, "date": date, "page": "checkout"})
            visitor["reached_checkout_today"] = checkout_on_date > 0
        
        return visitors
