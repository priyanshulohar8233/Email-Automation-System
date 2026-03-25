import os
import sys
import json
from flask import Flask, jsonify, request

# Ensure backend folder is in path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = Flask(__name__)

@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    print("API HIT: /api/settings")
    # Settings mostly dummy for now as it uses env vars
    return jsonify({
        "status": "ok",
        "settings": {
            "smtp_configured": bool(os.getenv("SMTP_USER")),
            "sendgrid_configured": bool(os.getenv("SENDGRID_API_KEY")),
            "base_url": os.getenv("BASE_URL", "http://localhost")
        }
    })

def handler(req):
    return app(req.environ, lambda s, h: None)
