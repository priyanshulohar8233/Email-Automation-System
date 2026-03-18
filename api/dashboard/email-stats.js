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

    // Fill in missing days - Fixed to Monday to Sunday for 7-day view
    const chartData = [];
    
    if (numDays === 7) {
        // Find the most recent Monday
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
        const diffToMonday = (dayOfWeek + 6) % 7; // Mon: 0, Tue: 1, ..., Sun: 6
        
        const monday = new Date(now);
        monday.setDate(now.getDate() - diffToMonday);
        
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            
            chartData.push({
                day: dayName,
                emails: dataMap[dateStr] || 0
            });
        }
    } else {
        // Standard chronological sliding window for other periods
        for (let i = numDays - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            
            chartData.push({
                day: dayName,
                emails: dataMap[dateStr] || 0
            });
        }
    }

    res.status(200).json(chartData);

  } catch (error) {
    console.error("🔥 ERROR in email-stats:", error);
    res.status(500).json({ error: error.message });
  }
}
