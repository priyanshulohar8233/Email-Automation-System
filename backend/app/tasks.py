import smtplib
import os
import re
import json
from datetime import datetime, timezone
from urllib.parse import quote
from .config import settings
from .debug import debug_log
from .database import SessionLocal
from .models import Email, EmailStatus, EmailEvent, Campaign, CampaignStatus, EventType, ActivityLog
from . import services
from .sendgrid_bridge import send_email_sendgrid

# Status priority: higher index = more advanced event
STATUS_PRIORITY = {"SENT": 1, "DELIVERED": 2, "OPENED": 3, "CLICKED": 4, "BOUNCED": 0}

def _extract_name_from_email(email: str) -> str:
    """Extract a display name from email prefix, e.g. john.doe@x.com -> John Doe"""
    prefix = email.split("@")[0]
    # Replace separators with space and title-case
    name = prefix.replace(".", " ").replace("_", " ").replace("-", " ").title()
    return name

def upsert_activity_log(db, email_id: int, campaign_id: int, recipient_email: str,
                        sender: str, company: str, new_status: str, country: str = None) -> None:
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

        if existing:
            # Parse existing history
            try:
                history = json.loads(existing.status_history or "[]")
            except Exception:
                history = []

            # For history, we now store: [{"status": "SENT", "time": "..."}]
            # Only append if not already in history (by status string)
            history_statuses = [h.get("status") if isinstance(h, dict) else str(h) for h in history]
            if new_status not in history_statuses:
                history.append({"status": new_status, "time": now_iso})
                existing.status_history = json.dumps(history)

            # Upgrade status if the new one has higher priority
            cur_priority = STATUS_PRIORITY.get(existing.status, 0)
            new_priority = STATUS_PRIORITY.get(new_status, 0)
            if new_priority > cur_priority:
                existing.status = new_status

            # Update country if we now have one
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

from celery import Celery

celery = Celery(
    "tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

def send_email_fn(email_id: int, subject: str, body: str, attachments: list = None):
    debug_log(f"DEBUG: Background task starting for email {email_id}")
    db = SessionLocal()
    
    try:
        # 1. Fetch email info
        email_record = db.query(Email).get(email_id)
        if not email_record:
            debug_log(f"ERROR: Email {email_id} not found")
            return
        
        to_addr = email_record.recipient_email
        campaign_id = email_record.campaign_id
        debug_log(f"DEBUG: Processing email {email_id} to {to_addr}")

        # 2. Compliance & Tracking
        base_url = settings.BASE_URL.rstrip('/')
        formatted_body = body.replace('\n', '<br/>')
        unsubscribe_url = f"{base_url}/api/contacts/unsubscribe?email={to_addr}"
        tracking_body = (
            f"<div style='font-family: sans-serif; color: #333; line-height: 1.6;'>"
            f"{formatted_body}"
            f"<br/><br/><hr style='border: 0; border-top: 1px solid #eee;'/><br/>"
            f"<p style='font-size: 12px; color: #999; text-align: center;'>"
            f"You received this because you are part of our mailing list.<br/>"
            f"<a href='{unsubscribe_url}' style='color: #4f46e5; text-decoration: underline;'>Unsubscribe</a>"
            f"</p>"
            f"<img src='{base_url}/api/t/o/{email_id}' width='1' height='1' alt='' style='display:none !important; visibility:hidden; opacity:0;'/>"
            f"</div>"
        )
        
        def repl(match):
            url = match.group(1)
            if "/t/c/" in url or "/unsubscribe" in url or "/track/" in url: 
                return f'href="{url}"'
            if base_url in url and ("/t/c/" in url or "/track/" in url):
                return f'href="{url}"'
            tracked_url = f"{base_url}/api/t/c/{email_id}?url={quote(url)}"
            return f'href="{tracked_url}"'
            
        tracking_body = re.sub(r'href=["\']([^"\']+)["\']', repl, tracking_body)

        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        # 3. Construct MIME Message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_USER
        msg["To"] = to_addr
        
        part = MIMEText(tracking_body, "html")
        msg.attach(part)

        # 4. Fetch Mail Provider & Send
        from .models import Settings as DBSettings
        s = db.query(DBSettings).first()
        provider = (s.email_provider or "SMTP").upper() if s else "SMTP"
        
        if provider == "SENDGRID" and s and s.sendgrid_api_key:
            debug_log(f"DEBUG: Sending via SendGrid API to {to_addr}")
            # Use specific SendGrid sender if configured, else fallback
            sender = s.from_email or s.smtp_username or "noreply@mailflow.com"
            res = send_email_sendgrid(
                api_key=s.sendgrid_api_key,
                from_email=sender,
                to_email=to_addr,
                subject=subject,
                html_content=tracking_body
            )
            if not res.get("success"):
                raise Exception(f"SendGrid Error: {res.get('error')}")
            debug_log(f"SUCCESS: Email {email_id} sent via SendGrid")
        else:
            # SMTP Fallback/Default
            host = s.smtp_host if s else settings.SMTP_HOST
            port = s.smtp_port if s else settings.SMTP_PORT
            user = s.smtp_username if s else settings.SMTP_USER
            password = s.smtp_password if s else settings.SMTP_PASS
            
            debug_log(f"DEBUG: Connecting to SMTP {host}:{port}")
            with smtplib.SMTP(host, port, timeout=30) as server:
                server.starttls()
                server.login(user, password)
                server.sendmail(user, [to_addr], msg.as_string())
            debug_log(f"SUCCESS: Email {email_id} sent via SMTP")
        now = datetime.now(timezone.utc)
        
        # 5. Update Status
        email_record.status = EmailStatus.DELIVERED
        email_record.sent_at = now
        email_record.subject = subject
        
        # Log to activity_logs (SENT → then upsert to DELIVERED on success)
        try:
            camp = db.query(Campaign).get(campaign_id)
            company_name = camp.company if camp else "Unknown"

            # First mark as SENT
            upsert_activity_log(db, email_id, campaign_id, to_addr,
                                settings.SMTP_USER, company_name, "SENT")
            db.flush()  # Ensure row exists before DELIVERED upsert below

            # Immediately upgrade to DELIVERED since SMTP send was successful
            upsert_activity_log(db, email_id, campaign_id, to_addr,
                                settings.SMTP_USER, company_name, "DELIVERED")
        except Exception as log_ex:
            debug_log(f"WARNING: Activity logging failed: {log_ex}")

        # Standard Grade: Use the centralized service for completion check
        services.check_and_complete_campaign(db, campaign_id)
                
        db.commit()
        
    except Exception as ex:
        error_msg = f"{type(ex).__name__}: {str(ex)}"
        debug_log(f"FAILED TO SEND EMAIL {email_id}: {error_msg}")
        db.rollback()
        
        email_record = db.query(Email).get(email_id)
        if email_record:
            email_record.status = EmailStatus.BOUNCED
            email_record.failure_reason = error_msg
            db.add(EmailEvent(email_id=email_id, event_type=EventType.BOUNCED, timestamp=datetime.now(timezone.utc)))
            
            camp = db.query(Campaign).get(email_record.campaign_id)
            if camp:
                camp.failed_count = (camp.failed_count or 0) + 1

                # Log BOUNCED (upsert)
                try:
                    upsert_activity_log(db, email_record.id, email_record.campaign_id,
                                        email_record.recipient_email,
                                        settings.SMTP_USER,
                                        camp.company or "Unknown",
                                        "BOUNCED")
                except Exception:
                    pass

            db.commit()
            
            # Ensure campaign completes even if this was a failure (as long as it's the last one)
            services.check_and_complete_campaign(db, email_record.campaign_id)
    finally:
        db.close()

    debug_log(f"DEBUG: Background task finished for email {email_id}")

@celery.task
def send_email_task(email_id: int, subject: str, body: str, attachments: list = None):
    return send_email_fn(email_id, subject, body, attachments)
