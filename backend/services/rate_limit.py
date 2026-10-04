"""Rate limiting middleware for FastAPI (B8 fix S12).

In-memory token bucket per (IP, endpoint-prefix). Sufficient for single-pod deployments.
For multi-pod, swap in Redis-backed counter.
"""
import time
import logging
from collections import defaultdict, deque
from typing import Dict, Deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Per-route rate limits: (max_requests, window_seconds)
# Tight on auth/order/coupon endpoints (abuse vectors), looser on reads.
LIMITS = {
    "/api/admin/login": (5, 60),
    "/api/customer/send-otp": (3, 60),
    "/api/customer/verify-otp": (5, 60),
    "/api/orders": (10, 60),
    "/api/validate-coupon": (20, 60),
    "/api/claim-discount": (3, 300),
    "/api/create-razorpay-order": (15, 60),
    "/api/verify-payment": (15, 60),
}
DEFAULT_LIMIT = (300, 60)  # 5 req/s sustained for everything else

# bucket: { (ip, route): deque[timestamps] }
_buckets: Dict[tuple, Deque[float]] = defaultdict(deque)


def _route_key(path: str) -> str:
    """Match longest prefix in LIMITS; fall back to default."""
    for k in LIMITS:
        if path.startswith(k):
            return k
    return "__default__"


def _client_ip(request) -> str:
    fwd = request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip")
    if fwd:
        return fwd.split(",")[0].strip()
    return getattr(request.client, "host", "unknown")


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path
        # Only rate-limit /api/* — static assets and websocket-style endpoints exempt.
        if not path.startswith("/api/"):
            return await call_next(request)

        route = _route_key(path)
        limit, window = LIMITS.get(route, DEFAULT_LIMIT)
        ip = _client_ip(request)
        bucket = _buckets[(ip, route)]
        now = time.time()
        # Drop timestamps outside the window
        while bucket and bucket[0] < now - window:
            bucket.popleft()
        if len(bucket) >= limit:
            retry_after = max(1, int(window - (now - bucket[0])))
            logger.warning(f"[rate-limit] BLOCKED ip={ip} route={route} count={len(bucket)}/{limit}")
            return JSONResponse(
                {"detail": f"Too many requests. Try again in {retry_after}s."},
                status_code=429,
                headers={"Retry-After": str(retry_after)},
            )
        bucket.append(now)
        return await call_next(request)
