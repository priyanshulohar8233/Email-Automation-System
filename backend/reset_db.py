import sys
import os
# Add current directory to path for imports
sys.path.append(os.getcwd())

from app.database import engine, Base
# Import models to ensure they are registered with Base
from app.models import Settings, Campaign, Email, Contact, Template, EmailEvent

print("Dropping all tables...")
Base.metadata.drop_all(bind=engine)
print("Creating all tables...")
Base.metadata.create_all(bind=engine)
print("Database reset successfully.")
