import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session
from urllib.parse import unquote

from .database import get_db
from . import services
from .schemas import CampaignRequest, SettingsUpdate, CampaignCreate, TemplateCreate, TemplateUpdate, AIGenerateRequest, TestEmailRequest
from .models import Email, EmailStatus, EventType
from .config import settings
from .tasks import send_email_task, send_email_fn
from . import debug

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
    
    # Check if a campaign with this ID is already RUNNING
    if camp.status == CampaignStatus.RUNNING:
        return {"status": "error", "message": "Campaign is already running"}

    records = []
    for addr in req.recipients:
        e = Email(campaign_id=req.campaign_id, recipient_email=addr, status=EmailStatus.PENDING)
        db.add(e)
        records.append(e)
    
    # Update campaign status based on scheduling
    if eta and eta > datetime.utcnow():
        camp.status = CampaignStatus.QUEUED
        camp.scheduled_for = eta.isoformat()
    else:
        camp.status = CampaignStatus.RUNNING
    
    db.commit()
    
    # Trigger tasks
    # ALWAYS use BackgroundTasks for immediate sending to avoid worker dependency and ensure robustness.
    # Use Celery ONLY for scheduled tasks (eta) if Redis is configured.
    can_use_celery = bool(settings.REDIS_URL and "redis" in settings.REDIS_URL) and not os.getenv("VERCEL")
    
    for e in records:
        if eta and can_use_celery:
            # Scheduled tasks require Celery
            send_email_task.apply_async(args=[e.id, req.subject, req.body, req.attachments], eta=eta)
        elif can_use_celery:
            # SaaS Grade: Immediate sends use the optimized raw Redis queue with our custom worker
            # Priority logic: Campaigns use 'marketing' queue by default
            services.push_to_email_queue(e.id, req.subject, req.body, req.attachments, queue="marketing")
        else:
            # Immediate sends use background_tasks (native to FastAPI/Uvicorn)
            background_tasks.add_task(send_email_fn, e.id, req.subject, req.body, req.attachments)
            
    return {"queued": len(records), "scheduled": bool(eta), "status": camp.status.value, "mode": "custom_redis" if (not eta and can_use_celery) else ("celery" if (eta and can_use_celery) else "background_tasks")}

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
        s = Settings(
            smtp_host="smtp.gmail.com", 
            smtp_port=587, 
            monthly_limit=1000000,
            base_url=(f"https://{os.getenv('VERCEL_URL')}" if os.getenv("VERCEL_URL") else "http://localhost:8000")
        )
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
    if req.sendgrid_api_key:
        s.sendgrid_api_key = req.sendgrid_api_key
    if req.email_provider:
        s.email_provider = req.email_provider
    if req.from_email:
        s.from_email = req.from_email
    if req.base_url:
        s.base_url = req.base_url
    s.monthly_limit = req.monthly_limit
    db.commit()
    return s

@router.post("/settings/test-smtp")
def test_smtp(db: Session = Depends(get_db)):
    from .models import Settings
    s = db.query(Settings).first()
    if not s or not s.smtp_host or not s.smtp_username:
        raise HTTPException(status_code=400, detail="SMTP settings not configured")
    
    try:
        from .services import send_mail
        # Try sending a test email to the user themselves
        send_mail(
            to_addr=s.smtp_username,
            subject="Test Email from MailFlow",
            body_html="<h1>Success!</h1><p>Your SMTP connection is working correctly.</p>",
            smtp_host=s.smtp_host,
            smtp_port=s.smtp_port,
            smtp_user=s.smtp_username,
            smtp_pass=s.smtp_password
        )
        return {"status": "success", "message": "Test email sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SMTP Error: {str(e)}")

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

@router.get("/analytics/system-health")
def get_system_health(db: Session = Depends(get_db)):
    return services.get_system_health(db)

@router.get("/dashboard/stats")
async def dashboard_stats(days: int = 30):
    try:
        # Step 5: Real database aggregations
        data = services.get_dashboard_stats(days)
        return data
    except Exception as e:
        return {"error": str(e)}

@router.get("/dashboard/email-stats")
def get_email_stats(days: int = 7, db: Session = Depends(get_db)):
    # Step 6: Daily chart data
    return services.emails_over_time(db, days)

@router.get("/dashboard/recent-events")
def get_recent_events(days: int = 30, campaign: str = "all", db: Session = Depends(get_db)):
    return services.recent_events(db, days, campaign_name=campaign)

@router.get("/t/o/{email_id}")
def tracking_pixel(email_id: int, request: Request, db: Session = Depends(get_db)):
    services.log_event(db, email_id, EventType.OPENED, ip=request.client.host, ua=request.headers.get("user-agent"))
    # Return 1x1 transparent pixel
    import base64
    pixel = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
    return Response(content=pixel, media_type="image/gif")

@router.get("/t/c/{email_id}")
def tracking_click(email_id: int, url: str, request: Request, db: Session = Depends(get_db)):
    from urllib.parse import unquote
    services.log_event(db, email_id, EventType.CLICKED, ip=request.client.host, ua=request.headers.get("user-agent"), url=url)
    return RedirectResponse(url=unquote(url))

@router.get("/analytics/links")
def get_link_performance(campaign: str = "all", db: Session = Depends(get_db)):
    return services.get_link_performance(db, campaign)

@router.post("/settings/test-sendgrid")
def test_sendgrid(db: Session = Depends(get_db)):
    from .models import Settings as DBSettings
    from .sendgrid_bridge import send_email_sendgrid
    s = db.query(DBSettings).first()
    if not s or not s.sendgrid_api_key:
        raise HTTPException(status_code=400, detail="SendGrid API Key not configured")
    
    res = send_email_sendgrid(
        api_key=s.sendgrid_api_key,
        from_email=s.from_email or s.smtp_username or "noreply@mailflow.com",
        to_email=s.from_email or s.smtp_username or "admin@mailflow.com",
        subject="SendGrid Connection Test",
        html_content="<h1>Connection Successful!</h1><p>Your SendGrid REST API bridge is now operational.</p>"
    )
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("error"))
    return {"status": "success"}

@router.post("/webhook/sendgrid")
def sendgrid_webhook(payload: List[dict], db: Session = Depends(get_db)):
    return services.process_sendgrid_webhook(db, payload)

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

@router.put("/templates/{id}")
def update_template(id: int, req: TemplateUpdate, db: Session = Depends(get_db)):
    try:
        return services.update_template(db, id, name=req.name, content=req.content)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/templates/{id}")
def delete_template(id: int, db: Session = Depends(get_db)):
    try:
        return services.delete_template(db, id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/templates/generate-blocks")
def generate_template_blocks(req: AIGenerateRequest):
    try:
        return services.generate_block_template(req.topic, req.tone)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

    SegmentResponse, 
    TestEmailRequest,
    AutomationCreate,
    AutomationResponse
)

@router.post("/ai/chat")
def ai_chat(req: AIChatRequest):
    try:
        response = services.process_ai_chat(req.message, req.history)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/contacts/import")
def import_contacts(req: BulkContactsRequest, db: Session = Depends(get_db)):
    return services.create_contacts(db, req.contacts)

@router.get("/contacts/{id}/profile", response_model=ContactProfileResponse)
def get_contact_profile(id: int, db: Session = Depends(get_db)):
    profile = services.get_contact_profile(db, id)
    if not profile:
        raise HTTPException(status_code=404, detail="Contact not found")
    return profile

@router.put("/contacts/{id}/tags")
def update_contact_tags(id: int, tags: List[str], db: Session = Depends(get_db)):
    return services.update_contact_tags(db, id, tags)

@router.get("/segments", response_model=List[SegmentResponse])
def get_segments(db: Session = Depends(get_db)):
    return services.get_segments(db)

@router.post("/segments", response_model=SegmentResponse)
def create_segment(req: SegmentCreate, db: Session = Depends(get_db)):
    return services.create_segment(db, req)

@router.delete("/segments/{id}")
def delete_segment(id: int, db: Session = Depends(get_db)):
    return services.delete_segment(db, id)

@router.get("/contacts/export")
def export_contacts(db: Session = Depends(get_db)):
    contacts = services.get_contacts(db)
    import csv
    import io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "Email", "Company", "Industry", "Status", "Score"])
    for c in contacts:
        writer.writerow([c["name"], c["email"], c["company"], c["industry"], c["status"], c["score"]])
    
    from fastapi.responses import StreamingResponse
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts_export.csv"}
    )

@router.post("/templates/test-send")
def test_send_template(req: TestEmailRequest, db: Session = Depends(get_db)):
    from .models import Settings
    s = db.query(Settings).first()
    if not s:
        raise HTTPException(status_code=400, detail="SMTP settings not configured")
        
    try:
        from .services import send_mail
        send_mail(
            to_addr=req.recipient,
            subject=req.subject,
            body_html=req.body,
            smtp_host=s.smtp_host,
            smtp_port=s.smtp_port,
            smtp_user=s.smtp_user,
            smtp_pass=s.smtp_pass,
            attachments=req.attachments
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/suppressions")
def get_suppressions(db: Session = Depends(get_db)):
    return services.get_suppressions(db)

@router.delete("/suppressions/{id}")
def delete_suppression(id: int, db: Session = Depends(get_db)):
    if services.delete_suppression(db, id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Suppression not found")

@router.post("/suppressions/manual")
def add_manual_suppression(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    reason = payload.get("reason", "MANUAL")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    from .models import SuppressionReason
    try:
        r_enum = SuppressionReason[reason.upper()]
    except:
        r_enum = SuppressionReason.MANUAL
        
    services.add_to_suppression(db, email, r_enum)
    return {"status": "success"}

@router.get("/automations", response_model=List[AutomationResponse])
def get_automations(db: Session = Depends(get_db)):
    return services.get_automations(db)

@router.post("/automations", response_model=AutomationResponse)
def create_automation(req: AutomationCreate, db: Session = Depends(get_db)):
    return services.create_automation(db, req)

@router.put("/automations/{id}", response_model=AutomationResponse)
def update_automation(id: int, req: AutomationCreate, db: Session = Depends(get_db)):
    try:
        return services.update_automation(db, id, req)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/automations/{id}")
def delete_automation(id: int, db: Session = Depends(get_db)):
    if services.delete_automation(db, id):
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Automation not found")
