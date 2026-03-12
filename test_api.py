import urllib.request
import json

endpoints = [
    "/api/dashboard/stats?days=30",
    "/api/dashboard/email-stats?days=30",
    "/api/dashboard/recent-events?days=30",
    "/api/analytics",
    "/api/campaigns",
    "/api/contacts"
]

base_url = "http://localhost:8000"

for path in endpoints:
    url = base_url + path
    print(f"\n--- Testing {url} ---")
    try:
        with urllib.request.urlopen(url) as response:
            status = response.getcode()
            print(f"Status Code: {status}")
            data = json.loads(response.read().decode())
            print(json.dumps(data, indent=2))
    except urllib.error.HTTPError as e:
        print(f"Status Code: {e.code}")
        print("Response Content:")
        try:
            error_content = e.read().decode()
            print(json.dumps(json.loads(error_content), indent=2))
        except:
            print(e.reason)
    except Exception as e:
        print(f"Request failed: {e}")
