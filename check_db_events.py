import sqlite3

def check_db():
    conn = sqlite3.connect("backend/emaildb.sqlite")
    cursor = conn.cursor()
    
    print("--- Emails ---")
    cursor.execute("SELECT id, recipient_email, status FROM emails")
    for row in cursor.fetchall():
        print(row)
        
    print("\n--- Email Events ---")
    cursor.execute("SELECT id, email_id, event_type, timestamp FROM email_events")
    for row in cursor.fetchall():
        print(row)
        
    print("\n--- Campaign Stats ---")
    cursor.execute("SELECT id, name, opens_count, delivered_count FROM campaigns")
    for row in cursor.fetchall():
        print(row)

    conn.close()

if __name__ == "__main__":
    check_db()
