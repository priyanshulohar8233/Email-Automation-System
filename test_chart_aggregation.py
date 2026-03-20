import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api"

def test_aggregation(days):
    print(f"\n>>> Testing aggregation for {days} days...")
    try:
        resp = requests.get(f"{BASE_URL}/dashboard/email-stats?days={days}")
        if resp.status_code != 200:
            print(f"FAILED: Status {resp.status_code}")
            print(resp.text)
            return
        
        data = resp.json()
        print(f"Received {len(data)} buckets.")
        for d in data:
            print(f"  {d['day']}: {d['emails']}")
            
        # Basic validation based on user requirements
        if days == 7:
            if len(data) == 7:
                print("✅ Week View: Exactly 7 buckets.")
            else:
                print(f"❌ Week View: Expected 7 buckets, got {len(data)}.")
        elif days == 30:
            if len(data) == 6:
                print("✅ Month View: Exactly 6 buckets (5-day intervals).")
            else:
                print(f"❌ Month View: Expected 6 buckets, got {len(data)}.")
        elif days == 90:
            if len(data) == 6:
                print("✅ Quarter View: Exactly 6 buckets (15-day intervals).")
            else:
                print(f"❌ Quarter View: Expected 6 buckets, got {len(data)}.")
        elif days == 365:
            if len(data) == 12:
                print("✅ Year View: Exactly 12 buckets.")
            else:
                print(f"❌ Year View: Expected 12 buckets, got {len(data)}.")
                
    except Exception as e:
        print(f"EXCEPTION: {e}")

if __name__ == "__main__":
    test_aggregation(7)
    test_aggregation(30)
    test_aggregation(90)
    test_aggregation(365)
