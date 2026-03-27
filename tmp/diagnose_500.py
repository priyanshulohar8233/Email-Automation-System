import sys
import os
import traceback
from datetime import datetime, timezone
import dotenv

# Setup paths
env_path = r"d:\Email-Automation-System_2.0\backend\.env"
dotenv.load_dotenv(env_path)
sys.path.append(r"d:\Email-Automation-System_2.0\backend")

from app.database import SessionLocal
from app.services import compute_stats, recent_events

def run_diagnostics():
    db = SessionLocal()
    try:
        print("--- Diagnostic: Testing compute_stats(days=30) ---")
        try:
            stats = compute_stats(db, days=30)
            print("compute_stats: SUCCESS")
        except Exception:
            print("compute_stats: FAILED")
            traceback.print_exc()

        print("\n--- Diagnostic: Testing recent_events(days=30) ---")
        try:
            events = recent_events(db, days=30)
            print(f"recent_events: SUCCESS ({len(events)} events)")
        except Exception:
            print("recent_events: FAILED")
            traceback.print_exc()

    finally:
        db.close()

if __name__ == "__main__":
    run_diagnostics()
