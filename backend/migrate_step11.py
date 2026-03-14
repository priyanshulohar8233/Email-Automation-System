from app.database import engine, Base
from app.models import Segment, Contact
from sqlalchemy import text

def migrate():
    print("Starting migration for Step 11...")
    
    # 1. Create new tables (Segments)
    Base.metadata.create_all(bind=engine)
    print("Created new tables (if any).")
    
    # 2. Add new columns to existing tables (Contacts)
    with engine.connect() as conn:
        try:
            # Check if columns already exist
            existing_columns = conn.execute(text("PRAGMA table_info(contacts)")).fetchall()
            col_names = [col[1] for col in existing_columns]
            
            if "total_opens" not in col_names:
                conn.execute(text("ALTER TABLE contacts ADD COLUMN total_opens INTEGER DEFAULT 0"))
                print("Added total_opens to contacts.")
            
            if "total_clicks" not in col_names:
                conn.execute(text("ALTER TABLE contacts ADD COLUMN total_clicks INTEGER DEFAULT 0"))
                print("Added total_clicks to contacts.")
                
            if "engagement_score" not in col_names:
                conn.execute(text("ALTER TABLE contacts ADD COLUMN engagement_score INTEGER DEFAULT 0"))
                print("Added engagement_score to contacts.")
            
            if "created_at" not in col_names:
                conn.execute(text("ALTER TABLE contacts ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
                print("Added created_at to contacts.")

            if "updated_at" not in col_names:
                conn.execute(text("ALTER TABLE contacts ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
                print("Added updated_at to contacts.")
                
            conn.commit()
            print("Migration successful.")
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
