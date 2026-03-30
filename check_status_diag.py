from backend.app.database import SessionLocal
from backend.app.models import Email, EmailStatus, Campaign, ActivityLog
import json

def check_diag():
    db = SessionLocal()
    try:
        print("--- Email Table Stats ---")
        emails = db.query(Email.status, Campaign.company, Email.sent_at).join(Campaign).all()
        print(f"Total Emails: {len(emails)}")
        for e in emails:
            print(f"  Status: {e.status}, Company: {e.company}, SentAt: {e.sent_at}")
            
        print("\n--- ActivityLog Table Stats ---")
        logs = db.query(ActivityLog.status, ActivityLog.company, ActivityLog.timestamp).all()
        print(f"Total Logs: {len(logs)}")
        for l in logs:
            print(f"  Status: {l.status}, Company: {l.company}, Timestamp: {l.timestamp}")

        from backend.app.services import get_emails_per_company
        print("\n--- Testing get_emails_per_company (30 days) ---")
        res = get_emails_per_company(db, days=30)
        print(f"Result: {json.dumps(res, indent=2)}")
        
    finally:
        db.close()

if __name__ == "__main__":
    check_diag()
