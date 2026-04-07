import os
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, Response
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from urllib.parse import unquote

from .database import get_db
from . import services
from .schemas import (
    CampaignRequest, SettingsUpdate, CampaignCreate, TemplateCreate, TemplateUpdate, 
    AIGenerateRequest, TestEmailRequest, DashboardStats, AutomationCreate, 
    AutomationResponse, ContactResponse, ContactCreate, BulkContactsRequest, 
    SegmentCreate, SegmentResponse, ContactProfileResponse, AIChatRequest,
    ContactCompanyUpdate, ActivityLogResponse, CampaignStatusResponse,
    GenerateBrandedEmailRequest
)
from .models import Email, EmailStatus, EventType, ActivityLog
from .config import settings
from .activity import upsert_activity_log
from . import debug

router = APIRouter(prefix="/api")

@router.get("/health")
def health_check():
    from datetime import datetime, timezone
    return {"status": "ok", "timestamp": str(datetime.now(timezone.utc))}

@router.post("/send-campaign")
def send_campaign(req: CampaignRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    return services.prepare_campaign_emails(db, req.campaign_id, req, background_tasks)

@router.get("/campaigns/check-due")
@router.post("/campaigns/check-due")
def trigger_due_campaigns(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    SaaS Grade: Redis + Vercel Cron trigger.
    Processes QUEUED campaigns that are now due using Redis ZSET.
    """
    cron_secret = os.getenv("CRON_SECRET")
    if cron_secret:
        auth_header = request.headers.get("authorization")
        if auth_header != f"Bearer {cron_secret}":
            debug.debug_log(f"CRON_AUTH_FAILED: Expected {cron_secret}, got {auth_header}")
            raise HTTPException(status_code=401, detail="Unauthorized")

    result = services.process_scheduled_queue(db, background_tasks)
    return result

@router.get("/campaigns")
def get_campaigns(search: str | None = None, status: str | None = None, db: Session = Depends(get_db)):
    try:
        data = services.get_campaigns(db, search=search, status=status)
        return {
            "success": True,
            "data": data
        }
    except Exception as e:
        debug.debug_log(f"ERROR in get_campaigns route: {str(e)}")
        return JSONResponse(
            status_code=200, # Per requirement to prevent 500
            content={
                "success": False,
                "error": str(e),
                "data": []
            }
        )

@router.post("/campaigns")
def create_campaign(req: CampaignCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. Manual validation for specific 400 error format
    if not req.name or not req.company or not req.subject or not req.body:
        return JSONResponse(
            status_code=400,
            content={"error": "Missing required fields"}
        )
    
    try:
        return services.create_campaign(db, req, background_tasks)
    except Exception as e:
        # 5 & 6. User-friendly error message, no raw SQL
        return JSONResponse(
            status_code=500,
            content={"error": "Database error while creating campaign"}
        )

@router.put("/campaigns/{id}")
def update_campaign(id: int, req: CampaignCreate, db: Session = Depends(get_db)):
    return services.update_campaign(db, id, req)

@router.delete("/campaigns/{id}")
def delete_campaign(id: int, db: Session = Depends(get_db)):
    return services.delete_campaign(db, id)

@router.post("/campaigns/{id}/toggle")
def toggle_campaign(id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    from .models import Campaign, CampaignStatus
    camp = db.query(Campaign).get(id)
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if camp.status == CampaignStatus.RUNNING:
        camp.status = CampaignStatus.QUEUED
    elif camp.status in [CampaignStatus.QUEUED, CampaignStatus.DRAFT, CampaignStatus.COMPLETED]:
        # If it was completed, setting it to Running will allow trigger_campaign_emails 
        # to find any new/resubmitted PENDING emails.
        camp.status = CampaignStatus.RUNNING
        # SaaS Grade: When resuming/starting, ensure any PENDING emails are triggered
        services.trigger_campaign_emails(db, camp.id, background_tasks)
    
    db.commit()
    db.refresh(camp)
    return {"id": camp.id, "status": camp.status.value}


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    from .models import Settings
    s = db.query(Settings).first()
    if not s:
        # Pro Grade: Auto-detect Vercel environment or fallback to localhost
        public_url = f"https://{os.getenv('VERCEL_URL')}" if os.getenv('VERCEL_URL') else "http://localhost:8000"
        s = Settings(
            smtp_host="smtp.gmail.com", 
            smtp_port=587, 
            monthly_limit=1000000,
            base_url=public_url
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
    if req.smtp_host:
        s.smtp_host = req.smtp_host
    if req.smtp_port is not None:
        s.smtp_port = req.smtp_port
    if req.smtp_username:
        s.smtp_username = req.smtp_username
    if req.smtp_password:
        s.smtp_password = req.smtp_password
    if req.sendgrid_api_key:
        s.sendgrid_api_key = req.sendgrid_api_key
    if req.email_provider:
        s.email_provider = req.email_provider
    if req.from_email:
        s.from_email = req.from_email
    if req.base_url:
        s.base_url = req.base_url
    if req.monthly_limit is not None:
        s.monthly_limit = req.monthly_limit
    db.commit()
    return s

@router.post("/settings/test-smtp")
def test_smtp(db: Session = Depends(get_db)):
    from .models import Settings
    from .config import settings as env_settings
    import traceback
    
    s = db.query(Settings).first()
    
    # 1. Prioritize DB settings, fallback to ENV
    source = "Database" if s and s.smtp_host else "Environment (.env)"
    host = (s.smtp_host if s and s.smtp_host else env_settings.SMTP_HOST)
    port = (s.smtp_port if s and s.smtp_port else env_settings.SMTP_PORT)
    user = (s.smtp_username if s and s.smtp_username else env_settings.SMTP_USER)
    pw = (s.smtp_password if s and s.smtp_password else env_settings.SMTP_PASS)
    
    if not host or not user:
        raise HTTPException(status_code=400, detail=f"SMTP settings not configured in {source}")
    
    # 2. Strict validation as requested
    if pw and " " in pw:
        debug.debug_log(f"SMTP_VALIDATION_ERROR: Password from {source} contains spaces.")
        raise HTTPException(
            status_code=400, 
            detail="SMTP Password contains spaces. Gmail 'App Passwords' must be entered WITHOUT spaces (16 characters total)."
        )

    # 3. Add defensive stripping for leading/trailing only
    user = user.strip() if user else user
    pw = pw.strip() if pw else pw
    
    debug.debug_log(f"SMTP_TEST: Using {source} credentials. Attempting {host}:{port} for {user}")
    
    try:
        from .services import send_mail
        # Try sending a test email to the user themselves
        send_mail(
            to_addr=user,
            subject="Test Email from MailFlow",
            body_html="<h1>Success!</h1><p>Your SMTP connection is working correctly.</p>",
            smtp_host=host,
            smtp_port=port,
            smtp_user=user,
            smtp_pass=pw,
            from_addr=user,
        )
        return {"status": "success", "message": f"Test email sent to {user} (Source: {source})"}
    except Exception as e:
        error_detail = str(e)
        debug.debug_log(f"SMTP_TEST_ERROR ({source}): {error_detail}")
        debug.debug_log(traceback.format_exc())
        
        # Surfacing more helpful messages specifically for 535 errors
        if "535" in error_detail or "authentication" in error_detail.lower():
            error_detail = (
                "535 Authentication Failed. Remediation Steps:\n"
                "1. Ensure '2-Step Verification' is ON in your Google Account.\n"
                "2. Use a 16-character 'App Password' generated at accounts.google.com.\n"
                "3. REMOVE ALL SPACES from the App Password.\n"
                "4. Verify SMTP_USER matches the account used to generate the password."
            )
        
        raise HTTPException(status_code=500, detail=f"SMTP Error: {error_detail}")

@router.get("/analytics")
def get_campaign_analytics(response: Response, campaign: str = "all", days: str = "30", time_range: str = "month", company: str | None = None, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    
    try:
        parsed_days = int(days) if days and str(days).isdigit() else 30
    except (ValueError, TypeError):
        parsed_days = 30
        
    range_map = {
        "week": 7,
        "month": 30,
        "quarter": 90,
        "year": 365
    }
    effective_days = range_map.get(time_range.lower(), parsed_days)
    
    try:
        company_list = company.split(",") if company and company != "all" else "all"
        debug.debug_log(f"Analytics API: campaign={campaign}, range={time_range}, days={effective_days}, company={company_list}")
        return services.get_analytics(db, campaign_name=campaign, days=effective_days, company_name=company_list)
    except Exception as e:
        debug.debug_log(f"DB ERROR in analytics: {e}")
        return {
            "deliveredEmails": 0,
            "openRate": 0,
            "clickRate": 0,
            "spamRate": 0,
            "bounceRate": 0,
            "unread": 0,
            "deliveredEmailsGrowth": 0,
            "openRateGrowth": 0,
            "clickRateGrowth": 0,
            "spamRateGrowth": 0,
            "performanceData": [],
            "deviceData": [],
            "locationsData": [],
            "linkData": [],
            "recentActivity": []
        }

@router.get("/campaigns/names")
def list_campaign_names(db: Session = Depends(get_db)):
    from .models import Campaign
    results = db.query(Campaign.name).distinct().all()
    return [r[0] for r in results]

@router.get("/companies")
def list_companies(db: Session = Depends(get_db)):
    from .models import Campaign, Contact

    companies = set()
    default_companies = {
        "A Making Company",
        "MP Consultant LLC",
        "MP Lumina",
        "Matkotech",
    }

    for (name,) in db.query(Campaign.company).distinct().all():
        if name and str(name).strip() and str(name).strip().lower() != "unknown":
            companies.add(str(name).strip())

    try:
        for (name,) in db.query(Contact.company).distinct().all():
            if name and str(name).strip() and str(name).strip().lower() != "unknown":
                companies.add(str(name).strip())
    except Exception:
        # Contact.company may not be populated in all environments; keep the
        # endpoint resilient and still return campaign-backed companies.
        pass

    companies.update(default_companies)
    return sorted(companies)

@router.get("/analytics/realtime")
def get_realtime_analytics(response: Response, campaign: str = "all", company: str | None = None, days: int = 30, limit: int = 10, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    try:
        company_list = company.split(",") if company and company != "all" else "all"
        return services.recent_events(db, days=days, limit=limit, campaign_name=campaign, company_name=company_list)
    except Exception as e:
        debug.debug_log(f"DB ERROR in realtime analytics: {e}")
        return []

@router.get("/analytics/system-health")
def get_system_health(db: Session = Depends(get_db)):
    return services.get_system_health(db)

@router.get("/analytics/emails-per-company")
def get_emails_per_company(days: int = 30, db: Session = Depends(get_db)):
    return services.get_emails_per_company(db, days)

@router.get("/campaign-status")
def campaign_status(days: int = 30, company: Optional[str] = "all", db: Session = Depends(get_db)):
    """Step 5: Safe Campaign Status API with filtering"""
    try:
        company_list = company.split(",") if company and company != "all" else "all"
        return services.get_emails_per_company(db, days, company_name=company_list)
    except Exception as e:
        debug.debug_log(f"DB ERROR in campaign-status: {e}")
        return []

@router.get("/dashboard/stats", response_model=DashboardStats)
def dashboard_stats(response: Response, background_tasks: BackgroundTasks, days: str = "30", time_range: str = "month", campaign: str = "all", company: str | None = None, db: Session = Depends(get_db)):
    # SaaS Grade: Proactive Scheduling Pulse
    background_tasks.add_task(services.scheduler_pulse)
    
    try:
        parsed_days = int(days) if days and str(days).isdigit() else 30
    except (ValueError, TypeError):
        parsed_days = 30
        
    # Range override (if range is provided, it takes precedence over days)
    range_map = {
        "week": (7, "vs last week"),
        "month": (30, "vs last month"),
        "quarter": (90, "vs last quarter"),
        "year": (365, "vs last year")
    }
    
    effective_days, vs_label = range_map.get(time_range.lower(), (parsed_days, "vs last month"))
    
    print(f"DEBUG: range={time_range}, lower={time_range.lower()}, vs_label={vs_label}")
    print(f"API HIT: /dashboard/stats (range={time_range}, days={effective_days}, campaign={campaign}, company={company})")
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    try:
        company_list = company.split(",") if company and company != "all" else "all"
        return services.compute_stats(db, effective_days, campaign_name=campaign, company_name=company_list, vs_label=vs_label)
    except Exception as e:
        print(f"CRITICAL ERROR in dashboard_stats: {str(e)}")
        import traceback
        traceback.print_exc()
        debug.debug_log(f"DB ERROR in dashboard_stats: {e}")
        return {
            "totalEmails": 0, "openRate": 0, "clickRate": 0, "bounceRate": 0, 
            "unread": 0, "activeCampaigns": 0, "totalEmailsGrowth": 0, "openRateGrowth": 0,
            "vsLabel": vs_label
        }

@router.get("/dashboard/email-stats")
def get_email_stats(response: Response, background_tasks: BackgroundTasks, days: str = "7", company: str | None = None, db: Session = Depends(get_db)):
    # SaaS Grade: Proactive Scheduling Pulse
    background_tasks.add_task(services.scheduler_pulse)

    try:
        parsed_days = int(days) if days and str(days).isdigit() else 7
    except (ValueError, TypeError):
        parsed_days = 7

    print(f"API HIT: /dashboard/email-stats (days={parsed_days}, company={company})")
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    try:
        company_list = company.split(",") if company and company != "all" else "all"
        return services.emails_over_time(db, parsed_days, company_name=company_list)
    except Exception as e:
        debug.debug_log(f"DB ERROR in email-stats: {e}")
        return {
            "emails_over_time": [],
            "campaign_status": [],
            "recent_activity": []
        }

@router.get("/dashboard/recent-events")
def get_recent_events(response: Response, days: str = "30", campaign: str = "all", company: str | None = None, db: Session = Depends(get_db)):
    try:
        parsed_days = int(days) if days and str(days).isdigit() else 30
    except (ValueError, TypeError):
        parsed_days = 30
        
    print(f"API HIT: /dashboard/recent-events (days={parsed_days}, campaign={campaign}, company={company})")
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    try:
        company_list = company.split(",") if company and company != "all" else "all"
        debug.debug_log(f"Fetching recent events: campaign={campaign}, days={parsed_days}, company={company_list}")
        return services.recent_events(db, parsed_days, campaign_name=campaign, company_name=company_list)
    except Exception as e:
        debug.debug_log(f"ERROR in get_recent_events: {str(e)}")
        import traceback
        debug.debug_log(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": "Failed to fetch recent activity", "error": str(e)}
        )

@router.get("/t/o/{email_id}")
def tracking_pixel(email_id: int, request: Request, db: Session = Depends(get_db)):
    services.log_event(db, email_id, EventType.OPENED, ip=request.client.host, ua=request.headers.get("user-agent"))
    
    # Upsert OPENED status in activity_logs with country from IP
    try:
        import requests as req_lib
        client_ip = request.client.host
        country = "Unknown"
        if client_ip and client_ip not in ("127.0.0.1", "::1", "localhost"):
            try:
                geo = req_lib.get(f"https://ipapi.co/{client_ip}/json/", timeout=2).json()
                country = geo.get("country_name") or "Unknown"
            except Exception:
                country = "Unknown"
        
        email_rec = db.query(Email).get(email_id)
        if email_rec:
            from .models import Campaign
            camp = db.query(Campaign).get(email_rec.campaign_id)
            company_name = camp.company if camp else "Unknown"
            upsert_activity_log(
                db, email_id, email_rec.campaign_id,
                email_rec.recipient_email, company_name, company_name,
                "OPENED", country
            )
            db.commit()
    except Exception as e:
        debug.debug_log(f"OPEN_TRACK_ERR: {e}")
    
    import base64
    pixel = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
    return Response(content=pixel, media_type="image/gif")

@router.get("/t/c/{email_id}")
def tracking_click(email_id: int, url: str, request: Request, db: Session = Depends(get_db)):
    from urllib.parse import unquote
    services.log_event(db, email_id, EventType.CLICKED, ip=request.client.host, ua=request.headers.get("user-agent"), url=url)
    
    # Upsert CLICKED status in activity_logs with country from IP
    try:
        import requests as req_lib
        client_ip = request.client.host
        country = "Unknown"
        if client_ip and client_ip not in ("127.0.0.1", "::1", "localhost"):
            try:
                geo = req_lib.get(f"https://ipapi.co/{client_ip}/json/", timeout=2).json()
                country = geo.get("country_name") or "Unknown"
            except Exception:
                country = "Unknown"
        
        email_rec = db.query(Email).get(email_id)
        if email_rec:
            from .models import Campaign
            camp = db.query(Campaign).get(email_rec.campaign_id)
            company_name = camp.company if camp else "Unknown"
            upsert_activity_log(
                db, email_id, email_rec.campaign_id,
                email_rec.recipient_email, company_name, company_name,
                "CLICKED", country
            )
            db.commit()
    except Exception as e:
        debug.debug_log(f"CLICK_TRACK_ERR: {e}")
    
    return RedirectResponse(url=unquote(url))

# Legacy Aliases (Compatibility for older emails)
@router.get("/track/open/{email_id}")
def legacy_tracking_pixel(email_id: int, request: Request, db: Session = Depends(get_db)):
    return tracking_pixel(email_id, request, db)

@router.get("/track/click/{email_id}")
def legacy_tracking_click(email_id: int, url: str, request: Request, db: Session = Depends(get_db)):
    return tracking_click(email_id, url, request, db)

@router.get("/analytics/links")
def get_link_performance(campaign: str = "all", db: Session = Depends(get_db)):
    return services.get_link_performance(db, campaign)

@router.post("/settings/test-sendgrid")
def test_sendgrid(db: Session = Depends(get_db)):
    from .config import settings
    from .sendgrid_bridge import send_email_sendgrid
    
    # Secure Grade: Prioritize ENV keys for testing
    api_key = settings.SENDGRID_API_KEY
    sender = settings.SENDGRID_VERIFIED_SENDER
    
    # Fallback to DB if ENV is missing (for flexibility)
    if not api_key or not sender:
        from .models import Settings as DBSettings
        s = db.query(DBSettings).first()
        if s:
            api_key = api_key or s.sendgrid_api_key
            sender = sender or s.from_email or s.smtp_username
            
    if not api_key:
        raise HTTPException(status_code=400, detail="SendGrid API Key not found in environment or database.")
    if not sender:
        raise HTTPException(status_code=400, detail="SendGrid Verified Sender not configured.")
    
    res = send_email_sendgrid(
        api_key=api_key,
        from_email=sender,
        to_email=sender, # Test send to self
        subject="SendGrid Connection Test",
        html_content="<h1>Connection Successful!</h1><p>Your SendGrid REST API bridge is now operational and verified.</p>"
    )
    
    if not res.get("success"):
        # SaaS Grade: Surface the specific SendGrid error (captured in our bridge)
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": res.get("error")}
        )
        
    return {"status": "success", "message": "Test email sent to verified sender"}

@router.post("/webhook/sendgrid")
def sendgrid_webhook_v2(payload: List[dict], db: Session = Depends(get_db)):
    return services.process_sendgrid_webhook(db, payload)

@router.post("/webhook/email-events")
def email_events_webhook(payload: dict, db: Session = Depends(get_db)):
    return services.process_webhook_event(db, payload)

@router.get("/activity")
def get_activity_log(background_tasks: BackgroundTasks, days: int = 30, company: str = "all", limit: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Consolidated Activity API with Service-layer logic.
    Supports filtering by days and company.
    """
    # SaaS Grade: Proactive Scheduling Pulse
    background_tasks.add_task(services.scheduler_pulse)
    
    try:
        company_list = company.split(",") if company and company != "all" else "all"
        return services.get_activity(db, limit=limit, days=days, company_name=company_list)
    except Exception as e:
        debug.debug_log(f"ERROR in get_activity_log route: {str(e)}")
        return []

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

@router.post("/generate-email")
def generate_branded_email_route(req: GenerateBrandedEmailRequest):
    try:
        return services.generate_branded_email(
            req.template, 
            req.description, 
            req.seniority, 
            req.image, 
            req.attachment
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
            smtp_user=s.smtp_username,
            smtp_pass=s.smtp_password,
            from_addr=(s.from_email or s.smtp_username),
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

@router.put("/contacts/company")
def update_contact_company(req: ContactCompanyUpdate, db: Session = Depends(get_db)):
    try:
        return services.update_contact_company(db, req.email, req.company)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/campaigns/history")
def get_campaigns_history(date: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Return all campaigns with aggregate activity stats.
    Filter by date if provided (YYYY-MM-DD).
    """
    from .models import Campaign, ActivityLog
    from sqlalchemy import func
    from datetime import datetime, time, timedelta

    query = db.query(Campaign)

    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
            start_dt = datetime.combine(target_date, time.min)
            end_dt = datetime.combine(target_date, time.max)
            query = query.filter(Campaign.created_at.between(start_dt, end_dt))
        except ValueError:
            pass

    campaigns = query.order_by(Campaign.created_at.desc()).all()
    
    result = []
    for c in campaigns:
        # Calculate stats from ActivityLog for this campaign
        logs = db.query(ActivityLog).filter(ActivityLog.campaign_id == c.id).all()
        
        sent = len(logs)
        delivered = sum(1 for l in logs if l.status in ("DELIVERED", "OPENED", "CLICKED"))
        opened = sum(1 for l in logs if l.status in ("OPENED", "CLICKED"))
        clicked = sum(1 for l in logs if l.status == "CLICKED")
        
        result.append({
            "id": c.id,
            "name": c.name,
            "date": c.created_at.isoformat() if c.created_at else "",
            "sent": sent,
            "delivered": delivered,
            "opened": opened,
            "clicked": clicked,
            "status": c.status.value if hasattr(c.status, 'value') else str(c.status)
        })
    
    return result

@router.get("/search/email")
def search_email_history(email: str, db: Session = Depends(get_db)):
    """
    Return full activity history for a specific email address.
    """
    import json
    from .models import ActivityLog, Campaign
    
    logs = db.query(ActivityLog).filter(
        ActivityLog.recipient_email.ilike(f"%{email}%")
    ).order_by(ActivityLog.timestamp.desc()).all()
    
    result = []
    for l in logs:
        campaign_name = "Unknown"
        if l.campaign_id:
            c = db.query(Campaign).filter(Campaign.id == l.campaign_id).first()
            if c: campaign_name = c.name
            
        try:
            history = json.loads(l.status_history or "[]")
        except:
            history = []
            
        result.append({
            "id": l.id,
            "email_id": l.email_id,
            "recipient_email": l.recipient_email,
            "recipient_name": l.recipient_name or "",
            "campaign_name": campaign_name, # Frontend expects campaign_name
            "sender": l.sender or "",
            "company": l.company or "",
            "country": l.country or "Unknown",
            "status": l.status or "SENT",
            "status_history": history, # Full detailed history with timestamps
            "timestamp": l.timestamp.isoformat() if l.timestamp else ""
        })
        
    return result

@router.get("/activity/{log_id}", response_model=ActivityLogResponse)
def get_activity_detail(log_id: int, db: Session = Depends(get_db)):
    """
    Return detailed activity log entry by ID.
    """
    import json
    from .models import ActivityLog
    log = db.query(ActivityLog).filter(ActivityLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log entry not found")
        
    try:
        history = json.loads(log.status_history or "[]")
    except:
        history = []
        
    return {
        "id": log.id,
        "email_id": log.email_id,
        "recipient_email": log.recipient_email,
        "recipient_name": log.recipient_name or "",
        "sender": log.sender or "",
        "company": log.company or "",
        "country": log.country or "Unknown",
        "status": log.status or "SENT",
        "status_history": history,
        "timestamp": log.timestamp.isoformat() if log.timestamp else ""
    }
