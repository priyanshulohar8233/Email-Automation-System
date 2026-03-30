from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Force-load .env before anything else so DATABASE_URL_NEW is always set
import os, pathlib
_env_file = pathlib.Path(__file__).parent.parent / ".env"
if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=str(_env_file), override=True)
    print(f"DATABASE_ENV_LOADED: {_env_file}")
else:
    print(f"DATABASE_ENV_MISSING: {_env_file}")

import pytz
IST = pytz.timezone('Asia/Kolkata')

from .config import settings

from sqlalchemy.pool import StaticPool

# Strict connection for Neon PostgreSQL
db_url = settings.DATABASE_URL_NEW or os.getenv("DATABASE_URL_NEW", "")

# Diagnostic print as requested by user
if not db_url:
    print("DEBUG: DATABASE_URL_NEW is None")
else:
    print(f"DEBUG: Connecting to: {db_url[:15]}...")

if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Ensure SSL is required for Neon
if db_url and "sslmode" not in db_url:
    separator = "&" if "?" in db_url else "?"
    db_url += f"{separator}sslmode=require"

try:
    engine = create_engine(
        db_url, 
        pool_pre_ping=True
    )
except Exception as e:
    print(f"ENGINE_CREATION_ERROR: {str(e)}")
    # Fallback for serverless environments where engine might be init'd lazily
    engine = None

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
