import sys
import os
sys.path.append(os.getcwd())

from app.database import SessionLocal
from app.models import Email, Campaign, EmailStatus, CampaignStatus
from datetime import datetime, timedelta
from sqlalchemy import func

db = SessionLocal()
now = datetime.utcnow()
days = 30
last_month = now - timedelta(days=days)

print(f"Checking for emails sent after: {last_month}")

# 1. Direct count
count_all = db.query(func.count(Email.id)).scalar()
print(f"Total emails in DB: {count_all}")

# 2. Count with filter
total_attempted = db.query(func.count(Email.id)).filter(
    Email.sent_at >= last_month,
    Email.sent_at < now
).scalar() or 0
print(f"Total attempted in range: {total_attempted}")

# 3. List some sent_at values
emails = db.query(Email.id, Email.sent_at).limit(5).all()
for e in emails:
    print(f"Email ID {e.id}, sent_at: {e.sent_at}, type: {type(e.sent_at)}")

# 4. Check campaign status
ac = db.query(func.count(Campaign.id)).filter(
    Campaign.status == CampaignStatus.RUNNING
).scalar() or 0
print(f"Active campaigns (RUNNING): {ac}")

# 5. Check if some emails match the status used in compute_stats
delivered = db.query(func.count(Email.id)).filter(
    Email.status.in_([EmailStatus.SENT, EmailStatus.DELIVERED])
).scalar() or 0
print(f"Delivered emails total: {delivered}")

db.close()
