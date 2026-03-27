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
        print("Testing compute_stats (last 30 days)...")
        stats = compute_stats(db, days=30)
        print(f"Total Emails: {stats['totalEmails']} (Growth: {stats['totalEmailsGrowth']}%)")
        print(f"Open Rate: {stats['openRate']}% (Growth: {stats['openRateGrowth']}%)")
        print(f"Click Rate: {stats['clickRate']}% (Growth: {stats['clickRateGrowth']}%)")
        print(f"Active Campaigns: {stats['activeCampaigns']} (Growth: {stats['activeCampaignsGrowth']}%)")
        
        # Check if they are not all 0.0 unless there is really no data
        if any(v != 0.0 for v in [stats['totalEmailsGrowth'], stats['openRateGrowth'], stats['clickRateGrowth']]):
            print("\nSUCCESS: Growth metrics are non-zero/dynamic.")
        else:
            print("\nNOTE: Growth metrics are all 0.0. This is expected if there is no historical data yet.")
            
    finally:
        db.close()

if __name__ == "__main__":
    test_stats()
