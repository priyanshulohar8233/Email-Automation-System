import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Vercel Postgres provides POSTGRES_URL by default
    DATABASE_URL: str = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL") or "sqlite:///./sql_app.db"
    
    # Vercel Redis (KV) provides KV_URL
    REDIS_URL: str = os.getenv("REDIS_URL") or os.getenv("KV_URL") or "redis://redis:6379/0"
    
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.example.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", "")
    
    # For tracking links
    # For tracking links
    BASE_URL: str = os.getenv("BASE_URL") or (f"https://{os.getenv('VERCEL_URL')}" if os.getenv("VERCEL_URL") else "http://localhost:8000")
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        extra = "allow"


settings = Settings()
