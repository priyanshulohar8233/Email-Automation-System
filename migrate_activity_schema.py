import os
from sqlalchemy import create_engine, text
from backend.app.database import SessionLocal

def migrate_activity_logs():
    print("🚀 Starting ActivityLog Schema Migration...")
    db_url = os.getenv("DATABASE_URL_NEW")
    if not db_url:
        # Fallback to backend/.env if not in environment
        from dotenv import load_dotenv
        load_dotenv("backend/.env")
        db_url = os.getenv("DATABASE_URL_NEW")

    if not db_url:
        print("❌ Error: DATABASE_URL_NEW is not set!")
        return

    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    
    if "sslmode" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url += f"{separator}sslmode=require"

    engine = create_engine(db_url)
    
    queries = [
        "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP WITH TIME ZONE;"
    ]

    with engine.connect() as conn:
        for q in queries:
            try:
                conn.execute(text(q))
                conn.commit()
                print(f"✅ Executed: {q}")
            except Exception as e:
                print(f"⚠️ Warning/Error on {q}: {e}")

    print("🎉 ActivityLog schema migration complete!")

if __name__ == "__main__":
    migrate_activity_logs()
