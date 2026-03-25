import os
import sys
import json
from flask import Flask, jsonify, request

# Ensure backend folder is in path for imports
# Standalone functions in /api/ need access to backend.app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from backend.app.database import SessionLocal
    from backend.app import services
    db_available = True
except Exception as e:
    print(f"DATABASE_IMPORT_ERROR: {str(e)}")
    db_available = False

app = Flask(__name__)

# --- Helper for DB Sessions ---
def get_db():
    if not db_available:
        return None
    return SessionLocal()

# --- Campaigns ---
@app.route('/api/campaigns', methods=['GET', 'POST'])
def handle_campaigns():
    db = get_db()
    if not db: return jsonify({"success": True, "data": []})
    try:
        if request.method == 'GET':
            data = services.get_campaigns(db)
            return jsonify({"success": True, "data": data})
        if request.method == 'POST':
            from backend.app.schemas import CampaignCreate
            # Minimal mock background tasks for serverless
            class MockBG:
                def add_task(self, f, *args, **kwargs): f(*args, **kwargs)
            res = services.create_campaign(db, CampaignCreate(**request.json), MockBG())
            return jsonify(res)
    except Exception as e:
        return jsonify({"error": str(e), "data": []})
    finally:
        db.close()

# --- Dashboard Stats ---
@app.route('/api/dashboard/stats')
def dashboard_stats():
    db = get_db()
    if not db: return jsonify({})
    try:
        return jsonify(services.get_dashboard_stats(db))
    except Exception as e:
        return jsonify({})
    finally:
        db.close()

@app.route('/api/dashboard/email-stats')
def email_stats():
    db = get_db()
    if not db: return jsonify({"emails_over_time": []})
    try:
        return jsonify(services.get_email_stats_chart(db))
    except Exception as e:
        return jsonify({"emails_over_time": []})
    finally:
        db.close()

@app.route('/api/dashboard/recent-events')
def recent_events():
    db = get_db()
    if not db: return jsonify([])
    try:
        return jsonify(services.recent_events(db))
    except Exception as e:
        return jsonify([])
    finally:
        db.close()

# --- Templates ---
@app.route('/api/templates', methods=['GET', 'POST'])
def handle_templates():
    db = get_db()
    if not db: return jsonify({"success": True, "data": []})
    try:
        if request.method == 'GET':
            return jsonify({"success": True, "data": services.get_templates(db)})
        if request.method == 'POST':
            return jsonify({"success": True, "data": services.create_template(db, request.json)})
    except Exception as e:
        return jsonify({"error": str(e), "data": []})
    finally:
        db.close()

# --- Contacts ---
@app.route('/api/contacts', methods=['GET', 'POST'])
def handle_contacts():
    db = get_db()
    if not db: return jsonify({"success": True, "data": []})
    try:
        if request.method == 'GET':
            return jsonify({"success": True, "data": services.get_contacts(db)})
        if request.method == 'POST':
            return jsonify({"success": True, "data": services.create_contact(db, request.json)})
    except Exception as e:
        return jsonify({"error": str(e), "data": []})
    finally:
        db.close()

# --- Activity & Status ---
@app.route('/api/activity')
def handle_activity():
    db = get_db()
    if not db: return jsonify([])
    try:
        return jsonify(services.recent_events(db, limit=int(request.args.get('limit', 50))))
    except Exception as e:
        return jsonify([])
    finally:
        db.close()

@app.route('/api/campaign-status')
def handle_campaign_status():
    db = get_db()
    if not db: return jsonify([])
    try:
        return jsonify(services.get_campaign_status_summary(db))
    except Exception as e:
        return jsonify([])
    finally:
        db.close()

# --- Test Heartbeat ---
@app.route('/api/test')
def test_heartbeat():
    return jsonify({
        "status": "ok",
        "message": "Consolidated Vercel Function is LIVE",
        "db_connected": db_available
    })

# --- Vercel Entry Point ---
def handler(req):
    return app(req.environ, lambda s, h: None)
