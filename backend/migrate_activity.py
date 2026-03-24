"""One-time migration: add new columns to activity_logs table."""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL_NEW")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL_NEW not set"); exit(1)

engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    migrations = [
        "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS email_id INTEGER",
        "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS campaign_id INTEGER",
        "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255)",
        "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS status_history TEXT DEFAULT '[]'",
        "CREATE INDEX IF NOT EXISTS idx_activity_email_id ON activity_logs(email_id)",
        "CREATE INDEX IF NOT EXISTS idx_activity_campaign ON activity_logs(campaign_id)",
    ]
    for sql in migrations:
        try:
            conn.execute(text(sql))
            print(f"OK: {sql[:60]}")
        except Exception as e:
            print(f"SKIP/ERR: {e}")
    conn.commit()
    print("Migration complete.")
