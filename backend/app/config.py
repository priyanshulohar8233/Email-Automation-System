import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Force SQLite for local dev to bypass Prisma limit
    @property
    def DATABASE_URL(self) -> str:
        return "sqlite:///d:/Email-Automation-System_2.0/backend/fixed_app.db"
    
    # Other settings
    REDIS_URL: str = os.getenv("REDIS_URL") or os.getenv("KV_URL") or "redis://redis:6379/0"
    
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.example.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", "")
    
    # For tracking links
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost")
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        extra = "allow"

settings = Settings()
