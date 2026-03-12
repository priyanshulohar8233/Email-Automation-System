import os
import re
from urllib.parse import quote

# Mock settings
class MockSettings:
    BASE_URL = "http://localhost:8000"
    SMTP_USER = "test@example.com"

settings = MockSettings()

def simulate_generation(email_id, subject, body):
    formatted_body = body.replace('\n', '<br/>')
    unsubscribe_url = f"{settings.BASE_URL}/api/contacts/unsubscribe?email=target@example.com"
    tracking_body = (
        f"<div style='font-family: sans-serif; color: #333; line-height: 1.6;'>"
        f"{formatted_body}"
        f"<br/><br/><hr style='border: 0; border-top: 1px solid #eee;'/><br/>"
        f"<p style='font-size: 12px; color: #999; text-align: center;'>"
        f"You received this because you are part of our mailing list.<br/>"
        f"<a href='{unsubscribe_url}' style='color: #4f46e5; text-decoration: underline;'>Unsubscribe</a>"
        f"</p>"
        f"<img src='{settings.BASE_URL}/api/track/open/{email_id}' width='1' height='1'/>"
        f"</div>"
    )
    
    def repl(match):
        url = match.group(1)
        if "/track/" in url or "/unsubscribe" in url: 
            return f'href="{url}"'
        tracked_url = f"{settings.BASE_URL}/api/track/click/{email_id}?url={quote(url)}"
        return f'href="{tracked_url}"'
        
    tracking_body = re.sub(r'href=["\']([^"\']+)["\']', repl, tracking_body)
    return tracking_body

if __name__ == "__main__":
    html = simulate_generation(6, "Test Subject", "Hello World\nCheck this link: https://google.com")
    print(html)
