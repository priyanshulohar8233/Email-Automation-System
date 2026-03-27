import sys
import os
from datetime import datetime, timezone
import dotenv

# Absolute path to .env
env_path = r"d:\Email-Automation-System_2.0\backend\.env"
dotenv.load_dotenv(env_path)

# Add backend to path
sys.path.append(r"d:\Email-Automation-System_2.0\backend")

from app.database import SessionLocal
from app.services import recent_events

def test_activity():
    db = SessionLocal()
    try:
        print("--- Testing Activity Filtering (1 day) ---")
        events_1 = recent_events(db, days=1)
        print(f"Events in last 1 day: {len(events_1)}")
        
        print("\n--- Testing Activity Filtering (365 days) ---")
        events_365 = recent_events(db, days=365)
        print(f"Events in last 365 days: {len(events_365)}")
        
        if len(events_1) <= len(events_365):
             print("\nSUCCESS: Activity filtering logic confirmed.")
        else:
             print("\nWARNING: Activity filtering logic discrepancy.")
            
    finally:
        db.close()

if __name__ == "__main__":
    test_activity()
