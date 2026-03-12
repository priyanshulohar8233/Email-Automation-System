from sqlalchemy import func
from app.database import SessionLocal
from app.models import Email, EmailStatus, Campaign
import json

db = SessionLocal()
try:
    emails = db.query(Email).order_by(Email.id.desc()).limit(20).all()
    print("--- RECENT EMAILS ---")
    for e in emails:
        print(f"ID: {e.id}, Recipient: {e.recipient_email}, Status: {e.status}, Campaign ID: {e.campaign_id}")
    
    stats = db.query(Email.status, func.count(Email.id)).group_by(Email.status).all()
    print("\n--- STATUS COUNTS ---")
    for s, count in stats:
        print(f"{s.value if hasattr(s, 'value') else s}: {count}")

    campaigns = db.query(Campaign).all()
    print("\n--- CAMPAIGNS ---")
    for c in campaigns:
        print(f"ID: {c.id}, Name: {c.name}, Status: {c.status}")

finally:
    db.close()
