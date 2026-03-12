import smtplib
import sqlite3
import os
import re
from datetime import datetime
from urllib.parse import quote
from app.config import settings
from app.debug import debug_log

from celery import Celery

celery = Celery(
    "tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "emaildb.sqlite")

def update_db_raw(query, params):
    try:
        conn = sqlite3.connect(DB_PATH, timeout=20)
        conn.execute("PRAGMA journal_mode=WAL;")
        c = conn.cursor()
        c.execute(query, params)
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        debug_log(f"RAW_DB_ERROR: {str(e)}")
        return False

@celery.task
def send_email_task(email_id: int, subject: str, body: str, attachments: list = None):
    debug_log(f"DEBUG: Background task starting for email {email_id}")
    
    # 1. Fetch email info raw
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT recipient_email, campaign_id FROM emails WHERE id=?", (email_id,))
    row = c.fetchone()
    conn.close()
    
    if not row:
        debug_log(f"ERROR: Email {email_id} not found")
        return
    
    to_addr, campaign_id = row
    debug_log(f"DEBUG: Processing email {email_id} to {to_addr}")

    # 2. Compliance & Tracking
    formatted_body = body.replace('\n', '<br/>')
    unsubscribe_url = f"{settings.BASE_URL}/api/contacts/unsubscribe?email={to_addr}"
    tracking_body = (
        f"<div style='font-family: sans-serif; color: #333; line-height: 1.6;'>"
        f"{formatted_body}"
        f"<br/><br/><hr style='border: 0; border-top: 1px solid #eee;'/><br/>"
        f"<p style='font-size: 12px; color: #999; text-align: center;'>"
        f"You received this because you are part of our mailing list.<br/>"
        f"<a href='{unsubscribe_url}' style='color: #4f46e5; text-decoration: underline;'>Unsubscribe</a>"
        f"</p>"
        f"<img src='{settings.BASE_URL}/api/track/open/{email_id}' width='1' height='1' alt='' style='display:none !important; visibility:hidden; opacity:0;'/>"
        f"</div>"
    )
    
    def repl(match):
        url = match.group(1)
        if "/track/" in url or "/unsubscribe" in url: 
            return f'href="{url}"'
        # Ensure we don't double track if BASE_URL is already in the URL
        if settings.BASE_URL in url and "/track/" in url:
            return f'href="{url}"'
            
        tracked_url = f"{settings.BASE_URL}/api/track/click/{email_id}?url={quote(url)}"
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

    try:
        debug_log(f"DEBUG: Connecting to SMTP {settings.SMTP_HOST}:{settings.SMTP_PORT}")
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.sendmail(settings.SMTP_USER, [to_addr], msg.as_string())
        
        debug_log(f"SUCCESS: Email {email_id} sent via SMTP")
        now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%f')
        update_db_raw("UPDATE emails SET status='SENT', sent_at=?, subject=? WHERE id=?", (now, subject, email_id))
        
        # Log events
        update_db_raw("INSERT INTO email_events (email_id, event_type, timestamp) VALUES (?, 'SENT', ?)", (email_id, now))
        update_db_raw("INSERT INTO email_events (email_id, event_type, timestamp) VALUES (?, 'DELIVERED', ?)", (email_id, now))

        # Check for campaign completion
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("UPDATE campaigns SET delivered_count = delivered_count + 1, sent_count = sent_count + 1, unread_count = unread_count + 1 WHERE id=?", (campaign_id,))
        
        # Check if this was the last pending email
        c.execute("SELECT COUNT(*) FROM emails WHERE campaign_id=? AND status='PENDING'", (campaign_id,))
        pending_count = c.fetchone()[0]
        if pending_count == 0:
            c.execute("UPDATE campaigns SET status='completed' WHERE id=?", (campaign_id,))
            debug_log(f"CAMPAIGN_FINISHED: Campaign {campaign_id} marked as COMPLETED")
            
        conn.commit()
        conn.close()
        
    except Exception as ex:
        error_msg = f"{type(ex).__name__}: {str(ex)}"
        debug_log(f"FAILED TO SEND EMAIL {email_id}: {error_msg}")
        update_db_raw("UPDATE emails SET status='BOUNCED', failure_reason=? WHERE id=?", (error_msg, email_id))
        update_db_raw("INSERT INTO email_events (email_id, event_type, timestamp) VALUES (?, 'BOUNCED', ?)", (email_id, datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%f')))
        update_db_raw("UPDATE campaigns SET failed_count = failed_count + 1 WHERE id=?", (campaign_id,))

    debug_log(f"DEBUG: Background task finished for email {email_id}")
