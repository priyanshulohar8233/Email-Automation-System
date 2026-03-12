from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import traceback
from .database import engine, Base
from .routes import router

# create tables
Base.metadata.create_all(bind=engine)

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
