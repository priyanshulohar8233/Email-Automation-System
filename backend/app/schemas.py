from pydantic import BaseModel, EmailStr, AnyHttpUrl
from typing import List, Optional


class CampaignRequest(BaseModel):
    campaign_id: Optional[int] = None
    subject: str
    body: str
    recipients: List[EmailStr]
    scheduled_at: Optional[str] = None
    attachments: Optional[List[str]] = None

class CampaignCreate(BaseModel):
    name: str
    subject: Optional[str] = None
    body: Optional[str] = None

class AIGenerateRequest(BaseModel):
    topic: str
    tone: str
class DashboardStats(BaseModel):
    totalEmails: int
    openRate: float
    clickRate: float
    bounceRate: float
    unread: float
    activeCampaigns: int
    
    totalEmailsGrowth: Optional[float] = 0.0
    openRateGrowth: Optional[float] = 0.0
    clickRateGrowth: Optional[float] = 0.0
    bounceRateGrowth: Optional[float] = 0.0
    unreadGrowth: Optional[float] = 0.0
    activeCampaignsGrowth: Optional[float] = 0.0

class DayStat(BaseModel):
    day: str
    emails: int

class CampaignResponse(BaseModel):
    id: str
    name: str
    status: str
    sent: int
    delivered: int
    failed: int
    opens: str
    unread: str
    bounce: str
    scheduled: str

class ContactResponse(BaseModel):
    id: str
    name: str
    email: str
    company: str
    industry: str
    tags: List[str]
    score: int
    status: str
    lastOpen: str

class ContactCreate(BaseModel):
    name: str
    email: EmailStr
    company: Optional[str] = None
    industry: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = "active"

class BulkContactsRequest(BaseModel):
    contacts: List[ContactCreate]

class SettingsResponse(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password: str
    sendgrid_api_key: Optional[str] = None
    base_url: Optional[str] = "http://localhost:8000"
    webhook_url: Optional[str]
    monthly_limit: Optional[int] = 500000
    monthly_sent: Optional[int] = 0

class SettingsUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    sendgrid_api_key: Optional[str] = None
    base_url: Optional[str] = None
    webhook_url: Optional[str] = None
    monthly_limit: Optional[int] = None

class TemplateCreate(BaseModel):
    name: str
    content: str
    
class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    
class TemplateResponse(BaseModel):
    id: int
    name: str
    content: str
    created_at: str
    updated_at: str

class TestEmailRequest(BaseModel):
    subject: str
    body: str
    recipient: EmailStr
    attachments: Optional[List[str]] = None
