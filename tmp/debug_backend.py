import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.database import SessionLocal, engine
from app import services
from app import models

def diag():
    db = SessionLocal()
    try:
        print("DIAG: Attempting to call get_analytics...")
        # This mirrors the call in routes.py @router.get("/analytics")
        res = services.get_analytics(db, campaign_name="all", days=30)
        print("DIAG: Success!")
        print(f"DIAG: Result keys: {res.keys()}")
    except Exception as e:
        print("DIAG: FAILED!")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    diag()
