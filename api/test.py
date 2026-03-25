import json
import os

def handler(event, context):
    """
    Vercel Python Serverless Function Handler (Standalone)
    """
    print("API HIT: /api/test")
    
    try:
        response_data = {
            "status": "ok",
            "message": "Vercel Serverless Function is LIVE",
            "environment": {
                "DATABASE_URL_NEW": bool(os.getenv("DATABASE_URL_NEW")),
                "SENDGRID_API_KEY": bool(os.getenv("SENDGRID_API_KEY")),
                "PYTHON_VERSION": os.getenv("VERCEL_PYTHON_VERSION", "Unknown")
            }
        }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(response_data)
        }
    except Exception as e:
        print(f"ERROR in /api/test: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({"error": str(e), "code": "INTERNAL_SERVER_ERROR"})
        }
