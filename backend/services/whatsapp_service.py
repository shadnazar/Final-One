"""
WhatsApp Cloud API Service for Celesta Glow
Handles sending WhatsApp messages for order confirmations and consultation results
"""
import os
import logging
import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class WhatsAppService:
    """Service for interacting with WhatsApp Cloud API"""
    
    def __init__(self, db=None):
        self.db = db
        self.phone_number_id = os.environ.get('WHATSAPP_PHONE_NUMBER_ID')
        self.business_account_id = os.environ.get('WHATSAPP_BUSINESS_ACCOUNT_ID')
        self.api_token = os.environ.get('WHATSAPP_API_TOKEN')
        self.api_version = "v18.0"
        self.api_base_url = "https://graph.facebook.com"
        
        # Verify configuration
        if not all([self.phone_number_id, self.api_token]):
            logger.warning("WhatsApp API credentials not fully configured")
    
    @property
    def messages_endpoint(self) -> str:
        """Get the WhatsApp messages API endpoint"""
        return f"{self.api_base_url}/{self.api_version}/{self.phone_number_id}/messages"
    
    @property
    def auth_headers(self) -> Dict[str, str]:
        """Get authorization headers for API requests"""
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
    
    def _format_phone_number(self, phone: str) -> str:
        """Format phone number for WhatsApp API (remove + and spaces)"""
        # Remove all non-digit characters
        clean_phone = ''.join(filter(str.isdigit, phone))
        
        # Add India country code if not present
        if len(clean_phone) == 10:
            clean_phone = f"91{clean_phone}"
        elif clean_phone.startswith('0'):
            clean_phone = f"91{clean_phone[1:]}"
        
        return clean_phone
    
    async def send_text_message(
        self,
        phone_number: str,
        message: str,
    ) -> Dict[str, Any]:
        """Send a text message via WhatsApp Cloud API
        
        Args:
            phone_number: Recipient phone number
            message: Message text to send
            
        Returns:
            API response containing message_id
        """
        clean_phone = self._format_phone_number(phone_number)
        
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_phone,
            "type": "text",
            "text": {
                "preview_url": False,
                "body": message
            }
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.messages_endpoint,
                    json=payload,
                    headers=self.auth_headers
                )
                
                result = response.json()
                
                if response.status_code == 200:
                    message_id = result.get('messages', [{}])[0].get('id')
                    logger.info(f"WhatsApp message sent successfully to {phone_number}. ID: {message_id}")
                    
                    # Log to database
                    if self.db is not None:
                        await self._log_message(
                            phone=phone_number,
                            message_type="text",
                            content=message,
                            status="sent",
                            external_id=message_id
                        )
                    
                    return {
                        "success": True,
                        "message_id": message_id,
                        "phone": phone_number
                    }
                else:
                    error_info = result.get('error', {})
                    error_message = error_info.get('message', 'Unknown error')
                    error_code = error_info.get('code', 'unknown')
                    
                    logger.error(f"WhatsApp API error {error_code}: {error_message}")
                    
                    if self.db is not None:
                        await self._log_message(
                            phone=phone_number,
                            message_type="text",
                            content=message,
                            status="failed",
                            error=f"{error_code}: {error_message}"
                        )
                    
                    return {
                        "success": False,
                        "error": error_message,
                        "error_code": error_code
                    }
                    
        except httpx.RequestError as e:
            logger.error(f"Network error sending WhatsApp message: {str(e)}")
            return {
                "success": False,
                "error": f"Network error: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Unexpected error sending WhatsApp message: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def send_order_confirmation(
        self,
        phone_number: str,
        order_id: str,
        customer_name: str,
        amount: float,
        payment_method: str,
        delivery_timeline: str
    ) -> Dict[str, Any]:
        """Send order confirmation message via WhatsApp"""
        
        message = f"""*Order Confirmed!* ✅

Thank you for your order, {customer_name}!

*Order ID:* {order_id}
*Product:* Celesta Glow Anti-Aging Serum (30ml)
*Amount:* ₹{amount}
*Payment:* {payment_method}
*Delivery:* {delivery_timeline}

Your skin transformation journey begins! 🌟

Track your order or contact us anytime.

- Team Celesta Glow"""
        
        result = await self.send_text_message(phone_number, message)
        
        if result.get("success") and self.db is not None:
            # Update order with WhatsApp notification status
            await self.db.orders.update_one(
                {"order_id": order_id},
                {"$set": {"whatsapp_notified": True, "whatsapp_notified_at": datetime.now(timezone.utc).isoformat()}}
            )
        
        return result
    
    async def send_consultation_result(
        self,
        phone_number: str,
        customer_name: str,
        consultation_id: str,
        skin_type: str,
        concerns: List[str],
        recommendations: str
    ) -> Dict[str, Any]:
        """Send consultation result message via WhatsApp"""
        
        concerns_text = ", ".join(concerns) if concerns else "General skincare"
        
        message = f"""*Your Skin Analysis Results* 🔬

Hi {customer_name},

Here are your personalized results:

*Consultation ID:* {consultation_id}
*Skin Type:* {skin_type}
*Concerns:* {concerns_text}

*Our Recommendations:*
{recommendations}

For best results, use Celesta Glow Anti-Aging Serum twice daily.

Questions? Reply to this message or visit celestaglow.com

- Team Celesta Glow"""
        
        result = await self.send_text_message(phone_number, message)
        
        if result.get("success") and self.db is not None:
            # Update consultation with WhatsApp notification status
            await self.db.consultations.update_one(
                {"consultation_id": consultation_id},
                {"$set": {"whatsapp_result_sent": True, "whatsapp_sent_at": datetime.now(timezone.utc).isoformat()}}
            )
        
        return result
    
    async def send_custom_message(
        self,
        phone_number: str,
        message: str,
        message_category: str = "promotional"
    ) -> Dict[str, Any]:
        """Send a custom message via WhatsApp (admin use)"""
        
        result = await self.send_text_message(phone_number, message)
        
        if result.get("success") and self.db is not None:
            await self._log_message(
                phone=phone_number,
                message_type="custom",
                content=message,
                status="sent",
                external_id=result.get("message_id"),
                category=message_category
            )
        
        return result
    
    async def send_bulk_messages(
        self,
        phone_numbers: List[str],
        message: str,
        message_category: str = "promotional"
    ) -> Dict[str, Any]:
        """Send bulk messages to multiple recipients"""
        
        results = {
            "total": len(phone_numbers),
            "sent": 0,
            "failed": 0,
            "details": []
        }
        
        for phone in phone_numbers:
            result = await self.send_text_message(phone, message)
            
            if result.get("success"):
                results["sent"] += 1
            else:
                results["failed"] += 1
            
            results["details"].append({
                "phone": phone,
                "success": result.get("success", False),
                "error": result.get("error") if not result.get("success") else None
            })
        
        return results
    
    async def _log_message(
        self,
        phone: str,
        message_type: str,
        content: str,
        status: str,
        external_id: Optional[str] = None,
        error: Optional[str] = None,
        category: Optional[str] = None
    ):
        """Log WhatsApp message to database"""
        if self.db is None:
            return
        
        log_entry = {
            "phone": phone,
            "message_type": message_type,
            "content": content[:500],  # Truncate for storage
            "status": status,
            "external_id": external_id,
            "error": error,
            "category": category,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.whatsapp_logs.insert_one(log_entry)
    
    async def get_message_logs(
        self,
        limit: int = 50,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get WhatsApp message logs"""
        if self.db is None:
            return []
        
        query = {}
        if status:
            query["status"] = status
        
        logs = await self.db.whatsapp_logs.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return logs
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get WhatsApp messaging statistics"""
        if self.db is None:
            return {"error": "Database not connected"}
        
        total = await self.db.whatsapp_logs.count_documents({})
        sent = await self.db.whatsapp_logs.count_documents({"status": "sent"})
        failed = await self.db.whatsapp_logs.count_documents({"status": "failed"})
        
        # Get today's stats
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_total = await self.db.whatsapp_logs.count_documents({
            "created_at": {"$regex": f"^{today}"}
        })
        
        return {
            "total_messages": total,
            "sent": sent,
            "failed": failed,
            "success_rate": round((sent / total * 100), 2) if total > 0 else 0,
            "today_messages": today_total
        }
