import os
import sys
import json
from flask import Flask, jsonify, request

# Ensure backend folder is in path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

try:
    from backend.app.database import SessionLocal
    from backend.app import services
    db_available = True
except Exception as e:
    print(f"DATABASE_IMPORT_ERROR: {str(e)}")
    db_available = False

app = Flask(__name__)

@app.route('/api/dashboard/recent-events')
def recent_events():
    print("API HIT: /api/dashboard/recent-events")
    if not db_available:
        return jsonify([])

    db = SessionLocal()
    try:
        days = int(request.args.get('days', 30))
        limit = int(request.args.get('limit', 10))
        campaign = request.args.get('campaign', 'all')
        company = request.args.get('company')
        company_list = company.split(",") if company and company != "all" else "all"
        
        events = services.recent_events(db, days, limit=limit, campaign_name=campaign, company_name=company_list)
        return jsonify(events)
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return jsonify([])
    finally:
        db.close()

def handler(req):
    return app(req.environ, lambda s, h: None)
