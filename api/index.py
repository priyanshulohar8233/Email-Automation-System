import os
import sys

# Ensure the project root is importable when Vercel loads this module.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from backend.app.main import app
