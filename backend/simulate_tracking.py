import requests
import sqlite3
import time

BASE_URL = "http://localhost:8000"

def check_db():
    conn = sqlite3.connect('emaildb.sqlite')
    c = conn.cursor()
    c.execute("SELECT id, opens_count, unread_count FROM campaigns WHERE id=1")
    camp = c.fetchone()
    c.execute("SELECT COUNT(*) FROM email_events WHERE email_id=1 AND event_type='opened'")
    opens = c.fetchone()[0]
    conn.close()
    return camp, opens

print("Initial State:", check_db())

# Track Open
print("Simulating Open...")
r1 = requests.get(f"{BASE_URL}/api/track/open/1")
print("Open Status:", r1.status_code)

# Track Click
print("Simulating Click...")
r2 = requests.get(f"{BASE_URL}/api/track/click/1", params={"url": "https://google.com"}, allow_redirects=False)
print("Click Status:", r2.status_code, "Redirect to:", r2.headers.get("Location"))

time.sleep(1)
print("Final State:", check_db())
