import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Mandatory fields for Pydantic v2 validation
    DATABASE_URL_NEW: str = os.getenv("DATABASE_URL_NEW", "")
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
        env_file = ".env"

settings = Settings()

# Debugging moved OUTSIDE the class to avoid Pydantic v2 errors
if not settings.DATABASE_URL_NEW:
    print("CRITICAL: DATABASE_URL_NEW is NOT set!")
else:
    print(f"DATABASE_CONNECTION: Using DATABASE_URL_NEW ({settings.DATABASE_URL_NEW[:15]}...)")
