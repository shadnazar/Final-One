"""Gift card system — backend service + Pydantic models.

Logic:
  • Admin creates a gift card with a code + face value (initial_balance).
  • Customers redeem on checkout: discount = min(gift_card_balance, cart_total).
  • Gift card balance is decremented on order completion.
  • Cards can be used unlimitedly until balance hits 0.
  • Each redemption recorded in `gift_card_redemptions` for audit.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
import re
import secrets


def _normalize(code: str) -> str:
    return re.sub(r"\s+", "", (code or "").upper())


class GiftCardService:
    def __init__(self, db):
        self.db = db

    async def ensure_indexes(self):
        try:
            await self.db.gift_cards.create_index("code", unique=True)
            await self.db.gift_card_redemptions.create_index("code")
            await self.db.gift_card_redemptions.create_index("order_id")
        except Exception:
            pass

    async def list_cards(self, page: int = 1, limit: int = 50):
        skip = (page - 1) * limit
        total = await self.db.gift_cards.count_documents({})
        cur = self.db.gift_cards.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
        return {"items": await cur.to_list(limit), "total": total, "page": page, "limit": limit}

    async def create_card(self, code: Optional[str], initial_balance: float, label: str = "", expiry_date: Optional[str] = None):
        c = _normalize(code) if code else f"GC{secrets.token_hex(4).upper()}"
        if await self.db.gift_cards.find_one({"code": c}):
            raise ValueError(f"Code {c} already exists")
        if initial_balance <= 0:
            raise ValueError("initial_balance must be > 0")
        doc = {
            "code": c,
            "initial_balance": float(initial_balance),
            "remaining_balance": float(initial_balance),
            "label": (label or "").strip(),
            "expiry_date": expiry_date,
            "is_active": True,
            "redemption_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await self.db.gift_cards.insert_one(doc)
        doc.pop("_id", None)
        return doc

    async def get(self, code: str):
        c = _normalize(code)
        return await self.db.gift_cards.find_one({"code": c}, {"_id": 0})

    async def update(self, code: str, **fields):
        c = _normalize(code)
        allowed = {k: v for k, v in fields.items() if k in ("label", "is_active", "expiry_date", "remaining_balance")}
        if not allowed:
            return await self.get(c)
        allowed["updated_at"] = datetime.now(timezone.utc).isoformat()
        await self.db.gift_cards.update_one({"code": c}, {"$set": allowed})
        return await self.get(c)

    async def delete(self, code: str):
        c = _normalize(code)
        r = await self.db.gift_cards.delete_one({"code": c})
        return r.deleted_count > 0

    async def validate_for_redemption(self, code: str, order_amount: float) -> dict:
        """Pre-flight: check if card is valid AND compute discount.

        Returns dict with: valid, discount, remaining_after, message.
        Does NOT mutate balance — use redeem() at order-confirmation time.
        """
        c = _normalize(code)
        gc = await self.db.gift_cards.find_one({"code": c}, {"_id": 0})
        if not gc:
            return {"valid": False, "discount": 0, "message": "Gift card not found"}
        if not gc.get("is_active"):
            return {"valid": False, "discount": 0, "message": "Gift card inactive"}
        if gc.get("expiry_date"):
            try:
                if datetime.fromisoformat(gc["expiry_date"]) < datetime.now(timezone.utc):
                    return {"valid": False, "discount": 0, "message": "Gift card expired"}
            except Exception:
                pass
        bal = float(gc.get("remaining_balance") or 0)
        if bal <= 0:
            return {"valid": False, "discount": 0, "message": "Gift card has zero balance"}
        discount = min(bal, float(order_amount))
        return {
            "valid": True,
            "code": c,
            "discount": round(discount, 2),
            "remaining_balance": round(bal, 2),
            "remaining_after": round(bal - discount, 2),
            "message": f"₹{discount:.0f} will be applied from your gift card. Remaining after order: ₹{bal - discount:.0f}",
        }

    async def redeem(self, code: str, amount: float, order_id: str) -> dict:
        """Atomically decrement balance + log redemption. Idempotent on (code, order_id)."""
        c = _normalize(code)
        # Idempotency: if already redeemed for this order, return as-is
        existing = await self.db.gift_card_redemptions.find_one({"code": c, "order_id": order_id}, {"_id": 0})
        if existing:
            return {"already_redeemed": True, "discount": existing.get("amount", 0)}

        gc = await self.db.gift_cards.find_one({"code": c})
        if not gc:
            return {"success": False, "error": "Gift card not found"}
        bal = float(gc.get("remaining_balance") or 0)
        if bal <= 0:
            return {"success": False, "error": "Zero balance"}
        actual = min(bal, float(amount))
        new_bal = round(bal - actual, 2)
        await self.db.gift_cards.update_one(
            {"code": c, "remaining_balance": {"$gte": actual}},
            {
                "$inc": {"redemption_count": 1},
                "$set": {"remaining_balance": new_bal, "updated_at": datetime.now(timezone.utc).isoformat()},
            },
        )
        await self.db.gift_card_redemptions.insert_one({
            "code": c,
            "order_id": order_id,
            "amount": actual,
            "balance_before": bal,
            "balance_after": new_bal,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": True, "discount": actual, "remaining_balance": new_bal}

    async def history(self, code: str, limit: int = 50):
        c = _normalize(code)
        cur = self.db.gift_card_redemptions.find({"code": c}, {"_id": 0}).sort("timestamp", -1).limit(limit)
        return await cur.to_list(limit)
