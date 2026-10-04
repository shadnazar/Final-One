"""One-shot script to push a fresh DB snapshot to the NEW Cloudinary account.

Run with:  cd /app/backend && python3 scripts/migrate_to_new_cloudinary.py
"""
import asyncio
import os
import sys
import time
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
sys.path.insert(0, "/app/backend")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from services.catalog_backup import snapshot  # noqa: E402


async def main():
    t0 = time.time()
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    print(f"[{time.strftime('%H:%M:%S')}] cloud={os.environ['CLOUDINARY_CLOUD_NAME']}", flush=True)
    print(f"[{time.strftime('%H:%M:%S')}] starting full snapshot upload...", flush=True)
    res = await snapshot(db)
    print(f"[{time.strftime('%H:%M:%S')}] done in {round(time.time() - t0)}s", flush=True)
    print(f"public_id : {res.get('public_id')}", flush=True)
    print(f"version   : {res.get('version')}", flush=True)
    print(f"counts    : products={res.get('counts', {}).get('products')}", flush=True)


asyncio.run(main())
