import sys
import os
sys.path.append(os.getcwd())
from app.database import SessionLocal
from app.models import Campaign, Email
from sqlalchemy import text

db = SessionLocal()
try:
    print("Syncing DB statuses to Uppercase...")
    db.execute(text("UPDATE campaigns SET status = UPPER(status) WHERE status IS NOT NULL"))
    db.execute(text("UPDATE emails SET status = UPPER(status) WHERE status IS NOT NULL"))
    db.commit()
    print("DB Sync Success")
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
