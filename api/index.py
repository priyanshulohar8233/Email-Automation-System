import os
import sys
import traceback
from fastapi import FastAPI
from fastapi.responses import JSONResponse

# 1. Robust Pathing: Ensure the project root is always in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

app = None
import_error = None

# 2. Defensive Import: Attempt to load the main backend app
try:
    from backend.app.main import app as main_app
    app = main_app
except Exception as e:
    import_error = str(e)
    # Get a clean traceback for the Vercel logs
    full_tb = traceback.format_exc()
    print(f"DEPLOYMENT_CRITICAL_ERROR: Failed to import backend app: {import_error}")
    print(full_tb)

# 3. Safe Fallback: Create a minimal app if the main one fails
if app is None:
    app = FastAPI(title="Email Automation (Fallback)")
    
    @app.get("/")
    @app.get("/api/health")
    def health_fallback():
        return {
            "status": "diagnostic_mode",
            "error": import_error,
            "message": "The main backend failed to load. Check Vercel logs for details."
        }
    
    @app.get("/api/test")
    def test_fallback():
        return JSONResponse(
            status_code=500,
            content={"error": "Backend unavailable", "details": import_error}
        )

# Vercel detects this 'app' variable
