"""
Referral System Service
- Generate unique referral links (homepage-share)
- Track referral purchases
- Calculate ₹50 cashback per successful referral (paid after the 7-day return
  window has passed since delivery)
- Customer-facing summaries + manual withdrawal queue
"""
import uuid
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase

# ---- Business rules (tweak in one place) ----
MIN_ORDER_AMOUNT = 500          # Referral discount + cashback only above this
DISCOUNT_AMOUNT  = 50           # ₹ off for the referred customer (same as WELCOME50)
CASHBACK_AMOUNT  = 50           # ₹ earned by the referrer
RETURN_WINDOW_DAYS = 7          # Hold on cashback until return window passes


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


class ReferralService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    # ---------- code generation ----------
    def generate_referral_code(self, phone: str) -> str:
        """Generate a unique short referral code based on phone + timestamp."""
        seed = f"{phone}_{datetime.now().timestamp()}"
        h = hashlib.sha256(seed.encode()).hexdigest()[:8].upper()
        return f"CG{h}"

    async def create_referral(self, order_data: Dict) -> Dict:
        """Create or fetch the referral entry for a customer (idempotent on phone)."""
        existing = await self.db.referrals.find_one({"referrer_phone": order_data.get("phone")})
        if existing:
            return {
                "referral_code": existing["referral_code"],
                "referral_link": f"https://celestaglow.com?ref={existing['referral_code']}",
                "is_new": False,
            }

        code = self.generate_referral_code(order_data.get("phone", ""))
        doc = {
            "referral_code": code,
            "referrer_phone": order_data.get("phone"),
            "referrer_email": order_data.get("email"),
            "referrer_name":  order_data.get("name"),
            "referrer_order_id": order_data.get("order_id"),
            "created_at": _iso(_now()),
            "total_referrals": 0,         # raw click count
            "successful_purchases": 0,    # paid + min-order-met
            "total_earnings": 0,          # lifetime ₹ earned (locked + withdrawable + paid)
            "earnings_paid": 0,           # actually paid out
            "earnings_pending": 0,        # earned but inside 7-day hold
            "earnings_withdrawable": 0,   # past 7-day hold, ready to withdraw
            "referred_orders": [],
            "status": "active",
        }
        await self.db.referrals.insert_one(doc)
        return {
            "referral_code": code,
            "referral_link": f"https://celestaglow.com?ref={code}",
            "is_new": True,
        }

    async def track_referral_click(self, referral_code: str, visitor_id: str = None) -> bool:
        ref = await self.db.referrals.find_one({"referral_code": referral_code})
        if not ref:
            return False
        await self.db.referrals.update_one(
            {"referral_code": referral_code},
            {
                "$inc": {"total_referrals": 1},
                "$push": {"clicks": {"visitor_id": visitor_id, "clicked_at": _iso(_now())}},
            },
        )
        return True

    async def validate_referral_code(self, referral_code: str) -> Optional[Dict]:
        return await self.db.referrals.find_one(
            {"referral_code": referral_code, "status": "active"},
            {"_id": 0, "referral_code": 1, "referrer_name": 1, "referrer_phone": 1},
        )

    # ---------- record a purchase made through a referral link ----------
    async def record_referral_purchase(self, referral_code: str, order_data: Dict) -> Dict:
        """Called from the order-create flow.

        - Always records the order under the referrer.
        - Cashback is ONLY earned if the order amount ≥ MIN_ORDER_AMOUNT
          (₹500). Below that we still log the order so admins can see traffic,
          but `cashback_amount` stays 0 and the referrer doesn't earn anything.
        """
        ref = await self.db.referrals.find_one({"referral_code": referral_code})
        if not ref:
            return {"success": False, "error": "Invalid referral code"}

        amount = float(order_data.get("amount") or 0)
        eligible = amount >= MIN_ORDER_AMOUNT

        referred_order = {
            "order_id":       order_data.get("order_id"),
            "buyer_phone":    order_data.get("phone"),
            "buyer_name":     order_data.get("name"),
            "order_amount":   amount,
            "purchased_at":   _iso(_now()),
            "referral_discount_applied": DISCOUNT_AMOUNT if eligible else 0,
            "cashback_amount": CASHBACK_AMOUNT if eligible else 0,
            "min_order_met":  eligible,
            "delivery_status": "pending",
            # Cashback lifecycle:
            #   pending           — order placed, not delivered yet
            #   in_return_window  — delivered, 7-day hold counter started
            #   withdrawable      — return window passed, customer can request payout
            #   paid              — admin marked paid
            "cashback_status": "pending",
            "withdrawable_after": None,
        }

        update = {"$push": {"referred_orders": referred_order}}
        if eligible:
            update["$inc"] = {
                "successful_purchases": 1,
                "total_earnings": CASHBACK_AMOUNT,
                "earnings_pending": CASHBACK_AMOUNT,
            }

        await self.db.referrals.update_one({"referral_code": referral_code}, update)

        return {
            "success": True,
            "referrer_phone": ref.get("referrer_phone"),
            "referrer_name":  ref.get("referrer_name"),
            "earnings_added": CASHBACK_AMOUNT if eligible else 0,
            "min_order_met":  eligible,
        }

    # ---------- delivery & cashback lifecycle ----------
    async def process_delivery_cashback(self, referred_order_id: str) -> Dict:
        """Called when a referred order is marked Delivered.

        Moves the cashback from `pending` → `in_return_window` and stamps a
        `withdrawable_after` timestamp 7 days into the future. The actual move
        from pending → withdrawable balance happens lazily inside
        `_promote_withdrawable_balance` next time the customer hits their
        summary endpoint.
        """
        ref = await self.db.referrals.find_one(
            {"referred_orders.order_id": referred_order_id}, {"_id": 0}
        )
        if not ref:
            return {"success": False, "error": "No referral found for this order"}

        # Find the matching order
        target = next((o for o in ref.get("referred_orders", [])
                       if o.get("order_id") == referred_order_id), None)
        if not target:
            return {"success": False, "error": "Order not found"}
        if target.get("cashback_status") in ("in_return_window", "withdrawable", "paid"):
            return {"success": False, "error": "Already processed"}
        if not target.get("min_order_met"):
            # Below ₹500 — no cashback owed, mark delivered & exit.
            await self.db.referrals.update_one(
                {"referral_code": ref["referral_code"], "referred_orders.order_id": referred_order_id},
                {"$set": {
                    "referred_orders.$.delivery_status": "delivered",
                    "referred_orders.$.delivered_at":    _iso(_now()),
                    "referred_orders.$.cashback_status": "ineligible",
                }},
            )
            return {"success": True, "earnings_added": 0, "min_order_met": False}

        withdrawable_at = _now() + timedelta(days=RETURN_WINDOW_DAYS)
        await self.db.referrals.update_one(
            {"referral_code": ref["referral_code"], "referred_orders.order_id": referred_order_id},
            {"$set": {
                "referred_orders.$.delivery_status":    "delivered",
                "referred_orders.$.delivered_at":       _iso(_now()),
                "referred_orders.$.cashback_status":    "in_return_window",
                "referred_orders.$.withdrawable_after": _iso(withdrawable_at),
            }},
        )
        return {
            "success": True,
            "referrer_phone": ref.get("referrer_phone"),
            "referrer_name":  ref.get("referrer_name"),
            "referral_code":  ref.get("referral_code"),
            "cashback_amount": CASHBACK_AMOUNT,
            "withdrawable_after": _iso(withdrawable_at),
            "message": f"₹{CASHBACK_AMOUNT} will be withdrawable on {withdrawable_at.date()}",
        }

    async def _promote_withdrawable_balance(self, referral_code: str) -> Dict:
        """Move every order whose `withdrawable_after` has passed from the
        pending bucket to the withdrawable bucket. Idempotent + cheap to call
        on every customer-summary read.
        """
        ref = await self.db.referrals.find_one({"referral_code": referral_code})
        if not ref:
            return {"promoted": 0}
        now = _now()
        promoted = 0
        for o in ref.get("referred_orders", []):
            if o.get("cashback_status") != "in_return_window":
                continue
            wa = o.get("withdrawable_after")
            try:
                wa_dt = datetime.fromisoformat(str(wa).replace("Z", "+00:00")) if wa else None
            except Exception:
                wa_dt = None
            if wa_dt and wa_dt <= now:
                await self.db.referrals.update_one(
                    {"referral_code": referral_code, "referred_orders.order_id": o.get("order_id")},
                    {
                        "$set": {"referred_orders.$.cashback_status": "withdrawable"},
                        "$inc": {"earnings_withdrawable": CASHBACK_AMOUNT,
                                 "earnings_pending":     -CASHBACK_AMOUNT},
                    },
                )
                promoted += 1
        return {"promoted": promoted}

    # ---------- customer-facing summary ----------
    async def get_customer_summary(self, phone: Optional[str] = None,
                                   email: Optional[str] = None) -> Optional[Dict]:
        """Return the data needed for the customer's referral dashboard widget.

        Looks up by phone first (more reliable since logins are OTP-on-phone),
        then by email. Always promotes withdrawable balance before returning.
        """
        query = None
        if phone:
            query = {"referrer_phone": phone}
        elif email:
            query = {"referrer_email": email.lower()}
        if not query:
            return None

        ref = await self.db.referrals.find_one(query, {"_id": 0})
        if not ref:
            return None

        await self._promote_withdrawable_balance(ref["referral_code"])
        ref = await self.db.referrals.find_one(query, {"_id": 0})

        # Trim the order list to just the fields the UI needs.
        order_view = []
        for o in ref.get("referred_orders", []):
            order_view.append({
                "order_id":          o.get("order_id"),
                "buyer_name":        o.get("buyer_name"),
                "order_amount":      o.get("order_amount"),
                "cashback_amount":   o.get("cashback_amount", 0),
                "delivery_status":   o.get("delivery_status"),
                "cashback_status":   o.get("cashback_status"),
                "purchased_at":      o.get("purchased_at"),
                "delivered_at":      o.get("delivered_at"),
                "withdrawable_after": o.get("withdrawable_after"),
                "min_order_met":     o.get("min_order_met", False),
            })

        return {
            "referral_code": ref["referral_code"],
            "referral_link": f"https://celestaglow.com?ref={ref['referral_code']}",
            "referrer_name":  ref.get("referrer_name"),
            "total_clicks":   ref.get("total_referrals", 0),
            "successful_purchases": ref.get("successful_purchases", 0),
            "total_earnings":      ref.get("total_earnings", 0),
            "earnings_paid":       ref.get("earnings_paid", 0),
            "earnings_pending":    ref.get("earnings_pending", 0),
            "earnings_withdrawable": ref.get("earnings_withdrawable", 0),
            "min_order_amount":   MIN_ORDER_AMOUNT,
            "cashback_per_referral": CASHBACK_AMOUNT,
            "discount_per_referred": DISCOUNT_AMOUNT,
            "return_window_days": RETURN_WINDOW_DAYS,
            "orders": order_view,
        }

    # ---------- withdrawal queue (option A — manual) ----------
    async def request_withdrawal(self, referral_code: str, payout_method: str,
                                 payout_destination: str, note: str = "") -> Dict:
        """Customer requests a payout of their full withdrawable balance.

        We first promote any matured holds, then create a withdrawal_request
        document referencing the referral. The referral's withdrawable balance
        is NOT decremented yet — it stays visible (with a "requested" flag) so
        the customer can see they have a pending request. It's decremented +
        moved to `earnings_paid` only when the admin marks it paid.
        """
        await self._promote_withdrawable_balance(referral_code)
        ref = await self.db.referrals.find_one({"referral_code": referral_code})
        if not ref:
            return {"success": False, "error": "Referral not found"}

        amount = int(ref.get("earnings_withdrawable", 0))
        if amount <= 0:
            return {"success": False, "error": "No withdrawable balance"}

        # Block if there's already an open request
        open_req = await self.db.withdrawal_requests.find_one({
            "referral_code": referral_code,
            "status": "pending",
        })
        if open_req:
            return {"success": False, "error": "A withdrawal request is already pending"}

        req_id = f"WR_{uuid.uuid4().hex[:10].upper()}"
        doc = {
            "request_id":   req_id,
            "referral_code": referral_code,
            "referrer_name":  ref.get("referrer_name"),
            "referrer_phone": ref.get("referrer_phone"),
            "referrer_email": ref.get("referrer_email"),
            "amount": amount,
            "payout_method": payout_method,           # "upi" / "bank"
            "payout_destination": payout_destination, # UPI ID or account number
            "note": note,
            "status": "pending",                      # pending | paid | rejected
            "created_at": _iso(_now()),
            "paid_at": None,
            "rejected_reason": None,
        }
        await self.db.withdrawal_requests.insert_one(doc)
        return {"success": True, "request_id": req_id, "amount": amount}

    async def list_withdrawal_requests(self, status: Optional[str] = None) -> List[Dict]:
        q = {"status": status} if status else {}
        cur = self.db.withdrawal_requests.find(q, {"_id": 0}).sort("created_at", -1)
        return await cur.to_list(length=200)

    async def mark_withdrawal_paid(self, request_id: str, txn_ref: str = "") -> Dict:
        """Admin marks a withdrawal request paid:
          - withdrawal_requests.status = 'paid'
          - referral.earnings_withdrawable -= amount
          - referral.earnings_paid       += amount
          - flag every 'withdrawable' order included in this payout as 'paid'
        """
        req = await self.db.withdrawal_requests.find_one({"request_id": request_id})
        if not req:
            return {"success": False, "error": "Request not found"}
        if req.get("status") != "pending":
            return {"success": False, "error": f"Request already {req.get('status')}"}

        amount = int(req.get("amount", 0))
        # Update the referral's buckets
        await self.db.referrals.update_one(
            {"referral_code": req["referral_code"]},
            {
                "$inc": {
                    "earnings_withdrawable": -amount,
                    "earnings_paid":          amount,
                },
                "$set": {"last_payment_at": _iso(_now())},
            },
        )

        # Flag the contributing orders as paid (anything currently 'withdrawable')
        ref = await self.db.referrals.find_one({"referral_code": req["referral_code"]})
        if ref:
            for o in ref.get("referred_orders", []):
                if o.get("cashback_status") == "withdrawable":
                    await self.db.referrals.update_one(
                        {"referral_code": req["referral_code"],
                         "referred_orders.order_id": o.get("order_id")},
                        {"$set": {
                            "referred_orders.$.cashback_status": "paid",
                            "referred_orders.$.paid_at": _iso(_now()),
                        }},
                    )

        await self.db.withdrawal_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "paid",
                "paid_at": _iso(_now()),
                "txn_ref": txn_ref,
            }},
        )
        return {"success": True, "request_id": request_id, "amount": amount}

    async def reject_withdrawal(self, request_id: str, reason: str) -> Dict:
        result = await self.db.withdrawal_requests.update_one(
            {"request_id": request_id, "status": "pending"},
            {"$set": {"status": "rejected", "rejected_reason": reason,
                      "rejected_at": _iso(_now())}},
        )
        return {"success": result.modified_count > 0}

    # ---------- admin / legacy helpers (kept for AdminReferrals.js) ----------
    async def get_referral_stats(self, phone: str = None,
                                 referral_code: str = None) -> Optional[Dict]:
        query = {}
        if phone:
            query["referrer_phone"] = phone
        elif referral_code:
            query["referral_code"] = referral_code
        else:
            return None
        return await self.db.referrals.find_one(query, {"_id": 0})

    async def get_all_referrals(self, limit: int = 100) -> List[Dict]:
        cur = self.db.referrals.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
        return await cur.to_list(limit)

    async def get_referral_summary(self) -> Dict:
        pipeline = [{
            "$group": {
                "_id": None,
                "total_referrers": {"$sum": 1},
                "total_clicks":    {"$sum": "$total_referrals"},
                "total_purchases": {"$sum": "$successful_purchases"},
                "total_earnings":  {"$sum": "$total_earnings"},
                "total_paid":      {"$sum": "$earnings_paid"},
                "total_pending":   {"$sum": "$earnings_pending"},
                "total_withdrawable": {"$sum": "$earnings_withdrawable"},
            }
        }]
        result = await self.db.referrals.aggregate(pipeline).to_list(1)
        if result:
            return {
                "total_referrers":    result[0].get("total_referrers", 0),
                "total_clicks":       result[0].get("total_clicks", 0),
                "total_purchases":    result[0].get("total_purchases", 0),
                "total_earnings":     result[0].get("total_earnings", 0),
                "total_paid":         result[0].get("total_paid", 0),
                "total_pending":      result[0].get("total_pending", 0),
                "total_withdrawable": result[0].get("total_withdrawable", 0),
            }
        return {
            "total_referrers": 0, "total_clicks": 0, "total_purchases": 0,
            "total_earnings": 0, "total_paid": 0, "total_pending": 0,
            "total_withdrawable": 0,
        }

    async def mark_earnings_paid(self, referral_code: str, amount: int) -> bool:
        """Legacy admin shortcut — moves `amount` ₹ from withdrawable → paid
        without going through the request queue."""
        await self._promote_withdrawable_balance(referral_code)
        ref = await self.db.referrals.find_one({"referral_code": referral_code})
        if not ref:
            return False
        wd = int(ref.get("earnings_withdrawable", 0))
        if wd < amount:
            # also try the legacy `earnings_pending` field for old data
            return False
        result = await self.db.referrals.update_one(
            {"referral_code": referral_code},
            {
                "$inc": {"earnings_paid": amount, "earnings_withdrawable": -amount},
                "$set": {"last_payment_at": _iso(_now())},
            },
        )
        return result.modified_count > 0

    async def get_referral_with_orders(self, referral_code: str) -> Optional[Dict]:
        ref = await self.db.referrals.find_one({"referral_code": referral_code}, {"_id": 0})
        if ref:
            await self._promote_withdrawable_balance(referral_code)
            ref = await self.db.referrals.find_one({"referral_code": referral_code}, {"_id": 0})
        return ref

    async def mark_order_cashback_paid(self, referral_code: str, order_id: str) -> bool:
        result = await self.db.referrals.update_one(
            {"referral_code": referral_code, "referred_orders.order_id": order_id},
            {
                "$set": {
                    "referred_orders.$.cashback_status": "paid",
                    "referred_orders.$.paid_at": _iso(_now()),
                },
                "$inc": {
                    "earnings_paid":         CASHBACK_AMOUNT,
                    "earnings_withdrawable": -CASHBACK_AMOUNT,
                },
            },
        )
        return result.modified_count > 0
