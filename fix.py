import os

with open('backend/app/services.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

out = []
i = 0
while i < len(lines):
    if lines[i].startswith('def get_emails_per_company('):
        end_idx = i
        while end_idx < len(lines) and not lines[end_idx].startswith('MAILFLOW_META_PREFIX'):
            end_idx += 1
        
        replacement = '''def get_emails_per_company(db: Session, days: int = 30, company_name: str | list = "all"):
    from .models import Campaign, Email

    start_date, end_date = get_date_window(days)
    debug.debug_log(f"FETCHING ACTIVITY: days={days}, start={start_date}, end={end_date}, company={company_name}")
    executed_email_statuses = [
        EmailStatus.SENT,
        EmailStatus.DELIVERED,
        EmailStatus.BOUNCED,
        EmailStatus.SPAM,
        EmailStatus.DROPPED,
    ]

    query = db.query(
        Campaign.company,
        func.count(Email.id).label("total")
    ).join(Email, Campaign.id == Email.campaign_id)

    query = query.filter(Email.status.in_(executed_email_statuses))
    
    target_date = func.coalesce(Email.sent_at, Email.created_at)
    query = query.filter(
        or_(
            and_(target_date.isnot(None), target_date >= start_date, target_date < end_date),
            and_(Email.opened_at.isnot(None), Email.opened_at >= start_date, Email.opened_at < end_date),
            and_(Email.clicked_at.isnot(None), Email.clicked_at >= start_date, Email.clicked_at < end_date),
        )
    )

    if company_name != "all":
        if isinstance(company_name, list):
            query = query.filter(Campaign.company.in_(company_name))
        else:
            query = query.filter(Campaign.company == company_name)

    results = query.group_by(Campaign.company).all()
    data = [{"company": r[0], "total": int(r[1] or 0)} for r in results if r[0] and r[0].lower() != "unknown" and (r[1] or 0) > 0]

    if data:
        return data

    activity_query = db.query(
        ActivityLog.company,
        func.count(distinct(ActivityLog.email_id)).label("total")
    ).filter(
        ActivityLog.timestamp >= start_date,
        ActivityLog.status.in_(["SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED"])
    )

    if company_name != "all":
        if isinstance(company_name, list):
            activity_query = activity_query.filter(ActivityLog.company.in_(company_name))
        else:
            activity_query = activity_query.filter(ActivityLog.company == company_name)

    activity_rows = activity_query.group_by(ActivityLog.company).all()
    return [{"company": r[0], "total": int(r[1] or 0)} for r in activity_rows if r[0] and r[0].lower() != "unknown" and (r[1] or 0) > 0]


'''
        out.append(replacement)
        i = end_idx
    else:
        out.append(lines[i])
        i += 1

with open('backend/app/services.py', 'w', encoding='utf-8') as f:
    f.writelines(out)
print('Fixed get_emails_per_company')
