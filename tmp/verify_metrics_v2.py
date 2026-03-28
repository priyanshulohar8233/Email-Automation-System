import sys
import os
from datetime import datetime, timezone
import dotenv
from unittest.mock import MagicMock

# Absolute path to .env
env_path = r"d:\Email-Automation-System_2.0\backend\.env"
dotenv.load_dotenv(env_path)

# Add backend to path
sys.path.append(r"d:\Email-Automation-System_2.0\backend")

from app.database import SessionLocal
from app.routes import dashboard_stats

def test_range(range_val):
    print(f"\n--- Testing Range: {range_val} ---")
    db = SessionLocal()
    try:
        # Mocking the dependency injection objects
        response = MagicMock()
        background_tasks = MagicMock()
        
        # Calling the route function directly
        stats = dashboard_stats(response, background_tasks, range=range_val, db=db)
        
        # stats is a DashboardStats model (dictionary-like or object depending on return)
        # Fastapi returns the dict or model
        if hasattr(stats, 'dict'):
            stats_dict = stats.dict()
        else:
            stats_dict = stats
            
        print(f"Label: {stats_dict.get('vsLabel')}")
        print(f"Total Emails: {stats_dict.get('totalEmails')} (Growth: {stats_dict.get('totalEmailsGrowth')}%)")
        
        expected_labels = {
            "week": "vs last week",
            "month": "vs last month",
            "quarter": "vs last quarter",
            "year": "vs last year"
        }
        
        if stats_dict.get('vsLabel') == expected_labels.get(range_val):
            print(f"SUCCESS: Label for {range_val} is correct.")
        else:
            print(f"FAILURE: Label for {range_val} is {stats_dict.get('vsLabel')}, expected {expected_labels.get(range_val)}.")
            
    finally:
        db.close()

if __name__ == "__main__":
    for r in ["week", "month", "quarter", "year"]:
        test_range(r)
