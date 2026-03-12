import os
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session
from urllib.parse import unquote

from .database import get_db
from . import services
from .schemas import CampaignRequest, SettingsUpdate, CampaignCreate, TemplateCreate, TemplateUpdate, AIGenerateRequest
from .models import Email, EmailStatus, EventType
from .config import settings
from .debug import debug_log
from .tasks import send_email_task

router = APIRouter(prefix="/api")

@router.get("/health")
def health_check():
    from datetime import datetime
    return {"status": "ok", "timestamp": str(datetime.now())}

@router.post("/send-campaign")
def send_campaign(req: CampaignRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    from datetime import datetime
    eta = None
    if req.scheduled_at:
        try:
            # First attempt: ISO format
            eta = datetime.fromisoformat(req.scheduled_at.replace("Z", "+00:00"))
        except:
            # Fallback for other formats
            try:
                eta = datetime.strptime(req.scheduled_at, "%Y-%m-%dT%H:%M:%S.%f")
            except:
                pass

    from .models import Campaign, CampaignStatus
    camp = db.query(Campaign).get(req.campaign_id)
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")

    records = []
    for addr in req.recipients:
        e = Email(campaign_id=req.campaign_id, recipient_email=addr, status=EmailStatus.PENDING)
        db.add(e)
        records.append(e)
    
    # Update campaign status based on scheduling
    if eta and eta > datetime.utcnow():
        camp.status = CampaignStatus.QUEUED
        camp.scheduled_for = eta.isoformat()
        debug_log(f"CAMPAIGN_SCHEDULED: ID {camp.id} set to QUEUED for {eta}")
    else:
        camp.status = CampaignStatus.RUNNING
        debug_log(f"CAMPAIGN_STARTED: ID {camp.id} set to RUNNING")
    
    db.commit()
    
    # Trigger tasks
    # Fallback for Vercel: Use BackgroundTasks if no Redis/Celery is configured
    is_serverless = os.getenv("VERCEL") == "1" or not os.getenv("REDIS_URL")
    
    for e in records:
        if is_serverless:
            # Native FastAPI Background Task (Serverless friendly)
            from .tasks import send_email_fn
            background_tasks.add_task(send_email_fn, e.id, req.subject, req.body, req.attachments)
        else:
            # Standard Celery
            if eta:
                send_email_task.apply_async(args=[e.id, req.subject, req.body, req.attachments], eta=eta)
            else:
                send_email_task.delay(e.id, req.subject, req.body, req.attachments)
            
    return {"queued": len(records), "scheduled": bool(eta), "status": camp.status.value, "mode": "serverless" if is_serverless else "celery"}

@router.get("/campaigns")
def get_campaigns(search: str | None = None, status: str | None = None, db: Session = Depends(get_db)):
    return services.get_campaigns(db, search=search, status=status)

@router.post("/campaigns")
def create_campaign(req: CampaignCreate, db: Session = Depends(get_db)):
    return services.create_campaign(db, req)

@router.put("/campaigns/{id}")
def update_campaign(id: int, req: CampaignCreate, db: Session = Depends(get_db)):
    return services.update_campaign(db, id, req)

@router.delete("/campaigns/{id}")
def delete_campaign(id: int, db: Session = Depends(get_db)):
    return services.delete_campaign(db, id)

@router.post("/campaigns/{id}/toggle")
def toggle_campaign(id: int, db: Session = Depends(get_db)):
    from .models import Campaign, CampaignStatus
    camp = db.query(Campaign).get(id)
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if camp.status == CampaignStatus.RUNNING:
        camp.status = CampaignStatus.QUEUED
    elif camp.status in [CampaignStatus.QUEUED, CampaignStatus.DRAFT]:
        camp.status = CampaignStatus.RUNNING
    
    db.commit()
    db.refresh(camp)
    return {"id": camp.id, "status": camp.status.value}

@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    from .models import Settings
    s = db.query(Settings).first()
    if not s:
        s = Settings(smtp_host="smtp.gmail.com", smtp_port=587, monthly_limit=1000000)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s

@router.put("/settings")
def update_settings(req: SettingsUpdate, db: Session = Depends(get_db)):
    from .models import Settings
    s = db.query(Settings).first()
    if not s:
        s = Settings()
        db.add(s)
    s.smtp_host = req.smtp_host
    s.smtp_port = req.smtp_port
    s.smtp_user = req.smtp_user
    if req.smtp_pass:
        s.smtp_pass = req.smtp_pass
    s.monthly_limit = req.monthly_limit
    db.commit()
    return s

@router.get("/analytics")
def get_campaign_analytics(campaign: str = "all", days: int = 30, db: Session = Depends(get_db)):
    return services.get_analytics(db, campaign_name=campaign, days=days)

@router.get("/campaigns/names")
def list_campaign_names(db: Session = Depends(get_db)):
    from .models import Campaign
    results = db.query(Campaign.name).distinct().all()
    return [r[0] for r in results]

@router.get("/analytics/realtime")
def get_realtime_analytics(campaign: str = "all", limit: int = 10, db: Session = Depends(get_db)):
    return services.recent_events(db, days=30, limit=limit, campaign_name=campaign)

@router.get("/dashboard/stats")
def get_dashboard_stats(days: int = 30, db: Session = Depends(get_db)):
    return services.compute_stats(db, days)

@router.get("/dashboard/email-stats")
def get_email_stats(days: int = 30, db: Session = Depends(get_db)):
    return services.emails_over_time(db, days)

@router.get("/dashboard/recent-events")
def get_recent_events(days: int = 30, campaign: str = "all", db: Session = Depends(get_db)):
    return services.recent_events(db, days, campaign_name=campaign)

@router.get("/track/open/{email_id}")
def track_open(email_id: int, request: Request, db: Session = Depends(get_db)):
    services.log_event(db, email_id, EventType.OPENED, ip=request.client.host, ua=request.headers.get("user-agent"))
    # Return 1x1 transparent pixel
    import base64
    pixel = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
    return Response(content=pixel, media_type="image/gif")

@router.get("/track/click/{email_id}")
def track_click(email_id: int, url: str, request: Request, db: Session = Depends(get_db)):
    from urllib.parse import unquote
    services.log_event(db, email_id, EventType.CLICKED, ip=request.client.host, ua=request.headers.get("user-agent"), url=url)
    return RedirectResponse(url=unquote(url))

@router.get("/analytics/links")
def get_link_performance(campaign: str = "all", db: Session = Depends(get_db)):
    return services.get_link_performance(db, campaign)

@router.post("/webhook/email-events")
def email_events_webhook(payload: dict, db: Session = Depends(get_db)):
    return services.process_webhook_event(db, payload)

@router.get("/templates")
def get_templates(db: Session = Depends(get_db)):
    from .models import Template
    return db.query(Template).all()

@router.post("/templates")
def create_template(req: TemplateCreate, db: Session = Depends(get_db)):
    from .models import Template
    t = Template(name=req.name, content=req.content)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t

@router.get("/contacts/unsubscribe")
def unsubscribe(email: str, db: Session = Depends(get_db)):
    from .models import Contact
    c = db.query(Contact).filter(Contact.email == email).first()
    if c:
        c.status = "unsubscribed"
        db.commit()
    return {"message": "Unsubscribed successfully"}

@router.post("/templates/generate")
def generate_template(req: AIGenerateRequest):
    try:
        result = services.generate_ai_template(req.topic, req.tone)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/contacts")
def get_contacts(search: str | None = None, db: Session = Depends(get_db)):
    return services.get_contacts(db, search=search)

@router.get("/dashboard/recent-events")
def get_recent_events_alias(days: int = 30, db: Session = Depends(get_db)):
    return services.recent_events(db, days=days, limit=100)
