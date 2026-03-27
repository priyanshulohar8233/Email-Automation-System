import google.generativeai as genai
import json
import re
from .config import settings
from . import debug

# Configure Gemini
if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "YOUR_GEMINI_API_KEY_HERE":
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    model = None
    debug.debug_log("GEMINI_API_KEY not configured or placeholder detected.")

# SaaS Grade: Shared Redis Client from services
def get_redis():
    from .services import redis_client
    return redis_client

async def enrich_activity_batch(activities: list):
    """
    Batches multiple activity rows to Gemini for enrichment.
    Input: list of {id, email, company, sender, timestamp}
    Returns: list of enriched objects
    """
    if not model:
        return []

    redis_cache = get_redis()
    results = []
    to_enrich = []

    # 1. Check Cache
    for act in activities:
        cache_key = f"gemini_enrich:{act.get('recipient_email')}:{act.get('company', '')}"
        if redis_cache:
            cached = redis_cache.get(cache_key)
            if cached:
                try:
                    cached_data = json.loads(cached)
                    cached_data['id'] = act['id'] # Map back to current row ID
                    results.append(cached_data)
                    continue
                except: pass
        to_enrich.append(act)

    if not to_enrich:
        return results

    # 2. Batch Enrich remaining
    prompt = "Extract person name, company name, and country for the following email activities. "
    prompt += "Return a JSON array of objects with keys: email_key, name, company, country. "
    prompt += "Use 'email_key' as the verbatim email address provided. "
    prompt += "Format 'name' as Full Name. Format 'company' and 'country' accurately. "
    prompt += "Activities:\n"
    
    for act in to_enrich:
        prompt += f"- Email: {act['recipient_email']}, Info: {act.get('sender', '')} / {act.get('company', '')}\n"

    try:
        response = model.generate_content(prompt)
        text = response.text
        
        json_match = re.search(r'\[.*\]', text, re.DOTALL)
        if json_match:
            ai_data = json.loads(json_match.group())
            
            # 3. Store in Cache and map back
            for item in ai_data:
                email = item.get('email_key')
                if not email: continue
                
                # Find matching activity to get the ID
                original = next((a for a in to_enrich if a['recipient_email'] == email), None)
                if original:
                    item['id'] = original['id']
                    results.append(item)
                    
                    # Cache it (24h expiry)
                    if redis_cache:
                        cache_key = f"gemini_enrich:{email}:{original.get('company', '')}"
                        cache_data = {k: v for k, v in item.items() if k != 'id'}
                        redis_cache.setex(cache_key, 86400, json.dumps(cache_data))
            
            return results
        else:
            debug.debug_log(f"GEMINI_PARSE_ERROR: No JSON array found in response: {text[:200]}")
            return []
            
    except Exception as e:
        debug.debug_log(f"GEMINI_SERVICE_ERROR: {e}")
        return []

def format_smart_time(timestamp_str: str):
    """
    Gemini-powered time formatting (optional use if local logic is insufficient)
    """
    # For performance, we might prefer local logic, but user requested Gemini for formatting.
    # We'll stick to a simple prompt if needed, but batching is better.
    pass
