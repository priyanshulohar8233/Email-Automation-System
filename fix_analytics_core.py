import re
import os

file_path = r'd:\Email-Automation-System_2.0\backend\app\services.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update get_link_performance to support date windows and company
old_link_perf = r'def get_link_performance\(db: Session, campaign_name: str = "all"\):'
new_link_perf = 'def get_link_performance(db: Session, campaign_name: str = "all", company_name: str | list = "all", days: int = 30):'
content = re.sub(old_link_perf, new_link_perf, content)

# Update the query inside get_link_performance
# Logic update:
link_perf_window = """
    start_date, end_date = get_date_window(days)
    q = db.query(EmailEvent.url, func.count(EmailEvent.id).label("clicks")).filter(
        EmailEvent.event_type == EventType.CLICKED,
        EmailEvent.timestamp >= start_date,
        EmailEvent.timestamp < end_date
    )
"""
content = re.sub(r'q = db\.query\(EmailEvent\.url, func\.count\(EmailEvent\.id\)\.label\("clicks"\)\)\.filter\(EmailEvent\.event_type == EventType\.CLICKED\)', link_perf_window, content)

# 2. Add Company Join to Link Performance
# Match the campaign filter and add company filter
link_perf_company = """
    if campaign_name != "all":
        q = q.join(Email).join(Campaign).filter(Campaign.name == campaign_name)
    if company_name and company_name != "all":
        companies = [company_name] if isinstance(company_name, str) else company_name
        # Fallback to join if not already joined via campaign_name logic
        if campaign_name == "all":
            q = q.join(Email).join(Campaign).filter(Campaign.company.in_(companies))
        else:
            q = q.filter(Campaign.company.in_(companies))
"""
# This needs to replace the old campaign filter block
old_link_cmp = r'if campaign_name != "all":\s+q = q\.join\(Email\)\.join\(Campaign\)\.filter\(Campaign\.name == campaign_name\)'
content = re.sub(old_link_cmp, link_perf_company, content)

# 3. FIX get_analytics IMPORTS
# Add models import inside the function
get_analytics_imports = """
def get_analytics(db: Session, campaign_name: str = "all", days: int = 30, company_name: str | list = "all"):
    \"\"\"
    Deep dive analytics synced with Dashboard math.
    \"\"\"
    from .models import EmailEvent, EventType, Email, Campaign, ActivityLog
    from datetime import datetime, timedelta, timezone
"""
content = re.sub(r'def get_analytics\(db: Session, campaign_name: str = "all", days: int = 30, company_name: str \| list = "all"\):\s+"""\s+Deep dive analytics synced with Dashboard math\.\s+"""\s+from datetime import datetime, timedelta, timezone', get_analytics_imports, content)

# 4. Sync get_analytics sub-calls to linkData
# Match the linkData call in get_analytics and add company/days
content = content.replace('"linkData": get_link_performance(db, campaign_name),',
                          '"linkData": get_link_performance(db, campaign_name, company_name=company_name, days=days),')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully applied Analytics logic fix to services.py")
