const { Pool } = require('pg');

module.exports = async function handler(req, res) {
  try {
    console.log("STEP 1: API HIT - /api/dashboard/stats");
    
    if (!process.env.DATABASE_URL_NEW) {
        console.error("ENV CHECK: DATABASE_URL_NEW is UNDEFINED");
        throw new Error("DATABASE_URL_NEW is not defined");
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL_NEW,
      ssl: { rejectUnauthorized: false }
    });

    console.log("STEP 2: DB CONNECT ATTEMPT");
    await pool.query('SELECT NOW()');
    console.log("STEP 3: DB CONNECT SUCCESS");

    const { days = 30 } = req.query;
    console.log(`STEP 4: EXECUTING DASHBOARD STATS QUERY (Days: ${days})`);

    const query = `
      SELECT 
        COUNT(*) as "totalEmails",
        COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered,
        COUNT(opened_at) as opened,
        COUNT(clicked_at) as clicked,
        COUNT(CASE WHEN status = 'BOUNCED' THEN 1 END) as bounced
      FROM emails
      WHERE sent_at >= NOW() - INTERVAL '${days} days'
    `;
    
    const result = await pool.query(query);
    console.log("STEP 5: QUERY SUCCESS");
    
    const row = result.rows[0];
    const total = parseInt(row.totalEmails) || 0;
    const delivered = parseInt(row.delivered) || 0;
    const opened = parseInt(row.opened) || 0;
    const clicked = parseInt(row.clicked) || 0;
    const bounced = parseInt(row.bounced) || 0;

    const calcRate = (num, den) => den > 0 ? parseFloat((num / den * 100).toFixed(1)) : 0.0;

    const stats = {
      totalEmails: total,
      openRate: calcRate(opened, delivered),
      clickRate: calcRate(clicked, delivered),
      bounceRate: calcRate(bounced, total),
      unread: calcRate(delivered - opened, delivered),
      activeCampaigns: 0,
      totalEmailsGrowth: 0.0,
      openRateGrowth: 0.0,
      clickRateGrowth: 0.0,
      activeCampaignsGrowth: 0.0,
      raw: { bounced, opened, delivered, unread: Math.max(0, delivered - opened) }
    };

    await pool.end();
    res.status(200).json(stats);

  } catch (error) {
    console.error("🔥 EXACT ERROR in /api/dashboard/stats:", error);
    res.status(500).json({ error: error.message, full: error });
  }
}
