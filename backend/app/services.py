from typing import List
import smtplib
from datetime import datetime
from sqlalchemy import func, distinct
from sqlalchemy.orm import Session
from .models import Email, EmailStatus, EmailEvent, EventType, Campaign, CampaignStatus, Settings


# low-level mail sender

from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email import encoders
import requests
import io

def check_and_complete_campaign(db: Session, campaign_id: int):
    from .models import Email, EmailStatus, Campaign, CampaignStatus
    from . import debug
    
    # Reload campaign
    camp = db.query(Campaign).get(campaign_id)
    if not camp: return
    
    # Check if any emails are still PENDING
    pending_count = db.query(Email).filter(Email.campaign_id == campaign_id, Email.status == EmailStatus.PENDING).count()
    if pending_count == 0:
        camp.status = CampaignStatus.COMPLETED
        db.commit()
        debug.debug_log(f"CAMPAIGN_COMPLETE: Campaign {campaign_id} finished.")

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
    from . import debug
    from datetime import datetime, timedelta
    
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
            elif event_type == EventType.OPENED:
                if not email.opened_at:
                    email.opened_at = datetime.utcnow()
            elif event_type == EventType.CLICKED:
                if not email.clicked_at:
                    email.clicked_at = datetime.utcnow()
            elif event_type == EventType.SPAM_REPORT:
                email.status = EmailStatus.SPAM
                
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

def get_analytics(db: Session, campaign_name: str = "all", days: int = 30):
    from datetime import datetime, timedelta
    from sqlalchemy import and_, extract, func
    
    now = datetime.utcnow()
    limit_date = now - timedelta(days=days)
    
    # Filter for campaign if specified
    campaign_id = None
    if campaign_name != "all":
        c = db.query(Campaign).filter(Campaign.name == campaign_name).first()
        if c: campaign_id = c.id

    def count_metric(event_type=None, email_status=None, start=None, end=None):
        if event_type:
            # Handle both enum objects and strings for robustness
            et_val = event_type.value if hasattr(event_type, 'value') else str(event_type)
            if "EventType." in et_val: et_val = et_val.split(".")[-1]
            
            q = db.query(func.count(EmailEvent.id)).filter(EmailEvent.event_type == et_val)
            if campaign_id:
                q = q.join(Email).filter(Email.campaign_id == campaign_id)
            if start: q = q.filter(EmailEvent.timestamp >= start)
            if end: q = q.filter(EmailEvent.timestamp < end)
            return q.scalar() or 0
        if email_status:
            # Handle both enum objects and strings for robustness
            status_val = email_status.value if hasattr(email_status, 'value') else str(email_status)
            if "EmailStatus." in status_val: status_val = status_val.split(".")[-1]
            q = db.query(func.count(Email.id)).filter(Email.status == status_val)
            if campaign_id: q = q.filter(Email.campaign_id == campaign_id)
            if start: q = q.filter(Email.sent_at >= start)
            if end: q = q.filter(Email.sent_at < end)
            return q.scalar() or 0
        return 0

    # 1. Period Metrics
    def get_period_stats(start, end=None):
        # Unify Sent: Definition = Total Attempts (SENT, DELIVERED, or BOUNCED)
        total_attempts = count_metric(email_status=EmailStatus.SENT, start=start, end=end) + \
                         count_metric(email_status=EmailStatus.DELIVERED, start=start, end=end) + \
                         count_metric(email_status=EmailStatus.BOUNCED, start=start, end=end)
        
        # Delivered = SENT or DELIVERED (Excludes BOUNCES for rate accuracy)
        delivered = count_metric(email_status=EmailStatus.SENT, start=start, end=end) + \
                    count_metric(email_status=EmailStatus.DELIVERED, start=start, end=end)
        
        opens = count_metric(event_type=EventType.OPENED, start=start, end=end)
        clicks = count_metric(event_type=EventType.CLICKED, start=start, end=end)
        spam = count_metric(event_type=EventType.SPAM_REPORT, start=start, end=end)
        bounces = count_metric(email_status=EmailStatus.BOUNCED, start=start, end=end)
        
        # Rates relative to correctly delivered or total attempts
        orate = (opens / delivered * 100) if delivered > 0 else 0
        crate = (clicks / delivered * 100) if delivered > 0 else 0
        srate = (spam / delivered * 100) if delivered > 0 else 0
        brate = (bounces / total_attempts * 100) if total_attempts > 0 else 0
        
        return total_attempts, orate, crate, srate, brate

    prev_month_start = limit_date - timedelta(days=days)
    cur_s, cur_orate, cur_crate, cur_srate, cur_brate = get_period_stats(limit_date)
    prev_s, prev_orate, prev_crate, prev_srate, prev_brate = get_period_stats(prev_month_start, limit_date)
    
    def calc_growth(cur, prev):
        if prev == 0: return 100.0 if cur > 0 else 0.0
        return round(((cur - prev) / prev) * 100, 1)

    # 2. Performance Data (Time Series)
    performance = []
    for i in range(7):
        d = now - timedelta(days=6-i)
        d_start = d.replace(hour=0, minute=0, second=0, microsecond=0)
        d_end = (d + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        o = count_metric(event_type=EventType.OPENED, start=d_start, end=d_end)
        c = count_metric(event_type=EventType.CLICKED, start=d_start, end=d_end)
        performance.append({"time": d.strftime('%a'), "opens": o, "clicks": c})

    # 3. Device & Link Data
    device_counts = {}
    q_device = db.query(EmailEvent.device, func.count(EmailEvent.id)).filter(EmailEvent.event_type == EventType.OPENED)
    if campaign_id: q_device = q_device.join(Email).filter(Email.campaign_id == campaign_id)
    for device, count in q_device.group_by(EmailEvent.device).all():
        device_counts[device or "Desktop"] = count
    
    # 4. Locations Data
    locations = []
    q_loc = db.query(EmailEvent.city, EmailEvent.country, func.count(EmailEvent.id)).filter(EmailEvent.event_type == EventType.OPENED)
    if campaign_id: q_loc = q_loc.join(Email).filter(Email.campaign_id == campaign_id)
    cur_opens_total = count_metric(event_type=EventType.OPENED, start=limit_date)
    for city, country, count in q_loc.group_by(EmailEvent.city, EmailEvent.country).limit(5).all():
        if city or country:
            locations.append({
                "city": city or "Unknown",
                "country": country or "Unknown",
                "opens": count,
                "rate": round((count / cur_opens_total * 100) if cur_opens_total > 0 else 0, 1)
            })

    # 5. Recent Events for this campaign (Enhanced for RealtimeFeed.tsx)
    recent = recent_events(db, campaign_name=campaign_name, limit=10)

    return {
        "deliveredEmails": int(cur_s),
        "openRate": round(cur_orate, 1),
        "clickRate": round(cur_crate, 1),
        "spamRate": round(cur_srate, 1),
        "bounceRate": round(cur_brate, 1),
        "deliveredEmailsGrowth": calc_growth(cur_s, prev_s),
        "openRateGrowth": calc_growth(cur_orate, prev_orate),
        "clickRateGrowth": calc_growth(cur_crate, prev_crate),
        "spamRateGrowth": calc_growth(cur_srate, prev_srate),
        "performanceData": performance,
        "deviceData": [{"name": k, "value": v} for k, v in device_counts.items()],
        "locationsData": locations,
        "linkData": get_link_performance(db, campaign_name),
        "recentActivity": recent
    }


def compute_stats(db: Session, days: int = 30):
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    last_month = now - timedelta(days=days)
    prev_month = last_month - timedelta(days=days)
    
    # Function to get counts
    def get_period_counts(start, end=None):
        # 1. Total Attempted (Raw count in DB)
        q_t = db.query(func.count(Email.id))
        if start: q_t = q_t.filter(Email.sent_at >= start)
        if end: q_t = q_t.filter(Email.sent_at < end)
        attempted = q_t.scalar() or 0
        
        # 2. Total Sent (SENT, DELIVERED, or BOUNCED) - This reflects total activity
        q_s = db.query(func.count(Email.id)).filter(
            Email.status.in_([EmailStatus.SENT, EmailStatus.DELIVERED, EmailStatus.BOUNCED])
        )
        if start: q_s = q_s.filter(Email.sent_at >= start)
        if end: q_s = q_s.filter(Email.sent_at < end)
        sent_activity = q_s.scalar() or 0
        
        # 3. Unique opens
        q_o = db.query(func.count(distinct(EmailEvent.email_id))).filter(
            EmailEvent.event_type == EventType.OPENED
        )
        if start: q_o = q_o.filter(EmailEvent.timestamp >= start)
        if end: q_o = q_o.filter(EmailEvent.timestamp < end)
        opens = q_o.scalar() or 0
        
        # 4. Unique clicks
        q_c = db.query(func.count(distinct(EmailEvent.email_id))).filter(
            EmailEvent.event_type == EventType.CLICKED
        )
        if start: q_c = q_c.filter(EmailEvent.timestamp >= start)
        if end: q_c = q_c.filter(EmailEvent.timestamp < end)
        clicks = q_c.scalar() or 0
        
        # 5. Bounces
        q_b = db.query(func.count(Email.id)).filter(
            Email.status == EmailStatus.BOUNCED
        )
        if start: q_b = q_b.filter(Email.sent_at >= start)
        if end: q_b = q_b.filter(Email.sent_at < end)
        bounces = q_b.scalar() or 0

        # 6. Active Campaigns
        q_ac = db.query(func.count(Campaign.id)).filter(
            Campaign.status == CampaignStatus.RUNNING
        )
        active_camps = q_ac.scalar() or 0
        
        return attempted, sent_activity, opens, clicks, bounces, active_camps

    cur_att, cur_s, cur_o, cur_c, cur_b, cur_ac = get_period_counts(last_month)
    prev_att, prev_s, prev_o, prev_c, prev_b, prev_ac = get_period_counts(prev_month, last_month)
    
    # Define Delivered (for unread/open rate denominators)
    # Delivered = SENT or DELIVERED (Excludes BOUNCES for rate accuracy)
    cur_delivered = cur_s - cur_b
    prev_delivered = prev_s - prev_b

    def calc_rate(num, den):
        return (num / den * 100.0) if den > 0 else 0.0
        
    def calc_growth(cur, prev):
        if prev == 0:
            return 100.0 if cur > 0 else 0.0
        return ((cur - prev) / prev) * 100.0
        
    cur_orate = calc_rate(cur_o, cur_delivered)
    prev_orate = calc_rate(prev_o, prev_delivered)
    cur_crate = calc_rate(cur_c, cur_delivered)
    prev_crate = calc_rate(prev_c, prev_delivered)
    cur_brate = calc_rate(cur_b, cur_s)
    prev_brate = calc_rate(prev_b, prev_s)
    
    # Standardize rates (Sent = SENT+DELIVERED)
    return {
        "totalEmails": int(cur_s),
        "totalAttempted": int(cur_att),
        "deliveredEmails": int(cur_delivered), 
        "openRate": round(float(cur_orate), 1),
        "clickRate": round(float(cur_crate), 1),
        "bounceRate": round(float(cur_brate), 1),
        "unread": round(float(100.0 - cur_orate if cur_delivered > 0 else 0.0), 1),
        "activeCampaigns": int(cur_ac),
        
        "totalEmailsGrowth": round(float(calc_growth(cur_s, prev_s)), 1),
        "openRateGrowth": round(float(calc_growth(cur_orate, prev_orate)), 1),
        "clickRateGrowth": round(float(calc_growth(cur_crate, prev_crate)), 1),
        "bounceRateGrowth": round(float(calc_growth(cur_brate, prev_brate)), 1),
        "unreadGrowth": round(float(calc_growth(100.0 - cur_orate, 100.0 - prev_orate)), 1),
        "activeCampaignsGrowth": round(float(calc_growth(cur_ac, prev_ac)), 1),

        "raw": {
            "bounced": int(cur_b),
            "opened": int(cur_o),
            "delivered": int(cur_s),
            "unread": int(max(0, cur_s - cur_o)),
            "attempted": int(cur_att)
        }
    }


def emails_over_time(db: Session, days: int = 7):
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    
    if days == 7:
        # 1. Monday-Sunday Daily View
        current_weekday = now.weekday()
        start_of_week = (now - timedelta(days=current_weekday)).replace(hour=0, minute=0, second=0, microsecond=0)
        limit_date = start_of_week
        
        counts = {}
        for i in range(7):
            d = start_of_week + timedelta(days=i)
            date_str = d.strftime('%Y-%m-%d')
            counts[date_str] = 0
            
        # Chart should show all attempted/successful/bounced deliveries (Total activity)
        rows = db.query(Email.sent_at).filter(
            Email.status.in_([EmailStatus.SENT, EmailStatus.DELIVERED, EmailStatus.BOUNCED]), 
            Email.sent_at >= limit_date
        ).all()
        for r in rows:
            if r.sent_at:
                key = (datetime.fromisoformat(r.sent_at.replace(' ', 'T')) if isinstance(r.sent_at, str) else r.sent_at).strftime('%Y-%m-%d')
                if key in counts: counts[key] += 1
                    
        return [{"day": (start_of_week + timedelta(days=i)).strftime('%a'), "emails": counts.get((start_of_week + timedelta(days=i)).strftime('%Y-%m-%d'), 0)} for i in range(7)]

    else:
        # 2. Weekly Aggregation for 30, 90, 365 Days
        num_weeks = (days // 7) + (1 if days % 7 > 0 else 0)
        total_days = num_weeks * 7
        limit_date = (now - timedelta(days=total_days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
        
        buckets = []
        for i in range(num_weeks):
            week_start = limit_date + timedelta(days=i*7)
            buckets.append({
                "day": f"Week {i+1}", 
                "start": week_start, 
                "end": week_start + timedelta(days=7), 
                "emails": 0
            })
            
        rows = db.query(Email.sent_at).filter(
            Email.status.in_([EmailStatus.SENT, EmailStatus.DELIVERED, EmailStatus.BOUNCED]), 
            Email.sent_at >= limit_date
        ).all()
        
        for r in rows:
            if not r.sent_at: continue
            
            # Robust datetime parsing
            try:
                dt = r.sent_at if isinstance(r.sent_at, datetime) else datetime.fromisoformat(str(r.sent_at).replace(' ', 'T').split('.')[0])
                for b in buckets:
                    if b["start"] <= dt < b["end"]:
                        b["emails"] += 1
                        break
            except:
                continue
                        
        return [{"day": b["day"], "emails": b["emails"]} for b in buckets]



def recent_events(db: Session, days: int = 30, limit: int = 15, campaign_name: str = "all"):
    from datetime import datetime, timedelta
    limit_date = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(EmailEvent).join(Email)
    
    if campaign_name != "all":
        query = query.join(Campaign).filter(Campaign.name == campaign_name)
        
    events = query.filter(EmailEvent.timestamp >= limit_date).order_by(EmailEvent.timestamp.desc()).limit(limit).all()
    
    result = []
    for ev in events:
        ev_type = ev.event_type.value if hasattr(ev.event_type, 'value') else str(ev.event_type)
        if "EventType." in ev_type: ev_type = ev_type.split(".")[-1].lower()
        
        loc = f"{ev.city}, {ev.country}" if ev.city and ev.country else "Unknown"
        
        result.append({
            "id": ev.id,
            "email_id": ev.email_id,
            "recipient": ev.email.recipient_email,
            "email": ev.email.recipient_email,
            "event_type": ev_type,
            "type": ev_type,
            "subject": ev.email.subject or "No Subject",
            "timestamp": ev.timestamp.isoformat() if hasattr(ev.timestamp, 'isoformat') else str(ev.timestamp),
            "location": loc,
            "metadata": {
                "browser": ev.browser or "Unknown",
                "os": ev.os or "Unknown",
                "device": ev.device or "Desktop",
                "location": loc,
                "url": ev.url
            }
        })
    return result


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

def push_to_email_queue(email_id: int, subject: str, body: str, attachments: list = None):
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
        r.lpush("email_queue", json.dumps(job_data))
        debug.debug_log(f"REDIS_QUEUE: Pushed email {email_id} to 'email_queue'")
    except Exception as e:
        debug.debug_log(f"REDIS_QUEUE_ERROR: {str(e)}")

def get_campaigns(db: Session, search: str | None = None, status: str | None = None):
    from .models import Campaign
    query = db.query(Campaign)
    
    if search:
        query = query.filter(Campaign.name.ilike(f"%{search}%"))
        
    if status and status.lower() != "all":
        query = query.filter(Campaign.status == status.upper())
        
    campaigns = query.order_by(Campaign.created_at.desc()).all()
    
    results = []
    for c in campaigns:
        # Dynamic counts for accuracy in serverless/async environments
        sent = db.query(func.count(Email.id)).filter(
            Email.campaign_id == c.id, 
            Email.status.in_([EmailStatus.SENT, EmailStatus.DELIVERED])
        ).scalar() or 0
        
        delivered = db.query(func.count(Email.id)).filter(
            Email.campaign_id == c.id, 
            Email.status == EmailStatus.DELIVERED
        ).scalar() or 0
        
        failed = db.query(func.count(Email.id)).filter(
            Email.campaign_id == c.id, 
            Email.status == EmailStatus.BOUNCED
        ).scalar() or 0
        
        opens = db.query(func.count(distinct(EmailEvent.email_id))).join(Email).filter(
            Email.campaign_id == c.id,
            EmailEvent.event_type == EventType.OPENED
        ).scalar() or 0
        
        unread = (sent - opens) if sent > opens else 0
        
        results.append({
            "id": str(c.id),
            "name": c.name,
            "status": "Complete" if c.status == CampaignStatus.COMPLETED else c.status.value.title(),
            "sent": sent,
            "delivered": delivered,
            "failed": failed,
            "opens": f"{opens} ({round(opens/sent*100, 1) if sent > 0 else 0}%)",
            "unread": f"{unread} ({round(unread/sent*100, 1) if sent > 0 else 0}%)",
            "bounce": f"{failed} ({round(failed/(sent+failed)*100, 1) if (sent+failed) > 0 else 0}%)",
            "scheduled": c.scheduled_for or "Not scheduled",
        })
    return results

def update_campaign(db: Session, campaign_id: int, data):
    from .models import Campaign
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise ValueError("Campaign not found")
        
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
        # (This avoids foreign key constraint violations)
        db.query(EmailEvent).filter(
            EmailEvent.email_id.in_(
                db.query(Email.id).filter(Email.campaign_id == campaign_id)
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
    if data.name is not None:
        t.name = data.name
    if data.content is not None:
        t.content = data.content
    db.commit()
    db.refresh(t)
    return {"id": t.id, "name": t.name, "content": t.content, "created_at": t.created_at.isoformat(), "updated_at": t.updated_at.isoformat()}

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
