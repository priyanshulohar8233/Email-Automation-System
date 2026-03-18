const { Pool } = require('pg');

module.exports = async function handler(req, res) {
  try {
    if (!process.env.DATABASE_URL_NEW) {
      throw new Error("DATABASE_URL_NEW is not defined");
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL_NEW,
      ssl: { rejectUnauthorized: false }
    });

    const { days = 7 } = req.query;
    const numDays = parseInt(days);

    // Initial query to get counts
    const timeSeriesQuery = `
      SELECT 
        TO_CHAR(sent_at, 'YYYY-MM-DD') as day_date,
        TO_CHAR(sent_at, 'Dy') as day_name,
        COUNT(*) as count
      FROM emails
      WHERE sent_at >= NOW() - INTERVAL '${numDays} days'
        AND status IN ('SENT', 'DELIVERED', 'BOUNCED')
      GROUP BY day_date, day_name
      ORDER BY day_date ASC
    `;
    
    const result = await pool.query(timeSeriesQuery);
    await pool.end();

    const dataMap = {};
    result.rows.forEach(row => {
      dataMap[row.day_date] = parseInt(row.count);
    });

    // Aggregation Logic
    const chartData = [];
    const now = new Date();
    
    if (numDays === 7) {
        // WEEK: Daily (Mon-Sun)
        const dayOfWeek = now.getDay();
        const diffToMonday = (dayOfWeek + 6) % 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - diffToMonday);
        
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            chartData.push({ day: dayName, emails: dataMap[dateStr] || 0 });
        }
    } else if (numDays === 30) {
        // MONTH: 5-day intervals (6 bars)
        for (let i = 0; i < 30; i += 5) {
            let intervalCount = 0;
            let startDay = i + 1;
            let endDay = i + 5;
            
            for (let j = 0; j < 5; j++) {
                const d = new Date(now);
                d.setDate(now.getDate() - (29 - (i + j)));
                const dateStr = d.toISOString().split('T')[0];
                intervalCount += dataMap[dateStr] || 0;
            }
            chartData.push({ day: `${startDay}-${endDay}`, emails: intervalCount });
        }
    } else if (numDays === 90) {
        // QUARTER: 15-day intervals (6 bars)
        for (let i = 0; i < 90; i += 15) {
            let intervalCount = 0;
            let startDay = i + 1;
            let endDay = i + 15;
            
            for (let j = 0; j < 15; j++) {
                const d = new Date(now);
                d.setDate(now.getDate() - (89 - (i + j)));
                const dateStr = d.toISOString().split('T')[0];
                intervalCount += dataMap[dateStr] || 0;
            }
            chartData.push({ day: `Day ${startDay}-${endDay}`, emails: intervalCount });
        }
    } else if (numDays === 365) {
        // YEAR: Monthly intervals (12 bars)
        const months = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = d.toLocaleDateString('en-US', { month: 'short' });
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months.push({ name: monthName, key: monthKey, count: 0 });
        }

        // Aggregate dataMap by month
        Object.keys(dataMap).forEach(dateStr => {
            const mKey = dateStr.substring(0, 7);
            const monthObj = months.find(m => m.key === mKey);
            if (monthObj) monthObj.count += dataMap[dateStr];
        });

        months.forEach(m => {
            chartData.push({ day: m.name, emails: m.count });
        });
    } else {
        // Fallback for other ranges
        for (let i = numDays - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            chartData.push({ day: dayName, emails: dataMap[dateStr] || 0 });
        }
    }

    res.status(200).json(chartData);

  } catch (error) {
    console.error("🔥 ERROR in email-stats:", error);
    res.status(500).json({ error: error.message });
  }
}
