import sqlite3
import os

db_path = 'backend/emaildb.sqlite'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    # try root
    db_path = 'emaildb.sqlite'

if os.path.exists(db_path):
    print(f"Checking database: {db_path}")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    try:
        c.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = c.fetchall()
        for t in tables:
            table_name = t[0]
            c.execute(f"SELECT count(*) FROM {table_name}")
            count = c.fetchone()[0]
            print(f"{table_name}: {count} rows")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
else:
    print("Database file still not found.")
