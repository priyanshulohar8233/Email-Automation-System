from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
import os, pathlib

# SaaS Grade: Force-load .env for Serverless Environment
_env_file = pathlib.Path(__file__).parent.parent / ".env"
if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=str(_env_file), override=True)

import pytz
IST = pytz.timezone('Asia/Kolkata')

from .config import settings

# Strict connection for Neon PostgreSQL
db_url = settings.DATABASE_URL_NEW or os.getenv("DATABASE_URL_NEW", "")

# Diagnostic Trace (Safe for Logs)
if not db_url:
    print("CRITICAL: DATABASE_URL_NEW is missing!")
else:
    print(f"DEBUG: Initializing DB: {db_url[:15]}...")

if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Ensure SSL is required for Neon (Vercel standard)
if db_url and "sslmode" not in db_url:
    separator = "&" if "?" in db_url else "?"
    db_url += f"{separator}sslmode=require"

try:
    if db_url:
        # StaticPool is recommended for some serverless setups to prevent connection drift
        # pool_pre_ping ensures the connection is alive before use
        engine = create_engine(
            db_url, 
            poolclass=StaticPool,
            connect_args={"check_same_thread": False} if "sqlite" in db_url else {},
            pool_pre_ping=True
        )
    else:
        engine = None
except Exception as e:
    print(f"ENGINE_INIT_FAILURE: {str(e)}")
    engine = None

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Fail-safe DB generator for FastAPI dependency injection."""
    if not engine:
        print("DATABASE_ERROR: Engine not initialized. Check environment variables.")
        return
    
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        print(f"SESSION_ERROR: {str(e)}")
        # Optional: rollback on error
        db.rollback()
        raise
    finally:
        db.close()
