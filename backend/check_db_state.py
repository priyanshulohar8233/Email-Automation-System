from app.database import SessionLocal
from app.models import Campaign, Email, EmailStatus
import json

db = SessionLocal()
try:
    print("--- Campaigns ---")
    campaigns = db.query(Campaign).all()
    for c in campaigns:
        print(f"ID: {c.id}, Name: {c.name}, Status: {c.status}")
        
    print("\n--- Emails ---")
    emails = db.query(Email).all()
    print(f"Total Emails in DB: {len(emails)}")
    counts = {}
    for e in emails:
        counts[e.status] = counts.get(e.status, 0) + 1
    print(f"Status counts: {counts}")
    
    if len(emails) > 0:
        print("\nLast 5 emails:")
        for e in emails[-5:]:
            print(f"ID: {e.id}, CampaignID: {e.campaign_id}, Status: {e.status}, Recipient: {e.recipient_email}")
finally:
    db.close()
