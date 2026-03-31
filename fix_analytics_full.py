import re
import os

file_path = r'd:\Email-Automation-System_2.0\backend\app\services.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update get_link_performance to support date windows and company properly
print("Updating get_link_performance...")
new_link_perf_impl = """def get_link_performance(db: Session, campaign_name: str = "all", company_name: str | list = "all", days: int = 30):
    from .models import EmailEvent, Email, Campaign, EventType
    from sqlalchemy import func
    
    start_date, end_date = get_date_window(days)
    
    # Group clicks by URL and count
    q = db.query(EmailEvent.url, func.count(EmailEvent.id).label("clicks")).filter(
        EmailEvent.event_type == EventType.CLICKED,
        EmailEvent.timestamp >= start_date,
        EmailEvent.timestamp < end_date
    )
    
    # Unified Join for multiple filters
    if campaign_name != "all" or (company_name and company_name != "all"):
        q = q.join(Email, EmailEvent.email_id == Email.id).join(Campaign, Email.campaign_id == Campaign.id)
        if campaign_name != "all":
            q = q.filter(Campaign.name == campaign_name)
        if company_name and company_name != "all":
            companies = [company_name] if isinstance(company_name, str) else company_name
            q = q.filter(Campaign.company.in_(companies))
    
    results = q.group_by(EmailEvent.url).order_by(func.count(EmailEvent.id).desc()).limit(10).all()
    return [{"url": r.url or "Direct/Unknown", "clicks": r.clicks} for r in results]
"""

# Match until the start of process_sendgrid_webhook or next function
link_perf_pattern = re.compile(r'def get_link_performance\(db: Session, campaign_name: str = "all"\):.*?return \[{"url": r\.url or "Direct/Unknown", "clicks": r\.clicks\} for r in results\]', re.DOTALL)
content = link_perf_pattern.sub(new_link_perf_impl, content)

# 2. Update get_analytics with proper imports and fixed sub-query join logic
print("Updating get_analytics...")
new_get_analytics_impl = """def get_analytics(db: Session, campaign_name: str = "all", days: int = 30, company_name: str | list = "all"):
    \"\"\"
    Deep dive analytics synced with Dashboard math.
    \"\"\"
    from .models import EmailEvent, EventType, Email, Campaign, ActivityLog
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func, case, distinct
    
    now = datetime.now(timezone.utc)
    s, e = get_date_window(days)
    
    # 1. Current Metrics (KPIs)
    m = get_unified_metrics(db, days=days, campaign_name=campaign_name, company_name=company_name, start_date=s, end_date=e)
    
    # 2. Growth Logic (Identical to compute_stats)
    if days == 7:
        prev_start = s - timedelta(days=7)
        prev_end = s
    elif days == 30:
        prev_start = (s - timedelta(days=30))
        prev_end = s
    else:
        prev_start = s - timedelta(days=days)
        prev_end = s
    p = get_unified_metrics(db, campaign_name=campaign_name, company_name=company_name, start_date=prev_start, end_date=prev_end)
    
    def calc_growth(cur, prev):
        if prev == 0: return 100.0 if cur > 0 else 0.0
        return round(((cur - prev) / prev) * 100, 1)

    # 3. Time Series Data (Performance Chart)
    performance = []
    
    daily_stats = db.query(
        func.date_trunc('day', EmailEvent.timestamp).label('day'),
        func.count(distinct(case(((EmailEvent.event_type == EventType.OPENED), EmailEvent.email_id), else_=None))).label('opens'),
        func.count(distinct(case(((EmailEvent.event_type == EventType.CLICKED), EmailEvent.email_id), else_=None))).label('clicks')
    ).filter(
        EmailEvent.timestamp >= s,
        EmailEvent.timestamp < e
    )
    
    if campaign_name != "all" or (company_name and company_name != "all"):
        daily_stats = daily_stats.join(Email, EmailEvent.email_id == Email.id).join(Campaign, Email.campaign_id == Campaign.id)
        if campaign_name != "all":
            daily_stats = daily_stats.filter(Campaign.name == campaign_name)
        if company_name and company_name != "all":
            companies = [company_name] if isinstance(company_name, str) else company_name
            daily_stats = daily_stats.filter(Campaign.company.in_(companies))
            
    results = daily_stats.group_by(func.date_trunc('day', EmailEvent.timestamp)).all()
    stats_map = {r.day.date(): {"opens": r.opens, "clicks": r.clicks} for r in results}
    
    # Populate intervals (Days or Months depending on range)
    if days == 7:
        for i in range(7):
            d = s + timedelta(days=i)
            day_stats = stats_map.get(d.date(), {"opens": 0, "clicks": 0})
            performance.append({"time": d.strftime('%a'), "opens": day_stats["opens"], "clicks": day_stats["clicks"]})
    elif days <= 31:
         for i in range(days):
            d = s + timedelta(days=i)
            if d > e: break
            day_stats = stats_map.get(d.date(), {"opens": 0, "clicks": 0})
            performance.append({"time": d.strftime('%d'), "opens": day_stats["opens"], "clicks": day_stats["clicks"]})
    else:
        for r in results:
            performance.append({"time": r.day.strftime('%m/%d'), "opens": r.opens, "clicks": r.clicks})

    # 4. Device Distribution
    device_query = db.query(
        EmailEvent.device, 
        func.count(EmailEvent.id).label("count")
    ).filter(EmailEvent.timestamp >= s, EmailEvent.timestamp < e)
    
    if campaign_name != "all" or (company_name and company_name != "all"):
        device_query = device_query.join(Email, EmailEvent.email_id == Email.id).join(Campaign, Email.campaign_id == Campaign.id)
        if campaign_name != "all":
            device_query = device_query.filter(Campaign.name == campaign_name)
        if company_name and company_name != "all":
            companies = [company_name] if isinstance(company_name, str) else company_name
            device_query = device_query.filter(Campaign.company.in_(companies))
    
    device_results = device_query.group_by(EmailEvent.device).all()
    device_data = [{"name": r[0] or "Unknown", "value": r[1]} for r in device_results]
    if not device_data:
        device_data = [{"name": "Desktop", "value": 0}, {"name": "Mobile", "value": 0}]

    # 5. Top Locations
    location_query = db.query(
        EmailEvent.country, 
        EmailEvent.city,
        func.count(EmailEvent.id).label("opens")
    ).filter(
        EmailEvent.event_type == EventType.OPENED,
        EmailEvent.timestamp >= s,
        EmailEvent.timestamp < e
    )
    
    if campaign_name != "all" or (company_name and company_name != "all"):
        location_query = location_query.join(Email, EmailEvent.email_id == Email.id).join(Campaign, Email.campaign_id == Campaign.id)
        if campaign_name != "all":
            location_query = location_query.filter(Campaign.name == campaign_name)
        if company_name and company_name != "all":
            companies = [company_name] if isinstance(company_name, str) else company_name
            location_query = location_query.filter(Campaign.company.in_(companies))
        
    location_results = location_query.group_by(EmailEvent.country, EmailEvent.city).order_by(func.count(EmailEvent.id).desc()).limit(5).all()
    
    total_opens = m.get("opens", 1) or 1
    locations_data = [
        {
            "country": r[0] or "Unknown", 
            "city": r[1] or "Unknown", 
            "opens": r[2],
            "rate": round((r[2] / total_opens) * 100, 1)
        } for r in location_results
    ]

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
        "performanceData": performance,
        "deviceData": device_data,
        "locationsData": locations_data,
        "linkData": get_link_performance(db, campaign_name, company_name=company_name, days=days),
        "recentActivity": recent_events(db, days=days, campaign_name=campaign_name, company_name=company_name, limit=10)
    }
"""

get_analytics_pattern = re.compile(r'def get_analytics\(db: Session, campaign_name: str = "all", days: int = 30, company_name: str \| list = "all"\):.*?recent_events\(db, days=days, campaign_name=campaign_name, company_name=company_name, limit=10\)\s+\}', re.DOTALL)
content = get_analytics_pattern.sub(new_get_analytics_impl, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully applied Analytics full fix to services.py")
