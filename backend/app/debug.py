import sys
from datetime import datetime

def debug_log(msg):
    print(f"DEBUG_LOG: {msg}")
    sys.stdout.flush()

def file_log(name: str, msg: str):
    log_path = f"d:\\Email-Automation-System_2.0\\backend\\{name}.log"
    try:
        with open(log_path, "a") as f:
            f.write(f"{datetime.now().isoformat()} - {msg}\n")
    except:
        pass
