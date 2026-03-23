import smtplib
import os
import re
from datetime import datetime, timezone
from urllib.parse import quote
from .config import settings
from .debug import debug_log
from .database import SessionLocal
from .models import Email, EmailStatus, EmailEvent, Campaign, CampaignStatus, EventType
from . import services

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

        # 4. Send via SMTP
        debug_log(f"DEBUG: Connecting to SMTP {settings.SMTP_HOST}:{settings.SMTP_PORT}")
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.sendmail(settings.SMTP_USER, [to_addr], msg.as_string())
        
        debug_log(f"SUCCESS: Email {email_id} sent via SMTP")
        now = datetime.now(timezone.utc)
        
        # 5. Update Status
        email_record.status = EmailStatus.DELIVERED
        email_record.sent_at = now
        email_record.subject = subject
        
        # Log events
        db.add(EmailEvent(email_id=email_id, event_type=EventType.SENT, timestamp=now))
        db.add(EmailEvent(email_id=email_id, event_type=EventType.DELIVERED, timestamp=now))

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
            db.commit()
            
            # Ensure campaign completes even if this was a failure (as long as it's the last one)
            services.check_and_complete_campaign(db, email_record.campaign_id)
    finally:
        db.close()

    debug_log(f"DEBUG: Background task finished for email {email_id}")

@celery.task
def send_email_task(email_id: int, subject: str, body: str, attachments: list = None):
    return send_email_fn(email_id, subject, body, attachments)
