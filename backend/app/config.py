import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str = "redis://redis:6379/0"
    SMTP_HOST: str
    SMTP_PORT: int = 587
    SMTP_USER: str
    SMTP_PASS: str
    # For tracking links
    BASE_URL: str = "http://localhost"
    OPENAI_API_KEY: str | None = None

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")


settings = Settings()
