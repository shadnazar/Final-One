"""
Customer Service
Handles customer data aggregation from orders, leads, and consultations
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from typing import Optional, List, Dict


class CustomerService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def get_all_customers(self, limit: int = 100, skip: int = 0) -> Dict:
        """Get all customers with their order status and details"""
        customers = {}
        
        # Get customers from orders
        orders_cursor = self.db.orders.find().sort("created_at", -1)
        async for order in orders_cursor:
            phone = order.get("phone", "").replace("+91", "").replace(" ", "")[-10:]
            if not phone:
                continue
                
            if phone not in customers:
                customers[phone] = {
                    "phone": phone,
                    "name": order.get("customer_name") or order.get("name", ""),
                    "email": order.get("email", ""),
                    "has_purchased": True,
                    "orders": [],
                    "total_spent": 0,
                    "address": {
                        "house": order.get("house", order.get("address", "")),
                        "area": order.get("area", ""),
                        "city": order.get("city", ""),
                        "state": order.get("state", ""),
                        "pincode": order.get("pincode", "")
                    },
                    "source": "order",
                    "first_contact": order.get("created_at"),
                    "last_contact": order.get("created_at")
                }
            
            # Add order to customer
            customers[phone]["orders"].append({
                "order_id": order.get("order_id"),
                "amount": order.get("amount", 0),
                "status": order.get("status", "pending"),
                "payment_method": order.get("payment_method", ""),
                "date": order.get("created_at"),
                "items": order.get("items") or [],
                "combo_id": order.get("combo_id")
            })
            customers[phone]["total_spent"] += order.get("amount", 0)
            
            # Update last contact
            order_date = order.get("created_at")
            if order_date and (not customers[phone]["last_contact"] or order_date > customers[phone]["last_contact"]):
                customers[phone]["last_contact"] = order_date
        
        # Get customers from phone leads (who haven't purchased)
        leads_cursor = self.db.phone_leads.find().sort("timestamp", -1)
        async for lead in leads_cursor:
            phone = lead.get("phone", "").replace("+91", "").replace(" ", "")[-10:]
            if not phone or phone in customers:
                continue
            
            customers[phone] = {
                "phone": phone,
                "name": lead.get("name", ""),
                "email": "",
                "has_purchased": False,
                "orders": [],
                "total_spent": 0,
                "address": {
                    "house": "",
                    "area": "",
                    "city": "",
                    "state": lead.get("state", ""),
                    "pincode": ""
                },
                "source": "lead",
                "first_contact": lead.get("timestamp"),
                "last_contact": lead.get("timestamp")
            }

        # Get customers from popup discount claims (visitor_leads collection)
        visitor_leads_cursor = self.db.visitor_leads.find().sort("claimed_at", -1)
        async for lead in visitor_leads_cursor:
            phone = (lead.get("phone") or "").replace("+91", "").replace(" ", "")[-10:]
            if not phone or phone in customers:
                continue
            customers[phone] = {
                "phone": phone,
                "name": lead.get("name", ""),
                "email": lead.get("email", ""),
                "has_purchased": False,
                "orders": [],
                "total_spent": 0,
                "address": {"house": "", "area": "", "city": "", "state": "", "pincode": ""},
                "source": "popup",
                "first_contact": lead.get("claimed_at") or lead.get("created_at"),
                "last_contact": lead.get("claimed_at") or lead.get("created_at"),
                "discount_code": lead.get("discount_code", ""),
                "page_claimed_on": lead.get("page", "")
            }
        
        # Get customers from consultations
        consult_cursor = self.db.consultations.find().sort("created_at", -1)
        async for consult in consult_cursor:
            phone = consult.get("phone", "").replace("+91", "").replace(" ", "")[-10:]
            if not phone:
                continue
            
            if phone not in customers:
                customers[phone] = {
                    "phone": phone,
                    "name": consult.get("name", ""),
                    "email": consult.get("email", ""),
                    "has_purchased": False,
                    "orders": [],
                    "total_spent": 0,
                    "address": {
                        "house": "",
                        "area": "",
                        "city": "",
                        "state": "",
                        "pincode": ""
                    },
                    "source": "consultation",
                    "first_contact": consult.get("created_at"),
                    "last_contact": consult.get("created_at"),
                    "consultation_id": str(consult.get("_id", ""))
                }
            else:
                # Add consultation info to existing customer
                customers[phone]["consultation_id"] = str(consult.get("_id", ""))
        
        # Convert to list and sort
        customer_list = list(customers.values())
        customer_list.sort(key=lambda x: x.get("last_contact") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        
        # Calculate stats
        total_customers = len(customer_list)
        purchased_count = sum(1 for c in customer_list if c["has_purchased"])
        leads_count = total_customers - purchased_count
        
        # Paginate
        paginated = customer_list[skip:skip + limit]
        
        return {
            "customers": paginated,
            "stats": {
                "total_customers": total_customers,
                "purchased": purchased_count,
                "leads": leads_count,
                "total_revenue": sum(c["total_spent"] for c in customer_list)
            },
            "pagination": {
                "total": total_customers,
                "limit": limit,
                "skip": skip
            }
        }
    
    async def get_customer_by_phone(self, phone: str) -> Optional[Dict]:
        """Get detailed customer info by phone"""
        phone = phone.replace("+91", "").replace(" ", "")[-10:]
        
        result = await self.get_all_customers(limit=1000)
        for customer in result["customers"]:
            if customer["phone"] == phone:
                return customer
        return None
    
    async def search_customers(self, query: str, limit: int = 50) -> List[Dict]:
        """Search customers by name, phone, or email"""
        query = query.lower().strip()
        result = await self.get_all_customers(limit=500)
        
        matches = []
        for customer in result["customers"]:
            if (query in customer["phone"] or 
                query in customer.get("name", "").lower() or 
                query in customer.get("email", "").lower()):
                matches.append(customer)
                if len(matches) >= limit:
                    break
        
        return matches
