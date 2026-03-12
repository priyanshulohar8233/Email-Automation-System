from app.database import SessionLocal
from app.models import Email, EmailStatus
import os

db = SessionLocal()
try:
    # Find recently sent email
    email = db.query(Email).order_by(Email.id.desc()).first()
    if email:
        print(f"Email ID: {email.id}")
        print(f"Status: {email.status}")
        print(f"Recipient: {email.recipient_email}")
        print("-" * 20)
        if email.body:
            # Look for tracking pixel
            if "api/track/open" in email.body:
                print("Found Open Tracking Pixel")
                # Extract the URL
                import re
                match = re.search(r'src=["\']([^"\']+/api/track/open/\d+)["\']', email.body)
                if match:
                    print(f"Tracking Pixel URL: {match.group(1)}")
                else:
                    print("Could not extract Pixel URL")
            else:
                print("NO Open Tracking Pixel found in body!")
            
            # Look for tracked links
            if "api/track/click" in email.body:
                print("Found Tracked Click Links")
                matches = re.findall(r'href=["\']([^"\']+/api/track/click/\d+\?url=[^"\']+)["\']', email.body)
                for m in matches:
                    print(f"Tracked Click URL: {m}")
            else:
                print("NO Tracked Click Links found in body!")
        else:
            print("Email body is empty.")
finally:
    db.close()
