import sqlite3
import os

# Database path
db_path = os.path.join(os.path.dirname(__file__), "sql_app.db")

def migrate():
    print(f"Connecting to database at {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Create indexes for EmailEvent
        print("Optimizing EmailEvent indexes...")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_email_events_email_id ON email_events (email_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_email_events_event_type ON email_events (event_type)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_email_events_timestamp ON email_events (timestamp)")

        # Create indexes for Contact
        print("Optimizing Contact indexes...")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_contacts_status ON contacts (status)")

        conn.commit()
        print("Performance indexes applied successfully.")
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
