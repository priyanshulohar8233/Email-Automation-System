import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.app.services import generate_ai_template

def verify_tone(tone):
    print(f"\n--- Verifying Tone: {tone} ---")
    result = generate_ai_template("Offer Letter Roadmap", tone)
    body = result['body']
    print(f"Subject: {result['subject']}")
    print("-" * 20)
    print(body)
    print("-" * 20)
    
    # Checks
    if tone != "else":
        if "Dear [Recipient Name]," not in body: print("❌ Missing Salutation [Recipient Name]")
        if "Cheers" in body: print("❌ Old 'Cheers' sign-off still present")
        if "Best regards" not in body: print("❌ Missing 'Best regards' sign-off")
        if "<br/>" in body: print("❌ HTML tags Found in Body (should be plain text)")
        if "\n" not in body: print("❌ Missing plain text newlines")
    
verify_tone("C-Executive Level")
verify_tone("Director")
verify_tone("Manager")
verify_tone("Non-Manager")
verify_tone("VP Level")
