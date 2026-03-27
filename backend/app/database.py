from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import settings

from sqlalchemy.pool import StaticPool

# Strict connection for Neon PostgreSQL
db_url = settings.DATABASE_URL_NEW

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

# SaaS Grade: Redis Client for Serverless Scheduling
import redis
from . import debug
try:
    if settings.REDIS_URL:
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    else:
        debug.debug_log("REDIS_URL not found in settings")
        redis_client = None
except Exception as e:
    debug.debug_log(f"REDIS_CONNECTION_ERROR: {e}")
    redis_client = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
