from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import traceback
import os
from .database import engine, Base
from .routes import router

# Selective DB init (lazy)
def init_db():
    try:
        print(f"DATABASE_INIT: Initializing DB...")
        if engine:
            Base.metadata.create_all(bind=engine)
            print("DATABASE_INIT: Success.")
        else:
            print("DATABASE_INIT: Skipped (No Engine)")
    except Exception as e:
        print(f"DATABASE_INIT_ERROR: {str(e)}")

app = FastAPI(title="Email Tracking API")

@app.on_event("startup")
async def startup_event():
    print("SERVER_STARTUP: Initializing services...")
    # Only run in non-serverless or as a lazy background task
    try:
        init_db()
    except Exception as e:
        print(f"STARTUP_ERROR (init_db): {str(e)}")
    
    # PRO GRADE: Start background scheduler for campaigns
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.interval import IntervalTrigger
    from .database import SessionLocal
    from . import services
    
    # Initialize scheduler
    scheduler = BackgroundScheduler()
    scheduler.start()

    def cron_check_campaigns():
        db = SessionLocal()
        try:
            # Check for due campaigns every minute
            services.check_due_campaigns(db)
        except Exception as e:
            print(f"SCHEDULER_ERROR: {str(e)}")
        finally:
            db.close()

    # Add the job to the scheduler
    scheduler.add_job(
        cron_check_campaigns,
        trigger=IntervalTrigger(minutes=1),
        id='check_due_campaigns',
        name='Check for due email campaigns every minute',
        replace_existing=True
    )
    print("SCHEDULER_START: Background campaign scheduler is running (interval: 1m)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["*"]  # Relaxed for Vercel/Production flexibility
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("GLOBAL EXCEPTION CAUGHT:")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": traceback.format_exc()},
    )

@app.get("/api/test")
def test_api():
    print("API HIT: /api/test")
    return {
        "status": "ok",
        "message": "Vercel function is active",
        "framework": "FastAPI",
        "database_configured": bool(os.getenv("DATABASE_URL") or os.getenv("DATABASE_URL_NEW"))
    }

@app.get("/health")
def health_check():
    print("API HIT: /health")
    from datetime import datetime, timezone
    return {
        "status": "ok", 
        "service": "email-automation-api",
        "timestamp": str(datetime.now(timezone.utc)),
        "version": "2.0.2",
        "db_connected": engine is not None
    }

@app.get("/")
def read_root():
    print("API HIT: /")
    return {"status": "ok", "service": "email-automation-api", "vercel": True}

app.include_router(router)

print("APP_INIT: FastAPI application initialized successfully.")
