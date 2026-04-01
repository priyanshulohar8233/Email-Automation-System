import os
import pathlib

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# Force-load .env before anything else so DATABASE_URL_NEW is always set.
_env_file = pathlib.Path(__file__).parent.parent / ".env"
if _env_file.exists():
    from dotenv import load_dotenv

    load_dotenv(dotenv_path=str(_env_file), override=True)
    print(f"DATABASE_ENV_LOADED: {_env_file}")
else:
    print(f"DATABASE_ENV_MISSING: {_env_file}")

from .config import settings

Base = declarative_base()


def _normalize_db_url(raw_url: str) -> str:
    db_url = (raw_url or "").strip().strip('"').strip("'")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    if db_url.startswith("postgresql://") and "sslmode" not in db_url:
        separator = "&" if "?" in db_url else "?"
        db_url += f"{separator}sslmode=require"
    return db_url


def _sqlite_url(path_obj: pathlib.Path) -> str:
    return f"sqlite:///{path_obj.as_posix()}"


def _candidate_database_urls() -> list[tuple[str, str]]:
    backend_root = pathlib.Path(__file__).resolve().parent.parent
    candidates: list[tuple[str, str]] = []

    primary_url = _normalize_db_url(settings.DATABASE_URL_NEW or os.getenv("DATABASE_URL_NEW", ""))
    if primary_url:
        candidates.append(("DATABASE_URL_NEW", primary_url))

    legacy_url = _normalize_db_url(os.getenv("DATABASE_URL", ""))
    if legacy_url and legacy_url != primary_url:
        candidates.append(("DATABASE_URL", legacy_url))

    sqlite_candidates = [
        backend_root / "fixed_app.db",
        backend_root / "sql_app.db",
        backend_root / "email_automation.db",
    ]
    for sqlite_path in sqlite_candidates:
        if sqlite_path.exists():
            sqlite_url = _sqlite_url(sqlite_path)
            candidates.append((sqlite_path.name, sqlite_url))

    # Final safety net so the app never boots with an unbound session.
    fallback_path = backend_root / "email_automation.db"
    if not fallback_path.exists():
        fallback_path.touch()
    fallback_url = _sqlite_url(fallback_path)
    if fallback_url not in {url for _, url in candidates}:
        candidates.append((fallback_path.name, fallback_url))

    return candidates


def _create_verified_engine(db_url: str):
    connect_args = {}
    if db_url.startswith("sqlite:///"):
        connect_args["check_same_thread"] = False

    candidate_engine = create_engine(
        db_url,
        pool_pre_ping=True,
        connect_args=connect_args,
    )

    # Verify immediately so we never keep an unusable bind around.
    with candidate_engine.connect() as conn:
        conn.execute(text("SELECT 1"))

    return candidate_engine


engine = None
ACTIVE_DATABASE_LABEL = "unconfigured"
ACTIVE_DATABASE_URL = ""
database_errors: list[str] = []

for label, candidate_url in _candidate_database_urls():
    try:
        print(f"DATABASE_CONNECT_ATTEMPT: {label} -> {candidate_url[:32]}...")
        engine = _create_verified_engine(candidate_url)
        ACTIVE_DATABASE_LABEL = label
        ACTIVE_DATABASE_URL = candidate_url
        print(f"DATABASE_CONNECT_SUCCESS: {label}")
        break
    except Exception as exc:
        msg = f"{label}: {exc}"
        database_errors.append(msg)
        print(f"DATABASE_CONNECT_FAILED: {msg}")

if engine is None:
    raise RuntimeError(
        "Unable to initialize any database engine. Attempts: "
        + " | ".join(database_errors)
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    if engine is None:
        raise RuntimeError(
            "Database engine is not initialized. Startup should fail before requests are served."
        )

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
