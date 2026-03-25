import os
import sys
import traceback
from typing import List, Optional
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from mangum import Mangum

# Ensure backend folder is in path for imports
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

# --- Fallback Schema Definitions ---
class FallbackCampaignCreate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    recipients: Optional[List[EmailStr]] = None

# --- Initial Import Logic ---
db_available = False
SessionLocal = None
engine = None
services = None
CampaignCreate = FallbackCampaignCreate 

try:
    from backend.app.database import SessionLocal, engine
    from backend.app import services
    from backend.app.schemas import CampaignCreate
    db_available = True
    print("IMPORT_SUCCESS: Backend services loaded.")
except Exception as e:
    print(f"IMPORT_ERROR: {str(e)}")
    print(traceback.format_exc())
    db_available = False

app = FastAPI(title="Email Automation API", docs_url=None, redoc_url=None)

# --- Health & Heartbeat (High Priority) ---

@app.get("/api/health")
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "email-automation-api", "db": db_available}

@app.get("/api/test")
async def test_endpoint():
    return {
        "status": "ok",
        "message": "Production-Ready Diagnostic API is LIVE",
        "db": db_available,
        "sys_path": sys.path[-3:],
        "error": "None" if db_available else "Import stage failed (see logs)"
    }

# --- Automatic DB Migration ---
def run_migrations():
    if not db_available or engine is None:
        return
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS company TEXT;"))
            conn.execute(text("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company TEXT;"))
            conn.commit()
            print("MIGRATION_SUCCESS: Columns verified.")
    except Exception as e:
        print(f"MIGRATION_ERROR: {str(e)}")

if db_available:
    run_migrations()

# --- Middleware for Logging ---
@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"API HIT: {request.url.path} | Method: {request.method}")
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        tb = traceback.format_exc()
        print(f"CRASH_IN_{request.url.path}: {str(e)}")
        print(tb)
        return JSONResponse(
            status_code=200, 
            content={
                "error": str(e),
                "traceback": tb,
                "success": False,
                "note": "Fail-safe recovery triggered"
            }
        )

# --- Main API Routes ---

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    if not db_available: return {"total_emails_sent": 0, "open_rate": 0, "note": "DB Offline"}
    db = SessionLocal()
    try:
        return services.get_dashboard_stats(db)
    finally:
        db.close()

@app.get("/api/dashboard/email-stats")
async def get_email_stats(days: int = 7):
    if not db_available: return {"emails_over_time": [], "note": "DB Offline"}
    db = SessionLocal()
    try:
        return services.get_email_stats_chart(db, days=days)
    finally:
        db.close()

@app.get("/api/dashboard/recent-events")
async def get_recent_events():
    if not db_available: return []
    db = SessionLocal()
    try:
        return services.recent_events(db)
    finally:
        db.close()

@app.get("/api/campaigns")
async def get_campaigns():
    if not db_available: return {"success": True, "data": []}
    db = SessionLocal()
    try:
        return {"success": True, "data": services.get_campaigns(db) or []}
    finally:
        db.close()

@app.post("/api/campaigns")
async def create_campaign(campaign: CampaignCreate):
    if not db_available: return {"success": False, "error": "Database unavailable"}
    db = SessionLocal()
    try:
        class MockBG:
            def add_task(self, f, *args, **kwargs): f(*args, **kwargs)
        return services.create_campaign(db, campaign, MockBG())
    finally:
        db.close()

# --- Vercel Entry Point ---
handler = Mangum(app)
