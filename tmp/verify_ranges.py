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
from app.services import compute_stats

def test_stats():
    db = SessionLocal()
    try:
        print("--- Testing WEEK (7 days) ---")
        stats_7 = compute_stats(db, days=7)
        print(f"Total Emails: {stats_7['totalEmails']} (Growth: {stats_7['totalEmailsGrowth']}%)")
        print(f"Open Rate: {stats_7['openRate']}% (Growth: {stats_7['openRateGrowth']}%)")
        
        print("\n--- Testing MONTH (30 days) ---")
        stats_30 = compute_stats(db, days=30)
        print(f"Total Emails: {stats_30['totalEmails']} (Growth: {stats_30['totalEmailsGrowth']}%)")
        print(f"Open Rate: {stats_30['openRate']}% (Growth: {stats_30['openRateGrowth']}%)")
        
        if stats_7['totalEmails'] <= stats_30['totalEmails']:
             print("\nSUCCESS: Filtering logic confirmed (7d <= 30d).")
        else:
             print("\nWARNING: Filtering logic discrepancy (7d > 30d).")
            
    finally:
        db.close()

if __name__ == "__main__":
    test_stats()
