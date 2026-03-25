import os
import sys
import json
from flask import Flask, jsonify, request

# Ensure backend folder is in path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from backend.app.database import SessionLocal
    from backend.app import services
    db_available = True
except Exception as e:
    print(f"DATABASE_IMPORT_ERROR: {str(e)}")
    db_available = False

app = Flask(__name__)

@app.route('/api/campaign-status')
def handle_status():
    print("API HIT: /api/campaign-status")
    if not db_available:
        return jsonify([])

    db = SessionLocal()
    try:
        data = services.get_campaign_status_summary(db)
        return jsonify(data)
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return jsonify([])
    finally:
        db.close()

def handler(req):
    return app(req.environ, lambda s, h: None)
