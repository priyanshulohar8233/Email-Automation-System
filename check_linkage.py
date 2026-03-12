import sqlite3
import os

DB_PATH = "backend/emaildb.sqlite"

def check_linkage():
    if not os.path.exists(DB_PATH):
        print("DB not found")
        return
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("--- Emails and their Campaign IDs ---")
    cursor.execute("SELECT id, recipient_email, campaign_id, status FROM emails ORDER BY id DESC LIMIT 20")
    for row in cursor.fetchall():
        print(row)
        
    print("\n--- OPENED Events ---")
    cursor.execute("SELECT id, email_id, timestamp FROM email_events WHERE event_type='OPENED'")
    events = cursor.fetchall()
    print(f"Total OPENED events: {len(events)}")
    for e in events:
        print(e)
        
    conn.close()

if __name__ == "__main__":
    check_linkage()
