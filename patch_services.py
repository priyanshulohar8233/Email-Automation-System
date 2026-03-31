import re
import os

file_path = r'd:\Email-Automation-System_2.0\backend\app\services.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Define the helper function
get_date_window_code = '''
def get_date_window(days: int = 30):
    """
    Returns (start_date, end_date) consistent with the Dashboard charts.
    - 7 days: Current Week (Monday 00:00:00 to Sunday 23:59:59)
    - 30 days: Current Month (1st to last day)
    - 90 days: Last 90 days from now
    - 365 days: Current Year (Jan 1st to Dec 31st)
    """
    import calendar
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    
    if days == 7:
        # Week View: Mon -> Sun of current week
        weekday = now.weekday() # 0 = Mon, 6 = Sun
        start_date = (now - timedelta(days=weekday)).replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=7)
        return start_date, end_date
        
    if days == 30:
        # Month View: Full current month
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_day = calendar.monthrange(now.year, now.month)[1]
        end_date = (start_date + timedelta(days=last_day-1)).replace(hour=23, minute=59, second=59) + timedelta(seconds=1)
        return start_date, end_date
        
    if days == 365:
        # Year View: Full current year
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date.replace(year=start_date.year + 1)
        return start_date, end_date
        
    # Quarter (90) or any other: Rolling window
    end_date = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    start_date = end_date - timedelta(days=days)
    return start_date, end_date

'''

# Insert helper before get_unified_metrics
if 'def get_date_window' not in content:
    content = content.replace('def get_unified_metrics', get_date_window_code + 'def get_unified_metrics')

# 2. Update get_unified_metrics logic
# Look for the range calculation in get_unified_metrics
unified_range_pattern = r'now = datetime\.now\(timezone\.utc\)\s+if not start_date:\s+start_date = now - timedelta\(days=days\)\s+if not end_date:\s+end_date = now'
unified_range_replacement = 'now = datetime.now(timezone.utc)\n    if not start_date or not end_date:\n        s, e = get_date_window(days)\n        if not start_date: start_date = s\n        if not end_date: end_date = e'
content = re.sub(unified_range_pattern, unified_range_replacement, content)

# 3. Update compute_stats logic
compute_stats_pattern = r'# 1\. Current Period Metrics\s+m = get_unified_metrics\(db, days=days, campaign_name=campaign_name, company_name=company_name\)\s+# 2\. Previous Period Metrics for Growth\s+prev_start = now - timedelta\(days=days \* 2\)\s+prev_end = now - timedelta\(days=days\)\s+p = get_unified_metrics\(db, campaign_name=campaign_name, company_name=company_name, start_date=prev_start, end_date=prev_end\)'
compute_stats_replacement = """# 1. Current Period Metrics
    s, e = get_date_window(days)
    m = get_unified_metrics(db, days=days, campaign_name=campaign_name, company_name=company_name, start_date=s, end_date=e)
    
    # 2. Previous Period Metrics for Growth
    if days == 7:
        prev_start = s - timedelta(days=7)
        prev_end = s
    elif days == 30:
        prev_start = (s - timedelta(days=1)).replace(day=1)
        prev_end = s
    else:
        prev_start = s - timedelta(days=days)
        prev_end = s
    p = get_unified_metrics(db, campaign_name=campaign_name, company_name=company_name, start_date=prev_start, end_date=prev_end)"""
content = re.sub(compute_stats_pattern, compute_stats_replacement, content)

# 4. Update recent_events logic
recent_events_pattern = r'limit_date = datetime\.now\(timezone\.utc\) - timedelta\(days=days\)'
recent_events_replacement = 'start_date, end_date = get_date_window(days)'
content = re.sub(recent_events_pattern, recent_events_replacement, content)

# Change limit_date to start_date/end_date in recent_events filter
content = content.replace('EmailEvent.timestamp >= limit_date', 'EmailEvent.timestamp >= start_date, EmailEvent.timestamp < end_date')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully patched services.py")
