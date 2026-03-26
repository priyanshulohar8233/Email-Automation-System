import os
import sys
from sqlalchemy.orm import Session
from backend.app.database import SessionLocal
from backend.app.models import ActivityLog

def fix_sender_data():
    print("Starting ActivityLog Sender Data Migration...")
    db = SessionLocal()
    try:
        # Find all logs where sender looks like an email (contains @)
        logs_to_fix = db.query(ActivityLog).filter(ActivityLog.sender.like("%@%")).all()
        
        if not logs_to_fix:
            print("No records found with email-style senders. Everything is clean!")
            return

        print(f"Found {len(logs_to_fix)} records to update.")
        
        updated_count = 0
        for log in logs_to_fix:
            if log.company:
                # Use the mapped company name
                log.sender = log.company
                updated_count += 1
            else:
                # Fallback if company is somehow missing
                log.sender = "MP Consultant LLC"
                updated_count += 1
        
        db.commit()
        print(f"Successfully updated {updated_count} records in the ActivityLog table.")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_sender_data()
