import re
import os

file_path = r'd:\Email-Automation-System_2.0\backend\app\services.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix get_activity logic: use start_date/end_date instead of undefined limit_date
# Current incorrect code:
# query = db.query(ActivityLog).filter(ActivityLog.timestamp >= limit_date)
# We want: 
# query = db.query(ActivityLog).filter(ActivityLog.timestamp >= start_date, ActivityLog.timestamp < end_date)

get_activity_fix = 'query = db.query(ActivityLog).filter(ActivityLog.timestamp >= start_date, ActivityLog.timestamp < end_date)'
# This might match the line exactly or contain slightly different spacing
content = re.sub(r'query = db\.query\(ActivityLog\)\.filter\(ActivityLog\.timestamp >= limit_date\)', get_activity_fix, content)

# 2. Add debug logging to get_activity to see ranges
content = content.replace('start_date, end_date = get_date_window(days)', 
                          'start_date, end_date = get_date_window(days)\n    debug.debug_log(f"FETCHING ACTIVITY: days={days}, start={start_date}, end={end_date}, company={company_name}")')

# 3. Remove the redundant/stale second definition of recent_events
# It starts around line 1191 in my previous view.
# We'll use a regex to find the second definition and remove it.
# We look for the second occurrence of 'def recent_events('

matches = list(re.finditer(r'def recent_events\(', content))
if len(matches) > 1:
    second_def_start = matches[1].start()
    # Find the end of this function. We assume it ends before the next 'def'
    next_def = re.search(r'\ndef ', content[second_def_start + 1:])
    if next_def:
        second_def_end = second_def_start + 1 + next_def.start()
        # Remove it
        print(f"Removing redundant recent_events starting at {second_def_start}")
        content = content[:second_def_start] + content[second_def_end:]
    else:
        # If it's the last def, remove until end of file
        content = content[:second_def_start]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully fixed activity logic in services.py")
