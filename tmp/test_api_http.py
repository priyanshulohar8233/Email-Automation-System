import requests
import json

def test_endpoints():
    base_url = "http://localhost:3001/api"
    endpoints = [
        "/dashboard/stats?days=30",
        "/activity",
        "/campaign-status"
    ]
    
    for ep in endpoints:
        url = base_url + ep
        print(f"\n--- Testing: {url} ---")
        try:
            resp = requests.get(url, timeout=5)
            print(f"Status: {resp.status_code}")
            try:
                print(f"Body: {json.dumps(resp.json(), indent=2)}")
            except:
                print(f"Raw Body: {resp.text}")
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    test_endpoints()
