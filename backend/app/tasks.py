import smtplib
import os
import re
from datetime import datetime
from urllib.parse import quote
from .config import settings
from . import debug
from .database import SessionLocal
from .models import Email, EmailStatus, EmailEvent, Campaign, CampaignStatus, EventType
from .services import log_event, check_and_complete_campaign

from celery import Celery

celery = Celery(
    "tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

def send_email_fn(email_id: int, subject: str, body: str, attachments: list = None):
    debug.debug_log(f"DEBUG: Background task starting for email {email_id}")
    db = SessionLocal()
    
    try:
        # 1. Get SMTP & Tracking Settings from DB (Source of Truth)
        from .models import Settings as DBSettings
        s = db.query(DBSettings).first()
        
        # Fallback to env if DB settings are missing
        smtp_host = s.smtp_host if (s and s.smtp_host) else settings.SMTP_HOST
        smtp_port = s.smtp_port if (s and s.smtp_port) else settings.SMTP_PORT
        smtp_user = s.smtp_username if (s and s.smtp_username) else settings.SMTP_USER
        smtp_pass = s.smtp_password if (s and s.smtp_password) else settings.SMTP_PASS
        
        # Dynamic BASE_URL from DB
        base_url = s.base_url if (s and s.base_url) else settings.BASE_URL
        if base_url.endswith("/"):
            base_url = base_url[:-1]
        
        # Check if we have valid settings
        if not smtp_host or not smtp_user:
            debug.debug_log(f"ERROR: Email {email_id} failed: SMTP settings missing in DB and .env")
            return

        # Look up email record
        email_record = db.query(Email).get(email_id)
        if not email_record:
            debug.debug_log(f"ERROR: Email {email_id} not found in DB")
            return
            
        campaign_id = email_record.campaign_id
        to_addr = email_record.recipient_email
        
        # 2. Tracking Pixel & Link Replacement
        # Unsubscribe link
        unsubscribe_url = f"{base_url}/api/contacts/unsubscribe?email={quote(to_addr)}"
        
        # Tracking Image (Pixel) - More robust than display:none which is often blocked
        tracking_pixel = f"<img src='{base_url}/api/track/open/{email_id}' width='1' height='1' border='0' style='display:block; margin:0; padding:0; line-height:0; color:transparent; pointer-events:none;' alt=''/>"
        
        # 3. Apply replacements to body
        final_body = body
        if "{{unsubscribe}}" in final_body:
            final_body = final_body.replace("{{unsubscribe}}", unsubscribe_url)
        else:
            final_body += f"<br/><br/><a href='{unsubscribe_url}' style='font-size: 10px; color: #666;'>Unsubscribe</a>"
            
        final_body += tracking_pixel
        
        # 4. Wrap links for click tracking
        import re
        def replace_link(match):
            url = match.group(1)
            # Skip tracking for system links
            if "/api/track/" in url or "/api/contacts/unsubscribe" in url:
                return match.group(0)
            tracked_url = f"{base_url}/api/track/click/{email_id}?url={quote(url)}"
            return f'href="{tracked_url}"'
            
        final_body = re.sub(r'href="([^"]+)"', replace_link, final_body)

        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_user
        msg["To"] = to_addr
        
        # Use final_body here (fixed NameError)
        part = MIMEText(final_body, "html")
        msg.attach(part)
        
        # 4. Send via SMTP
        debug.debug_log(f"DEBUG: Connecting to SMTP {smtp_host}:{smtp_port} as {smtp_user}")
        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [to_addr], msg.as_string())
        
        debug.debug_log(f"SUCCESS: Email {email_id} sent via SMTP")
        
        # 5. Update Status & Log Events
        email_record.status = EmailStatus.SENT
        email_record.subject = subject
        email_record.body = final_body # Save for inspection/auditing
        
        # Log events using services for consistency (updates campaign counters)
        log_event(db, email_id, EventType.SENT)
        log_event(db, email_id, EventType.DELIVERED)
        
        db.commit()
        
    except Exception as ex:
        error_msg = f"{type(ex).__name__}: {str(ex)}"
        debug.debug_log(f"FAILED TO SEND EMAIL {email_id}: {error_msg}")
        
        # Use a fresh session for error recovery in case the original one died (e.g. 'Closed Database')
        db_recovery = SessionLocal()
        try:
            email_record = db_recovery.query(Email).get(email_id)
            if email_record:
                email_record.status = EmailStatus.BOUNCED
                email_record.failure_reason = error_msg
                
                # Check for campaign completion
                if email_record.campaign_id:
                    pending_count = db_recovery.query(Email).filter(
                        Email.campaign_id == email_record.campaign_id, 
                        Email.status == EmailStatus.PENDING
                    ).count()
                    if pending_count == 0:
                        camp = db_recovery.query(Campaign).get(email_record.campaign_id)
                        if camp:
                            camp.status = CampaignStatus.COMPLETED
                
                db_recovery.add(EmailEvent(
                    email_id=email_id, 
                    event_type=EventType.BOUNCED, 
                    timestamp=datetime.utcnow()
                ))
                db_recovery.commit()
        except Exception as recovery_ex:
            debug.debug_log(f"RECOVERY ERROR for email {email_id}: {str(recovery_ex)}")
        finally:
            db_recovery.close()
            
    finally:
        try:
            db.close()
        except:
            pass

    debug.debug_log(f"DEBUG: Background task finished for email {email_id}")

@celery.task
def send_email_task(email_id: int, subject: str, body: str, attachments: list = None):
    return send_email_fn(email_id, subject, body, attachments)
