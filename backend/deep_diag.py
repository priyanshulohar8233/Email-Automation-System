import sys
import os
sys.path.append(os.getcwd())
from sqlalchemy import func
from app.database import SessionLocal
from app.models import Settings, Email, EmailEvent, EventType, EmailStatus, Campaign, CampaignStatus
from app.config import settings
from app.services import compute_stats, emails_over_time
import json
from datetime import datetime, timedelta

db = SessionLocal()
try:
    print("--- Settings ---")
    s = db.query(Settings).first()
    print(f"DB base_url: {s.base_url if s else 'None'}")
    print(f"Config BASE_URL: {settings.BASE_URL}")
    
    print("\n--- Current Dashboard Stats (30 days) ---")
    stats = compute_stats(db, days=30)
    print(json.dumps(stats, indent=2))
    
    print("\n--- Emails Over Time (30 days) ---")
    chart = emails_over_time(db, days=30)
    chart_total = sum(c['emails'] for c in chart)
    print(f"Chart Total (SENT/DELIVERED in intervals): {chart_total}")
    # print(json.dumps(chart, indent=2))
    
    print("\n--- Raw Email Table Counts ---")
    total_emails = db.query(Email).count()
    sent = db.query(Email).filter(Email.status == EmailStatus.SENT).count()
    delivered = db.query(Email).filter(Email.status == EmailStatus.DELIVERED).count()
    bounced = db.query(Email).filter(Email.status == EmailStatus.BOUNCED).count()
    pending = db.query(Email).filter(Email.status == EmailStatus.PENDING).count()
    print(f"Total: {total_emails}")
    print(f"SENT: {sent}")
    print(f"DELIVERED: {delivered}")
    print(f"BOUNCED: {bounced}")
    print(f"PENDING: {pending}")

    print("\n--- Raw Event Table Counts ---")
    events = db.query(EmailEvent.event_type, func.count(EmailEvent.id)).group_by(EmailEvent.event_type).all()
    for et, count in events:
        print(f"{et}: {count}")

    print("\n--- Campaign Model Counters vs Reality ---")
    camps = db.query(Campaign).order_by(Campaign.id.desc()).limit(3).all()
    for c in camps:
        print(f"Campaign ID {c.id} ({c.name}):")
        print(f"  Model sent_count: {c.sent_count}")
        print(f"  Actual Emails (SENT/DELIVERED): {db.query(Email).filter(Email.campaign_id == c.id, Email.status.in_([EmailStatus.SENT, EmailStatus.DELIVERED])).count()}")
        print(f"  Model delivered_count: {c.delivered_count}")
        print(f"  Actual Emails (DELIVERED): {db.query(Email).filter(Email.campaign_id == c.id, Email.status == EmailStatus.DELIVERED).count()}")

finally:
    db.close()
