import os
import sys
import json

# Script intended to be run from 'backend' directory
sys.path.append(os.getcwd())

from app.database import SessionLocal
from app.services import compute_stats

db = SessionLocal()
try:
    stats = compute_stats(db, days=30)
    print(json.dumps(stats, indent=2))
finally:
    db.close()
