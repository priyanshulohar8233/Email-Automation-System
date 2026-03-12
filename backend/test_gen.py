from app.services import generate_ai_template
import os

# Mock settings or just let it read .env
res = generate_ai_template("sick leave", "professional")
print("Subject:", res['subject'])
print("Body:", res['body'][:100], "...")
