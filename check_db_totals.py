import os
import sys

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.app.database import SessionLocal
from backend.app.models import Email, EmailEvent, Campaign

db = SessionLocal()
try:
    print(f"Total Emails: {db.query(Email).count()}")
    print(f"Total Events: {db.query(EmailEvent).count()}")
    print(f"Total Campaigns: {db.query(Campaign).count()}")
    
    latest_email = db.query(Email).order_by(Email.sent_at.desc()).first()
    if latest_email:
        print(f"Latest Email Sent At: {latest_email.sent_at}")
    
    latest_event = db.query(EmailEvent).order_by(EmailEvent.timestamp.desc()).first()
    if latest_event:
        print(f"Latest Event Timestamp: {latest_event.timestamp}")
finally:
    db.close()
