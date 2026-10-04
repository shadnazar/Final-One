"""
Unified email service with automatic Gmail → SendGrid failover.

Daily routing rule (exactly what the merchant asked for):
  • Every day (IST), the FIRST 250 emails go out via Gmail SMTP.
  • Email #251 and beyond that day automatically switch to SendGrid.
  • Counter resets at midnight IST.

Why this exists: Gmail silently refuses after ~500/day and flags accounts.
Routing through SendGrid past 250 keeps delivery healthy and inbox-safe during
flash sales / ad campaigns without the merchant touching anything.

Persists the counter in MongoDB (`email_daily_counter` doc with {date, count})
so it survives pod restarts and works across multiple workers.
"""
import os
import smtplib
import logging
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict

logger = logging.getLogger(__name__)

# IST = UTC+5:30
IST_OFFSET = timedelta(hours=5, minutes=30)

_db = None  # injected by server.py


def set_db(db):
    global _db
    _db = db


def _ist_date_key() -> str:
    """Today's date in IST as YYYY-MM-DD — used as the bucket key."""
    ist_now = datetime.now(timezone.utc) + IST_OFFSET
    return ist_now.strftime("%Y-%m-%d")


async def _get_daily_count() -> int:
    """Read the Gmail-sent count for today (IST)."""
    if _db is None:
        return 0
    key = _ist_date_key()
    doc = await _db.email_daily_counter.find_one({"date": key, "channel": "smtp"})
    return int((doc or {}).get("count", 0))


async def _increment_count(channel: str) -> None:
    """Increment the per-day counter for the given channel (smtp | sendgrid)."""
    if _db is None:
        return
    key = _ist_date_key()
    await _db.email_daily_counter.update_one(
        {"date": key, "channel": channel},
        {"$inc": {"count": 1}, "$set": {"last_sent_at": datetime.now(timezone.utc)}},
        upsert=True,
    )


def _smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASSWORD"))


def _sendgrid_configured() -> bool:
    return bool(os.environ.get("SENDGRID_API_KEY"))


def _smtp_daily_limit() -> int:
    try:
        return int(os.environ.get("SMTP_DAILY_LIMIT", "250"))
    except ValueError:
        return 250


def _from_address() -> str:
    """Resolve the From address. Prefer an env override, else BUSINESS_EMAIL,
    else build `noreply@<EMAIL_FROM_DOMAIN>`, else fall back to SMTP_USER."""
    override = (os.environ.get("EMAIL_FROM_ADDRESS") or "").strip()
    if override:
        return override
    biz = (os.environ.get("BUSINESS_EMAIL") or "").strip()
    if biz:
        return biz
    domain = (os.environ.get("EMAIL_FROM_DOMAIN") or "").strip()
    if domain:
        return f"noreply@{domain}"
    return (os.environ.get("SMTP_USER") or "").strip()


def _from_name() -> str:
    return (os.environ.get("EMAIL_FROM_NAME") or "Celesta Glow").strip()


# ---------------------------------------------------------------- providers

def _send_via_smtp_sync(to: str, subject: str, text: str, html: str) -> bool:
    """Blocking Gmail SMTP send. Called from an async wrapper."""
    host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    port = int(os.environ.get("SMTP_PORT", 587))
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    if not (user and password):
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{_from_name()} <{_from_address() or user}>"
        msg["To"] = to
        msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(_from_address() or user, [to], msg.as_string())
        return True
    except Exception as e:
        logger.warning(f"[email] SMTP send to {to} failed: {e}")
        return False


def _send_via_sendgrid_sync(to: str, subject: str, text: str, html: str) -> bool:
    """Blocking SendGrid send. Called from an async wrapper."""
    api_key = os.environ.get("SENDGRID_API_KEY")
    if not api_key:
        return False
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, From, To, Content

        mail = Mail(
            from_email=From(_from_address(), _from_name()),
            to_emails=To(to),
            subject=subject,
        )
        mail.add_content(Content("text/plain", text))
        mail.add_content(Content("text/html", html))
        client = SendGridAPIClient(api_key)
        resp = client.send(mail)
        if 200 <= resp.status_code < 300:
            return True
        logger.warning(f"[email] SendGrid returned {resp.status_code}: {resp.body}")
        return False
    except Exception as e:
        logger.warning(f"[email] SendGrid send to {to} failed: {e}")
        return False


# ---------------------------------------------------------------- public API

async def send_email(
    to: str,
    subject: str,
    text: str,
    html: str,
    force_provider: Optional[str] = None,
) -> Dict:
    """Send an email, automatically choosing between SMTP (Gmail) and SendGrid
    based on today's Gmail usage. Returns {success, channel, reason}.

    The routing logic:
      • days 1-250 of emails (IST): Gmail SMTP
      • email 251+: SendGrid
      • if the chosen provider fails, we fall back to the other one
      • force_provider='smtp' or 'sendgrid' bypasses the routing (for testing)
    """
    import asyncio

    to = (to or "").strip()
    if not to:
        return {"success": False, "channel": None, "reason": "empty recipient"}

    # Decide primary channel
    if force_provider in ("smtp", "sendgrid"):
        primary = force_provider
    else:
        smtp_count = await _get_daily_count()
        limit = _smtp_daily_limit()
        primary = "smtp" if smtp_count < limit else "sendgrid"
        logger.info(f"[email] daily gmail count={smtp_count}/{limit} → routing to {primary}")

    order = [primary, "sendgrid" if primary == "smtp" else "smtp"]

    loop = asyncio.get_event_loop()
    for channel in order:
        if channel == "smtp" and not _smtp_configured():
            continue
        if channel == "sendgrid" and not _sendgrid_configured():
            continue
        fn = _send_via_smtp_sync if channel == "smtp" else _send_via_sendgrid_sync
        try:
            ok = await loop.run_in_executor(None, fn, to, subject, text, html)
            if ok:
                await _increment_count(channel)
                return {"success": True, "channel": channel, "reason": None}
        except Exception as e:
            logger.warning(f"[email] {channel} send crashed: {e}")

    return {"success": False, "channel": None, "reason": "all providers failed or unconfigured"}


async def get_daily_stats() -> Dict:
    """Admin-dashboard helper: how many emails went out today, by channel."""
    if _db is None:
        return {"date": _ist_date_key(), "smtp": 0, "sendgrid": 0}
    key = _ist_date_key()
    docs = _db.email_daily_counter.find({"date": key}, {"_id": 0})
    out = {"date": key, "smtp": 0, "sendgrid": 0}
    async for d in docs:
        out[d.get("channel", "smtp")] = int(d.get("count", 0))
    out["limit"] = _smtp_daily_limit()
    out["next_channel"] = "sendgrid" if out["smtp"] >= out["limit"] else "smtp"
    return out
