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

@app.route('/api/uploads', methods=['POST'])
def handle_uploads():
    print("API HIT: /api/uploads")
    if not db_available:
        return jsonify({"error": "Service unavailable"}), 503

    db = SessionLocal()
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
            
        # Call service to process the file
        result = services.process_contact_upload(db, file)
        return jsonify({"success": True, "result": result})
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

def handler(req):
    return app(req.environ, lambda s, h: None)
