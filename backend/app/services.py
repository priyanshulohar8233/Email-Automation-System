from typing import List
import smtplib
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, distinct, case, select, and_, or_, cast, Date
from sqlalchemy.orm import Session
from .models import (
    Email, EmailStatus, EmailEvent, EventType, Campaign, CampaignStatus, 
    Settings, Suppression, SuppressionReason, BounceType, ActivityLog
)


# low-level mail sender

from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email import encoders
import requests
import io
import redis
from . import debug
from .config import settings

# SaaS Grade: Redis Client for Serverless Scheduling
try:
    if settings.REDIS_URL:
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    else:
        debug.debug_log("REDIS_URL not found in settings")
        redis_client = None
except Exception as e:
    debug.debug_log(f"REDIS_CONNECTION_ERROR: {e}")
    redis_client = None

def check_and_complete_campaign(db: Session, campaign_id: int):
    from .models import Email, EmailStatus, Campaign, CampaignStatus
    from datetime import datetime
    
    # PRO GRADE: Precise completion check
    camp = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not camp or camp.status == CampaignStatus.COMPLETED:
        return
    
    # Calculate total expected emails
    total_emails = db.query(Email).filter(Email.campaign_id == campaign_id).count()
    if total_emails == 0:
        return
        
    # Calculate processed emails (delivered + failed/bounced)
    processed_emails = db.query(Email).filter(
        Email.campaign_id == campaign_id,
        Email.status.in_([EmailStatus.DELIVERED, EmailStatus.BOUNCED, EmailStatus.SPAM, EmailStatus.DROPPED])
    ).count()
    
    # Also check if any are still PENDING
    pending_count = db.query(Email).filter(
        Email.campaign_id == campaign_id, 
        Email.status == EmailStatus.PENDING
    ).count()
    
    # Trigger completion if everything is processed AND nothing is pending
    if processed_emails >= total_emails and pending_count == 0:
        camp.status = CampaignStatus.COMPLETED
        camp.completed_at = datetime.now(timezone.utc)
        db.commit()
        debug.debug_log(f"CAMPAIGN_COMPLETE: Campaign {campaign_id} (Done at {camp.completed_at})")

def send_mail(to_addr: str, subject: str, body_html: str, smtp_host: str, smtp_port: int, smtp_user: str, smtp_pass: str, reply_to: str = None, attachments: list = None):
    # Create the root message and set headers
    message = MIMEMultipart("mixed")
    
    # Create the alternative part for text/html
    alt_part = MIMEMultipart("alternative")
    message.attach(alt_part)
    
    message["Subject"] = subject
    message["From"] = smtp_user
    message["To"] = to_addr
    
    # List-Unsubscribe Header (Crucial for Google/Outlook compliance)
    message["List-Unsubscribe"] = f"<{to_addr}-unsubscribe@yourdomain.com>"
    
    if reply_to:
        message["Reply-To"] = reply_to

    # Create plain-text version
    import re
    body_text = re.sub('<[^<]+?>', '', body_html)
    
    part1 = MIMEText(body_text, "plain")
    part2 = MIMEText(body_html, "html")

    alt_part.attach(part1)
    alt_part.attach(part2)

    # Process Attachments
    if attachments:
        import mimetypes
        from urllib.parse import unquote, urlparse

        for idx, attachment in enumerate(attachments):
            try:
                content = None
                filename = None
                mime_type = "application/octet-stream"

                if attachment.startswith('http'):
                    response = requests.get(attachment, timeout=10)
                    response.raise_for_status()
                    content = response.content
                    parsed = urlparse(attachment)
                    filename = unquote((parsed.path or "").split("/")[-1]) or f"attachment_{idx + 1}"
                    mime_type = (response.headers.get("Content-Type") or mimetypes.guess_type(filename)[0] or "application/octet-stream").split(";")[0].strip()
                elif attachment.startswith('data:'):
                    import base64
                    header, encoded = attachment.split(",", 1)
                    content = base64.b64decode(encoded)
                    header_meta = header[5:] if header.startswith("data:") else ""
                    parts = header_meta.split(";")
                    if parts and "/" in parts[0]:
                        mime_type = parts[0].split(";")[0].strip()

                    for part_meta in parts[1:]:
                        if part_meta.startswith("name="):
                            filename = unquote(part_meta.split("=", 1)[1].strip("\"' "))
                            break

                    if not filename:
                        ext = mimetypes.guess_extension(mime_type) or ""
                        filename = f"attachment_{idx + 1}{ext}"
                else:
                    continue

                if not filename:
                    filename = f"attachment_{idx + 1}"

                if "/" in mime_type:
                    maintype, subtype = mime_type.split("/", 1)
                    subtype = subtype.split(";")[0].strip()
                else:
                    maintype, subtype = "application", "octet-stream"

                part = MIMEBase(maintype, subtype)
                part.set_payload(content)
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    f'attachment; filename="{filename}"',
                )
                message.attach(part)
            except Exception as e:
                print(f"Error attaching file: {str(e)}")

    # Defensive stripping
    smtp_user = smtp_user.strip() if smtp_user else smtp_user
    smtp_pass = smtp_pass.strip() if smtp_pass else smtp_pass

    try:
        debug.debug_log(f"SMTP: Connecting to {smtp_host}:{smtp_port}...")
        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [to_addr], message.as_string())
            debug.debug_log(f"SMTP: Email sent successfully to {to_addr}")
    except Exception as e:
        debug.debug_log(f"SMTP_ERROR: Failed to send email to {to_addr}. Error: {str(e)}")
        raise e


# functions used by API

def get_country_from_ip(ip: str):
    """
    Resolves IP to Country using ipapi.co (Free tier: 1000 requests/day).
    """
    if not ip or ip in ["127.0.0.1", "localhost", "::1"]:
        return "Unknown"
        
    try:
        # User requested ipapi.co
        response = requests.get(f"https://ipapi.co/{ip}/json/", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if not data.get("error"):
                return data.get("country_name", "Unknown")
        return "Unknown"
    except Exception as e:
        debug.debug_log(f"GEOLOCATION_ERROR for IP {ip}: {str(e)}")
        return "Unknown"

def log_event(db: Session, email_id: int, event_type: EventType, ip: str = None, ua: str = None, url: str = None):
    from .models import Email, EmailEvent, Campaign, Suppression, SuppressionReason
    
    # 1. Professional Security: Prevent duplicate open tracking (60s window)
    if event_type == EventType.OPENED:
        recent_open = db.query(EmailEvent).filter(
            EmailEvent.email_id == email_id,
            EmailEvent.event_type == EventType.OPENED,
            EmailEvent.timestamp >= datetime.now(timezone.utc) - timedelta(seconds=60)
        ).first()
        if recent_open:
            debug.debug_log(f"TRACKING_FLOW: Blocked duplicate open for email {email_id} (within 60s)")
            return
            
    debug.debug_log(f"TRACKING_FLOW: Received {event_type} for email {email_id}")
    
    # SaaS Grade Geolocation
    country = "Unknown"
    if ip and ip not in ["127.0.0.1", "::1"]:
        country = get_country_from_ip(ip)

    browser, os, device = "Unknown", "Unknown", "Desktop"
    if ua:
        ua_lower = ua.lower()
        if "iphone" in ua_lower or "android" in ua_lower: device = "Mobile"
        elif "ipad" in ua_lower or "tablet" in ua_lower: device = "Tablet"
        if "chrome" in ua_lower: browser = "Chrome"
        elif "firefox" in ua_lower: browser = "Firefox"
        elif "safari" in ua_lower: browser = "Safari"
        elif "edge" in ua_lower: browser = "Edge"
        if "windows" in ua_lower: os = "Windows"
        elif "mac" in ua_lower: os = "MacOS"
        elif "linux" in ua_lower: os = "Linux"

    try:
        ev = EmailEvent(
            email_id=email_id, 
            event_type=event_type, 
            ip_address=ip, 
            user_agent=ua,
            browser=browser,
            os=os,
            device=device,
            country=country,
            timestamp=datetime.now(timezone.utc)
        )
        if url: ev.url = url
        
        db.add(ev)
        db.flush()
        
        email = db.query(Email).get(email_id)
        if email:
            if event_type == EventType.DELIVERED: 
                email.status = EmailStatus.DELIVERED
                email.delivery_status = "delivered"
            elif event_type == EventType.BOUNCED: 
                email.status = EmailStatus.BOUNCED
                # 2. Automated Deliverability: Classify and Suppress
                bounce_info = classify_bounce(email.bounce_reason or "Unknown bounce")
                email.bounce_type = bounce_info["type"]
                if bounce_info["type"] == BounceType.HARD:
                    add_to_suppression(db, email.recipient_email, SuppressionReason.BOUNCE, metadata={"reason": email.bounce_reason})
            elif event_type == EventType.OPENED:
                if not email.opened_at:
                    email.opened_at = datetime.now(timezone.utc)
            elif event_type == EventType.CLICKED:
                if not email.clicked_at:
                    email.clicked_at = datetime.now(timezone.utc)
            elif event_type == EventType.SPAM_REPORT:
                email.status = EmailStatus.SPAM
                add_to_suppression(db, email.recipient_email, SuppressionReason.SPAM)
            elif event_type == EventType.UNSUBSCRIBED:
                add_to_suppression(db, email.recipient_email, SuppressionReason.UNSUBSCRIBE)
                
            db.commit()
            
            # Atomic check for campaign completion if this was a delivery-related event
            if event_type in [EventType.SENT, EventType.DELIVERED, EventType.BOUNCED]:
                if email.campaign_id:
                    check_and_complete_campaign(db, email.campaign_id)
    except Exception as e:
        db.rollback()
        debug.debug_log(f"TRACKING_FLOW_ERROR: {str(e)}")
        raise e

def get_link_performance(db: Session, campaign_name: str = "all", company_name: str | list = "all", days: int = 30):
    # Group clicks by URL and count
    
    start_date, end_date = get_date_window(days)
    q = db.query(EmailEvent.url, func.count(EmailEvent.id).label("clicks")).filter(
        EmailEvent.event_type == EventType.CLICKED,
        EmailEvent.timestamp >= start_date,
        EmailEvent.timestamp < end_date
    )

    
    if campaign_name != "all":
        q = q.join(Email).join(Campaign).filter(Campaign.name == campaign_name)
    if company_name and company_name != "all":
        companies = [company_name] if isinstance(company_name, str) else company_name
        # Fallback to join if not already joined via campaign_name logic
        if campaign_name == "all":
            q = q.join(Email).join(Campaign).filter(Campaign.company.in_(companies))
        else:
            q = q.filter(Campaign.company.in_(companies))

    
    results = q.group_by(EmailEvent.url).order_by(func.count(EmailEvent.id).desc()).limit(10).all()
    return [{"url": r.url or "Direct/Unknown", "clicks": r.clicks} for r in results]

def process_sendgrid_webhook(db: Session, events: list[dict]):
    """
    Processes a list of events from the SendGrid Event Webhook.
    Reference: https://sendgrid.com/docs/for-developers/tracking-events/event-webhook-reference/
    """
    from datetime import datetime
    for event in events:
        email_id = event.get("email_id") # We'll need to pass this as a custom arg in SendGrid
        # If email_id isn't in top level, check if it's in personalizations metadata
        # But usually we send it as a custom argument
        
        # If email_id is missing, we try to find by recipient_email (less reliable)
        to_email = event.get("email")
        type_str = event.get("event", "").upper()
        
        # Map SendGrid event types to our EventType enum
        event_mapping = {
            "PROCESSED": EventType.SENT,
            "DELIVERED": EventType.DELIVERED,
            "OPEN": EventType.OPENED,
            "CLICK": EventType.CLICKED,
            "BOUNCE": EventType.BOUNCED,
            "SPAMREPORT": EventType.SPAM_REPORT,
            "UNSUBSCRIBE": EventType.UNSUBSCRIBED,
            "DEFERRED": EventType.DEFERRED,
            "DROPPED": EventType.DROPPED,
        }
        
        etype = event_mapping.get(type_str)
        if not etype:
            debug.debug_log(f"WEBHOOK: Unknown SendGrid event type: {type_str}")
            continue

        # Find email record
        from .models import Email
        email_rec = None
        if email_id:
            email_rec = db.query(Email).get(email_id)
        
        if not email_rec and to_email:
            # Fallback: Find most recent email for this recipient
            email_rec = db.query(Email).filter(Email.recipient_email == to_email).order_by(Email.sent_at.desc()).first()

        if email_rec:
            debug.debug_log(f"WEBHOOK: Processing {etype} for email {email_rec.id}")
            log_event(
                db, 
                email_rec.id, 
                etype, 
                ip=event.get("ip"), 
                ua=event.get("useragent"), 
                url=event.get("url")
            )
            
            # Additional metadata mapping
            if etype == EventType.BOUNCED:
                email_rec.bounce_reason = event.get("reason")
            if event.get("status"):
                email_rec.delivery_status = event.get("status")
            
            db.commit()
        else:
            debug.debug_log(f"WEBHOOK: Could not find email for event: {event}")

    return {"status": "success"}

def process_webhook_event(db: Session, payload: dict):
    # Standard format: { "id": "email_id", "event": "opened|clicked|bounced", "url": "...", "timestamp": "..." }
    email_id = payload.get("id")
    event_str = payload.get("event", "").upper()
    url = payload.get("url")
    
    event_type = None
    if "OPEN" in event_str: event_type = EventType.OPENED
    elif "CLICK" in event_str: event_type = EventType.CLICKED
    elif "BOUNCE" in event_str: event_type = EventType.BOUNCED
    
    if email_id and event_type:
        return log_event(db, int(email_id), event_type, url=url)
    return False


def get_date_window(days: int = 30):
    """
    Returns (start_date, end_date) consistent with the Dashboard charts.
    - 7 days: Current Week (Monday 00:00:00 to Sunday 23:59:59)
    - 30 days: Rolling last 30 days
    - 90 days: Last 90 days from now
    - 365 days: Current Year (Jan 1st to Dec 31st)
    """
    import calendar
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    
    if days == 7:
        # Week View: Mon -> Sun of current week
        weekday = now.weekday() # 0 = Mon, 6 = Sun
        start_date = (now - timedelta(days=weekday)).replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=7)
        return start_date, end_date
        
    if days == 30:
        # Month View: Rolling last 30 days to avoid zeroing out data on month boundaries.
        end_date = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        start_date = end_date - timedelta(days=30)
        return start_date, end_date
        
    if days == 365:
        # Year View: Full current year
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date.replace(year=start_date.year + 1)
        return start_date, end_date
        
    # Quarter (90) or any other: Rolling window
    end_date = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = end_date - timedelta(days=days)
    return start_date, end_date


def _dialect_name(db: Session) -> str:
    try:
        bind = db.get_bind()
        if bind and bind.dialect:
            return bind.dialect.name
    except Exception:
        pass
    return ""

def get_unified_metrics(db: Session, days: int = 30, campaign_name: str = "all", company_name: str | list = "all", start_date: datetime = None, end_date: datetime = None):
    """
    SaaS Grade Single Source of Truth for all metrics.
    Ensures calculations are identical across Dashboard and Analytics.
    """
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func, distinct, case
    
    now = datetime.now(timezone.utc)
    if not start_date or not end_date:
        s, e = get_date_window(days)
        if not start_date: start_date = s
        if not end_date: end_date = e
    
    # 1. Base Query Filter
    # SaaS Grade: Only count emails that have been actually 'sent' (sent_at is set)
    query_emails = db.query(
        func.count(Email.id).label("total_attempts"),
        func.count(case(((Email.status.in_([EmailStatus.SENT, EmailStatus.DELIVERED])), Email.id), else_=None)).label("delivered"),
        func.count(case(((Email.status == EmailStatus.BOUNCED), Email.id), else_=None)).label("bounces"),
        func.count(case(((Email.status == EmailStatus.SPAM), Email.id), else_=None)).label("spam")
    ).filter(Email.sent_at != None, Email.sent_at >= start_date, Email.sent_at < end_date)
    
    query_events = db.query(
        func.count(distinct(case(((EmailEvent.event_type == EventType.OPENED), EmailEvent.email_id), else_=None))).label("opens"),
        func.count(distinct(case(((EmailEvent.event_type == EventType.CLICKED), EmailEvent.email_id), else_=None))).label("clicks")
    ).filter(EmailEvent.timestamp >= start_date, EmailEvent.timestamp < end_date)
    
    if campaign_name != "all":
        campaign_filter = db.query(Campaign.id).filter(Campaign.name == campaign_name).scalar_subquery()
        query_emails = query_emails.filter(Email.campaign_id == campaign_filter)
        query_events = query_events.join(Email).filter(Email.campaign_id == campaign_filter)

    # 1.5. Company Filter (Join with Campaign)
    if company_name and company_name != "all":
        companies = [company_name] if isinstance(company_name, str) else company_name
        
        # PRO GRADE: Filter by the campaign's company (ownership)
        query_emails = query_emails.join(Campaign, Email.campaign_id == Campaign.id).filter(Campaign.company.in_(companies))
        
        # Join logic for events
        if campaign_name == "all":
            query_events = query_events.join(Email).join(Campaign, Email.campaign_id == Campaign.id).filter(Campaign.company.in_(companies))
        else:
             query_events = query_events.join(Campaign, Email.campaign_id == Campaign.id).filter(Campaign.company.in_(companies))
             
    email_res = query_emails.first()
    event_res = query_events.first()
    
    delivered = email_res.delivered or 0
    bounces = email_res.bounces or 0
    spam = email_res.spam or 0
    total_sent = delivered + bounces + spam
    
    opens = event_res.opens or 0
    clicks = event_res.clicks or 0
    
    def calc_rate(num, den):
        return round((num / den * 100.0), 1) if den > 0 else 0.0
        
    return {
        "delivered": int(delivered),
        "totalSent": int(total_sent),
        "opens": int(opens),
        "clicks": int(clicks),
        "bounces": int(bounces),
        "spam": int(spam),
        "unreadCount": int(max(0, delivered - opens)),
        "openRate": calc_rate(opens, delivered),
        "clickRate": calc_rate(clicks, delivered),
        "bounceRate": calc_rate(bounces, total_sent),
        "spamRate": calc_rate(spam, delivered)
    }



def get_analytics(db: Session, campaign_name: str = "all", days: int = 30, company_name: str | list = "all"):
    """
    Deep dive analytics synced with Dashboard math and compatible with both
    PostgreSQL and SQLite fallback mode.
    """
    from .models import EmailEvent, EventType, Email, Campaign

    s, e = get_date_window(days)

    # 1. Current Metrics (KPIs)
    m = get_unified_metrics(
        db,
        days=days,
        campaign_name=campaign_name,
        company_name=company_name,
        start_date=s,
        end_date=e,
    )

    # 2. Growth Logic (Identical to compute_stats)
    if days == 7:
        prev_start = s - timedelta(days=7)
        prev_end = s
    elif days == 30:
        prev_start = s - timedelta(days=30)
        prev_end = s
    else:
        prev_start = s - timedelta(days=days)
        prev_end = s

    p = get_unified_metrics(
        db,
        campaign_name=campaign_name,
        company_name=company_name,
        start_date=prev_start,
        end_date=prev_end,
    )

    def calc_growth(cur, prev):
        if prev == 0:
            return 100.0 if cur > 0 else 0.0
        return round(((cur - prev) / prev) * 100, 1)

    # 3. Pull raw event rows once and aggregate in Python to keep the query
    # compatible with both PostgreSQL and SQLite.
    event_query = db.query(
        EmailEvent.timestamp,
        EmailEvent.event_type,
        EmailEvent.email_id,
        EmailEvent.device,
        EmailEvent.country,
        EmailEvent.city,
    ).filter(
        EmailEvent.timestamp >= s,
        EmailEvent.timestamp < e,
    )

    if campaign_name != "all" or (company_name and company_name != "all"):
        event_query = event_query.join(Email, EmailEvent.email_id == Email.id).join(
            Campaign, Email.campaign_id == Campaign.id
        )
        if campaign_name != "all":
            event_query = event_query.filter(Campaign.name == campaign_name)
        if company_name and company_name != "all":
            companies = [company_name] if isinstance(company_name, str) else company_name
            event_query = event_query.filter(Campaign.company.in_(companies))

    event_rows = event_query.all()

    def performance_label(ts):
        if days == 7:
            return ts.strftime("%a")
        if days <= 31:
            return ts.strftime("%d")
        return ts.strftime("%m/%d")

    bucket_map: dict[str, dict[str, set[int]]] = {}
    device_counts: dict[str, int] = {}
    location_counts: dict[tuple[str, str], int] = {}

    for row in event_rows:
        ts = row.timestamp
        if ts is None:
            continue

        label = performance_label(ts)
        bucket = bucket_map.setdefault(label, {"opens": set(), "clicks": set()})
        if row.event_type == EventType.OPENED:
            bucket["opens"].add(row.email_id)
        elif row.event_type == EventType.CLICKED:
            bucket["clicks"].add(row.email_id)

        device_name = row.device or "Desktop"
        device_counts[device_name] = device_counts.get(device_name, 0) + 1

        if row.event_type == EventType.OPENED:
            country = row.country or "Unknown"
            city = row.city or "Unknown"
            key = (country, city)
            location_counts[key] = location_counts.get(key, 0) + 1

    performance = []
    if days == 7:
        for i in range(7):
            d = s + timedelta(days=i)
            label = d.strftime("%a")
            bucket = bucket_map.get(label, {"opens": set(), "clicks": set()})
            performance.append(
                {"time": label, "opens": len(bucket["opens"]), "clicks": len(bucket["clicks"])}
            )
    elif days <= 31:
        for i in range(days):
            d = s + timedelta(days=i)
            if d >= e:
                break
            label = d.strftime("%d")
            bucket = bucket_map.get(label, {"opens": set(), "clicks": set()})
            performance.append(
                {"time": label, "opens": len(bucket["opens"]), "clicks": len(bucket["clicks"])}
            )
    else:
        ordered_labels = []
        seen_labels = set()
        for row in sorted(event_rows, key=lambda item: item.timestamp or s):
            if not row.timestamp:
                continue
            label = row.timestamp.strftime("%m/%d")
            if label not in seen_labels:
                seen_labels.add(label)
                ordered_labels.append(label)
        for label in ordered_labels:
            bucket = bucket_map.get(label, {"opens": set(), "clicks": set()})
            performance.append(
                {"time": label, "opens": len(bucket["opens"]), "clicks": len(bucket["clicks"])}
            )

    # 4. Device Distribution
    device_data = [{"name": name, "value": count} for name, count in device_counts.items()]
    if not device_data:
        device_data = [{"name": "Desktop", "value": 0}, {"name": "Mobile", "value": 0}]

    # 5. Top Locations
    total_opens = m.get("opens", 0) or 1
    sorted_locations = sorted(location_counts.items(), key=lambda item: item[1], reverse=True)[:5]
    locations_data = []
    for (country, city), opens in sorted_locations:
        locations_data.append(
            {
                "country": country,
                "city": city,
                "opens": opens,
                "rate": round((opens / total_opens) * 100, 1),
            }
        )

    # Return exactly what the frontend expects
    return {
        "deliveredEmails": m["delivered"],
        "openRate": m["openRate"],
        "clickRate": m["clickRate"],
        "spamRate": m["spamRate"],
        "bounceRate": m["bounceRate"],
        "unread": m["unreadCount"],
        "deliveredEmailsGrowth": calc_growth(m["delivered"], p["delivered"]),
        "openRateGrowth": calc_growth(m["openRate"], p["openRate"]),
        "clickRateGrowth": calc_growth(m["clickRate"], p["clickRate"]),
        "spamRateGrowth": calc_growth(m["spamRate"], p["spamRate"]),
        "performanceData": performance,
        "deviceData": device_data,
        "locationsData": locations_data,
        "linkData": get_link_performance(db, campaign_name, company_name=company_name, days=days),
        "recentActivity": recent_events(db, days=days, campaign_name=campaign_name, company_name=company_name, limit=10)
    }


def compute_stats(db: Session, days: int = 30, campaign_name: str = "all", company_name: str | list = "all", vs_label: str = "vs last month"):
    # Unified Source of Truth
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    
    # 1. Current Period Metrics
    s, e = get_date_window(days)
    m = get_unified_metrics(db, days=days, campaign_name=campaign_name, company_name=company_name, start_date=s, end_date=e)
    
    # 2. Previous Period Metrics for Growth
    if days == 7:
        prev_start = s - timedelta(days=7)
        prev_end = s
    elif days == 30:
        prev_start = s - timedelta(days=30)
        prev_end = s
    else:
        prev_start = s - timedelta(days=days)
        prev_end = s
    p = get_unified_metrics(db, campaign_name=campaign_name, company_name=company_name, start_date=prev_start, end_date=prev_end)
    
    # helper for growth
    def calc_growth(cur, prev):
        if prev == 0: return 100.0 if cur > 0 else 0.0
        return round(((cur - prev) / prev) * 100, 1)

    # Active Campaigns
    active_camps = db.query(func.count(Campaign.id)).filter(
        Campaign.status == CampaignStatus.RUNNING
    ).scalar() or 0
    
    # Active Campaigns Growth (approximation vs 7 days ago if 30 days is too much)
    # But for consistency, use the same 'days' period
    prev_active_camps = db.query(func.count(Campaign.id)).filter(
        Campaign.status == CampaignStatus.RUNNING,
        Campaign.created_at < prev_end
    ).scalar() or 0

    return {
        "totalEmails": m["totalSent"],
        "openRate": m["openRate"],
        "clickRate": m["clickRate"],
        "bounceRate": m["bounceRate"],
        "unread": m["unreadCount"],
        "activeCampaigns": int(active_camps),
        "totalEmailsGrowth": calc_growth(m["totalSent"], p["totalSent"]),
        "openRateGrowth": calc_growth(m["openRate"], p["openRate"]),
        "clickRateGrowth": calc_growth(m["clickRate"], p["clickRate"]),
        "bounceRateGrowth": calc_growth(m["bounceRate"], p["bounceRate"]),
        "unreadGrowth": calc_growth(m["unreadCount"], p["unreadCount"]),
        "activeCampaignsGrowth": calc_growth(int(active_camps), int(prev_active_camps)),
        "vsLabel": vs_label,
        "raw": {"bounced": m["bounces"], "opened": m["opens"], "delivered": m["delivered"], "unread": m["unreadCount"]}
    }

def get_dashboard_stats(days: int = 30, campaign_name: str = "all", company_name: str | list = "all"):
    from .database import SessionLocal
    db = SessionLocal()
    try:
        return compute_stats(db, days, campaign_name, company_name)
    finally:
        db.close()


def emails_over_time(db: Session, days: int = 7, company_name: str | list = "all"):
    from datetime import datetime, timedelta, date, timezone
    import calendar
    from sqlalchemy import cast, Date, func
    
    now = datetime.now(timezone.utc)
    
    # Define buckets and range based on 'days' parameter
    buckets = []
    start_date = None
    end_date = None
    
    if days == 7:
        # Week View: Mon -> Sun of current week
        weekday = now.weekday() # 0 = Mon, 6 = Sun
        start_date = (now - timedelta(days=weekday)).replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=7)
        
        for i in range(7):
            d = start_date + timedelta(days=i)
            buckets.append({
                "label": d.strftime('%a'), # Mon, Tue...
                "start": d,
                "end": d + timedelta(days=1)
            })
            
    elif days == 30:
        # Month View: rolling 30 days grouped into 3-day intervals.
        end_date = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        start_date = end_date - timedelta(days=30)

        cursor = start_date
        while cursor < end_date:
            bucket_end = min(cursor + timedelta(days=3), end_date)
            buckets.append({
                "label": cursor.strftime('%d %b'),
                "start": cursor,
                "end": bucket_end
            })
            cursor = bucket_end
            
    elif days == 90:
        # Quarter View: 10-day grouping (10, 20, ..., 90)
        end_date = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        start_date = end_date - timedelta(days=90)
        
        for i in range(0, 90, 10):
            b_start = start_date + timedelta(days=i)
            b_end = b_start + timedelta(days=10)
            buckets.append({
                "label": str(i + 10), # 10, 20, 30... 90
                "start": b_start,
                "end": b_end
            })
            
    elif days == 365:
        # Year View: Monthly intervals of current year
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date.replace(year=start_date.year + 1)
        
        for m in range(1, 13):
            b_start = start_date.replace(month=m)
            if m == 12:
                b_end = b_start.replace(year=b_start.year + 1, month=1)
            else:
                b_end = b_start.replace(month=m + 1)
            buckets.append({
                "label": calendar.month_name[m][:3], # Jan, Feb...
                "start": b_start,
                "end": b_end
            })
    else:
        # Fallback to daily for any other value (Last 'days' days)
        end_date = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        start_date = end_date - timedelta(days=days)
        for i in range(days):
            d = start_date + timedelta(days=i)
            buckets.append({
                "label": d.strftime('%b %d'),
                "start": d,
                "end": d + timedelta(days=1)
            })

    from .models import Contact
    # Fetch aggregated counts by date
    query = db.query(
        cast(Email.sent_at, Date).label("d"),
        func.count(Email.id).label("c")
    ).filter(
        Email.sent_at >= start_date,
        Email.sent_at < end_date,
        Email.status.in_([EmailStatus.SENT, EmailStatus.DELIVERED, EmailStatus.BOUNCED])
    )

    if company_name and company_name != "all":
        companies = [company_name] if isinstance(company_name, str) else company_name
        query = query.join(Campaign, Email.campaign_id == Campaign.id).filter(Campaign.company.in_(companies))

    print(f"DEBUG: Running chart query for {days} days...")
    results = query.group_by(cast(Email.sent_at, Date)).all()
    
    if not results:
        return [{"day": b["label"], "emails": 0} for b in buckets]

    # Map real results into buckets
    chart_data = []
    for b in buckets:
        count = 0
        b_start_date = b["start"].date()
        b_end_date = b["end"].date()
        for r_date, c in results:
            if b_start_date <= r_date < b_end_date:
                count += c
        chart_data.append({
            "day": b["label"], 
            "emails": count
        })
                        
    return chart_data



def recent_events(db: Session, days: int = 30, limit: int | None = 20, campaign_name: str = "all", company_name: str | list = "all"):
    from datetime import datetime, timedelta, timezone
    from .models import Contact
    start_date, end_date = get_date_window(days)
    debug.debug_log(f"FETCHING ACTIVITY: days={days}, start={start_date}, end={end_date}, company={company_name}")
    
    # Outer join with Contact and Campaign to get name, company, and campaign details
    query = db.query(
        EmailEvent, 
        Contact.name.label("contact_name"), 
        Contact.company.label("contact_company"),
        Campaign.name.label("campaign_name"),
        Campaign.company.label("campaign_company"),
    ).join(Email, EmailEvent.email_id == Email.id)\
     .outerjoin(Contact, Email.recipient_email == Contact.email)\
     .outerjoin(Campaign, Email.campaign_id == Campaign.id)
    
    if campaign_name != "all":
        query = query.filter(Campaign.name == campaign_name)
    
    if company_name and company_name != "all":
        companies = [company_name] if isinstance(company_name, str) else company_name
        query = query.filter(Campaign.company.in_(companies))
        
    events_query = query.filter(
        EmailEvent.timestamp >= start_date,
        EmailEvent.timestamp < end_date
    ).order_by(EmailEvent.timestamp.desc())

    fetch_limit = limit * 5 if limit else None
    if fetch_limit:
        events_query = events_query.limit(fetch_limit)

    events = events_query.all()  # Fetch more for grouping when a limit is provided
    
    PERSONAL_PROVIDERS = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "protonmail.com"}
    TLD_COUNTRY_MAP = {"in": "India", "uk": "United Kingdom", "us": "USA", "au": "Australia", "de": "Germany", "fr": "France", "ca": "Canada"}
    
    result = []
    if not events:
        fallback_query = db.query(ActivityLog).filter(
            ActivityLog.timestamp >= start_date,
            ActivityLog.timestamp < end_date,
        )

        if campaign_name != "all":
            campaign_ids = db.query(Campaign.id).filter(Campaign.name == campaign_name).subquery()
            fallback_query = fallback_query.filter(ActivityLog.campaign_id.in_(campaign_ids))

        if company_name and company_name != "all":
            companies = [company_name] if isinstance(company_name, str) else company_name
            fallback_query = fallback_query.filter(ActivityLog.company.in_(companies))

        fallback_rows = fallback_query.order_by(ActivityLog.timestamp.desc())
        if fetch_limit:
            fallback_rows = fallback_rows.limit(fetch_limit)

        for row in fallback_rows.all():
            event_type = (row.status or "SENT").lower()
            timestamp = row.timestamp.isoformat() if row.timestamp else ""
            result.append({
                "id": row.id,
                "email_id": row.email_id or row.id,
                "recipient": row.recipient_email or "",
                "email": row.recipient_email or "",
                "recipient_name": row.recipient_name or "Unknown",
                "company": row.company or "Unknown",
                "event_type": event_type,
                "type": event_type,
                "subject": "No Subject",
                "sender": row.sender or "Unknown",
                "timestamp": timestamp,
                "location": row.country or "Unknown",
                "country": row.country or "Unknown",
                "metadata": {
                    "browser": "Unknown",
                    "os": "Unknown",
                    "device": "Desktop",
                    "location": row.country or "Unknown",
                    "url": None,
                }
            })

    for ev_data in events:
        ev, contact_name, contact_company, campaign_name, campaign_company = ev_data
        
        # Determine Sender (Multi-Company Sync)
        sender_company = campaign_company or "MP Consultant LLC"
        if not sender_company:
            # Fallback to legacy string matching if company record is empty
            camp_name = (campaign_name or "").lower()
            if "making" in camp_name: sender_company = "A Making Company"
            elif "lumina" in camp_name: sender_company = "MP Lumina"
            else: sender_company = "MP Consultant LLC"
        
        # Smart Company Extraction Logic
        email_str = ev.email.recipient_email
        domain = email_str.split("@")[-1].lower() if "@" in email_str else ""
        if not contact_company:
            if domain in PERSONAL_PROVIDERS:
                contact_company = "Personal Email"
            elif domain:
                company_base = domain.rsplit(".", 1)[0]
                contact_company = company_base.capitalize()
            else:
                contact_company = "Unknown"
            
        # Country deduction
        country = "Unknown"
        if ev.country and ev.country != "Unknown":
            country = ev.country
        elif domain:
            tld = domain.rsplit(".", 1)[-1] if "." in domain else ""
            if tld in TLD_COUNTRY_MAP:
                country = TLD_COUNTRY_MAP[tld]
            # Removed hardcoded .com -> USA guess to ensure real data priority

        ev_type = ev.event_type.value if hasattr(ev.event_type, 'value') else str(ev.event_type)
        if "EventType." in ev_type: ev_type = ev_type.split(".")[-1].lower()
        
        loc = f"{ev.city}, {country}" if ev.city and country != "Unknown" else country
        
        # Robust Name Fallback
        if not contact_name and email_str:
            prefix = email_str.split("@")[0]
            # john.doe -> John Doe
            contact_name = " ".join([w.capitalize() for w in prefix.replace(".", " ").replace("_", " ").replace("-", " ").split()])

        result.append({
            "id": ev.id,
            "email_id": ev.email_id,
            "recipient": email_str,
            "email": email_str, # Alias for frontend compatibility
            "recipient_name": contact_name or "Unknown",
            "company": contact_company,
            "campaign_name": campaign_name or "",
            "event_type": ev_type,
            "type": ev_type,
            "subject": ev.email.subject or "No Subject",
            "sender": sender_company,
            "timestamp": (ev.timestamp.isoformat() if hasattr(ev.timestamp, "isoformat") else str(ev.timestamp)).replace("+00:00", "Z") + ("Z" if "Z" not in str(ev.timestamp) and "+00:00" not in str(ev.timestamp) else ""),
            "location": loc,
            "country": country,
            "metadata": {
                "browser": ev.browser or "Unknown",
                "os": ev.os or "Unknown",
                "device": ev.device or "Desktop",
                "location": loc,
                "url": ev.url
            }
        })
    
    # Grouping Logic: Each unique email send (email_id) gets its own timeline
    grouped = {}
    for r in result:
        key = r['email_id']
        if key not in grouped:
            grouped[key] = {
                "id": r["id"],
                "email_id": r["email_id"],
                "recipient": r["recipient"],
                "recipient_name": r["recipient_name"],
                "company": r["company"],
                "campaign_name": r.get("campaign_name", ""),
                "subject": r["subject"],
                "sender": r["sender"],
                "location": r["location"],
                "country": r["country"],
                "email": r["email"],
                "type": r["type"],
                "timestamp": r["timestamp"],
                "metadata": r["metadata"],
                "latest_type": r["type"],
                "latest_timestamp": r["timestamp"],
                "events": []
            }
        
        # Deduplication Logic: Only one SENT and one DELIVERED per email
        # Multiple OPENED/CLICKED are allowed
        is_duplicate = False
        if r["type"] in ["sent", "delivered"]:
            if any(e["type"] == r["type"] for e in grouped[key]["events"]):
                is_duplicate = True
        
        if not is_duplicate:
            grouped[key]["events"].append({
                "type": r["type"],
                "timestamp": r["timestamp"]
            })
            
        # Update latest status info
        if r["timestamp"] > grouped[key]["latest_timestamp"]:
             grouped[key]["latest_timestamp"] = r["timestamp"]
             grouped[key]["latest_type"] = r["type"]
             grouped[key]["type"] = r["type"]
             grouped[key]["timestamp"] = r["timestamp"]
             grouped[key]["metadata"] = r["metadata"]

    # Final Polish: Sort events chronologically inside each group
    for group in grouped.values():
        group["events"].sort(key=lambda x: x["timestamp"])

    # Flatten and sort rows by most recent activity
    final_grouped = list(grouped.values())
    final_grouped.sort(key=lambda x: x["latest_timestamp"], reverse=True)
    
    return final_grouped[:limit] if limit else final_grouped

def get_emails_per_company(db: Session, days: int = 30, company_name: str | list = "all"):
    """
    Returns company-wise executed email totals for the dashboard donut chart.

    Important business rules:
    - Do not count QUEUED/SCHEDULED/PENDING-only campaign rows.
    - Count only real executed email attempts.
    - Be resilient to stale campaign.status values by relying on email/activity data.
    """
    from .models import Campaign, Email

    start_date, end_date = get_date_window(days)
    debug.debug_log(f"FETCHING ACTIVITY: days={days}, start={start_date}, end={end_date}, company={company_name}")
    executed_email_statuses = [
        EmailStatus.SENT,
        EmailStatus.DELIVERED,
        EmailStatus.BOUNCED,
        EmailStatus.SPAM,
        EmailStatus.DROPPED,
    ]

    query = db.query(
        Campaign.company,
        func.count(Email.id).label("total")
    ).join(Email, Campaign.id == Email.campaign_id)

    # Count only actually executed emails. This excludes queued/pending rows even if
    # sent_at was prefilled by an earlier default or legacy migration.
    query = query.filter(Email.status.in_(executed_email_statuses))
    query = query.filter(
        or_(
            and_(Email.sent_at.isnot(None), Email.sent_at >= start_date, Email.sent_at < end_date),
            and_(Email.opened_at.isnot(None), Email.opened_at >= start_date, Email.opened_at < end_date),
            and_(Email.clicked_at.isnot(None), Email.clicked_at >= start_date, Email.clicked_at < end_date),
        )
    )

    if company_name != "all":
        if isinstance(company_name, list):
            query = query.filter(Campaign.company.in_(company_name))
        else:
            query = query.filter(Campaign.company == company_name)

    results = query.group_by(Campaign.company).all()
    # Remove 'Unknown' or Null companies as per user requirement
    data = [{"company": r[0], "total": int(r[1] or 0)} for r in results if r[0] and r[0].lower() != "unknown" and (r[1] or 0) > 0]

    if data:
        return data

    # Fallback for legacy rows where email timestamps/statuses were not normalized
    # but activity logs already contain the real execution history.
    activity_query = db.query(
        ActivityLog.company,
        func.count(distinct(ActivityLog.email_id)).label("total")
    ).filter(
        ActivityLog.timestamp >= start_date,
        ActivityLog.status.in_(["SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED"])
    )

    if company_name != "all":
        if isinstance(company_name, list):
            activity_query = activity_query.filter(ActivityLog.company.in_(company_name))
        else:
            activity_query = activity_query.filter(ActivityLog.company == company_name)

    activity_rows = activity_query.group_by(ActivityLog.company).all()
    # Remove 'Unknown' or Null companies as per user requirement
    return [{"company": r[0], "total": int(r[1] or 0)} for r in activity_rows if r[0] and r[0].lower() != "unknown" and (r[1] or 0) > 0]


def prepare_campaign_emails(db: Session, campaign_id: int, data, background_tasks):
    from .models import Campaign, CampaignStatus, Email, EmailStatus
    from .tasks import send_email_fn
    from datetime import datetime, timezone
    
    camp = db.query(Campaign).get(campaign_id)
    if not camp:
        raise Exception("Campaign not found")
        
    eta = None
    if getattr(data, 'scheduled_at', None):
        try:
            eta = datetime.fromisoformat(data.scheduled_at.replace("Z", "+00:00"))
        except:
            pass

    records = []
    recipients = getattr(data, 'recipients', []) or []
    
    # Deduplication Logic: Check existing emails for this campaign
    existing_emails = {e.recipient_email for e in db.query(Email.recipient_email).filter(Email.campaign_id == campaign_id).all()}
    
    for addr in recipients:
        if addr in existing_emails:
            continue
            
        e = Email(
            campaign_id=campaign_id, 
            recipient_email=addr, 
            status=EmailStatus.PENDING,
            subject=data.subject,
            body=data.body
        )
        db.add(e)
        records.append(e)
    
    # Update campaign status
    if eta and eta > datetime.now(timezone.utc):
        camp.status = CampaignStatus.QUEUED
        camp.scheduled_for = eta
    else:
        camp.status = CampaignStatus.RUNNING
        # If launching now, ensure we have emails to send (could be existing ones)
        if not records:
            existing_pending = db.query(Email).filter(Email.campaign_id == campaign_id, Email.status == EmailStatus.PENDING).all()
            records = list(existing_pending)
    
    db.commit()
    
    # Trigger background tasks for immediate sends
    if camp.status == CampaignStatus.RUNNING:
        for e in records:
            background_tasks.add_task(send_email_fn, e.id, data.subject, data.body)
            
    return {"queued": len(records), "scheduled": bool(eta), "status": camp.status.value}

def create_campaign(db: Session, data, background_tasks=None):
    from .models import Campaign, CampaignStatus
    import traceback
    
    # 9. Add logging
    debug.debug_log(f"Campaign Payload: {data.dict()}")

    # 7 & 8. Ensure company field matches allowed values
    ALLOWED_COMPANIES = ["MP Lumina", "MP Consultant LLC", "A Making Company", "Matkotech"]
    if data.company not in ALLOWED_COMPANIES:
        debug.debug_log(f"VALIDATION_ERROR: Invalid company '{data.company}'")
        data.company = "MP Consultant LLC" 

    try:
        # 3. Fix DB insert query: status -> default "RUNNING"
        new_camp = Campaign(
            name=data.name,
            company=data.company,
            subject=data.subject,
            body=data.body,
            status=CampaignStatus.RUNNING,
            sent_count=0,
            delivered_count=0,
            failed_count=0,
            opens_count=0,
            unread_count=0,
            bounce_count=0,
            scheduled_for=None
        )
        
        # Handle scheduling with timezone awareness
        scheduled_at_str = getattr(data, 'scheduled_at', None)
        if scheduled_at_str:
            try:
                if "Z" in scheduled_at_str or "+" in scheduled_at_str:
                     new_camp.scheduled_for = datetime.fromisoformat(scheduled_at_str.replace("Z", "+00:00"))
                else:
                     new_camp.scheduled_for = datetime.fromisoformat(scheduled_at_str).replace(tzinfo=timezone.utc)
            except Exception as parse_err:
                debug.debug_log(f"SCHEDULING_PARSE_ERROR: {str(parse_err)}")
        
        db.add(new_camp)
        db.commit()
        db.refresh(new_camp)
        
        send_result = None
        if getattr(data, 'recipients', None) and background_tasks:
            send_result = prepare_campaign_emails(db, new_camp.id, data, background_tasks)

        result = {
            "id": int(new_camp.id),
            "name": str(new_camp.name),
            "subject": str(new_camp.subject),
            "body": str(new_camp.body),
            "status": str(new_camp.status.value),
            "sent": int(new_camp.sent_count or 0),
            "opens": "0 (0%)",
            "unread": "0 (0%)",
            "bounce": "0 (0%)",
            "company": str(new_camp.company),
            "scheduled": str(new_camp.scheduled_for or "-"),
        }
        
        if send_result:
            result["send_status"] = send_result
            
        # SaaS Grade: Add to Redis scheduler if scheduled for future
        if new_camp.status == CampaignStatus.QUEUED and redis_client:
            try:
                # new_camp.scheduled_for is a datetime object (naive or TZ aware)
                # Ensure it's treated as UTC for the timestamp
                eta = new_camp.scheduled_for
                if eta.tzinfo is None:
                    eta = eta.replace(tzinfo=timezone.utc)
                timestamp = int(eta.timestamp())
                redis_client.zadd("scheduled_campaigns", {str(new_camp.id): timestamp})
                debug.debug_log(f"REDIS_SCHEDULER: Added campaign {new_camp.id} to queue (Unix: {timestamp})")
            except Exception as re:
                debug.debug_log(f"REDIS_SCHEDULER_ERROR: {str(re)}")

        return result
    except Exception as e:
        db.rollback()
        debug.debug_log(f"DB ERROR in create_campaign: {str(e)}")
        debug.debug_log(traceback.format_exc())
        raise Exception("Database error while creating campaign")

def process_scheduled_queue(db: Session, background_tasks):
    """
    Step 4: Safe Scheduler Worker for Vercel.
    Pulls due campaign IDs from Redis and starts them.
    Fix: Triggers existing emails instead of recreating them.
    """
    if not redis_client:
        processed = check_due_campaigns(db, background_tasks=background_tasks)
        return {"status": "ok", "processed": processed, "source": "database-fallback"}

    now_ts = int(datetime.now(timezone.utc).timestamp())
    
    # Use a lock to prevent multi-trigger overlap
    lock_key = "scheduler_execution_lock"
    is_locked = redis_client.set(lock_key, "locked", ex=50, nx=True)
    if not is_locked:
        return {"status": "skipped", "message": "Another scheduler is running"}

    try:
        due_ids = redis_client.zrangebyscore("scheduled_campaigns", 0, now_ts)
        if not due_ids:
            return {"status": "ok", "processed": 0}

        processed = 0
        for camp_id in due_ids:
            try:
                camp = db.query(Campaign).filter(Campaign.id == int(camp_id)).first()
                if not camp:
                    redis_client.zrem("scheduled_campaigns", camp_id)
                    continue

                if camp.status != CampaignStatus.QUEUED:
                    redis_client.zrem("scheduled_campaigns", camp_id)
                    continue

                # Lock and update status
                camp.status = CampaignStatus.RUNNING
                db.commit()

                # Trigger execution of existing PENDING emails
                if background_tasks:
                    trigger_campaign_emails(db, camp.id, background_tasks)
                else:
                    execute_campaign_sync(db, camp.id)
                
                redis_client.zrem("scheduled_campaigns", camp_id)
                processed += 1
                debug.debug_log(f"REDIS_SCHEDULER: Successfully triggered campaign {camp_id}")
            except Exception as inner_e:
                debug.debug_log(f"REDIS_SCHEDULER: Error processing ID {camp_id}: {inner_e}")

        return {"status": "ok", "processed": processed}
    finally:
        redis_client.delete(lock_key)


def scheduler_pulse():
    """
    Fire-and-forget scheduler pulse that manages its own DB session. This keeps
    dashboard/activity requests from passing a request-scoped Session object
    into FastAPI background tasks.
    """
    from .database import SessionLocal

    db = SessionLocal()
    try:
        process_scheduled_queue(db, None)
    except Exception as exc:
        debug.debug_log(f"SCHEDULER_PULSE_ERROR: {exc}")
    finally:
        db.close()


def get_activity(db: Session, limit: int | None = None, days: int = 30, company_name: str | list = "all"):
    """
    Returns grouped activity: one row per (email_id), ordered by latest event.
    Supports filtering by days and company.
    """
    import json
    from datetime import datetime, timedelta, timezone
    start_date, end_date = get_date_window(days)
    debug.debug_log(f"FETCHING ACTIVITY: days={days}, start={start_date}, end={end_date}, company={company_name}")
    
    try:
        query = db.query(ActivityLog).filter(ActivityLog.timestamp >= start_date, ActivityLog.timestamp < end_date)
        
        if company_name != "all":
            companies = [company_name] if isinstance(company_name, str) else company_name
            query = query.filter(ActivityLog.company.in_(companies))
            
        rows_query = query.order_by(ActivityLog.timestamp.desc())
        if limit:
            rows_query = rows_query.limit(limit * 2)
        rows = rows_query.all()
    except Exception as e:
        debug.debug_log(f"DB ERROR in get_activity: {e}")
        rows = []
    
    if not rows:
        fallback_rows = recent_events(
            db,
            days=days,
            limit=limit,
            company_name=company_name,
        )
        converted = []
        for row in fallback_rows:
            converted.append({
                "id": row.get("id"),
                "email_id": row.get("email_id"),
                "recipient_email": row.get("recipient") or row.get("email") or "",
                "recipient_name": row.get("recipient_name") or "",
                "sender": row.get("sender") or "",
                "company": row.get("company") or "",
                "status": (row.get("latest_type") or "SENT").upper(),
                "status_history": [
                    {
                        "status": (event.get("type") or "SENT").upper(),
                        "time": event.get("timestamp"),
                    }
                    for event in row.get("events", [])
                ],
                "country": row.get("country") or "Unknown",
                "timestamp": row.get("latest_timestamp") or row.get("timestamp") or "",
            })
        return converted

    seen = {}
    for row in rows:
        key = row.email_id if row.email_id else f"legacy_{row.recipient_email}"
        if key not in seen:
            seen[key] = row
        else:
            if row.id > seen[key].id:
                seen[key] = row
    
    result = []
    # Simplified priority for sorting timeline
    priority = {"CLICKED": 4, "OPENED": 3, "DELIVERED": 2, "SENT": 1, "BOUNCED": 0}

    deduped_rows = list(seen.values())[:limit] if limit else list(seen.values())
    campaign_ids = {row.campaign_id for row in deduped_rows if getattr(row, "campaign_id", None)}
    email_ids = {row.email_id for row in deduped_rows if getattr(row, "email_id", None)}

    campaign_name_map = {}
    if campaign_ids:
        campaign_name_map = {
            campaign_id: campaign_name
            for campaign_id, campaign_name in db.query(Campaign.id, Campaign.name).filter(Campaign.id.in_(campaign_ids)).all()
        }

    subject_map = {}
    if email_ids:
        subject_map = {
            email_id: subject
            for email_id, subject in db.query(Email.id, Email.subject).filter(Email.id.in_(email_ids)).all()
        }

    for row in deduped_rows:
        try:
            history_raw = json.loads(row.status_history or "[]")
            history_objs = []
            for h in history_raw:
                if isinstance(h, dict):
                    status_name = h.get("status")
                    event_time = h.get("time")
                else:
                    status_name = str(h)
                    event_time = row.timestamp.isoformat() if row.timestamp else None
                
                if status_name:
                    history_objs.append({"status": status_name.upper(), "time": event_time})
        except Exception:
            history_objs = [{"status": row.status.upper(), "time": row.timestamp.isoformat() if row.timestamp else None}]
        
        # Deduplicate and sort history
        history_map = {h["status"]: h for h in history_objs}
        history_sorted = sorted(history_map.values(), key=lambda x: priority.get(x["status"], 0), reverse=True)
        
        result.append({
            "id": row.id,
            "email_id": row.email_id,
            "recipient_email": row.recipient_email,
            "recipient_name": row.recipient_name or "",
            "sender": row.sender or "",
            "company": row.company or "",
            "campaign_name": campaign_name_map.get(row.campaign_id, ""),
            "subject": subject_map.get(row.email_id, "No Subject"),
            "status": row.status.upper() if row.status else "SENT",
            "status_history": history_sorted,
            "country": row.country or "Unknown",
            "timestamp": row.timestamp.isoformat() if row.timestamp else "",
        })
    return result

def process_sendgrid_webhook(db: Session, events: List[dict]):
    """
    Processes a list of SendGrid webhook events.
    This definition intentionally stays as the final definition in the file so
    the real implementation is not overwritten by an empty stub.
    """
    from .models import Email

    event_mapping = {
        "PROCESSED": EventType.SENT,
        "DELIVERED": EventType.DELIVERED,
        "OPEN": EventType.OPENED,
        "CLICK": EventType.CLICKED,
        "BOUNCE": EventType.BOUNCED,
        "SPAMREPORT": EventType.SPAM_REPORT,
        "UNSUBSCRIBE": EventType.UNSUBSCRIBED,
        "DEFERRED": EventType.DEFERRED,
        "DROPPED": EventType.DROPPED,
    }

    for event in events:
        email_id = event.get("email_id")
        to_email = event.get("email")
        type_str = str(event.get("event", "")).upper()
        etype = event_mapping.get(type_str)

        if not etype:
            debug.debug_log(f"WEBHOOK: Unknown SendGrid event type: {type_str}")
            continue

        email_rec = None
        if email_id:
            email_rec = db.query(Email).get(email_id)
        if not email_rec and to_email:
            email_rec = (
                db.query(Email)
                .filter(Email.recipient_email == to_email)
                .order_by(Email.sent_at.desc())
                .first()
            )

        if not email_rec:
            debug.debug_log(f"WEBHOOK: Could not find email for event: {event}")
            continue

        log_event(
            db,
            email_rec.id,
            etype,
            ip=event.get("ip"),
            ua=event.get("useragent"),
            url=event.get("url"),
        )

        if etype == EventType.BOUNCED:
            email_rec.bounce_reason = event.get("reason")
        if event.get("status"):
            email_rec.delivery_status = event.get("status")

        db.commit()

    return {"status": "success"}

def push_to_email_queue(email_id: int, subject: str, body: str, attachments: list = None, queue: str = "marketing"):
    """
    Pushes a job to the raw Redis queue for custom worker consumption.
    """
    import redis
    import json
    import os
    try:
        REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        r = redis.from_url(REDIS_URL)
        job_data = {
            "email_id": email_id,
            "subject": subject,
            "body": body,
            "attachments": attachments or []
        }
        r.lpush(queue, json.dumps(job_data))
        debug.debug_log(f"REDIS_QUEUE: Pushed email {email_id} to '{queue}'")
    except Exception as e:
        debug.debug_log(f"REDIS_QUEUE_ERROR: {str(e)}")

def get_campaigns(db: Session, search: str | None = None, status: str | None = None):
    from .models import Campaign
    try:
        # 1. Base query for campaigns
        query = db.query(Campaign)
        
        if search:
            query = query.filter(Campaign.name.ilike(f"%{search}%"))
            
        if status and status.lower() != "all":
            # Direct status string filter (Postgres/SQLite compatible)
            query = query.filter(Campaign.status == status.upper())
            
        campaigns = query.order_by(Campaign.created_at.desc()).all()
        
        results = []
        for c in campaigns:
            # 2. PRO GRADE: Atomic sub-queries for reliability
            # Calculations move into Python loop if count is small (<100) or stays in SQL for scale.
            # Here we simulate high scale by checking counts via SQLAlchemy func.
            
            sent = db.query(func.count(Email.id)).filter(
                Email.campaign_id == c.id,
                Email.status.in_([EmailStatus.SENT, EmailStatus.DELIVERED])
            ).scalar() or 0
            
            failed = db.query(func.count(Email.id)).filter(
                Email.campaign_id == c.id,
                Email.status == EmailStatus.BOUNCED
            ).scalar() or 0
            
            opens = db.query(func.count(distinct(EmailEvent.email_id))).join(Email).filter(
                Email.campaign_id == c.id,
                EmailEvent.event_type == EventType.OPENED
            ).scalar() or 0
            
            unread = max(0, sent - opens)
            
            # Use established status mapping logic
            display_status = c.status.value.title() if hasattr(c.status, "value") else str(c.status).title()
            if c.status == CampaignStatus.COMPLETED:
                display_status = "Complete" + (" with Errors" if failed > 0 else "")

            # Smarter time display: if launched now, use created_at, else scheduled_for
            display_time = c.scheduled_for or c.created_at
            
            def format_rate(num, den):
                if den <= 0: return f"0 (0.0%)"
                rate = round((num / den) * 100, 1)
                return f"{num} ({rate}%)"

            results.append({
                "id": str(c.id),
                "name": c.name,
                "status": display_status,
                "sent": sent,
                "delivered": sent,
                "failed": failed,
                "opens": format_rate(opens, sent),
                "unread": format_rate(unread, sent),
                "bounce": format_rate(failed, sent + failed),
                "company": str(c.company or "MP Consultant LLC"),
                "scheduled": display_time.isoformat() if display_time else None,
            })
        return results
    except Exception as e:
        debug.debug_log(f"CRITICAL ERROR in get_campaigns: {str(e)}")
        import traceback
        debug.debug_log(traceback.format_exc())
        raise e

def check_due_campaigns(db: Session, background_tasks=None):
    """
    SaaS Grade Scheduler: Finds QUEUED/SCHEDULED campaigns whose time has come.
    Implements is_processing locking to prevent duplicate execution across workers.
    """
    from .models import Campaign, CampaignStatus
    from datetime import datetime
    
    now = datetime.now(timezone.utc)
    # 1. Selection with primitive lock check
    due_campaigns = db.query(Campaign).filter(
        Campaign.status.in_([CampaignStatus.QUEUED, CampaignStatus.SCHEDULED]),
        Campaign.scheduled_for <= now,
        Campaign.is_processing == False
    ).all()
    
    if not due_campaigns:
        return 0
        
    debug.debug_log(f"SCHEDULER: Found {len(due_campaigns)} due campaigns.")
    triggered_count = 0
    
    for camp in due_campaigns:
        try:
            # 2. Atomic Lock (Best effort for MVP)
            camp.is_processing = True
            camp.status = CampaignStatus.RUNNING
            db.commit()
            
            debug.debug_log(f"SCHEDULER: Locked & Starting campaign {camp.id} ({camp.name})")
            
            # 3. Trigger Execution
            if background_tasks:
                trigger_campaign_emails(db, camp.id, background_tasks)
            else:
                # Synchronous execution for worker/loop safety
                execute_campaign_sync(db, camp.id)
            
            triggered_count += 1
            
        except Exception as e:
            debug.debug_log(f"SCHEDULER_CRITICAL: Failed to trigger campaign {camp.id}: {str(e)}")
            camp.is_processing = False
            camp.status = CampaignStatus.FAILED
            db.commit()
            
    return triggered_count

def execute_campaign_sync(db: Session, campaign_id: int):
    """Executes a campaign synchronously within the scheduler context."""
    from .models import Email, EmailStatus, CampaignStatus, Campaign
    from .tasks import send_email_fn
    
    camp = db.query(Campaign).get(campaign_id)
    if not camp: return
    
    pending = db.query(Email).filter(Email.campaign_id == campaign_id, Email.status == EmailStatus.PENDING).all()
    debug.debug_log(f"SCHEDULER_EXEC: Sending {len(pending)} pending emails for {camp.name}")
    
    errors = 0
    for e in pending:
        try:
            send_email_fn(e.id, e.subject, e.body)
        except Exception as err:
            debug.debug_log(f"SCHEDULER_SEND_ERROR for email {e.id}: {err}")
            errors += 1
    
    # Final check and status update
    camp.is_processing = False
    if errors > 0:
        camp.status = CampaignStatus.COMPLETED_WITH_ERRORS
    else:
        camp.status = CampaignStatus.COMPLETED
    
    camp.completed_at = datetime.now(timezone.utc)
    db.commit()
    debug.debug_log(f"SCHEDULER_COMPLETE: Campaign {camp.id} finished with {errors} errors.")

def trigger_campaign_emails(db: Session, campaign_id: int, background_tasks):
    """Legacy/FastAPI compatible trigger (BackgroundTasks version)"""
    from .models import Email, EmailStatus, Campaign
    from .tasks import send_email_fn
    
    pending_emails = db.query(Email).filter(
        Email.campaign_id == campaign_id,
        Email.status == EmailStatus.PENDING
    ).all()
    
    if not pending_emails:
        return 0
        
    # Queue them in background_tasks
    for e in pending_emails:
        background_tasks.add_task(send_email_fn, e.id, e.subject, e.body)
        
    return len(pending_emails)

def update_campaign(db: Session, campaign_id: int, data):
    from .models import Campaign, CampaignStatus
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise ValueError("Campaign not found")
        
        # PRO GRADE: Lock completed campaigns
        if campaign.status == CampaignStatus.COMPLETED:
            raise ValueError("Completed campaigns cannot be modified.")
        
        if hasattr(data, 'name') and data.name:
            campaign.name = data.name
        if hasattr(data, 'subject') and data.subject:
            campaign.subject = data.subject
        if hasattr(data, 'body') and data.body:
            campaign.body = data.body
        if hasattr(data, 'status') and data.status:
            campaign.status = CampaignStatus[data.status.upper()]
        
        db.commit()
        db.refresh(campaign)
        
        return {
            "id": str(campaign.id),
            "name": campaign.name,
            "status": campaign.status.value,
            "sent": campaign.sent_count,
            "delivered": campaign.delivered_count,
            "failed": campaign.failed_count,
            "opens": f"{campaign.opens_count} ({round(campaign.opens_count/campaign.delivered_count*100, 1) if campaign.delivered_count and campaign.delivered_count > 0 else 0}%)",
            "unread": f"{campaign.unread_count} ({round(campaign.unread_count/campaign.delivered_count*100, 1) if campaign.delivered_count and campaign.delivered_count > 0 else 0}%)",
            "bounce": f"{campaign.bounce_count} ({round(campaign.bounce_count/campaign.sent_count*100, 1) if campaign.sent_count and campaign.sent_count > 0 else 0}%)",
            "scheduled": campaign.scheduled_for or "-",
        }
    except Exception as e:
        db.rollback()
        raise e

def delete_campaign(db: Session, campaign_id: int):
    from .models import Campaign, Email, EmailEvent
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise ValueError("Campaign not found")
        
        # 1. Delete all tracking events associated with this campaign's emails
        # Use a join for better performance on large sets
        db.query(EmailEvent).filter(
            EmailEvent.email_id.in_(
                select(Email.id).where(Email.campaign_id == campaign_id)
            )
        ).delete(synchronize_session=False)
        
        # 2. Delete all emails associated with this campaign
        db.query(Email).filter(Email.campaign_id == campaign_id).delete(synchronize_session=False)
        
        # 3. Delete the campaign
        db.delete(campaign)
        db.commit()
        
        return {"status": "success", "message": f"Campaign {campaign_id} deleted"}
    except Exception as e:
        db.rollback()
        raise e

def get_contacts(db: Session, search: str | None = None):
    from .models import Contact
    query = db.query(Contact)
    if search:
        query = query.filter(Contact.name.ilike(f"%{search}%") | Contact.email.ilike(f"%{search}%"))
    contacts = query.all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "email": c.email,
            "company": c.company or "-",
            "industry": c.industry or "-",
            "tags": [t.strip() for t in c.tags_raw.split(',') if t.strip()] if c.tags_raw else [],
            "score": c.score,
            "status": c.status,
            "lastOpen": c.last_open or "-",
        }
        for c in contacts
    ]

def create_contacts(db: Session, contacts_data: list):
    from .models import Contact
    new_contacts = []
    for data in contacts_data:
        # Check if contact already exists
        existing = db.query(Contact).filter(Contact.email == data.email).first()
        if existing:
            continue
        
        c = Contact(
            name=data.name,
            email=data.email,
            company=data.company,
            industry=data.industry,
            status=data.status or "active",
            tags_raw=",".join(data.tags) if data.tags else ""
        )
        db.add(c)
        new_contacts.append(c)
    
    db.commit()
    return {"added": len(new_contacts)}

def update_contact_company(db: Session, email: str, company: str):
    from .models import Contact
    contact = db.query(Contact).filter(Contact.email == email).first()
    if contact:
        contact.company = company
    else:
        # Create new contact if doesn't exist
        contact = Contact(
            email=email,
            company=company,
            name=email.split("@")[0], # Fallback name
            status="active"
        )
        db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact

def get_segments(db: Session):
    from .models import Segment
    return db.query(Segment).all()

def create_segment(db: Session, data):
    from .models import Segment
    s = Segment(
        name=data.name,
        description=data.description,
        criteria=data.criteria
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s

def delete_segment(db: Session, segment_id: int):
    from .models import Segment
    s = db.query(Segment).filter(Segment.id == segment_id).first()
    if not s:
        raise ValueError("Segment not found")
    db.delete(s)
    db.commit()
    return {"status": "success"}

def get_contact_profile(db: Session, contact_id: int):
    from .models import Contact, Email, EmailEvent, Campaign
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        return None
    
    # Get all events for this contact's email
    events = db.query(EmailEvent, Email, Campaign)\
        .join(Email, EmailEvent.email_id == Email.id)\
        .outerjoin(Campaign, Email.campaign_id == Campaign.id)\
        .filter(Email.recipient_email == contact.email)\
        .order_by(EmailEvent.timestamp.desc())\
        .all()
        
    activity = []
    for ev, email, campaign in events:
        activity.append({
            "id": ev.id,
            "event_type": ev.event_type.value,
            "timestamp": ev.timestamp,
            "metadata": {
                "ip": ev.ip_address,
                "browser": ev.browser,
                "os": ev.os,
                "device": ev.device,
                "location": f"{ev.city}, {ev.country}" if ev.city else "Unknown"
            },
            "campaign_name": campaign.name if campaign else "Direct Email"
        })
        
    return {
        "id": contact.id,
        "name": contact.name,
        "email": contact.email,
        "company": contact.company,
        "industry": contact.industry,
        "tags": [t.strip() for t in contact.tags_raw.split(',') if t.strip()] if contact.tags_raw else [],
        "score": contact.engagement_score,
        "status": contact.status,
        "total_opens": contact.total_opens,
        "total_clicks": contact.total_clicks,
        "created_at": contact.created_at,
        "activity": activity
    }

def update_contact_tags(db: Session, contact_id: int, tags: list):
    from .models import Contact
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise ValueError("Contact not found")
    contact.tags_raw = ",".join(tags)
    db.commit()
    return {"status": "success", "tags": tags}



def get_settings(db: Session):
    from .models import Settings
    from datetime import datetime
    setting = db.query(Settings).first()
    if not setting:
        setting = Settings()
        db.add(setting)
        db.commit()
    
    # Count emails sent this calendar month
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_sent = db.query(Email).filter(
        Email.status == EmailStatus.SENT,
        Email.sent_at >= month_start
    ).count()
    
    return {
        "smtp_host": setting.smtp_host,
        "smtp_port": setting.smtp_port,
        "smtp_username": setting.smtp_username,
        "smtp_password": setting.smtp_password,
        "webhook_url": setting.webhook_url,
        "monthly_limit": setting.monthly_limit,
        "monthly_sent": monthly_sent,
    }

def update_settings(db: Session, update_data):
    from .models import Settings
    setting = db.query(Settings).first()
    if not setting:
        setting = Settings()
        db.add(setting)
    
    if update_data.smtp_host is not None:
        setting.smtp_host = update_data.smtp_host
    if update_data.smtp_port is not None:
        setting.smtp_port = update_data.smtp_port
    if update_data.smtp_username is not None:
        setting.smtp_username = update_data.smtp_username
    if update_data.smtp_password is not None:
        setting.smtp_password = update_data.smtp_password
    if update_data.webhook_url is not None:
        setting.webhook_url = update_data.webhook_url
    if update_data.monthly_limit is not None:
        setting.monthly_limit = update_data.monthly_limit
        
    db.commit()
    return get_settings(db)

def get_templates(db: Session):
    from .models import Template
    templates = db.query(Template).order_by(Template.updated_at.desc()).all()
    return [{"id": t.id, "name": t.name, "content": t.content, "created_at": t.created_at.isoformat(), "updated_at": t.updated_at.isoformat()} for t in templates]

def get_template(db: Session, template_id: int):
    from .models import Template
    from fastapi import HTTPException
    t = db.query(Template).filter(Template.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"id": t.id, "name": t.name, "content": t.content, "created_at": t.created_at.isoformat(), "updated_at": t.updated_at.isoformat()}

def create_template(db: Session, data):
    from .models import Template
    t = Template(name=data.name, content=data.content)
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "name": t.name, "content": t.content, "created_at": t.created_at.isoformat(), "updated_at": t.updated_at.isoformat()}

def update_template(db: Session, template_id: int, data):
    from .models import Template
    from fastapi import HTTPException
    t = db.query(Template).filter(Template.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"id": t.id, "name": t.name, "content": t.content, "created_at": t.created_at.isoformat(), "updated_at": t.updated_at.isoformat()}

def update_template(db: Session, template_id: int, name: str | None = None, content: str | None = None):
    from .models import Template
    t = db.query(Template).filter(Template.id == template_id).first()
    if not t:
        raise ValueError("Template not found")
    if name is not None:
        t.name = name
    if content is not None:
        t.content = content
    db.commit()
    db.refresh(t)
    return {"id": t.id, "name": t.name, "content": t.content}

def delete_template(db: Session, template_id: int):
    from .models import Template
    t = db.query(Template).filter(Template.id == template_id).first()
    if not t:
        raise ValueError("Template not found")
    db.delete(t)
    db.commit()
    return {"status": "success", "message": "Template deleted"}

def generate_block_template(topic: str, tone: str) -> list:
    """Generates a list of blocks for the visual template builder."""
    from .config import settings
    # For now, let's return a set of blocks based on the tone.
    # In a real production app, this would use OpenAI to return a JSON list of blocks.
    
    blocks = [
        {
            "id": "header",
            "type": "image",
            "content": "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format",
            "styles": {"borderRadius": "14px", "width": "100%"}
        }
    ]
    
    if tone == "C-Executive Level":
        blocks.extend([
            {
                "id": "headline",
                "type": "text",
                "content": f"Executive Summary: {topic}",
                "styles": {"fontSize": "24px", "fontWeight": "800", "padding": "16px"}
            },
            {
                "id": "body",
                "type": "text",
                "content": f"Dear Stakeholders,\n\nWe are pleased to present the strategic roadmap for {topic}. This initiative aligns with our quarterly objectives...",
                "styles": {"fontSize": "16px", "lineHeight": "1.6", "padding": "16px"}
            },
            {
                "id": "cta",
                "type": "button",
                "content": "Review Roadmap",
                "styles": {"backgroundColor": "#4f46e5", "color": "#ffffff", "padding": "12px 24px", "borderRadius": "12px", "textAlign": "center"}
            }
        ])
    else:
        blocks.extend([
            {
                "id": "headline",
                "type": "text",
                "content": f"New Update: {topic}",
                "styles": {"fontSize": "22px", "fontWeight": "700", "padding": "16px"}
            },
            {
                "id": "body",
                "type": "text",
                "content": f"Hi team!\n\nJust wanted to share some exciting news about {topic}. We've been working hard on this and can't wait to see it live!",
                "styles": {"fontSize": "16px", "lineHeight": "1.5", "padding": "16px"}
            },
            {
                "id": "cta",
                "type": "button",
                "content": "Learn More",
                "styles": {"backgroundColor": "#10b981", "color": "#ffffff", "padding": "10px 20px", "borderRadius": "10px", "textAlign": "center"}
            }
        ])
        
    blocks.append({
        "id": "footer",
        "type": "text",
        "content": "© 2024 MailFlow Analytics. All rights reserved.",
        "styles": {"fontSize": "12px", "color": "#94a3b8", "textAlign": "center", "padding": "24px"}
    })
    
    return blocks

def generate_ai_template(topic: str, tone: str) -> dict:
    import json
    import random
    from .config import settings
    
    api_key = settings.OPENAI_API_KEY
    
    # Debug: Check if key is loaded
    if api_key and len(api_key) > 10:
        print(f"DEBUG: Generating AI email with OpenAI Key (length: {len(api_key)})")
    else:
        print("DEBUG: Using Local Fallback Generator (No API Key)")

    variation_id = random.randint(1000, 9999)
    angle_hint = random.choice([
        "relationship-first value framing",
        "ROI-oriented executive summary",
        "problem-solution storytelling",
        "concise operational update with CTA",
    ])
    subject_flavor = random.choice([
        "Strategic Brief",
        "Growth Update",
        "Execution Note",
        "Priority Action",
    ])

    # Fallback / Local Generation Logic (if no API Key or for quick testing)
    def fallback_generation(topic: str, tone: str) -> dict:
        topic_lower = topic.lower()
        short_topic = topic[:50]
        
        # Determine the type of email
        is_request = any(w in topic_lower for w in ["sick", "leave", "vacation", "request", "permission"])
        is_news = any(w in topic_lower for w in ["update", "news", "announcement", "reveal"])
        is_sale = any(w in topic_lower for w in ["sale", "discount", "offer", "deal", "promo"])
        is_followup = any(w in topic_lower for w in ["follow up", "touching base", "checking in"])

        # Determine wording based on keywords
        action_verb = "regarding"
        if is_request:
            action_verb = "Request for"
        elif is_news:
            action_verb = "Important Update on"
        elif is_sale:
            action_verb = "Exclusive Offer for"

        # Default Subject
        subject = f"{action_verb}: {short_topic}"

        signature = (
            "\n\nBest regards,\n\n"
            "[Your Name]\n"
            "Sr. Business Development Manager\n"
            "Email: support@mailflow.com\n"
            "Phone: 847-550-4472"
        )

        # Refined Structure based on user example: Intro -> Core -> Update -> Appreciation -> Sign-off
        # C-Executive Level
        if tone == "C-Executive Level":
            subject = f"Strategic Overview: {topic.title()}"
            body = (
                f"Dear [Recipient Name],\n\n"
                f"I hope this finds you well and your week is off to a strong start.\n\n"
                f"I am writing to provide a high-level strategic update regarding {topic} as we discussed in our last leadership sync. "
                f"Our team is fully committed to ensuring the success of this initiative and aligning it with our long-term goals.\n\n"
                f"I will continue to monitor the long-term impact of {topic} and will provide additional milestones as they are reached. "
                f"Please let me know if there are any critical elements that require my immediate attention at the executive level.\n\n"
                f"Thank you for your continued leadership and understanding."
                f"{signature}"
            )
        # VP Level
        elif tone == "VP Level":
            subject = f"Impact & Results: {topic.title()}"
            body = (
                f"Dear [Recipient Name],\n\n"
                f"I hope you are having a productive week.\n\n"
                f"I am reaching out to discuss the recent impact and cross-departmental results of {topic} as we move forward. "
                f"Initial data suggests that our approach is yielding significant efficiency gains across the board.\n\n"
                f"I'll be sure to keep you updated on the performance metrics of {topic} as new data becomes available. "
                f"Please let me know if any urgent matter requires my attention regarding the scale of this project.\n\n"
                f"Thank you for your support on this initiative."
                f"{signature}"
            )
        # Director
        elif tone == "Director":
            subject = f"Resource & Roadmap: {topic.title()}"
            body = (
                f"Dear [Recipient Name],\n\n"
                f"I hope you are doing well.\n\n"
                f"I am writing to formally address the matter of {topic} and how it fits into our current roadmap and resource allocation. "
                f"We have identified several key opportunities to streamline our execution phase.\n\n"
                f"I will keep you updated on the progress of {topic} and will finalize the next operational steps as soon as possible. "
                f"Please let me know if any urgent matter requires my attention regarding our execution plan.\n\n"
                f"Thank you for your understanding."
                f"{signature}"
            )
        # Manager
        elif tone == "Manager":
            subject = f"Project Update: {topic.title()}"
            body = (
                f"Dear [Recipient Name],\n\n"
                f"Hope your day is going well.\n\n"
                f"I'm reaching out with a quick project-level update about {topic} and the current status of our team's tasks. "
                f"I wanted to share some thoughts on {topic} and ensure we are aligned with the upcoming deadlines.\n\n"
                f"I'll be sure to keep you in the loop as things develop on the ground. "
                f"Let's chat about this during our next check-in if you have a free moment.\n\n"
                f"Thanks so much for your guidance."
                f"{signature}"
            )
        # Non-Manager
        elif tone == "Non-Manager":
            subject = f"Collaborative Sync: {topic.title()}"
            body = (
                f"Dear [Recipient Name],\n\n"
                f"I hope you are having a productive week.\n\n"
                f"I am writing to provide an update on {topic} and to request a brief sync to discuss the next steps in our implementation. "
                f"I have been review the latest progress and would love to align on our roadmap.\n\n"
                f"Please let me know if you are available later this week to chat briefly.\n\n"
                f"Thank you for your time and consideration."
                f"{signature}"
            )
        else:
            body = f"Dear [Recipient Name],\n\nI hope you are well. I am writing to discuss {topic}.\n\nBest regards,\n[Your Name]"

        subject = f"{subject_flavor}: {subject}"
        body = body + "\n\nP.S. " + random.choice([
            "Happy to tailor this further for your role and priorities.",
            "I can also share a condensed version for quick executive review.",
            "If helpful, I can send a role-specific follow-up in the next step.",
        ])
        return {"subject": subject, "body": body}

    if not api_key:
        return fallback_generation(topic, tone)

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        
        prompt = (
            f"Write a professional, high-impact email about '{topic}' tailored for a recipient at the '{tone}' level.\n\n"
            f"UNIQUENESS REQUIREMENT:\n"
            f"- Variation ID: {variation_id}\n"
            f"- Writing Angle: {angle_hint}\n"
            f"- Produce a fresh variant with distinct phrasing and structure.\n\n"
            f"STRUCTURE (MANDATORY):\n"
            f"- Salutation: 'Dear [Recipient Name],'\n"
            f"- Body: 3-4 professional paragraphs using standard punctuation and formal tone.\n"
            f"- Closing: A polite concluding sentence.\n"
            f"- Sign-off: 'Best regards,' followed by '[Your Name]'.\n\n"
            f"FORMATTING RULES:\n"
            "1. Use ONLY standard plain text. DO NOT use HTML tags like <br/> or <strong>.\n"
            "2. Use standard newlines (\\n) for paragraphs and spacing.\n"
            f"3. The subject line MUST be professional and include '{topic}'.\n"
            "4. Output ONLY a valid JSON object: {'subject': '...', 'body': '...'}. No markdown."
        )
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a master executive communicator. Write structured, professional emails in plain text. Use 'Best regards,' for sign-offs. Use standard punctuation. Always generate a fresh, non-repetitive variant and output pure JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.9,
            max_tokens=800
        )
        content = response.choices[0].message.content.strip()
        # Clean markdown if present
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
            
        try:
            data = json.loads(content)
            return {"subject": data.get("subject", "Generated Subject"), "body": data.get("body", content)}
        except json.JSONDecodeError:
            return {"subject": "Email Subject", "body": content}
    except Exception as e:
        print(f"ERROR: OpenAI failure: {str(e)}")
        # Fallback to local generation if API fails (e.g. quota limit)
        return fallback_generation(topic, tone)

def process_ai_chat(message: str, history: list = None) -> str:
    """
    Powers the 'Clawd Assistant' using OpenAI/Claude.
    Tailored for a professional Email SaaS experience.
    """
    from .config import settings
    from openai import OpenAI
    
    api_key = settings.OPENAI_API_KEY
    if not api_key:
        return "Hey! I'm Clawd, your email assistant. I'm currently in 'Offline Mode' because no AI API key is configured in your settings. Please add an OpenAI API Key to start a real conversation!"

    try:
        client = OpenAI(api_key=api_key)
        
        system_prompt = (
            "You are 'Clawd', a senior Email Growth Specialist and AI Assistant for this Email Automation SaaS platform.\n"
            "Your personality: Professional, encouraging, highly technical yet accessible, and slightly witty.\n"
            "Your goals:\n"
            "1. Help users with email copywriting (subject lines, body, calls-to-action).\n"
            "2. Explain technical concepts like SMTP, SendGrid, deliverability, and tracking pixels.\n"
            "3. Help users navigate the dashboard and campaigns.\n"
            "4. Provide growth strategies for email marketing.\n\n"
            "Tone: SaaS Executive meets helpful Engineer. Use Markdown for formatting (bold, lists, etc.). Keep responses concise."
        )

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            # History is expected as list of {"role": "user|assistant", "content": "..."}
            messages.extend(history[-10:]) # Keep last 10 messages for context
        
        messages.append({"role": "user", "content": message})

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"CLAWDBOT_ERROR: {str(e)}")
        return f"I'm sorry, I'm having a bit of a technical hiccup (AI engine error). But as your assistant, I'm here to help! Error details: {str(e)}"
def get_system_health(db: Session) -> dict:
    """
    Returns real-time health metrics including Redis queue depth and 
    the 'Reputation Guard' status based on recent bounce rates.
    """
    import redis
    import os
    from datetime import datetime, timedelta
    
    # 1. Queue Depth (Redis)
    queue_stats = {"marketing": 0, "transactional": 0, "status": "Healthy"}
    try:
        REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        r = redis.from_url(REDIS_URL)
        queue_stats["marketing"] = r.llen("marketing")
        queue_stats["transactional"] = r.llen("transactional")
        
        if queue_stats["marketing"] > 500 or queue_stats["transactional"] > 50:
            queue_stats["status"] = "Congested"
    except Exception as e:
        queue_stats["status"] = f"Redis Error: {str(e)}"

    # 2. Reputation Guard (Recent Bounce Rate Check)
    # Check last 100 emails for bounce rate
    recent_emails = db.query(Email.status).order_by(Email.sent_at.desc()).limit(100).all()
    if recent_emails:
        bounces = len([e for e in recent_emails if e.status == EmailStatus.BOUNCED])
        bounce_rate = (bounces / len(recent_emails)) * 100
    else:
        bounce_rate = 0

    reputation = "Optimal"
    if bounce_rate > 3.0: # Professional threshold is often < 2-3%
        reputation = "Critical (High Bounces)"
    elif bounce_rate > 1.0:
        reputation = "Warning"

    # 3. Delivery Velocity (Last Hour)
    hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    vel_sent = db.query(Email).filter(Email.sent_at >= hour_ago, Email.status == EmailStatus.SENT).count()
    vel_delivered = db.query(Email).filter(Email.sent_at >= hour_ago, Email.status == EmailStatus.DELIVERED).count()

    return {
        "queues": queue_stats,
        "reputation": {
            "status": reputation,
            "bounce_rate": round(bounce_rate, 2),
            "threshold": 3.0
        },
        "velocity": {
            "sent_last_hour": vel_sent,
            "delivered_last_hour": vel_delivered
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

def check_reputation_guard(db: Session):
    """
    Internal circuit breaker to pause all running campaigns if reputation is critical.
    """
    health = get_system_health(db)
    bounce_rate = health["reputation"]["bounce_rate"]
    if health["reputation"]["status"] == "Critical (High Bounces)":
        # Professional Safeguard: Pause all running campaigns
        from .models import Campaign, CampaignStatus
        db.query(Campaign).filter(Campaign.status == CampaignStatus.RUNNING).update({"status": "PAUSED"})
        db.commit()
    if bounce_rate > 5.0: # Hard threshold
        debug.debug_log("REPUTATION_GUARD: All campaigns PAUSED due to high bounce rate.")
        return True
    return False
def is_suppressed(db: Session, email: str) -> bool:
    """Checks if an email is in the global suppression list."""
    existing = db.query(Suppression).filter(Suppression.email == email).first()
    return existing is not None

def add_to_suppression(db: Session, email: str, reason: SuppressionReason, metadata: dict = None):
    """Adds an address to the suppression list to prevent future sends."""
    import json
    existing = db.query(Suppression).filter(Suppression.email == email).first()
    if existing:
        return existing
    
    supp = Suppression(
        email=email,
        reason=reason,
        metadata_raw=json.dumps(metadata) if metadata else None
    )
    db.add(supp)
    # Also update contact status if exists
    from .models import Contact
    contact = db.query(Contact).filter(Contact.email == email).first()
    if contact:
        contact.status = "suppressed"
    
    db.commit()
    debug.debug_log(f"SUPPRESSION: Added {email} (Reason: {reason})")
    return supp

def get_suppressions(db: Session):
    return db.query(Suppression).order_by(Suppression.created_at.desc()).all()

def delete_suppression(db: Session, suppression_id: int):
    supp = db.query(Suppression).filter(Suppression.id == suppression_id).first()
    if supp:
        # If deleted, we might want to set contact back to active
        from .models import Contact
        contact = db.query(Contact).filter(Contact.email == supp.email).first()
        if contact and contact.status == "suppressed":
            contact.status = "active"
        db.delete(supp)
        db.commit()
        return True
    return False

def classify_bounce(error_msg: str) -> dict:
    """
    Categorizes bounces into HARD or SOFT based on SMTP codes and patterns.
    Hard: Permanent (e.g., User not found)
    Soft: Temporary (e.g., Mailbox full, Greylisting)
    """
    msg = error_msg.lower()
    
    hard_patterns = [
        "550", "5.1.1", "user unknown", "no such user", "does not exist", 
        "recipient rejected", "invalid recipient", "permanent failure",
        "access denied", "account disabled"
    ]
    
    soft_patterns = [
        "421", "450", "451", "452", "mailbox full", "quota exceeded",
        "too many messages", "try again", "temporary", "timeout", 
        "connection refused", "deferred", "greylist"
    ]
    
    for pattern in hard_patterns:
        if pattern in msg:
            return {"type": BounceType.HARD, "pattern": pattern}
            
    for pattern in soft_patterns:
        if pattern in msg:
            return {"type": BounceType.SOFT, "pattern": pattern}
            
    return {"type": BounceType.UNKNOWN, "pattern": None}

def get_automations(db: Session):
    from .models import Automation
    return db.query(Automation).order_by(Automation.created_at.desc()).all()

def create_automation(db: Session, data):
    from .models import Automation, AutomationStep, AutomationTrigger
    import json
    
    # Map string trigger to enum
    try:
        t_enum = AutomationTrigger[data.trigger_type.upper()]
    except:
        t_enum = AutomationTrigger.WELCOME
        
    new_auto = Automation(
        name=data.name,
        trigger_type=t_enum,
        trigger_config=data.trigger_config or "{}"
    )
    db.add(new_auto)
    db.flush() # Get ID
    
    for step in data.steps:
        s = AutomationStep(
            automation_id=new_auto.id,
            type=step.type.lower(),
            config=step.config or "{}",
            position=step.position
        )
        db.add(s)
    
    db.commit()
    db.refresh(new_auto)
    return new_auto

def delete_automation(db: Session, id: int):
    from .models import Automation
    auto = db.query(Automation).filter(Automation.id == id).first()
    if auto:
        db.delete(auto)
        db.commit()
        return True
    return False

def update_automation(db: Session, id: int, data):
    from .models import Automation, AutomationStep, AutomationTrigger
    
    auto = db.query(Automation).filter(Automation.id == id).first()
    if not auto:
        raise ValueError("Automation not found")
    
    if hasattr(data, 'name') and data.name is not None: auto.name = data.name
    if hasattr(data, 'trigger_type') and data.trigger_type is not None: 
        try:
            auto.trigger_type = AutomationTrigger[data.trigger_type.upper()]
        except:
            pass
    if hasattr(data, 'trigger_config') and data.trigger_config is not None: auto.trigger_config = data.trigger_config
    
    if hasattr(data, 'steps') and data.steps is not None:
        # Clear and recreate steps for simplicity in this MVP
        db.query(AutomationStep).filter(AutomationStep.automation_id == id).delete()
        for step in data.steps:
            s = AutomationStep(
                automation_id=id,
                type=step.type.lower(),
                config=step.config or "{}",
                position=step.position
            )
            db.add(s)
            
    db.commit()
    db.refresh(auto)
    return auto


def generate_branded_email(template_name: str, description: str, seniority: str, image: str = None, attachment: str = None) -> dict:
    """
    Generates an AI email and wraps it in a specific company branding/signature layout.
    """
    import html as html_lib

    # 1. Generate core content
    ai_result = generate_ai_template(description, seniority)
    subject = ai_result.get("subject", "Generated Email")
    body_text = ai_result.get("body", "")

    def _format_body(raw_text: str) -> str:
        lines = [line.strip() for line in str(raw_text or "").splitlines()]
        paragraphs = []
        chunk = []
        for line in lines:
            if line:
                chunk.append(line)
            elif chunk:
                paragraphs.append(" ".join(chunk))
                chunk = []
        if chunk:
            paragraphs.append(" ".join(chunk))

        if not paragraphs:
            paragraphs = ["Thank you for your time. I would be glad to share more details based on your priorities."]

        return "".join(
            f'<p style="margin:0 0 14px 0; font-size:15px; line-height:1.72; color:#dbe6ff;">{html_lib.escape(p)}</p>'
            for p in paragraphs
        )

    # 2. Branded signatures with professional and consistent sizing.
    layouts = {
        "MP Lumina": {
            "primary": "#7B61FF",
            "secondary": "#4F46E5",
            "logo": "https://img.icons8.com/fluency/96/sparkling.png",
            "signature": """
                <div style="margin-top: 28px; padding: 16px; border: 1px solid #2a3155; border-radius: 12px; background: #131d37; font-family: 'Inter', 'Segoe UI', sans-serif;">
                    <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td style="vertical-align: top; padding-right: 12px;">
                                <img src="https://img.icons8.com/fluency/48/sparkling.png" width="40" height="40" alt="MP Lumina" />
                            </td>
                            <td style="border-left: 2px solid #7B61FF; padding-left: 12px;">
                                <div style="font-weight: 700; font-size: 15px; color: #f8fafc;">Sarah Jenkins</div>
                                <div style="font-size: 12px; color: #a5b4fc; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; margin-top: 2px;">Head of Creative Strategy</div>
                                <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">MP Lumina</div>
                                <a href="https://www.mplumina.com" style="display:inline-block; margin-top: 6px; color: #7B61FF; text-decoration:none; font-size:12px; font-weight:700;">www.mplumina.com</a>
                            </td>
                        </tr>
                    </table>
                </div>
            """,
        },
        "MP Consultant LLC": {
            "primary": "#FFC107",
            "secondary": "#F59E0B",
            "logo": "https://img.icons8.com/color/96/business-group.png",
            "signature": """
                <div style="margin-top: 28px; padding: 18px; border: 1px solid #2a3155; border-radius: 12px; background: #131d37; font-family: 'Segoe UI', Tahoma, sans-serif;">
                    <div style="font-size: 14px; color: #e2e8f0; margin-bottom: 8px;">Cheers,</div>
                    <div style="font-size: 17px; font-weight: 800; letter-spacing: 0.04em; color: #f8fafc; text-transform: uppercase;">MARGI CHHAPPAN</div>
                    <div style="font-size: 16px; font-style: italic; color: #e2e8f0; margin-top: 4px; font-family: 'Times New Roman', serif;">Sr. Business Development Manager</div>
                    <div style="font-size: 15px; color: #f8fafc; margin-top: 12px;">
                        <span style="color:#93c5fd;">&#9993;</span>
                        <span style="color:#f59e0b;"> :</span>
                        <a href="mailto:margi@mpconsulting.com" style="color:#60a5fa; text-decoration:none;">margi@mpconsulting.com</a>
                    </div>
                    <div style="font-size: 15px; color: #f8fafc; margin-top: 6px;">
                        <span>📞</span>
                        <span style="color:#f59e0b;"> :</span>
                        <span>847-550-4472</span>
                    </div>
                    <div style="margin-top: 10px;">
                        <a href="#" style="display:inline-block; width:24px; height:24px; line-height:24px; text-align:center; border-radius:4px; background:#0b4a8b; color:#fff; text-decoration:none; font-size:12px; font-weight:700; margin-right:4px;">f</a>
                        <a href="#" style="display:inline-block; width:24px; height:24px; line-height:24px; text-align:center; border-radius:4px; background:#0e76a8; color:#fff; text-decoration:none; font-size:11px; font-weight:700; margin-right:4px;">in</a>
                        <a href="#" style="display:inline-block; width:24px; height:24px; line-height:24px; text-align:center; border-radius:4px; background:#111827; color:#f59e0b; text-decoration:none; font-size:12px; font-weight:700;">◎</a>
                    </div>
                    <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #2a3155; font-size: 11px; line-height: 1.5; color: #94a3b8;">
                        <b style="text-transform: uppercase; color:#cbd5e1;">Confidentiality Note:</b>
                        This electronic mail may contain confidential information intended only for the recipient(s) named in this email.
                    </div>
                </div>
            """,
        },
        "A Making Company": {
            "primary": "#FF4D4F",
            "secondary": "#F97316",
            "logo": "https://img.icons8.com/color/96/factory.png",
            "signature": """
                <div style="margin-top: 28px; padding: 18px; border: 1px solid #3b2a2f; border-radius: 12px; background: linear-gradient(180deg, #25151a, #1a1f33); font-family: 'Segoe UI', Tahoma, sans-serif;">
                    <div style="font-size: 18px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px;">
                        <span style="color:#ef4444;">A</span><span style="color:#ef4444;">m</span><span style="color:#ef4444;">c</span>
                        <span style="color:#cbd5e1; margin-left:6px;">making company</span>
                    </div>
                    <div style="font-size: 16px; font-weight: 700; color: #f8fafc;">Margi Chhappan</div>
                    <div style="font-size: 15px; font-style: italic; color: #e2e8f0; margin-top: 4px; font-family: 'Times New Roman', serif;">Sr. Business Development Manager</div>
                    <div style="font-size: 15px; color: #f8fafc; margin-top: 10px;">📞 847-550-4472</div>
                    <div style="font-size: 15px; margin-top: 6px;">
                        🌐 <a href="https://www.amakingcompany.com" style="color: #60a5fa; text-decoration: underline; font-weight: 700;">www.amakingcompany.com</a>
                    </div>
                </div>
            """,
        },
        "Matkotech": {
            "primary": "#22C55E",
            "secondary": "#16A34A",
            "logo": "https://img.icons8.com/fluency/96/artificial-intelligence.png",
            "signature": """
                <div style="margin-top: 28px; padding: 16px; border: 1px solid #214032; border-radius: 12px; background: #112a21; font-family: 'Segoe UI', sans-serif;">
                    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                        <tr>
                            <td style="vertical-align: top; padding-right: 12px;">
                                <img src="https://img.icons8.com/fluency/48/artificial-intelligence.png" width="40" height="40" alt="Matkotech" />
                            </td>
                            <td style="border-left: 2px solid #22C55E; padding-left: 12px;">
                                <div style="font-weight: 700; font-size: 15px; color: #f0fdf4;">Matkotech Growth Desk</div>
                                <div style="font-size: 12px; color: #86efac; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px;">AI Outreach & Automation</div>
                                <div style="font-size: 12px; color: #bbf7d0; margin-top: 4px;">Build Faster. Scale Smarter.</div>
                                <a href="https://matkotech.com/" style="display:inline-block; margin-top: 6px; color: #4ade80; text-decoration:none; font-size:12px; font-weight:700;">https://matkotech.com/</a>
                            </td>
                        </tr>
                    </table>
                </div>
            """,
        },
    }

    # Backward compatibility for older template key used in some UIs.
    layouts["MP Consultant"] = layouts["MP Consultant LLC"]
    config = layouts.get(template_name, layouts["MP Lumina"])

    formatted_body = _format_body(body_text)

    image_html = ""
    if image:
        image_html = (
            f'<div style="margin: 18px 0 6px 0;">'
            f'<img src="{image}" style="width:100%; max-width:600px; border-radius:12px; border:1px solid #2a3155; '
            f'box-shadow:0 10px 24px rgba(2, 6, 23, 0.35); object-fit:cover;" />'
            f"</div>"
        )

    html_content = f"""
    <div style="max-width: 640px; margin: 0 auto; font-family: 'Inter', 'Segoe UI', Tahoma, sans-serif; color: #e2e8f0; line-height: 1.65; background: linear-gradient(180deg, #0f172a 0%, #111b34 100%); padding: 30px; border-radius: 16px; border: 1px solid #253152;">
        <div style="display:flex; align-items:center; gap:12px; padding-bottom: 16px; border-bottom: 1px solid #2a3155; margin-bottom: 22px;">
            <img src="{config['logo']}" width="42" height="42" alt="{template_name}" />
            <div>
                <div style="font-size:13px; color:#93a4c2; letter-spacing:0.06em; text-transform:uppercase;">MailFlow Standard Layout</div>
                <div style="font-size:16px; font-weight:700; color:#f8fafc;">{html_lib.escape(template_name)}</div>
            </div>
        </div>

        <div style="font-size: 15px; min-height: 120px;">
            {formatted_body}
        </div>

        {image_html}

        {config['signature']}

        <div style="margin-top: 24px; font-size: 11px; color: #8ea1c4; text-align: center; border-top: 1px solid #2a3155; padding-top: 14px;">
            Sent via MailFlow AI Engine. To unsubscribe,
            <a href="#" style="color: {config['primary']}; text-decoration: none; font-weight: 700;">click here</a>.
        </div>
    </div>
    """

    return {"html": html_content, "subject": subject, "body_text": body_text}
