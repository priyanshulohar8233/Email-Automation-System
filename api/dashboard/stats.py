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

@app.route('/api/dashboard/stats')
def stats():
    print("API HIT: /api/dashboard/stats")
    if not db_available:
        return jsonify({"totalEmails": 0, "openRate": 0, "clickRate": 0, "activeCampaigns": 0})

    db = SessionLocal()
    try:
        days = int(request.args.get('days', 30))
        campaign = request.args.get('campaign', 'all')
        company = request.args.get('company', 'all')
        stats_data = services.compute_stats(db, days, campaign_name=campaign, company_name=company)
        return jsonify(stats_data)
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return jsonify({"error": str(e), "totalEmails": 0})
    finally:
        db.close()

def handler(req):
    return app(req.environ, lambda s, h: None)
