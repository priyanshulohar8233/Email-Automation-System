import sqlite3
import os

DB_PATH = "backend/emaildb.sqlite"
OUTPUT_FILE = "tmp_tracking_report.txt"

def inspect_tracking():
    if not os.path.exists(DB_PATH):
        with open(OUTPUT_FILE, "w") as f:
            f.write(f"Error: Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    report = []

    report.append("\n--- Summary of Event Types ---")
    cursor.execute("SELECT event_type, COUNT(*) FROM email_events GROUP BY event_type")
    for row in cursor.fetchall():
        report.append(f"{row[0]}: {row[1]}")

    report.append("\n--- All Opened Events ---")
    cursor.execute("""
        SELECT e.recipient_email, ee.timestamp, ee.ip_address, ee.user_agent 
        FROM email_events ee 
        JOIN emails e ON ee.email_id = e.id 
        WHERE ee.event_type = 'OPENED'
        ORDER BY ee.timestamp DESC
    """)
    rows = cursor.fetchall()
    if not rows:
        report.append("No OPENED events found.")
    for row in rows:
        report.append(str(row))

    report.append("\n--- All Clicked Events ---")
    cursor.execute("""
        SELECT e.recipient_email, ee.timestamp, ee.ip_address, ee.url 
        FROM email_events ee 
        JOIN emails e ON ee.email_id = e.id 
        WHERE ee.event_type = 'CLICKED'
        ORDER BY ee.timestamp DESC
    """)
    rows = cursor.fetchall()
    if not rows:
        report.append("No CLICKED events found.")
    for row in rows:
        report.append(str(row))

    report.append("\n--- Campaign Stats ---")
    cursor.execute("SELECT id, name, opens_count, delivered_count, status FROM campaigns")
    for row in cursor.fetchall():
        report.append(str(row))

    with open(OUTPUT_FILE, "w") as f:
        f.write("\n".join(report))

    conn.close()

if __name__ == "__main__":
    inspect_tracking()
