import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_endpoint(path, name):
    print(f"\n--- Testing {name} ({path}) ---")
    try:
        response = requests.get(f"{BASE_URL}{path}")
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print(f"Success: Returned a list with {len(data)} items.")
                if len(data) > 0:
                    print(f"First item keys: {list(data[0].keys())}")
                    # Specific check for recent-events
                    if "recent-events" in path:
                        keys = data[0].keys()
                        if "email_id" in keys and "recipient" in keys and "event_type" in keys:
                            print("✅ Data structure matches frontend expectations.")
                        else:
                            print("❌ Data structure MISMATCH!")
                            print(f"Actual keys: {list(keys)}")
            else:
                print(f"Success: Returned an object.")
                print(f"Keys: {list(data.keys())}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Exception: {str(e)}")

test_endpoint("/dashboard/recent-events", "Recent Events")
test_endpoint("/dashboard/stats", "Dashboard Stats")

    # 3. Test Analytics
print("\n--- Testing Analytics (/api/analytics) ---")
try:
    resp = requests.get(f"{BASE_URL}/analytics")
    data = resp.json()
    required_keys = ['deliveredEmails', 'openRate', 'clickRate', 'performanceData', 'deviceData', 'locationsData']
    if all(k in data for k in required_keys):
        print("✅ Analytics data structure matches frontend expectations.")
        print(f"   Sample: Delivered={data['deliveredEmails']}, OpenRate={data['openRate']}%, ClickRate={data['clickRate']}%")
        print(f"   PerformancePoints: {len(data['performanceData'])}")
    else:
        missing = [k for k in required_keys if k not in data]
        print(f"❌ Missing keys in Analytics: {missing}")
except Exception as e:
    print(f"❌ Analytics Test Failed: {e}")
