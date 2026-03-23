from typing import List
import smtplib
from datetime import datetime, timedelta
from sqlalchemy import func, distinct, case, select, and_, cast, Date
from sqlalchemy.orm import Session
from .models import Email, EmailStatus, EmailEvent, EventType, Campaign, CampaignStatus, Settings, Suppression, SuppressionReason, BounceType


# low-level mail sender

from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email import encoders
import requests
import io
from . import debug

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
        camp.completed_at = datetime.utcnow()
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
        for attachment in attachments:
            try:
                if attachment.startswith('http'):
                    response = requests.get(attachment, timeout=10)
                    content = response.content
                    filename = attachment.split('/')[-1] or 'attachment'
                elif attachment.startswith('data:'):
                    import base64
                    header, encoded = attachment.split(",", 1)
                    content = base64.b64decode(encoded)
                    filename = 'image_attachment'
                    # Try to guess extension from header
                    if 'image/png' in header: filename += '.png'
                    elif 'image/jpeg' in header: filename += '.jpg'
                else:
                    continue

                part = MIMEBase("application", "octet-stream")
                part.set_payload(content)
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    f"attachment; filename={filename}",
                )
                message.attach(part)
            except Exception as e:
                print(f"Error attaching file: {str(e)}")

    with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, [to_addr], message.as_string())


# functions used by API

def log_event(db: Session, email_id: int, event_type: EventType, ip: str = None, ua: str = None, url: str = None):
    from .models import Email, EmailEvent, Campaign, Suppression, SuppressionReason
    
    # 1. Professional Security: Prevent duplicate open tracking (60s window)
    if event_type == EventType.OPENED:
        recent_open = db.query(EmailEvent).filter(
            EmailEvent.email_id == email_id,
            EmailEvent.event_type == EventType.OPENED,
            EmailEvent.timestamp >= datetime.utcnow() - timedelta(seconds=60)
        ).first()
        if recent_open:
            debug.debug_log(f"TRACKING_FLOW: Blocked duplicate open for email {email_id} (within 60s)")
            return
            
    debug.debug_log(f"TRACKING_FLOW: Received {event_type} for email {email_id}")
    
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
            timestamp=datetime.utcnow()
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
                    email.opened_at = datetime.utcnow()
            elif event_type == EventType.CLICKED:
                if not email.clicked_at:
                    email.clicked_at = datetime.utcnow()
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

def get_link_performance(db: Session, campaign_name: str = "all"):
    # Group clicks by URL and count
    q = db.query(EmailEvent.url, func.count(EmailEvent.id).label("clicks")).filter(EmailEvent.event_type == EventType.CLICKED)
    if campaign_name != "all":
        q = q.join(Email).join(Campaign).filter(Campaign.name == campaign_name)
    
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

def get_unified_metrics(db: Session, days: int = 30, campaign_name: str = "all", company_name: str | list = "all"):
    """
    SaaS Grade Single Source of Truth for all metrics.
    Ensures calculations are identical across Dashboard and Analytics.
    """
    from datetime import datetime, timedelta
    from sqlalchemy import func, distinct, case
    
    now = datetime.utcnow()
    limit_date = now - timedelta(days=days)
    
    # 1. Base Query Filter
    query_emails = db.query(
        func.count(Email.id).label("total_attempts"),
        func.count(case((Email.status.in_([EmailStatus.SENT, EmailStatus.DELIVERED]), Email.id))).label("delivered"),
        func.count(case((Email.status == EmailStatus.BOUNCED, Email.id))).label("bounces"),
        func.count(case((Email.status == EmailStatus.SPAM, Email.id))).label("spam")
    ).filter(Email.sent_at >= limit_date)
    
    query_events = db.query(
        func.count(distinct(case(((EmailEvent.event_type == EventType.OPENED), EmailEvent.email_id), else_=None))).label("opens"),
        func.count(distinct(case(((EmailEvent.event_type == EventType.CLICKED), EmailEvent.email_id), else_=None))).label("clicks")
    ).filter(EmailEvent.timestamp >= limit_date)
    
    if campaign_name != "all":
        campaign_filter = db.query(Campaign.id).filter(Campaign.name == campaign_name).scalar_subquery()
        query_emails = query_emails.filter(Email.campaign_id == campaign_filter)
        query_events = query_events.join(Email).filter(Email.campaign_id == campaign_filter)

    # 1.5. Company Filter (Join with Contact)
    if company_name and company_name != "all":
        from .models import Contact
        companies = [company_name] if isinstance(company_name, str) else company_name
        
        # We need to subquery/join to filter Email by recipient's company
        query_emails = query_emails.join(Contact, Email.recipient_email == Contact.email).filter(Contact.company.in_(companies))
        
        # Fix: If query_events already joined Email, don't join again
        if campaign_name != "all":
             query_events = query_events.join(Contact, Email.recipient_email == Contact.email).filter(Contact.company.in_(companies))
        else:
             query_events = query_events.join(Email).join(Contact, Email.recipient_email == Contact.email).filter(Contact.company.in_(companies))
             
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

def get_analytics(db: Session, campaign_name: str = "all", days: int = 30):
    from datetime import datetime, timedelta
    from sqlalchemy import func
    
    now = datetime.utcnow()
    
    # Current Metrics
    metrics = get_unified_metrics(db, days=days, campaign_name=campaign_name)
    
    # Simple Growth Calculation (Total vs Today approximation for MVP diff)
    prev_metrics = get_unified_metrics(db, days=days*2, campaign_name=campaign_name)
    
    def calc_growth(cur, total_2x):
        prev = total_2x - cur
        if prev <= 0: return 100.0 if cur > 0 else 0.0
        return round(((cur - prev) / prev) * 100, 1)

    # 3. Time Series Data (Standardize on 7 points)
    performance = []
    for i in range(7):
        d = now - timedelta(days=6-i)
        d_start = d.replace(hour=0, minute=0, second=0, microsecond=0)
        d_end = d_start + timedelta(days=1)
        o = db.query(func.count(distinct(EmailEvent.email_id)))\
              .filter(EmailEvent.event_type == EventType.OPENED, EmailEvent.timestamp >= d_start, EmailEvent.timestamp < d_end).scalar() or 0
        c = db.query(func.count(distinct(EmailEvent.email_id)))\
              .filter(EmailEvent.event_type == EventType.CLICKED, EmailEvent.timestamp >= d_start, EmailEvent.timestamp < d_end).scalar() or 0
        performance.append({"time": d.strftime('%a'), "opens": o, "clicks": c})

    return {
        "deliveredEmails": metrics["delivered"],
        "openRate": metrics["openRate"],
        "clickRate": metrics["clickRate"],
        "spamRate": metrics["spamRate"],
        "bounceRate": metrics["bounceRate"],
        "unread": metrics["unreadCount"],
        "deliveredEmailsGrowth": calc_growth(metrics["delivered"], prev_metrics["delivered"]),
        "openRateGrowth": calc_growth(metrics["openRate"], prev_metrics["openRate"]),
        "clickRateGrowth": 0.0,
        "performanceData": performance,
        "deviceData": [{"name": "Desktop", "value": 75}, {"name": "Mobile", "value": 25}],
        "locationsData": [],
        "linkData": get_link_performance(db, campaign_name),
        "recentActivity": recent_events(db, days=days, campaign_name=campaign_name, limit=10)
    }


def compute_stats(db: Session, days: int = 30, campaign_name: str = "all", company_name: str | list = "all"):
    # Unified Source of Truth
    m = get_unified_metrics(db, days=days, campaign_name=campaign_name, company_name=company_name)
    
    # Active Campaigns
    active_camps = db.query(func.count(Campaign.id)).filter(
        Campaign.status == CampaignStatus.RUNNING
    ).scalar() or 0

    return {
        "totalEmails": m["totalSent"],
        "openRate": m["openRate"],
        "clickRate": m["clickRate"],
        "bounceRate": m["bounceRate"],
        "unread": m["unreadCount"], # Absolute count for dashboard if UI supports it, or rate? 
        # User said: Unread = total_delivered - total_opens. 
        # But UI was displaying percentage. We'll provide both or match requirements.
        "activeCampaigns": int(active_camps),
        
        "totalEmailsGrowth": 0.0,
        "openRateGrowth": 0.0,
        "clickRateGrowth": 0.0,
        "activeCampaignsGrowth": 0.0,
        
        "raw": {
            "bounced": m["bounces"],
            "opened": m["opens"],
            "delivered": m["delivered"],
            "unread": m["unreadCount"]
        }
    }

def get_dashboard_stats(days: int = 30, campaign_name: str = "all", company_name: str | list = "all"):
    from .database import SessionLocal
    db = SessionLocal()
    try:
        return compute_stats(db, days, campaign_name, company_name)
    finally:
        db.close()


def emails_over_time(db: Session, days: int = 7, company_name: str | list = "all"):
    from datetime import datetime, timedelta, date
    import calendar
    from sqlalchemy import cast, Date
    
    now = datetime.utcnow()
    
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
        # Month View: 5-day intervals of current month
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_day = calendar.monthrange(now.year, now.month)[1]
        end_date = (start_date + timedelta(days=last_day-1)).replace(hour=23, minute=59, second=59) + timedelta(seconds=1)
        
        intervals = [(1, 5), (6, 10), (11, 15), (16, 20), (21, 25), (26, last_day)]
        for s, e in intervals:
            b_start = start_date.replace(day=s)
            # b_end is the start of the day AFTER 'e'
            if e == last_day:
                if now.month == 12:
                    b_end = start_date.replace(year=now.year + 1, month=1, day=1)
                else:
                    b_end = start_date.replace(month=now.month + 1, day=1)
            else:
                b_end = start_date.replace(day=e+1)
            
            buckets.append({
                "label": f"{s}-{e}",
                "start": b_start,
                "end": b_end
            })
            
    elif days == 90:
        # Quarter View: 15-day intervals for the last 90 days
        end_date = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        start_date = end_date - timedelta(days=90)
        
        for i in range(0, 90, 15):
            b_start = start_date + timedelta(days=i)
            b_end = b_start + timedelta(days=15)
            buckets.append({
                "label": f"D{i+1}-{i+15}",
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
        query = query.join(Contact, Email.recipient_email == Contact.email).filter(Contact.company.in_(companies))

    results = query.group_by(cast(Email.sent_at, Date)).all()
    
    # Map results into buckets
    chart_data = []
    for b in buckets:
        count = 0
        b_start_date = b["start"].date()
        b_end_date = b["end"].date()
        for r_date, c in results:
            if b_start_date <= r_date < b_end_date:
                count += c
        chart_data.append({
            "day": b["label"], # Keeping 'day' key for frontend compatibility
            "emails": count
        })
                        
    return chart_data



def recent_events(db: Session, days: int = 30, limit: int = 20, campaign_name: str = "all", company_name: str | list = "all"):
    from datetime import datetime, timedelta
    from .models import Contact
    limit_date = datetime.utcnow() - timedelta(days=days)
    
    # Outer join with Contact and Campaign to get name, company, and campaign details
    query = db.query(
        EmailEvent, 
        Contact.name.label("contact_name"), 
        Contact.company.label("contact_company"),
        Campaign.name.label("campaign_name")
    ).join(Email, EmailEvent.email_id == Email.id)\
     .outerjoin(Contact, Email.recipient_email == Contact.email)\
     .outerjoin(Campaign, Email.campaign_id == Campaign.id)
    
    if campaign_name != "all":
        query = query.filter(Campaign.name == campaign_name)
    
    if company_name and company_name != "all":
        companies = [company_name] if isinstance(company_name, str) else company_name
        query = query.filter(Contact.company.in_(companies))
        
    events = query.filter(EmailEvent.timestamp >= limit_date).order_by(EmailEvent.timestamp.desc()).limit(limit * 5).all() # Fetch more for grouping
    
    PERSONAL_PROVIDERS = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "protonmail.com"}
    TLD_COUNTRY_MAP = {"in": "India", "uk": "United Kingdom", "us": "USA", "au": "Australia", "de": "Germany", "fr": "France", "ca": "Canada"}
    
    result = []
    for ev_data in events:
        ev = ev_data[0]
        contact_name = ev_data[1]
        
        # Determine Sender
        camp_name = (ev_data[3] or "").lower()
        if "making" in camp_name:
            sender_company = "A Making Company"
        elif "lumina" in camp_name:
            sender_company = "MP Lumina"
        elif "mp" in camp_name or "consulting" in camp_name:
            sender_company = "MP Consulting"
        else:
            sender_company = "MP Consulting"
        
        # Smart Company Extraction Logic
        email_str = ev.email.recipient_email
        domain = email_str.split("@")[-1].lower() if "@" in email_str else ""
        
        if domain in PERSONAL_PROVIDERS:
            contact_company = "Personal Email"
        elif domain:
            company_base = domain.rsplit(".", 1)[0]
            contact_company = company_base.capitalize()
        else:
            contact_company = "Unknown"
            
        # Country deduction
        country = "Unknown"
        if ev.country:
            country = ev.country
        elif domain:
            tld = domain.rsplit(".", 1)[-1] if "." in domain else ""
            if tld in TLD_COUNTRY_MAP:
                country = TLD_COUNTRY_MAP[tld]
            elif tld == "com":
                country = "USA"

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
            "event_type": ev_type,
            "type": ev_type,
            "subject": ev.email.subject or "No Subject",
            "sender": sender_company,
            "timestamp": ev.timestamp.isoformat() if hasattr(ev.timestamp, "isoformat") else str(ev.timestamp),
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
    
    # Grouping Logic: Merge entries for the same email + campaign
    grouped = {}
    for r in result:
        key = f"{r['recipient']}-{r['subject']}" # Using subject as proxy for campaign if not available
        if key not in grouped:
            grouped[key] = {
                "id": r["id"],
                "recipient": r["recipient"],
                "recipient_name": r["recipient_name"],
                "company": r["company"],
                "subject": r["subject"],
                "sender": r["sender"],
                "location": r["location"],
                "country": r["country"],
                "latest_type": r["type"],
                "latest_timestamp": r["timestamp"],
                "events": []
            }
        grouped[key]["events"].append({
            "type": r["type"],
            "timestamp": r["timestamp"]
        })
        # Update latest status
        if r["timestamp"] > grouped[key]["latest_timestamp"]:
             grouped[key]["latest_timestamp"] = r["timestamp"]
             grouped[key]["latest_type"] = r["type"]

    # Flatten and sort by latest activity
    final_grouped = list(grouped.values())
    final_grouped.sort(key=lambda x: x["latest_timestamp"], reverse=True)
    
    return final_grouped[:limit]

def get_emails_per_company(db: Session, days: int = 30):
    from .models import Campaign, Email
    from datetime import datetime, timedelta
    from sqlalchemy import func
    limit_date = datetime.utcnow() - timedelta(days=days)
    
    results = db.query(
        Campaign.name,
        func.count(Email.id).label("count")
    ).join(Email, Campaign.id == Email.campaign_id)\
     .filter(Email.sent_at >= limit_date)\
     .group_by(Campaign.name).all()
    
    counts = {
        "MP Consultant LLC": 0,
        "MP Lumina": 0,
        "A Making Company": 0
    }
    
    for row in results:
        camp_name = (row[0] or "").lower()
        if "making" in camp_name:
            counts["A Making Company"] += row[1]
        elif "lumina" in camp_name:
            counts["MP Lumina"] += row[1]
        elif "mp" in camp_name or "consulting" in camp_name:
            counts["MP Consultant LLC"] += row[1]
        else:
            counts["MP Consultant LLC"] += row[1] # fallback priority
            
    return {
        "success": True,
        "data": [
            {"company": "MP Consultant LLC", "emails_sent": counts["MP Consultant LLC"]},
            {"company": "MP Lumina", "emails_sent": counts["MP Lumina"]},
            {"company": "A Making Company", "emails_sent": counts["A Making Company"]}
        ]
    }


def create_campaign(db: Session, data):
    from .models import Campaign, CampaignStatus
    try:
        new_camp = Campaign(
            name=data.name,
            subject=data.subject or "",
            body=data.body or "",
            status=CampaignStatus.DRAFT,
            sent_count=0,
            opens_count=0,
            unread_count=0,
            bounce_count=0
        )
        db.add(new_camp)
        db.commit()
        db.refresh(new_camp)
        
        return {
            "id": str(new_camp.id),
            "name": str(new_camp.name),
            "subject": str(new_camp.subject),
            "body": str(new_camp.body),
            "status": str(new_camp.status.value),
            "sent": int(new_camp.sent_count or 0),
            "opens": "0 (0%)",
            "unread": "0 (0%)",
            "bounce": "0 (0%)",
            "scheduled": str(new_camp.scheduled_for or "-"),
        }
    except Exception as e:
        db.rollback()
        print(f"CRITICAL ERROR in create_campaign: {str(e)}")
        raise e

def process_sendgrid_webhook(db: Session, events: List[dict]):
    # ... (existing logic)
    pass

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

            def format_rate(num, den):
                if den <= 0: return f"0 (0.0%)"
                rate = round((num / den) * 100, 1)
                return f"{num} ({rate}%)"

            results.append({
                "id": str(c.id),
                "name": c.name,
                "status": display_status,
                "sent": sent,
                "delivered": sent, # delivered is sent for this MVP
                "failed": failed,
                "opens": format_rate(opens, sent),
                "unread": format_rate(unread, sent),
                "bounce": format_rate(failed, sent + failed),
                "scheduled": c.scheduled_for or "Not scheduled",
            })
        return results
    except Exception as e:
        debug.debug_log(f"CRITICAL ERROR in get_campaigns: {str(e)}")
        import traceback
        debug.debug_log(traceback.format_exc())
        raise e

def check_due_campaigns(db: Session, background_tasks=None):
    """
    Finds QUEUED/SCHEDULED campaigns whose time has come and triggers them.
    Can be used in a background loop or via a Cron endpoint.
    """
    from .models import Campaign, CampaignStatus
    from datetime import datetime
    
    now = datetime.utcnow()
    # Find due campaigns
    due_campaigns = db.query(Campaign).filter(
        Campaign.status.in_([CampaignStatus.QUEUED, CampaignStatus.SCHEDULED]),
        Campaign.scheduled_for != None
    ).all()
    
    triggered_count = 0
    for camp in due_campaigns:
        try:
            # Parse scheduled time
            try:
                sched_time = datetime.fromisoformat(camp.scheduled_for.replace("Z", "+00:00"))
            except:
                continue
                
            if sched_time <= now:
                debug.debug_log(f"SCHEDULER: Triggering campaign {camp.id} (Scheduled for {camp.scheduled_for})")
                camp.status = CampaignStatus.RUNNING
                db.commit()
                
                # Trigger emails
                if background_tasks:
                    trigger_campaign_emails(db, camp.id, background_tasks)
                else:
                    # If we don't have FastAPI background_tasks (e.g. from a loop), 
                    # we use a manual trigger or wait for next heartbeat.
                    # For now, we'll assume we pass it or use a fallback.
                    from .tasks import send_email_fn
                    from .models import Email, EmailStatus
                    pending = db.query(Email).filter(Email.campaign_id == camp.id, Email.status == EmailStatus.PENDING).all()
                    for e in pending:
                        send_email_fn(e.id, e.subject, e.body)
                
                triggered_count += 1
        except Exception as e:
            debug.debug_log(f"SCHEDULER_ERROR for campaign {camp.id}: {str(e)}")
            db.rollback()
            
    return triggered_count

def trigger_campaign_emails(db: Session, campaign_id: int, background_tasks):
    from .models import Email, EmailStatus, Campaign
    from .tasks import send_email_fn
    
    # Fetch all PENDING emails for this campaign
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
    now = datetime.utcnow()
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

        return {"subject": subject, "body": body}

    if not api_key:
        return fallback_generation(topic, tone)

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        
        prompt = (
            f"Write a professional, high-impact email about '{topic}' tailored for a recipient at the '{tone}' level.\n\n"
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
                {"role": "system", "content": "You are a master executive communicator. Write structured, professional emails in plain text. Use 'Best regards,' for sign-offs. Use standard punctuation. Output pure JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
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
    hour_ago = datetime.utcnow() - timedelta(hours=1)
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
        "timestamp": datetime.utcnow().isoformat()
    }

def check_reputation_guard(db: Session):
    """
    Internal circuit breaker to pause all running campaigns if reputation is critical.
    """
    health = get_system_health(db)
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
