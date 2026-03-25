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

@app.route('/api/templates', methods=['GET', 'POST'])
def handle_templates():
    print("API HIT: /api/templates")
    if not db_available:
        return jsonify({"success": True, "data": []})

    db = SessionLocal()
    try:
        if request.method == 'GET':
            templates = services.get_templates(db)
            return jsonify({"success": True, "data": templates})
        
        if request.method == 'POST':
            data = request.json
            template = services.create_template(db, data)
            return jsonify({"success": True, "data": template})
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return jsonify({"error": str(e), "data": []})
    finally:
        db.close()

def handler(req):
    return app(req.environ, lambda s, h: None)
