import os
import sys

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.app.database import SessionLocal
from backend.app.models import Email, EmailStatus

db = SessionLocal()
try:
    first_email = db.query(Email).first()
    if first_email:
        print(f"Status in Python: '{first_email.status}'")
        print(f"Type in Python: {type(first_email.status)}")
        print(f"Is equal to EmailStatus.SENT ({EmailStatus.SENT})? {first_email.status == EmailStatus.SENT}")
        print(f"Is equal to 'SENT'? {first_email.status == 'SENT'}")
    else:
        print("No emails found.")
finally:
    db.close()
