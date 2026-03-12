import sys
import os
sys.path.append(os.getcwd())
from app.database import SessionLocal
from app.models import Email, EmailStatus
import traceback

def diagnostic():
    db = SessionLocal()
    try:
        print("--- RECENT FAILED EMAILS ---")
        failed = db.query(Email).filter(Email.status == EmailStatus.BOUNCED).order_by(Email.id.desc()).limit(5).all()
        if not failed:
            print("No failed emails found.")
            return

        for e in failed:
            print(f"\nID: {e.id}")
            print(f"Recipient: {e.recipient_email}")
            print(f"Reason: {e.failure_reason}")
            print("-" * 20)
            
    except Exception as ex:
        print(f"Diagnostic failed: {ex}")
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    diagnostic()
