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

@app.route('/api/campaigns', methods=['GET', 'POST'])
def handle_campaigns():
    print("API HIT: /api/campaigns")
    
    if not db_available:
        return jsonify({
            "success": True,
            "data": [],
            "warning": "Database services currently unavailable (Mock Data)"
        })

    db = SessionLocal()
    try:
        if request.method == 'GET':
            search = request.args.get('search')
            status = request.args.get('status')
            campaigns = services.get_campaigns(db, search=search, status=status)
            return jsonify({"success": True, "data": campaigns})
        
        return jsonify({"success": True, "message": "Method not fully implemented in standalone mode"})
    except Exception as e:
        print(f"ERROR in /api/campaigns: {str(e)}")
        return jsonify({
            "success": True,
            "data": [],
            "error": str(e)
        })
    finally:
        db.close()

def handler(request_obj):
    """
    Vercel entry point as requested (Step 3)
    """
    return app(request_obj.environ, lambda status, headers: None)
