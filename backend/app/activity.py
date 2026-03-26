import json
from datetime import datetime, timezone

from .debug import debug_log
from .models import ActivityLog


STATUS_PRIORITY = {"SENT": 1, "DELIVERED": 2, "OPENED": 3, "CLICKED": 4, "BOUNCED": 0}

PERSONAL_DOMAINS = [
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", 
    "icloud.com", "aol.com", "protonmail.com", "proton.me", 
    "zoho.com", "yandex.com", "mail.com", "gmx.com"
]


def _extract_name_from_email(email: str) -> str:
    """Extract a display name from email prefix, e.g. john.doe@x.com -> John Doe."""
    prefix = email.split("@")[0]
    return prefix.replace(".", " ").replace("_", " ").replace("-", " ").title()


def upsert_activity_log(
    db,
    email_id: int,
    campaign_id: int,
    recipient_email: str,
    sender: str,
    company: str,
    new_status: str,
    country: str = None,
) -> None:
    """
    Upsert one ActivityLog row per email_id.
    - If row exists: update status if new_status has higher priority, append to status_history, update timestamp.
    - If row doesn't exist: create it.
    """
    try:
        existing = db.query(ActivityLog).filter(ActivityLog.email_id == email_id).first()
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        name = _extract_name_from_email(recipient_email)
        
        # REQUIREMENT 2: Country Column Logic (Personal Email check)
        final_country = country or "Unknown"
        domain = recipient_email.split("@")[-1].lower() if "@" in recipient_email else ""
        if domain in PERSONAL_DOMAINS:
            final_country = "Personal Email"

        if existing:
            # Update specific status timestamps
            s = new_status.upper()
            if s == "SENT" and not existing.sent_at: existing.sent_at = now
            elif s == "DELIVERED" and not existing.delivered_at: existing.delivered_at = now
            elif s == "OPENED" and not existing.opened_at: existing.opened_at = now
            elif s == "CLICKED" and not existing.clicked_at: existing.clicked_at = now

            try:
                history = json.loads(existing.status_history or "[]")
            except Exception:
                history = []

            history_statuses = [h.get("status") if isinstance(h, dict) else str(h) for h in history]
            if new_status not in history_statuses:
                history.append({"status": new_status, "time": now_iso})
                existing.status_history = json.dumps(history)

            cur_priority = STATUS_PRIORITY.get(existing.status, 0)
            new_priority = STATUS_PRIORITY.get(new_status, 0)
            if new_priority > cur_priority:
                existing.status = new_status

            # Update country if it's "Unknown" or if it matched personal domain
            if final_country == "Personal Email" or (final_country != "Unknown" and (not existing.country or existing.country == "Unknown")):
                existing.country = final_country

            existing.timestamp = now
        else:
            # Create new log
            log = ActivityLog(
                email_id=email_id,
                campaign_id=campaign_id,
                recipient_email=recipient_email,
                recipient_name=name,
                sender=sender,
                company=company,
                status=new_status,
                status_history=json.dumps([{"status": new_status, "time": now_iso}]),
                country=final_country,
                timestamp=now,
            )
            
            # Set initial timestamp
            s = new_status.upper()
            if s == "SENT": log.sent_at = now
            elif s == "DELIVERED": log.delivered_at = now
            elif s == "OPENED": log.opened_at = now
            elif s == "CLICKED": log.clicked_at = now
            
            db.add(log)
            
    except Exception as e:
        debug_log(f"WARNING: upsert_activity_log failed: {e}")
