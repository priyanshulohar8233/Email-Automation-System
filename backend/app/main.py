from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import traceback
from .database import engine, Base
from .routes import router

# create tables with safety
try:
    print(f"DATABASE_INIT: Connecting to {engine.url.drivername}...")
    Base.metadata.create_all(bind=engine)
    print("DATABASE_INIT: Success.")
except Exception as e:
    print(f"DATABASE_INIT_ERROR: {str(e)}")
    # We don't crash here; we let the app start so the global exception handler 
    # can report the error to the UI for easier debugging.
    pass

app = FastAPI(title="Email Tracking API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
