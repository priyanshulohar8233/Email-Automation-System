import os
import sys
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from mangum import Mangum

# Ensure backend folder is in path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = FastAPI(title="Email Automation API", docs_url=None, redoc_url=None)

# Import logic with safety
try:
    from backend.app.database import SessionLocal, engine
    from backend.app import services, models
    from backend.app.schemas import CampaignCreate
    db_available = True
    print("IMPORT_SUCCESS: Backend services loaded.")
except Exception as e:
    print(f"IMPORT_ERROR: {str(e)}")
    db_available = False

# --- Automatic DB Migration (Add company column if missing) ---
def run_migrations():
    if not db_available or not engine:
        return
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            # Check if columns exist and add if missing
            conn.execute(text("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS company TEXT;"))
            conn.execute(text("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company TEXT;"))
            conn.commit()
            print("MIGRATION_SUCCESS: Columns verified.")
    except Exception as e:
        print(f"MIGRATION_ERROR: {str(e)}")

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
            status_code=200, # Fail-safe
            content={
                "error": str(e),
                "traceback": tb,
                "success": False
            }
        )

# --- Routes ---

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    db = SessionLocal()
    try:
        return services.get_dashboard_stats(db)
    finally:
        db.close()

@app.get("/api/dashboard/email-stats")
async def get_email_stats(days: int = 7):
    db = SessionLocal()
    try:
        return services.get_email_stats_chart(db, days=days)
    finally:
        db.close()

@app.get("/api/dashboard/recent-events")
async def get_recent_events():
    db = SessionLocal()
    try:
        return services.recent_events(db)
    finally:
        db.close()

@app.get("/api/campaigns")
async def get_campaigns():
    db = SessionLocal()
    try:
        return {"success": True, "data": services.get_campaigns(db) or []}
    finally:
        db.close()

@app.post("/api/campaigns")
async def create_campaign(campaign: CampaignCreate):
    db = SessionLocal()
    try:
        class MockBG:
            def add_task(self, f, *args, **kwargs): f(*args, **kwargs)
        return services.create_campaign(db, campaign, MockBG())
    finally:
        db.close()

@app.get("/api/templates")
async def get_templates():
    db = SessionLocal()
    try:
        return {"success": True, "data": services.get_templates(db) or []}
    finally:
        db.close()

@app.get("/api/contacts")
async def get_contacts():
    db = SessionLocal()
    try:
        return {"success": True, "data": services.get_contacts(db) or []}
    finally:
        db.close()

@app.get("/api/activity")
async def get_activity(limit: int = 50):
    db = SessionLocal()
    try:
        return services.recent_events(db, limit=limit) or []
    finally:
        db.close()

@app.get("/api/campaign-status")
async def get_campaign_status():
    db = SessionLocal()
    try:
        return services.get_campaign_status_summary(db) or []
    finally:
        db.close()

@app.get("/api/test")
async def test_endpoint():
    return {
        "status": "ok",
        "message": "FastAPI + Mangum Diagnostic API is LIVE",
        "db": db_available
    }

# --- Vercel Entry Point (ASGI Mangum) ---
handler = Mangum(app)
