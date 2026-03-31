import re
import os

file_path = r'd:\Email-Automation-System_2.0\backend\app\services.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update get_emails_per_company to use start_date AND end_date
# Current code uses limit_date (undefined)
print("Patching get_emails_per_company...")

# Initial query filter
old_filter_1 = r'or_\(\s+and_\(Email\.sent_at\.isnot\(None\), Email\.sent_at >= limit_date\),\s+and_\(Email\.opened_at\.isnot\(None\), Email\.opened_at >= limit_date\),\s+and_\(Email\.clicked_at\.isnot\(None\), Email\.clicked_at >= limit_date\),\s+\)'
new_filter_1 = """or_(
            and_(Email.sent_at.isnot(None), Email.sent_at >= start_date, Email.sent_at < end_date),
            and_(Email.opened_at.isnot(None), Email.opened_at >= start_date, Email.opened_at < end_date),
            and_(Email.clicked_at.isnot(None), Email.clicked_at >= start_date, Email.clicked_at < end_date),
        )"""

# Use a more flexible regex for matching the multiline filter
pattern_1 = re.compile(r'or_\(\s+and_\(Email\.sent_at\.isnot\(None\), Email\.sent_at >= limit_date\),\s+and_\(Email\.opened_at\.isnot\(None\), Email\.opened_at >= limit_date\),\s+and_\(Email\.clicked_at\.isnot\(None\), Email\.clicked_at >= limit_date\),\s+\)', re.MULTILINE)
content = pattern_1.sub(new_filter_1, content)

# Fallback activity_query filter
old_filter_2 = r'ActivityLog\.timestamp >= limit_date,'
new_filter_2 = 'ActivityLog.timestamp >= start_date, ActivityLog.timestamp < end_date,'
content = content.replace(old_filter_2, new_filter_2)

# Verify if any other limit_date remain
remaining = re.findall(r'limit_date', content)
if remaining:
    print(f"WARNING: Still found {len(remaining)} occurrences of limit_date. Replacing with start_date globally where appropriate.")
    # Safe global replacement for any remaining limit_date in queries
    content = content.replace('>= limit_date', '>= start_date')
    content = content.replace('= limit_date', '= start_date')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully synced all date windows in services.py")
