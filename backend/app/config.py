import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Support both DATABASE_URL (Standard) and DATABASE_URL_NEW (Custom)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    DATABASE_URL_NEW: str = os.getenv("DATABASE_URL_NEW", "")
    
    # Priority Logic: Use DATABASE_URL if available, then DATABASE_URL_NEW
    EFFECTIVE_DB_URL: str = DATABASE_URL or DATABASE_URL_NEW
    
    # Debug logging to verify env at runtime
    if not EFFECTIVE_DB_URL:
        print("CRITICAL: Neither DATABASE_URL nor DATABASE_URL_NEW is set in environment!")
    else:
        source = "DATABASE_URL" if DATABASE_URL else "DATABASE_URL_NEW"
        print(f"DATABASE_CONNECTION: Found {source} ({EFFECTIVE_DB_URL[:15]}...)")
    
    # Redis for background tasks
    REDIS_URL: str = os.getenv("REDIS_URL") or ""
    
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.example.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", "")
    
    # For tracking links
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost")
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")
    SENDGRID_API_KEY: str | None = os.getenv("SENDGRID_API_KEY")
    if SENDGRID_API_KEY:
        print(f"SENDGRID: API KEY found ({SENDGRID_API_KEY[:8]}...)")
    else:
        print("SENDGRID: API KEY NOT FOUND")
    SENDGRID_VERIFIED_SENDER: str | None = os.getenv("SENDGRID_VERIFIED_SENDER")

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        extra = "allow"


settings = Settings()
