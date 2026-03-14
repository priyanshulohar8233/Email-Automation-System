import sqlite3
import os

# Database path
db_path = os.path.join(os.path.dirname(__file__), "sql_app.db")

def migrate():
    print(f"Connecting to database at {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 1. Create suppressions table
        print("Creating 'suppressions' table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS suppressions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                reason TEXT NOT NULL,
                metadata_raw TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_suppressions_email ON suppressions (email)")

        # 2. Add bounce_type to emails table
        print("Adding 'bounce_type' to 'emails' table...")
        try:
            cursor.execute("ALTER TABLE emails ADD COLUMN bounce_type TEXT")
        except sqlite3.OperationalError:
            print("Column 'bounce_type' already exists or could not be added.")

        conn.commit()
        print("Migration Step 13 completed successfully.")
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
