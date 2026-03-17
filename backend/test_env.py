import os
from pydantic_settings import BaseSettings
from pydantic import AnyUrl

class Settings(BaseSettings):
    OPENAI_API_KEY: str | None = None
    DATABASE_URL_NEW: str = os.getenv("DATABASE_URL_NEW", "")
    REDIS_URL: str = "redis://localhost:6379/0"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 587
    SMTP_USER: str = "user"
    SMTP_PASS: str = "pass"
    BASE_URL: str = "http://localhost"

    class Config:
        env_file = ".env"

settings = Settings()
print(f"Key loaded: {settings.OPENAI_API_KEY is not None}")
if settings.OPENAI_API_KEY:
    print(f"Key length: {len(settings.OPENAI_API_KEY)}")
    print(f"Key starts with: {settings.OPENAI_API_KEY[:7]}")
