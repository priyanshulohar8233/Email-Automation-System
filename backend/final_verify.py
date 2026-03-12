import requests
import sqlite3
import time

BASE_URL = "http://localhost:8000"

def get_db_counts():
    conn = sqlite3.connect('emaildb.sqlite')
    c = conn.cursor()
    c.execute("SELECT opens_count FROM campaigns WHERE id=1")
    opens = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM email_events WHERE event_type='OPENED'")
    ev_count = c.fetchone()[0]
    conn.close()
    return opens, ev_count

print("Step 1: Checking AI Template Generation...")
res_ai = requests.post(f"{BASE_URL}/api/templates/generate", json={"topic": "Test Campaign", "tone": "VP Level"})
print("AI Status:", res_ai.status_code)
if res_ai.status_code == 200:
    print("AI Response Keys:", res_ai.json().keys())
else:
    print("AI ERROR:", res_ai.text)

init_opens, init_ev = get_db_counts()
print(f"\nStep 2: Simulating tracking. Initial Opens: {init_opens}, Events: {init_ev}")

print("Simulating Open for Email 1...")
r_open = requests.get(f"{BASE_URL}/api/track/open/1")
print("Open response:", r_open.status_code)

time.sleep(1)
final_opens, final_ev = get_db_counts()
print(f"Final Opens: {final_opens}, Events: {final_ev}")

if final_ev > init_ev:
    print("\nSUCCESS: Tracking event recorded correctly!")
else:
    print("\nFAILURE: Tracking event NOT recorded.")

print("\nStep 3: Verifying Analytics API...")
res_an = requests.get(f"{BASE_URL}/api/analytics")
print("Analytics Status:", res_an.status_code)
if res_an.status_code == 200:
    print("Analytics Data Received: Delivered emails =", res_an.json().get('deliveredEmails'))
else:
    print("Analytics ERROR:", res_an.text)
