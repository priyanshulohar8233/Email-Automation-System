import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL_NEW")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL_NEW not set")
    exit(1)

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("Checking campaigns table schema...")
    
    # Add company column if missing
    try:
        conn.execute(text("ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS company VARCHAR(255)"))
        print("Success: company column added or already exists.")
    except Exception as e:
        print(f"Error adding company column: {e}")

    # Alter scheduled_for type to TIMESTAMPTZ
    try:
        # We use USING clause to convert existing strings if any (though there shouldn't be much)
        conn.execute(text("ALTER TABLE campaigns ALTER COLUMN scheduled_for TYPE TIMESTAMPTZ USING scheduled_for::TIMESTAMPTZ"))
        print("Success: scheduled_for altered to TIMESTAMPTZ.")
    except Exception as e:
        print(f"Error altering scheduled_for: {e}")
        
    # Ensure other columns are TIMESTAMPTZ
    time_columns = ["created_at", "completed_at"]
    for col in time_columns:
        try:
            conn.execute(text(f"ALTER TABLE campaigns ALTER COLUMN {col} TYPE TIMESTAMPTZ"))
            print(f"Success: {col} altered to TIMESTAMPTZ.")
        except Exception as e:
            print(f"Error altering {col}: {e}")

    conn.commit()
    print("Database schema fix completed.")
