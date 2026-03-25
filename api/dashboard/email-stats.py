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

@app.route('/api/dashboard/email-stats')
def email_stats():
    print("API HIT: /api/dashboard/email-stats")
    if not db_available:
        return jsonify({"emails_over_time": []})

    db = SessionLocal()
    try:
        days = int(request.args.get('days', 7))
        company = request.args.get('company', 'all')
        data = services.emails_over_time(db, days, company_name=company)
        return jsonify(data)
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return jsonify({"emails_over_time": []})
    finally:
        db.close()

def handler(req):
    return app(req.environ, lambda s, h: None)
