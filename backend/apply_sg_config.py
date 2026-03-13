from app.database import SessionLocal, engine, Base
from app.models import Settings
import time

def update_config():
    # Ensure tables are created in the new SQLite DB
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    max_retries = 5
    for attempt in range(max_retries):
        try:
            s = db.query(Settings).first()
            if not s:
                s = Settings()
                db.add(s)
            
            s.email_provider = "SENDGRID"
            s.sendgrid_api_key = "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"
            s.from_email = "priyanshulohar18@gmail.com"
            s.smtp_username = "priyanshulohar18@gmail.com"
            s.smtp_password = "elazmzhquwtjkeiv"
            
            db.commit()
            print("Successfully updated Settings to SendGrid.")
            return
        except Exception as e:
            print(f"Attempt {attempt+1} failed: {e}")
            db.rollback()
            time.sleep(2)
    db.close()

if __name__ == "__main__":
    update_config()
