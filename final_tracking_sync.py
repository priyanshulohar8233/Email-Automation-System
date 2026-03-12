import sqlite3
import os
from datetime import datetime

DB_PATH = "backend/emaildb.sqlite"

def cleanup_db():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Cleaning up email_events...")
    # 1. Normalize Event Types to UPPERCASE
    cursor.execute("UPDATE email_events SET event_type = UPPER(event_type)")
    
    # 2. Normalize Email Table Status to UPPERCASE
    print("Cleaning up emails...")
    cursor.execute("UPDATE emails SET status = UPPER(status)")

    # 3. Check for invalid email_id in email_events (events without an email)
    cursor.execute("SELECT id, email_id FROM email_events WHERE email_id NOT IN (SELECT id FROM emails)")
    orphans = cursor.fetchall()
    if orphans:
        print(f"Found {len(orphans)} orphaned events (no matching email_id). Deleting...")
        for o_id, _ in orphans:
            cursor.execute("DELETE FROM email_events WHERE id=?", (o_id,))

    # 4. Sync Campaign Stats based on cleaned events
    print("Syncing Campaign metrics...")
    # Reset counts
    cursor.execute("UPDATE campaigns SET opens_count = 0, delivered_count = 0, sent_count = 0, unread_count = 0")
    
    # Recalculate from emails
    cursor.execute("""
        UPDATE campaigns 
        SET sent_count = (SELECT COUNT(*) FROM emails WHERE campaign_id = campaigns.id AND status IN ('SENT', 'DELIVERED', 'OPENED', 'CLICKED')),
            delivered_count = (SELECT COUNT(*) FROM emails WHERE campaign_id = campaigns.id AND status IN ('DELIVERED', 'OPENED', 'CLICKED')),
            opens_count = (SELECT COUNT(DISTINCT email_id) FROM email_events JOIN emails ON email_events.email_id = emails.id WHERE emails.campaign_id = campaigns.id AND email_events.event_type = 'OPENED')
    """)
    
    # Update unread_count (delivered - opened)
    cursor.execute("UPDATE campaigns SET unread_count = delivered_count - opens_count")

    conn.commit()
    conn.close()
    print("Cleanup and Sync complete.")

if __name__ == "__main__":
    cleanup_db()
