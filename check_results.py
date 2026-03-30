from backend.app.database import SessionLocal
from backend.app.services import get_emails_per_company
import json

def check_results():
    db = SessionLocal()
    try:
        for d in [1, 7, 30, 90]:
            print(f"--- Days: {d} ---")
            res = get_emails_per_company(db, days=d)
            print(json.dumps(res, indent=2))
    finally:
        db.close()

if __name__ == "__main__":
    check_results()
