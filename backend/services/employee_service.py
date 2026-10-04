"""
Employee Management Service
Handles employee accounts with role-based access control
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from typing import Optional, List, Dict
import hashlib
import secrets


class EmployeeService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.employees
    
    def _hash_password(self, password: str) -> str:
        """Hash password with SHA-256 (auto-trimmed for copy-paste safety)."""
        return hashlib.sha256((password or "").strip().encode()).hexdigest()
    
    def _generate_password(self, length: int = 8) -> str:
        """Generate a random alphanumeric password (no '-' or '_' that confuse copy-paste)."""
        # token_urlsafe produces -, _ which look weird in passwords; use hex instead
        return secrets.token_hex(length // 2 + 1)[:length]
    
    async def create_employee(
        self,
        username: str,
        name: str,
        permissions: Dict[str, bool],
        password: Optional[str] = None,
        email: Optional[str] = None
    ) -> Dict:
        """Create a new employee account"""
        username = (username or "").strip().lower()
        email = (email or "").strip().lower() or None

        if not username:
            return {"success": False, "error": "Username is required"}

        # Check if username (or email) already exists
        existing = await self.collection.find_one({
            "$or": [
                {"username": username},
                *([{"email": email}] if email else []),
            ]
        })
        if existing:
            return {"success": False, "error": "Username or email already exists"}
        
        # Generate password if not provided (or trim provided password)
        password = (password or "").strip()
        if not password:
            password = self._generate_password()
        
        employee = {
            "username": username,
            "name": name,
            "email": email,
            "password_hash": self._hash_password(password),
            "permissions": {
                "orders": permissions.get("orders", False),
                "blogs": permissions.get("blogs", False),
                "ai_studio": permissions.get("ai_studio", False),
                "customers": permissions.get("customers", False),
                "analytics": permissions.get("analytics", False),
                "landing_pages": permissions.get("landing_pages", False),
                "consultations": permissions.get("consultations", False),
                "products": permissions.get("products", False),
                "retention": permissions.get("retention", False),
            },
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_login": None
        }
        
        await self.collection.insert_one(employee)
        
        return {
            "success": True,
            "username": username,
            "email": email,
            "password": password,  # Return plain password only on creation
            "permissions": employee["permissions"]
        }
    
    async def authenticate(self, username_or_email: str, password: str) -> Optional[Dict]:
        """Authenticate employee by username OR email; returns their data on success.

        Both username and password are trimmed and compared case-insensitively
        for the username/email — this avoids the most common 'wrong password'
        complaint caused by accidental whitespace or capitalisation on copy-paste.
        """
        identifier = (username_or_email or "").strip().lower()
        if not identifier:
            return None
        pwd_hash = self._hash_password(password)

        employee = await self.collection.find_one({
            "$or": [
                {"username": identifier},
                {"email": identifier},
            ],
            "password_hash": pwd_hash,
            "is_active": True
        })
        
        if employee:
            # Update last login
            await self.collection.update_one(
                {"_id": employee["_id"]},
                {"$set": {"last_login": datetime.now(timezone.utc)}}
            )
            
            return {
                "username": employee["username"],
                "name": employee["name"],
                "email": employee.get("email"),
                "permissions": employee["permissions"]
            }
        return None
    
    async def get_all_employees(self) -> List[Dict]:
        """Get all employees"""
        employees = []
        cursor = self.collection.find({"is_active": True})
        async for emp in cursor:
            employees.append({
                "username": emp["username"],
                "name": emp["name"],
                "email": emp.get("email"),
                "permissions": emp["permissions"],
                "created_at": emp.get("created_at"),
                "last_login": emp.get("last_login")
            })
        return employees
    
    async def update_password(self, username: str, new_password: str) -> bool:
        """Update employee password (auto-trimmed)"""
        new_password = (new_password or "").strip()
        if not new_password:
            return False
        result = await self.collection.update_one(
            {"username": (username or "").strip().lower()},
            {"$set": {"password_hash": self._hash_password(new_password)}}
        )
        return result.modified_count > 0
    
    async def update_permissions(self, username: str, permissions: Dict[str, bool]) -> bool:
        """Update employee permissions"""
        result = await self.collection.update_one(
            {"username": (username or "").strip().lower()},
            {"$set": {"permissions": permissions}}
        )
        return result.modified_count > 0
    
    async def delete_employee(self, username: str) -> bool:
        """Soft delete employee (deactivate)"""
        result = await self.collection.update_one(
            {"username": (username or "").strip().lower()},
            {"$set": {"is_active": False}}
        )
        return result.modified_count > 0
    
    async def get_employee(self, username: str) -> Optional[Dict]:
        """Get single employee details"""
        emp = await self.collection.find_one(
            {"username": (username or "").strip().lower(), "is_active": True}
        )
        if emp:
            return {
                "username": emp["username"],
                "name": emp["name"],
                "email": emp.get("email"),
                "permissions": emp["permissions"],
                "created_at": emp.get("created_at"),
                "last_login": emp.get("last_login")
            }
        return None
