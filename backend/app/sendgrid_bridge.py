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
        debug_log(f"SENDGRID_ERROR: {str(e)}")
        return {"success": False, "error": str(e)}
