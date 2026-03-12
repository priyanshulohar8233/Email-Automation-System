import sqlite3
import os

DB_PATH = "emaildb.sqlite"

def update_db():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Updating email_events table...")
    cursor.execute("UPDATE email_events SET event_type = UPPER(event_type)")
    print(f"Rows affected: {cursor.rowcount}")

    print("Updating emails table...")
    cursor.execute("UPDATE emails SET status = UPPER(status)")
    print(f"Rows affected: {cursor.rowcount}")

    conn.commit()
    conn.close()
    print("Cleanup complete.")

if __name__ == "__main__":
    update_db()
