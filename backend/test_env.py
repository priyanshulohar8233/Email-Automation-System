import os
from pydantic_settings import BaseSettings
from pydantic import AnyUrl

class Settings(BaseSettings):
    OPENAI_API_KEY: str | None = None
    DATABASE_URL: str = "sqlite:///./test.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = priyanshulohar18@gmail.com
    SMTP_PASS: str = elazmzhquwtjkeiv
    BASE_URL: str = "http://localhost"

    class Config:
        env_file = ".env"

settings = Settings()
print(f"Key loaded: {settings.OPENAI_API_KEY is not None}")
if settings.OPENAI_API_KEY:
    print(f"Key length: {len(settings.OPENAI_API_KEY)}")
    print(f"Key starts with: {settings.OPENAI_API_KEY[:7]}")
