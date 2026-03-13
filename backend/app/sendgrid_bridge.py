import os
import requests
from typing import Optional, List, Dict
from . import debug

class SendGridBridge:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.sendgrid.com/v3/mail/send"

    def send_email(self, from_email: str, to_email: str, subject: str, html_content: str) -> Dict:
        """
        Sends an email using SendGrid's v3 REST API.
        Reference: https://sendgrid.com/docs/API_Reference/api_v3_mail.html
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "personalizations": [
                {
                    "to": [{"email": to_email}]
                }
            ],
            "from": {"email": from_email},
            "subject": subject,
            "content": [
                {
                    "type": "text/html",
                    "value": html_content
                }
            ]
        }

        try:
            debug.debug_log(f"SENDGRID API: Sending to {to_email} via REST API")
            response = requests.post(self.base_url, headers=headers, json=payload, timeout=30)
            
            if response.status_code in [200, 201, 202]:
                debug.debug_log(f"SENDGRID API SUCCESS: {response.status_code}")
                return {"success": True, "status_code": response.status_code}
            else:
                error_detail = response.text
                debug.debug_log(f"SENDGRID API ERROR: {response.status_code} - {error_detail}")
                return {"success": False, "status_code": response.status_code, "error": error_detail}
        except Exception as e:
            debug.debug_log(f"SENDGRID API CRITICAL FAILURE: {str(e)}")
            return {"success": False, "error": str(e)}

def send_email_sendgrid(api_key: str, from_email: str, to_email: str, subject: str, html_content: str):
    bridge = SendGridBridge(api_key)
    return bridge.send_email(from_email, to_email, subject, html_content)
