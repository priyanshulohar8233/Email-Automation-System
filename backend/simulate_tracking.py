from app.database import SessionLocal
from app.models import Email, EmailEvent, EventType, EmailStatus
from app.services import log_event, compute_stats
import json
from datetime import datetime

db = SessionLocal()
try:
    # 1. Find a SENT or DELIVERED email
    email = db.query(Email).filter(Email.status.in_([EmailStatus.SENT, EmailStatus.DELIVERED])).order_by(Email.id.desc()).first()
    if not email:
        print("No sent emails found to simulate tracking.")
    else:
        print(f"Simulating events for Email ID: {email.id}, Campaign ID: {email.campaign_id}")
        
        # 2. Log an OPENED event
        print("Logging OPENED event...")
        log_event(db, email.id, EventType.OPENED)
        
        # 3. Log a CLICKED event
        print("Logging CLICKED event...")
        log_event(db, email.id, EventType.CLICKED, url="https://google.com")
        
        # 4. Refresh stats
        stats = compute_stats(db, days=1)
        print("\n--- Current Stats (Last 24h) ---")
        print(json.dumps(stats, indent=2))
        
        # 5. Check EmailEvent table directly
        events = db.query(EmailEvent).filter(EmailEvent.email_id == email.id).all()
        print(f"\nTotal events for this email: {len(events)}")
        for ev in events:
            print(f"- Type: {ev.event_type}, Time: {ev.timestamp}")

finally:
    db.close()
