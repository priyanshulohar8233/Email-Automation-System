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

def retry_db_write(db, func, *args, **kwargs):
    import time
    import random
    max_retries = 5
    for attempt in range(max_retries):
        try:
            result = func(db, *args, **kwargs)
            db.commit()
            return result
        except Exception as e:
            db.rollback()
            if "busy" in str(e).lower() or "locked" in str(e).lower():
                wait = (attempt + 1) + random.random()
                debug.debug_log(f"DB_BUSY: Write attempt {attempt+1} failed. Retrying in {wait:.2f}s...")
                time.sleep(wait)
            else:
                raise e
    raise Exception("DB_WRITE_FAILED_AFTER_RETRIES")

def send_email_fn(email_id: int, subject: str, body: str, attachments: list = None):
    debug.debug_log(f"DEBUG: Background task starting for email {email_id}")
    db = SessionLocal()
    
    try:
        # 1. Get SMTP & Tracking Settings from DB with Retry (SQLite can lock)
        from .models import Settings as DBSettings
        import time
        
        s = None
        max_retries = 3
        for attempt in range(max_retries):
            try:
                s = db.query(DBSettings).first()
                break
            except Exception as e:
                debug.debug_log(f"RETRY {attempt+1}: Failed to fetch settings: {str(e)}")
                db.rollback()
                time.sleep(1)
        
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
            debug.debug_log(f"ERROR: Email {email_id} failed: SMTP settings missing")
            raise Exception("SMTP settings missing in DB and .env")

        # Look up email record
        email_record = db.query(Email).get(email_id)
        if not email_record:
            debug.debug_log(f"ERROR: Email {email_id} not found in DB")
            return
            
        campaign_id = email_record.campaign_id
        to_addr = email_record.recipient_email
        
        # 2. Tracking Pixel & Link Replacement
        unsubscribe_url = f"{base_url}/api/contacts/unsubscribe?email={quote(to_addr)}"
        tracking_pixel = f"<img src='{base_url}/api/track/open/{email_id}' width='1' height='1' border='0' style='display:block; margin:0; padding:0; line-height:0; color:transparent; pointer-events:none;' alt=''/>"
        
        final_body = body
        if "{{unsubscribe}}" in final_body:
            final_body = final_body.replace("{{unsubscribe}}", unsubscribe_url)
        else:
            final_body += f"<br/><br/><a href='{unsubscribe_url}' style='font-size: 10px; color: #666;'>Unsubscribe</a>"
            
        final_body += tracking_pixel
        
        def replace_link(match):
            url = match.group(1)
            if "/api/track/" in url or "/api/contacts/unsubscribe" in url:
                return match.group(0)
            tracked_url = f"{base_url}/api/track/click/{email_id}?url={quote(url)}"
            return f'href="{tracked_url}"'
            
        final_body = re.sub(r'href="([^"]+)"', replace_link, final_body)

        # 3. Prepare Message
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_user
        msg["To"] = to_addr
        part = MIMEText(final_body, "html")
        msg.attach(part)
        
        # 4. Send via SMTP with specific error catching
        debug.debug_log(f"DEBUG: Connecting to SMTP {smtp_host}:{smtp_port}")
        try:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [to_addr], msg.as_string())
        except smtplib.SMTPRecipientsRefused:
            raise Exception(f"RECIPIENT_REFUSED: The email address {to_addr} was rejected by the server.")
        except smtplib.SMTPAuthenticationError:
            raise Exception("AUTH_ERROR: SMTP authentication failed. Check your username/password in Settings.")
        except smtplib.SMTPConnectError:
            raise Exception("CONNECT_ERROR: Could not connect to the SMTP server. Check host/port.")
        except Exception as e:
            raise Exception(f"SMTP_ERROR: {str(e)}")
        
        debug.debug_log(f"SUCCESS: Email {email_id} sent")
        
        # 5. Update Status & Log Events (Wrapped in Ultra-Robust Retry)
        def finalize_send(current_db):
            email_rec = current_db.query(Email).get(email_id)
            if email_rec:
                email_rec.status = EmailStatus.SENT
                email_rec.subject = subject
                email_rec.body = final_body
                log_event(current_db, email_id, EventType.SENT)
                log_event(current_db, email_id, EventType.DELIVERED)
                # Check for campaign completion
                if email_rec.campaign_id:
                    check_and_complete_campaign(current_db, email_rec.campaign_id)
        
        retry_db_write(db, finalize_send)
        
    except Exception as ex:
        error_msg = f"{type(ex).__name__}: {str(ex)}"
        debug.debug_log(f"FAILED TO SEND EMAIL {email_id}: {error_msg}")
        
        # Use a fresh session for error recovery in case the original one died (e.g. 'Closed Database')
        db_recovery = SessionLocal()
        def recovery_cleanup(recovery_db):
            email_rec = recovery_db.query(Email).get(email_id)
            if email_rec:
                email_rec.status = EmailStatus.BOUNCED
                email_rec.failure_reason = error_msg
                
                # Log bounce event
                log_event(recovery_db, email_id, EventType.BOUNCED)
                
                # Check for campaign completion
                if email_rec.campaign_id:
                    check_and_complete_campaign(recovery_db, email_rec.campaign_id)

        try:
            retry_db_write(db_recovery, recovery_cleanup)
        except Exception as recovery_ex:
            debug.debug_log(f"RECOVERY ERROR (Final): {str(recovery_ex)}")
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
    debug.debug_log(f"CELERY_TASK: Processing email {email_id}")
    db = SessionLocal()
    
    try:
        # 1. Fetch Settings (Source of Truth)
        # We use a retry loop directly around the query to handle transient SQLite busy state
        from .models import Settings as DBSettings
        import time
        s = None
        for attempt in range(5):
            try:
                s = db.query(DBSettings).first()
                break
            except Exception as e:
                if "busy" in str(e).lower() or "locked" in str(e).lower():
                    debug.debug_log(f"DB_BUSY: settings fetch attempt {attempt+1} failed. Retrying...")
                    db.rollback()
                    time.sleep(2)
                else:
                    raise e
        
        smtp_host = s.smtp_host if (s and s.smtp_host) else settings.SMTP_HOST
        smtp_port = s.smtp_port if (s and s.smtp_port) else settings.SMTP_PORT
        smtp_user = s.smtp_username if (s and s.smtp_username) else settings.SMTP_USER
        smtp_pass = s.smtp_password if (s and s.smtp_password) else settings.SMTP_PASS
        base_url = s.base_url if (s and s.base_url) else settings.BASE_URL
        if base_url.endswith("/"): base_url = base_url[:-1]

        # 2. Fetch Email Record
        email_record = None
        for attempt in range(5):
            try:
                email_record = db.query(Email).get(email_id)
                break
            except Exception as e:
                db.rollback()
                time.sleep(1)

        if not email_record:
            debug.debug_log(f"ERROR: Email {email_id} not found")
            return

        to_addr = email_record.recipient_email
        
        # 3. Tracking Logic
        unsubscribe_url = f"{base_url}/api/contacts/unsubscribe?email={quote(to_addr)}"
        tracking_pixel = f"<img src='{base_url}/api/track/open/{email_id}' width='1' height='1' border='0' style='display:block; margin:0; padding:0; line-height:0; color:transparent; pointer-events:none;' alt=''/>"
        
        final_body = body
        if "{{unsubscribe}}" in final_body:
            final_body = final_body.replace("{{unsubscribe}}", unsubscribe_url)
        else:
            final_body += f"<br/><br/><a href='{unsubscribe_url}' style='font-size: 10px; color: #666;'>Unsubscribe</a>"
        final_body += tracking_pixel
        
        def replace_link(match):
            url = match.group(1)
            if "/api/track/" in url or "/api/contacts/unsubscribe" in url:
                return match.group(0)
            return f'href="{base_url}/api/track/click/{email_id}?url={quote(url)}"'
            
        final_body = re.sub(r'href="([^"]+)"', replace_link, final_body)

        # 4. SMTP Send
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Email System <{smtp_user}>"
        msg["To"] = to_addr
        msg.attach(MIMEText(final_body, "html"))
        
        debug.debug_log(f"SMTP: Connecting to {smtp_host}:{smtp_port}")
        try:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=45) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [to_addr], msg.as_string())
            debug.debug_log(f"SMTP: Success for email {email_id}")
        except Exception as smtp_err:
            debug.debug_log(f"SMTP: Failed for email {email_id}: {str(smtp_err)}")
            raise Exception(f"SMTP_DELIVERY_FAILURE: {str(smtp_err)}")

        # 5. Success Updates (Ultra-Robust)
        def finalize_task(current_db):
            email_rec = current_db.query(Email).get(email_id)
            if email_rec:
                email_rec.status = EmailStatus.SENT
                email_rec.subject = subject
                email_rec.body = final_body
                log_event(current_db, email_id, EventType.SENT)
                log_event(current_db, email_id, EventType.DELIVERED)
                # Campaign completion check
                if email_rec.campaign_id:
                    check_and_complete_campaign(current_db, email_rec.campaign_id)
        
        retry_db_write(db, finalize_task)
        debug.debug_log(f"DONE: Email {email_id} fully processed")

    except Exception as ex:
        err_str = f"{type(ex).__name__}: {str(ex)}"
        debug.debug_log(f"TASK_CRASH for email {email_id}: {err_str}")
        
        # Recovery block with fresh session
        db_rec = SessionLocal()
        def final_recovery(recovery_db):
            rec_email = recovery_db.query(Email).get(email_id)
            if rec_email:
                rec_email.status = EmailStatus.BOUNCED
                rec_email.failure_reason = err_str
                log_event(recovery_db, email_id, EventType.BOUNCED)
                # Check for campaign completion
                if rec_email.campaign_id:
                    check_and_complete_campaign(recovery_db, rec_email.campaign_id)
        
        try:
            retry_db_write(db_rec, final_recovery)
        except:
            pass
        finally:
            db_rec.close()
    finally:
        db.close()
