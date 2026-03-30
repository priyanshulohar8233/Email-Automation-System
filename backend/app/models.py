import enum
import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, func, Boolean
from sqlalchemy.orm import relationship
from .database import Base


class CampaignStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_ERRORS = "COMPLETED_WITH_ERRORS"
    FAILED = "FAILED"

class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    company = Column(String, nullable=True) # A Making Company, MP Consultant LLC, MP Lumina
    subject = Column(String, nullable=True)
    body = Column(String, nullable=True)
    status = Column(Enum(CampaignStatus), default=CampaignStatus.DRAFT)
    sent_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    opens_count = Column(Integer, default=0)
    unread_count = Column(Integer, default=0)
    bounce_count = Column(Integer, default=0)
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    is_processing = Column(Boolean, default=False)

class EmailStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    BOUNCED = "BOUNCED"
    SPAM = "SPAM"
    DROPPED = "DROPPED"

class BounceType(str, enum.Enum):
    HARD = "HARD"
    SOFT = "SOFT"
    UNKNOWN = "UNKNOWN"

class SuppressionReason(str, enum.Enum):
    BOUNCE = "BOUNCE"
    SPAM = "SPAM"
    UNSUBSCRIBE = "UNSUBSCRIBE"
    MANUAL = "MANUAL"


class Email(Base):
    __tablename__ = "emails"
    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), index=True, nullable=True)
    recipient_email = Column(String, index=True, nullable=False)
    status = Column(Enum(EmailStatus), default=EmailStatus.PENDING)
    subject = Column(String, nullable=True)
    body = Column(String, nullable=True)
    failure_reason = Column(String, nullable=True)
    bounce_reason = Column(String, nullable=True)
    bounce_type = Column(Enum(BounceType), nullable=True)
    delivery_status = Column(String, nullable=True) # e.g., "delivered", "processed", "deferred"
    sent_at = Column(DateTime(timezone=True), default=func.now(), index=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    clicked_at = Column(DateTime(timezone=True), nullable=True)

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
    email_id = Column(Integer, ForeignKey("emails.id"), nullable=False, index=True)
    event_type = Column(Enum(EventType), nullable=False, index=True)
    
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
    
    timestamp = Column(DateTime(timezone=True), default=func.now(), index=True)

    email = relationship("Email", back_populates="events")

class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

class Segment(Base):
    __tablename__ = "segments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    criteria = Column(String, default="{}") # JSON criteria for filtering contacts
    created_at = Column(DateTime(timezone=True), default=func.now())

class Suppression(Base):
    __tablename__ = "suppressions"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    reason = Column(Enum(SuppressionReason), nullable=False)
    metadata_raw = Column(String, nullable=True) # JSON details (e.g., SMTP code)
    created_at = Column(DateTime(timezone=True), default=func.now())

class Contact(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    company = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    score = Column(Integer, default=0)
    status = Column(String, default="active", index=True) # active, unsubscribed, bounced
    tags_raw = Column(String, default="") # Store as comma separated string for simplicity
    
    # Marketing metrics
    total_opens = Column(Integer, default=0)
    total_clicks = Column(Integer, default=0)
    engagement_score = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

class Settings(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    smtp_host = Column(String, default="smtp.mailflow.com")
    smtp_port = Column(Integer, default=587)
    smtp_username = Column(String, default="admin@mailflow.com")
    smtp_password = Column(String, default="")
    sendgrid_api_key = Column(String, nullable=True)
    email_provider = Column(String, default="SMTP") # SMTP or SENDGRID
    from_email = Column(String, default="noreply@mailflow.com")
    base_url = Column(String, default="http://localhost:8000")
    webhook_url = Column(String, nullable=True)
    monthly_limit = Column(Integer, default=500000)

class Template(Base):
    __tablename__ = "templates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="Untitled Template")
    content = Column(String, default="[]") # JSON string of blocks
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

class AutomationTrigger(str, enum.Enum):
    WELCOME = "WELCOME" # Subscriber joins list
    OPENED = "OPENED" # Opens specific email
    CLICKED = "CLICKED" # Clicks specific link
    TAG_ADDED = "TAG_ADDED" # Tag added to contact

class Automation(Base):
    __tablename__ = "automations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="Untitled Automation")
    status = Column(String, default="draft") # draft, active, paused
    trigger_type = Column(Enum(AutomationTrigger), default=AutomationTrigger.WELCOME)
    trigger_config = Column(String, default="{}") # JSON config for trigger
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    steps = relationship("AutomationStep", back_populates="automation", cascade="all, delete-orphan", order_by="AutomationStep.position.asc()")

class AutomationStep(Base):
    __tablename__ = "automation_steps"
    id = Column(Integer, primary_key=True, index=True)
    automation_id = Column(Integer, ForeignKey("automations.id"), nullable=False, index=True)
    type = Column(String, nullable=False) # email, delay, condition
    config = Column(String, default="{}") # JSON config for step
    position = Column(Integer, default=0)

    automation = relationship("Automation", back_populates="steps")

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, index=True)
    email_id = Column(Integer, nullable=True, index=True)       # Link to emails table
    campaign_id = Column(Integer, nullable=True, index=True)    # Link to campaigns table
    recipient_email = Column(String)
    recipient_name = Column(String, nullable=True)              # Extracted name
    sender = Column(String)
    company = Column(String)
    status = Column(String)                                     # Current/latest status
    status_history = Column(String, default="[]")              # JSON: ["SENT","DELIVERED",...]
    country = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=func.now())  # Latest event time
