import sqlite3
import os

DB_PATH = "backend/emaildb.sqlite"

def migrate_dates():
    if not os.path.exists(DB_PATH):
        print("DB not found")
        return
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("Migrating email_events.timestamp...")
    cursor.execute("SELECT id, timestamp FROM email_events")
    for row in cursor.fetchall():
        id, ts = row
        if ts and ' ' in ts:
            new_ts = ts.replace(' ', 'T')
            cursor.execute("UPDATE email_events SET timestamp=? WHERE id=?", (new_ts, id))
            
    print("Migrating emails.sent_at...")
    cursor.execute("SELECT id, sent_at FROM emails")
    for row in cursor.fetchall():
        id, ts = row
        if ts and ' ' in ts:
            new_ts = ts.replace(' ', 'T')
            cursor.execute("UPDATE emails SET sent_at=? WHERE id=?", (new_ts, id))
            
    print("Migrating campaigns.created_at...")
    # Add if exists
    try:
        cursor.execute("SELECT id, created_at FROM campaigns")
        for row in cursor.fetchall():
            id, ts = row
            if ts and ' ' in ts:
                new_ts = ts.replace(' ', 'T')
                cursor.execute("UPDATE campaigns SET created_at=? WHERE id=?", (new_ts, id))
    except:
        pass

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate_dates()
