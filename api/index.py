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

# --- Route Logging Helper ---
def log_request(route):
    print(f"API HIT: {route} | Method: {request.method} | DB: {db_available}")

# --- Campaigns ---
@app.route('/api/campaigns', methods=['GET', 'POST'])
def handle_campaigns():
    log_request("/api/campaigns")
    db = get_safe_db()
    
    try:
        if request.method == 'GET':
            if not db: return jsonify({"success": True, "data": [], "note": "Static fallback"})
            data = services.get_campaigns(db)
            return jsonify({"success": True, "data": data or []})
            
        if request.method == 'POST':
            if not db: return jsonify({"error": "Database unavailable for creation"}), 503
            from backend.app.schemas import CampaignCreate
            class MockBG:
                def add_task(self, f, *args, **kwargs): f(*args, **kwargs)
            res = services.create_campaign(db, CampaignCreate(**request.json), MockBG())
            return jsonify(res)
            
    except Exception as e:
        print(f"CRASH_IN_CAMPAIGNS: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": "Internal Error", "data": []}), 200 # Fail safe JSON
    finally:
        if db: db.close()

# --- Dashboard Stats ---
@app.route('/api/dashboard/stats')
def dashboard_stats():
    log_request("/api/dashboard/stats")
    db = get_safe_db()
    try:
        if not db: return jsonify({
            "total_emails_sent": 0, "open_rate": 0, "click_rate": 0,
            "unread_responses": 0, "bounce_rate": 0, "active_campaigns": 0
        })
        return jsonify(services.get_dashboard_stats(db))
    except Exception as e:
        print(f"CRASH_IN_STATS: {str(e)}")
        return jsonify({"total_emails_sent": 0, "open_rate": 0}), 200
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
        print(f"CRASH_IN_EMAIL_STATS: {str(e)}")
        return jsonify({"emails_over_time": []}), 200
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
        print(f"CRASH_IN_EVENTS: {str(e)}")
        return jsonify([]), 200
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
        if request.method == 'POST':
            if not db: return jsonify({"error": "DB Unavailable"}), 503
            return jsonify({"success": True, "data": services.create_template(db, request.json)})
    except Exception as e:
        print(f"CRASH_IN_TEMPLATES: {str(e)}")
        return jsonify({"success": False, "data": []}), 200
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
        if request.method == 'POST':
            if not db: return jsonify({"error": "DB Unavailable"}), 503
            return jsonify({"success": True, "data": services.create_contact(db, request.json)})
    except Exception as e:
        print(f"CRASH_IN_CONTACTS: {str(e)}")
        return jsonify({"success": False, "data": []}), 200
    finally:
        if db: db.close()

# --- Activity & Status ---
@app.route('/api/activity')
def handle_activity():
    log_request("/api/activity")
    db = get_safe_db()
    try:
        if not db: return jsonify([])
        limit = int(request.args.get('limit', 50))
        return jsonify(services.recent_events(db, limit=limit) or [])
    except Exception as e:
        return jsonify([]), 200
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
        return jsonify([]), 200
    finally:
        if db: db.close()

# --- Test Heartbeat ---
@app.route('/api/test')
def test_heartbeat():
    log_request("/api/test")
    return jsonify({
        "status": "ok",
        "message": "Defensive Consolidated Function is LIVE",
        "db_connected": db_available,
        "runtime": "Vercel Serverless"
    })

# --- Vercel Entry Point ---
def handler(req):
    return app(req.environ, lambda s, h: None)
