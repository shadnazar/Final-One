"""
Enhanced Analytics Tracker - Real-time visitor tracking with page-wise analytics
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid


class EnhancedAnalyticsTracker:
    def __init__(self, db):
        self.db = db
        # In-memory cache for live visitors - keyed by session_id
        # When user navigates pages, their entry is updated (not duplicated)
        self.live_visitors = {}
        # Track unique IPs per page to prevent same IP counting multiple times
        self.ip_page_tracker = {}  # {ip: {page: last_seen}}
    
    async def track_page_visit(self, page: str, session_id: str, user_agent: str = None, referrer: str = None, ip_address: str = None):
        """Track a page visit with detailed information including IP
        
        Key behaviors:
        1. Session-based: When user moves from homepage to product, homepage count decreases, product increases
        2. IP deduplication: Same IP on same page within 5 min window counts as 1 visitor only
        """
        now = datetime.now(timezone.utc)
        
        # Normalize page name for tracking
        normalized_page = self._normalize_page(page)
        
        # Update live visitors cache - session_id is key, so moving pages updates the entry
        self.live_visitors[session_id] = {
            "page": normalized_page,
            "last_seen": now,
            "user_agent": user_agent,
            "ip_address": ip_address
        }
        
        # Clean up stale sessions (older than 5 minutes)
        cutoff = now - timedelta(minutes=5)
        self.live_visitors = {
            k: v for k, v in self.live_visitors.items() 
            if v["last_seen"] > cutoff
        }
        
        # Clean up stale IP tracking
        self._cleanup_ip_tracker(cutoff)
        
        # Check if this IP already visited this page recently (for historical stats)
        should_count_visit = True
        if ip_address:
            if ip_address in self.ip_page_tracker:
                if normalized_page in self.ip_page_tracker[ip_address]:
                    last_visit = self.ip_page_tracker[ip_address][normalized_page]
                    # If same IP visited same page within last 30 minutes, don't count again
                    if last_visit > (now - timedelta(minutes=30)):
                        should_count_visit = False
            
            # Update IP tracker
            if ip_address not in self.ip_page_tracker:
                self.ip_page_tracker[ip_address] = {}
            self.ip_page_tracker[ip_address][normalized_page] = now
        
        # Store in database for historical tracking (always store for audit)
        visit_doc = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "page": normalized_page,
            "raw_page": page,
            "user_agent": user_agent,
            "referrer": referrer,
            "ip_address": ip_address,
            "timestamp": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "hour": now.hour,
            "counted": should_count_visit  # Flag to know if this was counted in stats
        }
        
        await self.db.page_visits.insert_one(visit_doc)
        
        # Only increment stats if this is a unique visit (not same IP refreshing)
        if should_count_visit:
            # Update page stats for normalized page
            await self.db.page_stats.update_one(
                {"page": normalized_page, "date": now.strftime("%Y-%m-%d")},
                {
                    "$inc": {"visits": 1},
                    "$setOnInsert": {"page": normalized_page, "date": now.strftime("%Y-%m-%d")}
                },
                upsert=True
            )
            
            # Update total stats
            await self.db.total_stats.update_one(
                {"type": "global"},
                {
                    "$inc": {"total_visits": 1},
                    "$set": {"last_updated": now.isoformat()}
                },
                upsert=True
            )
        
        # Track IP location if provided
        if ip_address:
            await self._track_ip_location(ip_address, now)
        
        return {"tracked": True, "session_id": session_id, "counted": should_count_visit}
    
    def _cleanup_ip_tracker(self, cutoff: datetime):
        """Clean up old IP tracking entries"""
        ips_to_remove = []
        for ip, pages in self.ip_page_tracker.items():
            pages_to_remove = [p for p, t in pages.items() if t < cutoff]
            for p in pages_to_remove:
                del pages[p]
            if not pages:
                ips_to_remove.append(ip)
        for ip in ips_to_remove:
            del self.ip_page_tracker[ip]
    
    def _normalize_page(self, page: str) -> str:
        """Normalize page URLs to standard categories for tracking"""
        page_lower = page.lower().strip('/')
        
        if page_lower == '' or page_lower == 'home' or page_lower == '/':
            return 'Homepage'
        elif page_lower.startswith('product') or page_lower.startswith('serum'):
            return 'Product Page'
        elif page_lower.startswith('checkout'):
            return 'Checkout'
        elif page_lower.startswith('blog'):
            return 'Blog'
        elif page_lower.startswith('consultation'):
            return 'Consultation'
        elif page_lower.startswith('location'):
            return 'Location'
        elif page_lower.startswith('order-confirmed'):
            return 'Order Confirmed'
        else:
            # Capitalize first letter for display
            return page.strip('/').title() if page.strip('/') else 'Other'
    
    async def _track_ip_location(self, ip_address: str, timestamp: datetime):
        """Track IP address for location analytics"""
        if not ip_address or ip_address in ['127.0.0.1', 'localhost', '::1']:
            return
        
        # Update IP location tracking
        await self.db.ip_locations.update_one(
            {"ip": ip_address},
            {
                "$inc": {"visit_count": 1},
                "$set": {"last_visit": timestamp.isoformat()},
                "$setOnInsert": {"ip": ip_address, "first_visit": timestamp.isoformat()}
            },
            upsert=True
        )
    
    def get_live_visitors_count(self, page: str = None):
        """Get count of live visitors (active in last 5 minutes)"""
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=5)
        
        # Clean up stale sessions
        self.live_visitors = {
            k: v for k, v in self.live_visitors.items() 
            if v["last_seen"] > cutoff
        }
        
        if page:
            normalized = self._normalize_page(page)
            return len([v for v in self.live_visitors.values() if v["page"] == normalized])
        return len(self.live_visitors)
    
    def get_live_visitors_by_page(self):
        """Get live visitors count grouped by page"""
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=5)
        
        # Clean up stale sessions
        self.live_visitors = {
            k: v for k, v in self.live_visitors.items() 
            if v["last_seen"] > cutoff
        }
        
        page_counts = {}
        for visitor in self.live_visitors.values():
            page = visitor["page"]
            page_counts[page] = page_counts.get(page, 0) + 1
        
        return page_counts
    
    async def get_page_visit_totals(self):
        """Get total visit counts for key pages (Homepage, Product, Checkout)"""
        key_pages = ['Homepage', 'Product Page', 'Checkout']
        totals = {}
        
        for page in key_pages:
            stats = await self.db.page_stats.find({"page": page}, {"_id": 0, "visits": 1}).to_list(1000)
            totals[page] = sum(s.get("visits", 0) for s in stats)
        
        return totals
    
    async def get_top_locations(self, limit: int = 10):
        """Get top visitor locations based on IP tracking"""
        # Try to get state-level data from orders (most reliable)
        pipeline = [
            {"$group": {"_id": "$state", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit}
        ]
        
        state_counts = await self.db.orders.aggregate(pipeline).to_list(limit)
        
        # Also get from page visits if we have IP data
        ip_pipeline = [
            {"$match": {"ip_address": {"$exists": True, "$ne": None}}},
            {"$group": {"_id": "$ip_address", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 100}
        ]
        
        ip_counts = await self.db.page_visits.aggregate(ip_pipeline).to_list(100)
        
        # Combine results
        locations = []
        for state in state_counts:
            if state["_id"]:
                locations.append({
                    "location": state["_id"],
                    "visits": state["count"],
                    "source": "orders"
                })
        
        # Add unique IPs count
        unique_ips = len(ip_counts)
        
        return {
            "top_states": locations,
            "unique_visitors": unique_ips,
            "total_ips_tracked": sum(ip.get("count", 0) for ip in ip_counts)
        }
    
    async def get_page_analytics(self, page: str = None, days: int = 7):
        """Get detailed page analytics"""
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days)
        
        query = {"date": {"$gte": start_date.strftime("%Y-%m-%d")}}
        if page:
            query["page"] = page
        
        stats = await self.db.page_stats.find(query, {"_id": 0}).to_list(1000)
        
        # Aggregate by page
        page_totals = {}
        daily_data = {}
        
        for stat in stats:
            pg = stat["page"]
            date = stat["date"]
            visits = stat.get("visits", 0)
            
            if pg not in page_totals:
                page_totals[pg] = 0
            page_totals[pg] += visits
            
            if date not in daily_data:
                daily_data[date] = {}
            daily_data[date][pg] = visits
        
        return {
            "page_totals": page_totals,
            "daily_data": daily_data,
            "period_days": days
        }
    
    async def get_total_stats(self):
        """Get total site statistics"""
        stats = await self.db.total_stats.find_one({"type": "global"}, {"_id": 0})
        return stats or {"total_visits": 0}
    
    async def get_hourly_distribution(self, page: str = None, days: int = 7):
        """Get visitor distribution by hour"""
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days)
        
        query = {"timestamp": {"$gte": start_date.isoformat()}}
        if page:
            query["page"] = page
        
        visits = await self.db.page_visits.find(query, {"_id": 0, "hour": 1}).to_list(10000)
        
        hourly = {i: 0 for i in range(24)}
        for visit in visits:
            hour = visit.get("hour", 0)
            hourly[hour] += 1
        
        return hourly

    async def get_daywise_analytics(self, days: int = 7, start_date: str = None, end_date: str = None):
        """Get day-wise visitor analytics for Homepage, Product Page, and Checkout
        
        Args:
            days: Number of days to look back (used if start_date/end_date not provided)
            start_date: Custom start date in YYYY-MM-DD format
            end_date: Custom end date in YYYY-MM-DD format
        
        Returns:
            Dictionary with daily_stats (list of day data) and totals
        """
        now = datetime.now(timezone.utc)
        
        # Determine date range
        if start_date and end_date:
            date_start = start_date
            date_end = end_date
        else:
            date_end = now.strftime("%Y-%m-%d")
            date_start = (now - timedelta(days=days)).strftime("%Y-%m-%d")
        
        # Query page_stats for the date range
        query = {
            "date": {"$gte": date_start, "$lte": date_end},
            "page": {"$in": ["Homepage", "Product Page", "Checkout", "homepage", "product", "checkout"]}
        }
        
        stats = await self.db.page_stats.find(query, {"_id": 0}).to_list(10000)
        
        # Also get from page_visits for more accurate data
        visits_query = {
            "date": {"$gte": date_start, "$lte": date_end}
        }
        visits = await self.db.page_visits.find(
            visits_query, 
            {"_id": 0, "date": 1, "page": 1}
        ).to_list(100000)
        
        # Aggregate by date and page type
        daily_data = {}
        
        # Process page_stats
        for stat in stats:
            date = stat["date"]
            page = stat["page"].lower()
            visits_count = stat.get("visits", 0)
            
            if date not in daily_data:
                daily_data[date] = {"homepage": 0, "product": 0, "checkout": 0, "total": 0}
            
            # Normalize page names
            if page in ["homepage", "home"]:
                daily_data[date]["homepage"] += visits_count
            elif page in ["product page", "product", "serum"]:
                daily_data[date]["product"] += visits_count
            elif page in ["checkout"]:
                daily_data[date]["checkout"] += visits_count
            
            daily_data[date]["total"] += visits_count
        
        # If we have raw visits data, use that for more accurate counts
        if visits:
            # Reset and recalculate from raw visits
            daily_data_v2 = {}
            for visit in visits:
                date = visit.get("date", "")
                page = (visit.get("page", "") or "").lower()
                
                if not date:
                    continue
                    
                if date not in daily_data_v2:
                    daily_data_v2[date] = {"homepage": 0, "product": 0, "checkout": 0, "total": 0}
                
                # Normalize page names and count
                if page in ["homepage", "home", ""]:
                    daily_data_v2[date]["homepage"] += 1
                elif page in ["product page", "product", "serum"]:
                    daily_data_v2[date]["product"] += 1
                elif page in ["checkout"]:
                    daily_data_v2[date]["checkout"] += 1
                # Always increment total for key pages
                if page in ["homepage", "home", "", "product page", "product", "serum", "checkout"]:
                    daily_data_v2[date]["total"] += 1
            
            # Use v2 data if it has more entries
            if len(daily_data_v2) >= len(daily_data):
                daily_data = daily_data_v2
        
        # Convert to sorted list
        daily_stats = []
        totals = {"homepage": 0, "product": 0, "checkout": 0, "total": 0}
        
        for date in sorted(daily_data.keys(), reverse=True):
            data = daily_data[date]
            daily_stats.append({
                "date": date,
                "homepage": data["homepage"],
                "product": data["product"],
                "checkout": data["checkout"],
                "total": data["homepage"] + data["product"] + data["checkout"]
            })
            totals["homepage"] += data["homepage"]
            totals["product"] += data["product"]
            totals["checkout"] += data["checkout"]
        
        totals["total"] = totals["homepage"] + totals["product"] + totals["checkout"]
        
        return {
            "daily_stats": daily_stats,
            "totals": totals,
            "date_range": {
                "start": date_start,
                "end": date_end
            }
        }


class VisitorLeadTracker:
    """Track visitor phone numbers for discount offers"""
    
    def __init__(self, db):
        self.db = db
    
    async def save_visitor_lead(self, phone: str, session_id: str, page: str, discount_code: str = "WELCOME50"):
        """Save a visitor's phone number when they claim discount"""
        now = datetime.now(timezone.utc)
        
        # Check if phone already exists
        existing = await self.db.visitor_leads.find_one({"phone": phone})
        if existing:
            return {"success": False, "message": "Phone number already registered", "already_claimed": True}
        
        lead_doc = {
            "id": str(uuid.uuid4()),
            "phone": phone,
            "session_id": session_id,
            "page": page,
            "discount_code": discount_code,
            "discount_amount": 50,
            "claimed_at": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "converted": False,
            "conversion_order_id": None
        }
        
        await self.db.visitor_leads.insert_one(lead_doc)
        
        return {
            "success": True,
            "discount_code": discount_code,
            "discount_amount": 50,
            "message": "Discount unlocked!"
        }
    
    async def get_all_leads(self, limit: int = 500):
        """Get all visitor leads for admin panel"""
        leads = await self.db.visitor_leads.find({}, {"_id": 0}).sort("claimed_at", -1).limit(limit).to_list(limit)
        return leads
    
    async def get_leads_stats(self):
        """Get visitor leads statistics"""
        total = await self.db.visitor_leads.count_documents({})
        converted = await self.db.visitor_leads.count_documents({"converted": True})
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_leads = await self.db.visitor_leads.count_documents({"date": today})
        
        return {
            "total_leads": total,
            "converted_leads": converted,
            "conversion_rate": round((converted / total * 100) if total > 0 else 0, 1),
            "today_leads": today_leads
        }
    
    async def mark_converted(self, phone: str, order_id: str):
        """Mark a lead as converted when they place an order"""
        await self.db.visitor_leads.update_one(
            {"phone": phone},
            {"$set": {"converted": True, "conversion_order_id": order_id}}
        )
