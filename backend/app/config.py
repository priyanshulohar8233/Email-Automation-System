import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Mandatory fields for Pydantic v2 validation
    DATABASE_URL_NEW: str = os.getenv("DATABASE_URL_NEW", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", "")
    SENDGRID_API_KEY: str = os.getenv("SENDGRID_API_KEY", "")
    
    # Optional fields
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    SENDGRID_VERIFIED_SENDER: str = os.getenv("SENDGRID_VERIFIED_SENDER", "")

    class Config:
        case_sensitive = True
        extra = "allow"
        _env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        env_file = _env_path

settings = Settings()

# Debugging moved OUTSIDE the class to avoid Pydantic v2 errors
if not settings.DATABASE_URL_NEW and not settings.DATABASE_URL:
    print("CRITICAL: Neither DATABASE_URL_NEW nor DATABASE_URL is set!")
else:
    active_url = settings.DATABASE_URL_NEW or settings.DATABASE_URL
    print(f"DATABASE_CONNECTION: Using {('DATABASE_URL_NEW' if settings.DATABASE_URL_NEW else 'DATABASE_URL')} ({active_url[:15]}...)")
