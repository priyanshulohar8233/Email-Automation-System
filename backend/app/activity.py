from .models import ActivityLog, get_now_utc


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
        now = get_now_utc()
        now_iso = now.isoformat()
        name = _extract_name_from_email(recipient_email)

        if existing:
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

            if country and country != "Unknown" and (not existing.country or existing.country == "Unknown"):
                existing.country = country

            existing.timestamp = now
        else:
            log = ActivityLog(
                email_id=email_id,
                campaign_id=campaign_id,
                recipient_email=recipient_email,
                recipient_name=name,
                sender=sender,
                company=company,
                status=new_status,
                status_history=json.dumps([{"status": new_status, "time": now_iso}]),
                country=country or "Unknown",
                timestamp=now,
            )
            db.add(log)
    except Exception as e:
        debug_log(f"WARNING: upsert_activity_log failed: {e}")
