import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from .debug import debug_log

def send_email_sendgrid(api_key: str, from_email: str, to_email: str, subject: str, html_content: str):
    """
    Sends an email using the SendGrid REST API.
    """
    message = Mail(
        from_email=Email(from_email),
        to_emails=To(to_email),
        subject=subject,
        html_content=Content("text/html", html_content)
    )
    
    try:
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        debug_log(f"SENDGRID_SUCCESS: Status {response.status_code}")
        return {"success": True, "status_code": response.status_code}
    except Exception as e:
        # SendGrid errors often have a body with details
        error_msg = str(e)
        if hasattr(e, 'body'):
            import json
            try:
                body_data = json.loads(e.body.decode('utf-8') if hasattr(e.body, 'decode') else str(e.body))
                if "errors" in body_data and len(body_data["errors"]) > 0:
                    error_msg = body_data["errors"][0].get("message", str(e))
                else:
                    error_msg = str(body_data)
            except:
                error_msg = f"{e.body.decode('utf-8') if hasattr(e.body, 'decode') else str(e.body)}"
        
        debug_log(f"SENDGRID_ERROR: {error_msg}")
        return {"success": False, "error": error_msg}
