const db = require('../lib/db');

export default async function handler(req, res) {
  const { days = 30 } = req.query;
  
  console.log(`Fetching email stats for last ${days} days`);
  
  try {
    const timeSeriesQuery = `
      SELECT 
        TO_CHAR(sent_at, 'YYYY-MM-DD') as day_date,
        TO_CHAR(sent_at, 'Dy') as day_name,
        COUNT(*) as count
      FROM emails
      WHERE sent_at >= NOW() - INTERVAL '${days} days'
        AND status IN ('SENT', 'DELIVERED', 'BOUNCED')
      GROUP BY day_date, day_name
      ORDER BY day_date ASC
    `;
    
    const timeSeriesResult = await db.query(timeSeriesQuery);
    
    const chartData = timeSeriesResult.rows.map(row => ({
      day: row.day_name,
      emails: parseInt(row.count)
    }));

    return res.status(200).json(chartData);
  } catch (error) {
    console.error("DB ERROR:", error);
    return res.status(500).json({ 
      detail: "Failed to fetch email stats", 
      error: error.message 
    });
  }
}
