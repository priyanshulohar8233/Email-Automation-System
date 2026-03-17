from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import settings

from sqlalchemy.pool import StaticPool

# Strict connection for Neon PostgreSQL
db_url = settings.DATABASE_URL_NEW
if not db_url:
    raise ValueError("DATABASE_URL_NEW is empty. Database connection impossible.")

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Ensure SSL is required for Neon
if "sslmode" not in db_url:
    separator = "&" if "?" in db_url else "?"
    db_url += f"{separator}sslmode=require"

engine = create_engine(
    db_url, 
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
