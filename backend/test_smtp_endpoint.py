import requests
import json

BASE_URL = "http://localhost:8000" # Assuming backend is on 8000

try:
    print("Triggering SMTP test...")
    response = requests.post(f"{BASE_URL}/api/settings/test-smtp")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
