import sqlite3
import os

DB_PATH = "backend/emaildb.sqlite"

def inspect_raw():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("\n--- Raw Email Records (Top 5 Sent) ---")
    cursor.execute("SELECT id, status, sent_at FROM emails WHERE status='SENT' OR status='DELIVERED' ORDER BY sent_at DESC LIMIT 5")
    for row in cursor.fetchall():
        print(f"ID: {row[0]}, Status: {row[1]}, SentAt: {row[2]} (Type: {type(row[2])})")

    print("\n--- Raw Event Records (Top 5) ---")
    cursor.execute("SELECT id, email_id, event_type, timestamp FROM email_events ORDER BY timestamp DESC LIMIT 5")
    for row in cursor.fetchall():
        print(f"ID: {row[0]}, EmailID: {row[1]}, Type: {row[2]}, TS: {row[3]} (Type: {type(row[3])})")

    print("\n--- Campaign Stats ---")
    cursor.execute("SELECT id, name, sent_count, delivered_count, opens_count FROM campaigns")
    for row in cursor.fetchall():
        print(row)

    conn.close()

if __name__ == "__main__":
    inspect_raw()
