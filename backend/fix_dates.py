import sqlite3
import os

DB_PATH = 'emaildb.sqlite'
if not os.path.exists(DB_PATH):
    print(f"Database {DB_PATH} not found.")
    exit(1)

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

try:
    c.execute("UPDATE emails SET sent_at = REPLACE(sent_at, ' ', 'T') WHERE sent_at LIKE '% %'")
    emails_updated = c.rowcount
    
    c.execute("UPDATE email_events SET timestamp = REPLACE(timestamp, ' ', 'T') WHERE timestamp LIKE '% %'")
    events_updated = c.rowcount
    
    conn.commit()
    print(f"Updated {emails_updated} emails and {events_updated} email_events.")
except Exception as e:
    print(f"Error: {e}")
finally:
    conn.close()
