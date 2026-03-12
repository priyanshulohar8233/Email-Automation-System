from app.database import SessionLocal
from app.models import Settings
import os

db = SessionLocal()
try:
    s = db.query(Settings).first()
    if not s:
        s = Settings()
        db.add(s)
    
    # Force update from .env or provided values
    s.smtp_host = "smtp.gmail.com"
    s.smtp_port = 587
    s.smtp_username = "priyanshulohar18@gmail.com"
    s.smtp_password = "elazmzhquwtjkeiv"
    
    db.commit()
    print("Database settings updated to Gmail SMTP.")
finally:
    db.close()
