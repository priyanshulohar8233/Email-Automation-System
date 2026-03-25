import os
import sys
import json
import traceback
from flask import Flask, jsonify, request

# Ensure backend folder is in path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Attempt imports with fallback
try:
    from backend.app.database import SessionLocal
    from backend.app import services
    db_available = True
    print("IMPORT_SUCCESS: Backend services loaded.")
except Exception as e:
    print(f"IMPORT_ERROR: {str(e)}")
    db_available = False

app = Flask(__name__)

# --- Defensive Database Helper ---
def get_safe_db():
    if not db_available:
        print("DB_NOT_AVAILABLE: Skipping connection.")
        return None
    try:
        return SessionLocal()
    except Exception as e:
        print(f"DB_CONNECTION_ERROR: {str(e)}")
        return None

# --- Error Response Helper ---
def error_response(context, exception):
    err_msg = str(exception)
    tb = traceback.format_exc()
    print(f"CRASH_IN_{context}: {err_msg}")
    print(tb)
    return jsonify({
        "error": err_msg,
        "traceback": tb,
        "context": context,
        "success": False
    }), 200 # Fail safe JSON

# --- Route Logging Helper ---
def log_request(route):
    print(f"API HIT: {route} | Method: {request.method} | DB: {db_available}")

# --- Campaigns ---
@app.route('/api/campaigns', methods=['GET', 'POST', 'DELETE'])
def handle_campaigns():
    log_request("/api/campaigns")
    db = get_safe_db()
    try:
        if request.method == 'GET':
            if not db: return jsonify({"success": True, "data": []})
            return jsonify({"success": True, "data": services.get_campaigns(db) or []})
        if request.method == 'POST':
            if not db: return jsonify({"error": "DB Unavailable"}), 503
            from backend.app.schemas import CampaignCreate
            class MockBG:
                def add_task(self, f, *args, **kwargs): f(*args, **kwargs)
            return jsonify(services.create_campaign(db, CampaignCreate(**request.json), MockBG()))
    except Exception as e:
        return error_response("CAMPAIGNS", e)
    finally:
        if db: db.close()

# --- Dashboard ---
@app.route('/api/dashboard/stats')
def dashboard_stats():
    log_request("/api/dashboard/stats")
    db = get_safe_db()
    try:
        if not db: return jsonify({"total_emails_sent": 0, "open_rate": 0})
        return jsonify(services.get_dashboard_stats(db))
    except Exception as e:
        return error_response("DASHBOARD_STATS", e)
    finally:
        if db: db.close()

@app.route('/api/dashboard/email-stats')
def email_stats():
    log_request("/api/dashboard/email-stats")
    db = get_safe_db()
    try:
        if not db: return jsonify({"emails_over_time": []})
        return jsonify(services.get_email_stats_chart(db))
    except Exception as e:
        return error_response("EMAIL_STATS", e)
    finally:
        if db: db.close()

@app.route('/api/dashboard/recent-events')
def recent_events():
    log_request("/api/dashboard/recent-events")
    db = get_safe_db()
    try:
        if not db: return jsonify([])
        return jsonify(services.recent_events(db) or [])
    except Exception as e:
        return error_response("RECENT_EVENTS", e)
    finally:
        if db: db.close()

# --- Templates & Contacts ---
@app.route('/api/templates', methods=['GET', 'POST'])
def handle_templates():
    log_request("/api/templates")
    db = get_safe_db()
    try:
        if request.method == 'GET':
            if not db: return jsonify({"success": True, "data": []})
            return jsonify({"success": True, "data": services.get_templates(db) or []})
    except Exception as e:
        return error_response("TEMPLATES", e)
    finally:
        if db: db.close()

@app.route('/api/contacts', methods=['GET', 'POST'])
def handle_contacts():
    log_request("/api/contacts")
    db = get_safe_db()
    try:
        if request.method == 'GET':
            if not db: return jsonify({"success": True, "data": []})
            return jsonify({"success": True, "data": services.get_contacts(db) or []})
    except Exception as e:
        return error_response("CONTACTS", e)
    finally:
        if db: db.close()

# --- Activity & Status ---
@app.route('/api/activity')
def handle_activity():
    log_request("/api/activity")
    db = get_safe_db()
    try:
        if not db: return jsonify([])
        return jsonify(services.recent_events(db, limit=int(request.args.get('limit', 50))) or [])
    except Exception as e:
        return error_response("ACTIVITY", e)
    finally:
        if db: db.close()

@app.route('/api/campaign-status')
def handle_campaign_status():
    log_request("/api/campaign-status")
    db = get_safe_db()
    try:
        if not db: return jsonify([])
        return jsonify(services.get_campaign_status_summary(db) or [])
    except Exception as e:
        return error_response("CAMPAIGN_STATUS", e)
    finally:
        if db: db.close()

# --- Test Heartbeat ---
@app.route('/api/test')
def test_api():
    return jsonify({
        "status": "ok",
        "message": "Diagnostic API is LIVE",
        "db": db_available,
        "env": {
            "DATABASE_URL_NEW": bool(os.getenv("DATABASE_URL_NEW")),
            "PYTHON_VERSION": sys.version
        }
    })

# --- Vercel Entry ---
def handler(req):
    return app(req.environ, lambda s, h: None)
