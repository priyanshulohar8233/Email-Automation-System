import smtplib
import os
import re
import json
from datetime import datetime, timezone
from urllib.parse import quote
from typing import Any
from .config import settings
from .activity import upsert_activity_log
from .debug import debug_log
from .database import SessionLocal
from .models import Email, EmailStatus, EmailEvent, Campaign, CampaignStatus, EventType, ActivityLog
from . import services
from .sendgrid_bridge import send_email_sendgrid

try:
    from celery import Celery
except ImportError:
    Celery = None


celery = None
if Celery and settings.REDIS_URL:
    celery = Celery(
        "tasks",
        broker=settings.REDIS_URL,
        backend=settings.REDIS_URL
    )
else:
    debug_log("CELERY_DISABLED: Running without Celery worker integration.")

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
            sender_val = s.from_email or s.smtp_username or "noreply@mailflow.com"
            res = send_email_sendgrid(
                api_key=s.sendgrid_api_key,
                from_email=sender_val,
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

            # SaaS Grade: Map SENDER to Company Name (Fix for Round 20)
            # First mark as SENT
            upsert_activity_log(db, email_id, campaign_id, to_addr,
                                company_name, company_name, "SENT")
            db.flush()  # Ensure row exists before DELIVERED upsert below

            # Immediately upgrade to DELIVERED since SMTP send was successful
            upsert_activity_log(db, email_id, campaign_id, to_addr,
                                company_name, company_name, "DELIVERED")
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

                # Log BOUNCED (upsert) - Also fix SENDER here
                try:
                    comp = camp.company or "Unknown"
                    upsert_activity_log(db, email_record.id, email_record.campaign_id,
                                        email_record.recipient_email,
                                        comp, comp,
                                        "BOUNCED")
                except Exception:
                    pass

            db.commit()
            
            # Ensure campaign completes even if this was a failure (as long as it's the last one)
            services.check_and_complete_campaign(db, email_record.campaign_id)
    finally:
        db.close()

    debug_log(f"DEBUG: Background task finished for email {email_id}")

def _send_email_task_impl(email_id: int, subject: str, body: str, attachments: list = None):
    return send_email_fn(email_id, subject, body, attachments)


if celery:
    send_email_task = celery.task(name="send_email_task")(_send_email_task_impl)
else:
    send_email_task = _send_email_task_impl
