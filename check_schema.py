import sqlite3
import os

db_path = 'backend/emaildb.sqlite'

def check_table(conn, table_name):
    print(f"START_TABLE:{table_name}")
    c = conn.cursor()
    c.execute(f"PRAGMA table_info({table_name})")
    columns = c.fetchall()
    for col in columns:
        print(f"COL:{col[1]}:{col[2]}")
    print(f"END_TABLE:{table_name}")

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    tables = ['campaigns', 'emails', 'email_events', 'contacts', 'settings', 'templates']
    for t in tables:
        try:
            check_table(conn, t)
        except Exception as e:
            print(f"Error checking {t}: {e}")
    conn.close()
else:
    print(f"DB not found at {db_path}")
