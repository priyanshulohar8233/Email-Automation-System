import sys
import os
from datetime import datetime, timedelta

# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services import emails_over_time
from unittest.mock import MagicMock
from app.models import EmailStatus

def test_logic(days):
    print(f"\n--- Testing {days} days grouping ---")
    db = MagicMock()
    
    # Mock some dummy query results
    # For simplicity, let's assume some emails were sent on specific dates
    from datetime import date
    now = datetime.utcnow().date()
    
    # Example results: (date, count)
    mock_results = [
        (now, 10),
        (now - timedelta(days=1), 5),
        (now - timedelta(days=2), 2),
        (now - timedelta(days=10), 20),
        (now - timedelta(days=40), 50),
    ]
    
    # Mock the query chain: db.query(...).filter(...).group_by(...).all()
    # Note: the actual code uses cast(Email.sent_at, Date)
    db.query.return_value.filter.return_value.group_by.return_value.all.return_value = mock_results
    
    res = emails_over_time(db, days)
    
    print(f"Buckets: {len(res)}")
    for item in res:
        print(f"  {item['day']}: {item['emails']}")
        
    return res

if __name__ == "__main__":
    # Test all 4 cases
    test_logic(7)
    test_logic(30)
    test_logic(90)
    test_logic(365)
