import sqlite3
import os

db_path = 'backend/emaildb.sqlite'
if not os.path.exists(db_path):
    db_path = 'emaildb.sqlite'

def apply_final_fixes(conn):
    c = conn.cursor()
    
    # Tables to check: campaigns, emails, email_events, contacts, settings, templates
    tables_to_fix = {
        "campaigns": [
            ("delivered_count", "INTEGER DEFAULT 0"),
            ("failed_count", "INTEGER DEFAULT 0"),
            ("unread_count", "INTEGER DEFAULT 0"),
            ("bounce_count", "INTEGER DEFAULT 0"),
            ("scheduled_for", "VARCHAR")
        ],
        "emails": [
            ("subject", "VARCHAR"),
            ("failure_reason", "VARCHAR")
        ]
    }
    
    for table, cols in tables_to_fix.items():
        c.execute(f"PRAGMA table_info({table})")
        existing_cols = [col[1] for col in c.fetchall()]
        added = 0
        for col_name, col_def in cols:
            if col_name not in existing_cols:
                print(f"Adding {col_name} to {table}...")
                c.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}")
                added += 1
        if added > 0:
            conn.commit()
            print(f"Added {added} columns to {table}.")

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    try:
        apply_final_fixes(conn)
    finally:
        conn.close()
