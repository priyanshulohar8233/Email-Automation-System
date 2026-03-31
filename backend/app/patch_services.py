import os

file_path = r'd:\Email-Automation-System_2.0\backend\app\services.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_service = """

def generate_branded_email(template_name: str, description: str, seniority: str, image: str = None, attachment: str = None) -> dict:
    \"\"\"
    Generates an AI email and wraps it in a specific company branding/signature layout.
    \"\"\"
    # 1. Generate the core content (subject and body) using existing AI logic
    ai_result = generate_ai_template(description, seniority)
    subject = ai_result.get(\"subject\", \"Generated Email\")
    body_text = ai_result.get(\"body\", \"\")
    
    # 2. Define Branded Layouts
    layouts = {
        \"MP Lumina\": {
            \"primary\": \"#6366f1\",
            \"secondary\": \"#4f46e5\",
            \"logo\": \"https://img.icons8.com/fluency/96/sparkling.png\",
            \"signature\": \"\"\"
                <div style=\"margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-family: 'Inter', sans-serif;\">
                    <table cellpadding=\"0\" cellspacing=\"0\" border=\"0\">
                        <tr>
                            <td style=\"vertical-align: top; padding-right: 15px;\">
                                <img src=\"https://img.icons8.com/fluency/48/sparkling.png\" width=\"48\" height=\"48\" alt=\"Lumina\" />
                            </td>
                            <td style=\"border-left: 2px solid #6366f1; padding-left: 15px;\">
                                <div style=\"font-weight: 800; font-size: 16px; color: #111827;\">Sarah Jenkins</div>
                                <div style=\"font-size: 13px; color: #6366f1; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;\">Head of Creative Strategy</div>
                                <div style=\"font-size: 12px; color: #6b7280;\">MP Lumina | Illuminating Brands</div>
                                <div style=\"margin-top: 8px;\">
                                    <a href=\"#\" style=\"text-decoration: none; color: #6366f1; font-size: 12px; font-weight: 600;\">www.mplumina.com</a>
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>
            \"\"\"
        },
        \"MP Consultant\": {
            \"primary\": \"#0f172a\",
            \"secondary\": \"#334155\",
            \"logo\": \"https://img.icons8.com/color/96/business-group.png\",
            \"signature\": \"\"\"
                <div style=\"margin-top: 40px; padding-top: 20px; border-top: 2px solid #0f172a; font-family: 'Georgia', serif;\">
                    <div style=\"font-weight: bold; font-size: 18px; color: #0f172a; margin-bottom: 2px;\">Robert Sterling</div>
                    <div style=\"font-size: 14px; color: #334155; font-style: italic; margin-bottom: 10px;\">Senior Management Consultant</div>
                    <div style=\"font-size: 12px; color: #64748b; line-height: 1.5;\">
                        <b>MP Consultant Group</b><br/>
                        1221 Avenue of the Americas, New York, NY<br/>
                        Office: +1 (212) 555-0198
                    </div>
                </div>
            \"\"\"
        },
        \"A Making Company\": {
            \"primary\": \"#f97316\",
            \"secondary\": \"#ea580c\",
            \"logo\": \"https://img.icons8.com/color/96/factory.png\",
            \"signature\": \"\"\"
                <div style=\"margin-top: 40px; background-color: #fff7ed; padding: 20px; border-radius: 8px; border-left: 4px solid #f97316; font-family: 'Roboto', sans-serif;\">
                    <div style=\"display: inline-block; font-weight: 900; font-size: 20px; color: #c2410c; letter-spacing: -0.02em;\">A MAKING CO.</div>
                    <div style=\"margin-top: 10px; height: 1px; background-color: #ffedd5; width: 100%;\"></div>
                    <div style=\"margin-top: 12px; font-size: 14px; color: #111827;\">
                        <b>James 'Forge' Miller</b> | Operations Director<br/>
                        <span style=\"color: #f97316;\">Build. Create. Scale.</span>
                    </div>
                    <div style=\"margin-top: 8px; font-size: 11px; color: #9a3412; text-transform: uppercase; font-weight: bold;\">
                        ISO 9001 CERTIFIED MANUFACTURING
                    </div>
                </div>
            \"\"\"
        }
    }
    
    config = layouts.get(template_name, layouts[\"MP Lumina\"])
    
    # 3. Assemble HTML
    formatted_body = body_text.replace('\\n', '<br/>')
    
    image_html = \"\"
    if image:
        image_html = f'<div style=\"margin: 20px 0;\"><img src=\"{image}\" style=\"width: 100%; max-width: 600px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);\" /></div>'

    html_content = f\"\"\"
    <div style=\"max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #374151; line-height: 1.6; background-color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #e5e7eb;\">
        <div style=\"padding-bottom: 20px; border-bottom: 1px solid #f3f4f6; margin-bottom: 30px;\">
            <img src=\"{config['logo']}\" width=\"48\" height=\"48\" />
        </div>
        
        <div style=\"font-size: 16px; min-height: 200px;\">
            {formatted_body}
        </div>
        
        {image_html}
        
        {config['signature']}
        
        <div style=\"margin-top: 40px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 20px;\">
            Sent via MailFlow AI Engine. To unsubscribe, <a href=\"#\" style=\"color: {config['primary']}; text-decoration: none;\">click here</a>.
        </div>
    </div>
    \"\"\"
    
    return {\"html\": html_content, \"subject\": subject, \"body_text\": body_text}
"""

if 'def generate_branded_email' not in content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content + new_service)
    print('SUCCESS')
else:
    print('ALREADY_EXISTS')
