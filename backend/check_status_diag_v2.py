import os
import sys

# Script intended to be run from 'backend' directory
sys.path.append(os.getcwd())

from app.database import SessionLocal
from app.models import Email, EmailStatus

db = SessionLocal()
try:
    first_email = db.query(Email).first()
    if first_email:
        print(f"Status in Python: '{first_email.status}'")
        print(f"Type in Python: {type(first_email.status)}")
        print(f"Is equal to EmailStatus.SENT ({EmailStatus.SENT})? {first_email.status == EmailStatus.SENT}")
        print(f"Is equal to 'SENT'? {str(first_email.status) == 'SENT'}")
        
        # Check counts manually here to double check
        cnt_all = db.query(Email).count()
        cnt_sent = db.query(Email).filter(Email.status == EmailStatus.SENT).count()
        cnt_bounced = db.query(Email).filter(Email.status == EmailStatus.BOUNCED).count()
        print(f"Counts - Total: {cnt_all}, SENT: {cnt_sent}, BOUNCED: {cnt_bounced}")
    else:
        print("No emails found.")
finally:
    db.close()
