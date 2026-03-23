import sys
import os
from datetime import datetime, timezone

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database import SessionLocal
from app.models import Email, EmailEvent, EventType, EmailStatus

def inject_event():
    db = SessionLocal()
    try:
        # 1. Ensure we have an email to attach to
        email = db.query(Email).first()
        if not email:
            print("No email found in DB. Creating one...")
            email = Email(recipient_email="test@example.com", subject="Test Sync", status=EmailStatus.SENT)
            db.add(email)
            db.commit()
            db.refresh(email)
        
        # 2. Add an OPENED event with CURRENT UTC time
        now = datetime.now(timezone.utc)
        print(f"Injecting OPENED event at {now.isoformat()} (UTC)")
        
        event = EmailEvent(
            email_id=email.id,
            event_type=EventType.OPENED,
            timestamp=now,
            browser="Chrome",
            os="Windows",
            device="Desktop",
            country="India"
        )
        db.add(event)
        db.commit()
        print(f"Successfully injected event for email_id {email.id}")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    inject_event()
