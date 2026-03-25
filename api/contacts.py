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

@app.route('/api/contacts', methods=['GET', 'POST'])
def handle_contacts():
    print("API HIT: /api/contacts")
    if not db_available:
        return jsonify({"success": True, "data": []})

    db = SessionLocal()
    try:
        if request.method == 'GET':
            contacts = services.get_contacts(db)
            return jsonify({"success": True, "data": contacts})
        
        if request.method == 'POST':
            data = request.json
            contact = services.create_contact(db, data)
            return jsonify({"success": True, "data": contact})
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return jsonify({"error": str(e), "data": []})
    finally:
        db.close()

def handler(req):
    return app(req.environ, lambda s, h: None)
