import enum
import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import relationship
from .database import Base


class CampaignStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"

class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    subject = Column(String, nullable=True)
    body = Column(String, nullable=True)
    status = Column(Enum(CampaignStatus), default=CampaignStatus.DRAFT)
    sent_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    opens_count = Column(Integer, default=0)
    unread_count = Column(Integer, default=0)
    bounce_count = Column(Integer, default=0)
    scheduled_for = Column(String, nullable=True) # or DateTime
    created_at = Column(DateTime, default=func.now())

class EmailStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    BOUNCED = "BOUNCED"
    SPAM = "SPAM"
    DROPPED = "DROPPED"


class Email(Base):
    __tablename__ = "emails"
    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), index=True, nullable=True)
    recipient_email = Column(String, index=True, nullable=False)
    status = Column(Enum(EmailStatus), default=EmailStatus.PENDING)
    subject = Column(String, nullable=True)
    body = Column(String, nullable=True)
    failure_reason = Column(String, nullable=True)
    sent_at = Column(DateTime, default=func.now())

    events = relationship("EmailEvent", back_populates="email", order_by="EmailEvent.timestamp.asc()")


class EventType(str, enum.Enum):
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    OPENED = "OPENED"
    CLICKED = "CLICKED"
    BOUNCED = "BOUNCED"
    SPAM_REPORT = "SPAM_REPORT"
    UNSUBSCRIBED = "UNSUBSCRIBED"
    DEFERRED = "DEFERRED"
    DROPPED = "DROPPED"


class EmailEvent(Base):
    __tablename__ = "email_events"
    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(Integer, ForeignKey("emails.id"), nullable=False)
    event_type = Column(Enum(EventType), nullable=False)
    
    # Metadata for enriched tracking
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    browser = Column(String, nullable=True)
    os = Column(String, nullable=True)
    device = Column(String, nullable=True)
    country = Column(String, nullable=True)
    city = Column(String, nullable=True)
    
    # For Click tracking
    url = Column(String, nullable=True) 
    
    timestamp = Column(DateTime, default=func.now())

    email = relationship("Email", back_populates="events")

class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

class Contact(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    company = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    score = Column(Integer, default=0)
    status = Column(String, default="active") # active, unsubscribed, bounced
    last_open = Column(String, nullable=True)
    tags_raw = Column(String, default="") # Store as comma separated string for simplicity

class Settings(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    smtp_host = Column(String, default="smtp.mailflow.com")
    smtp_port = Column(Integer, default=587)
    smtp_username = Column(String, default="admin@mailflow.com")
    smtp_password = Column(String, default="")
    base_url = Column(String, default="http://localhost:8000")
    webhook_url = Column(String, nullable=True)
    monthly_limit = Column(Integer, default=500000)

class Template(Base):
    __tablename__ = "templates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="Untitled Template")
    content = Column(String, default="[]") # JSON string of blocks
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
