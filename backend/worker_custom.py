import os
import json
import redis
import time
from sqlalchemy.orm import Session
from .database import SessionLocal
from .tasks import send_email_fn
from . import debug

# Configure Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
r = redis.from_url(REDIS_URL)

QUEUE_NAME = "email_queue"

def process_email_job(job_data: dict):
    """
    Worker logic to process an email job from the Redis queue.
    """
    email_id = job_data.get("email_id")
    subject = job_data.get("subject")
    body = job_data.get("body")
    attachments = job_data.get("attachments")
    
    if not email_id:
        return
        
    debug.debug_log(f"CUSTOM_WORKER: Processing email {email_id}")
    
    # We reuse the existing robust send_email_fn logic
    # but we need to provide it with a fresh DB session
    db = SessionLocal()
    try:
        # Note: send_email_fn is designed to run in a thread/process
        # It handles its own internal retries for DB writes.
        send_email_fn(email_id, subject, body, attachments)
    except Exception as e:
        debug.debug_log(f"CUSTOM_WORKER ERROR: {str(e)}")
    finally:
        db.close()

def run_worker():
    debug.debug_log(f"CUSTOM_WORKER: Starting up. Listening on queue '{QUEUE_NAME}'")
    while True:
        try:
            # BRPOP blocks until an item is available
            # Returns tuple (queue_name, item)
            raw_job = r.brpop(QUEUE_NAME, timeout=30)
            
            if raw_job:
                queue, item = raw_job
                job_data = json.loads(item)
                process_email_job(job_data)
            else:
                # Idle poll
                pass
                
        except Exception as e:
            debug.debug_log(f"CUSTOM_WORKER_CRITICAL: {str(e)}")
            time.sleep(5)

if __name__ == "__main__":
    run_worker()
