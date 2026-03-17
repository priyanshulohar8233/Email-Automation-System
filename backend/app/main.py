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
    # On Vercel, everything is transient, so we call it once.
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3001", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://veltrion-frontend.vercel.app",
        "https://veltrion.vercel.app",
        "https://veltrion-git-main-priyanshulohar8233s-projects.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["localhost", "127.0.0.1", "*.vercel.app", "veltrion.com", "*.veltrion.com"]
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("GLOBAL EXCEPTION CAUGHT:")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": traceback.format_exc()},
    )

@app.get("/")
def read_root():
    return {"status": "ok", "service": "email-automation-api"}

app.include_router(router)
