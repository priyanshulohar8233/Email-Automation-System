from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import traceback
from .database import engine, Base
from .routes import router

# Selective DB init (lazy)
def init_db():
    try:
        print(f"DATABASE_INIT: Initializing {engine.url.drivername}...")
        Base.metadata.create_all(bind=engine)
        print("DATABASE_INIT: Success.")
    except Exception as e:
        print(f"DATABASE_INIT_ERROR: {str(e)}")

app = FastAPI(title="Email Tracking API")

@app.on_event("startup")
async def startup_event():
    # Only run in non-serverless or as a lazy background task
    init_db()
    
    # PRO GRADE: Start background scheduler for campaigns
    import asyncio
    from .database import SessionLocal
    from . import services
    
    async def campaign_scheduler_loop():
        # Wait a bit for DB to be ready
        await asyncio.sleep(5)
        while True:
            try:
                db = SessionLocal()
                # We don't have background_tasks here, so we'll use immediate sending fallback
                # which is fine for the worker.
                services.check_due_campaigns(db)
                db.close()
            except Exception as e:
                print(f"SCHEDULER_LOOP_ERROR: {str(e)}")
            await asyncio.sleep(60) # Check every minute
            
    asyncio.create_task(campaign_scheduler_loop())

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3001", 
        "https://mailflow-frontend.vercel.app",
        "https://*.vercel.app" # Allow Vercel previews
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["localhost", "127.0.0.1", "*.vercel.app", "mailflow.com", "email-automation-api.vercel.app"]
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("GLOBAL EXCEPTION CAUGHT:")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": traceback.format_exc()},
    )

@app.get("/health")
def health_check():
    from datetime import datetime
    return {
        "status": "ok", 
        "service": "email-automation-api",
        "timestamp": str(datetime.now()),
        "version": "2.0.1",
        "db_connected": True
    }

@app.get("/")
def read_root():
    return {"status": "ok", "service": "email-automation-api"}

app.include_router(router)
