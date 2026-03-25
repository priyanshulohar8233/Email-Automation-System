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

@app.route('/api/activity')
def handle_activity():
    print("API HIT: /api/activity")
    if not db_available:
        return jsonify([])

    db = SessionLocal()
    try:
        limit = int(request.args.get('limit', 50))
        # Reuse existing recent_events for activity logs
        activities = services.recent_events(db, days=30, limit=limit)
        return jsonify(activities)
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return jsonify([])
    finally:
        db.close()

def handler(req):
    return app(req.environ, lambda s, h: None)
