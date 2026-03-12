from .database import engine, Base
from .models import Settings, Campaign, Email, Contact, Template, EmailEvent

# This will drop and recreate all tables based on the current models.py
# WARNING: This will delete all existing data.
print("Dropping all tables...")
Base.metadata.drop_all(bind=engine)
print("Creating all tables...")
Base.metadata.create_all(bind=engine)
print("Database schema synchronized successfully.")
