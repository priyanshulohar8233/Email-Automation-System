from app.database import SessionLocal
from app.models import Email, EmailEvent, EventType, EmailStatus
import traceback

db = SessionLocal()
try:
    print("Testing Email Events load...")
    events = db.query(EmailEvent).all()
    print(f"Loaded {len(events)} events.")
    for e in events:
        print(f"Event {e.id}: {e.event_type} (type: {type(e.event_type)})")
        
    print("\nTesting Emails load...")
    emails = db.query(Email).all()
    print(f"Loaded {len(emails)} emails.")
    for em in emails:
        print(f"Email {em.id}: {em.status} (type: {type(em.status)})")

except Exception as e:
    print("\nERROR DETECTED:")
    print(e)
    traceback.print_exc()
finally:
    db.close()
