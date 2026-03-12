from app.database import SessionLocal
from app.models import Email
from sqlalchemy import func

db = SessionLocal()
first_email = db.query(Email).first()
if first_email:
    print(f"First Email Sent At: {first_email.sent_at} (Type: {type(first_email.sent_at)})")
else:
    print("No emails found in database.")

# Check count with different filters
from datetime import datetime, timedelta
now = datetime.utcnow()
start = now - timedelta(days=30)
start_str_t = start.strftime('%Y-%m-%dT%H:%M:%S')
start_str_space = start.strftime('%Y-%m-%d %H:%M:%S')

count_t = db.query(Email).filter(Email.sent_at >= start_str_t).count()
count_space = db.query(Email).filter(Email.sent_at >= start_str_space).count()
count_raw = db.query(Email).filter(Email.sent_at >= start).count()

print(f"Count with 'T': {count_t}")
print(f"Count with ' ': {count_space}")
print(f"Count with datetime object: {count_raw}")

db.close()
