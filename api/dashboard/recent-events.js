const { Pool } = require('pg');

module.exports = async function handler(req, res) {
  try {
    console.log("STEP 1: API HIT - /api/dashboard/recent-events");
    
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

    const { days = 30, limit = 15, campaign = "all" } = req.query;
    console.log(`STEP 4: EXECUTING RECENT EVENTS QUERY (Campaign: ${campaign})`);

    let sql = `
      SELECT 
        ee.*,
        e.recipient_email,
        c.name as contact_name,
        c.company as contact_company
      FROM email_events ee
      JOIN emails e ON ee.email_id = e.id
      LEFT JOIN contacts c ON e.recipient_email = c.email
      WHERE ee.timestamp >= NOW() - INTERVAL '${days} days'
    `;
    
    const params = [];
    if (campaign !== "all") {
      sql += ` AND e.campaign_id IN (SELECT id FROM campaigns WHERE name = $1)`;
      params.push(campaign);
    }
    
    sql += ` ORDER BY ee.timestamp DESC LIMIT ${parseInt(limit)}`;
    
    const result = await pool.query(sql, params);
    console.log("STEP 5: QUERY SUCCESS");
    
    const PERSONAL_PROVIDERS = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com"]);
    
    const events = result.rows.map(row => {
      let company = row.contact_company;
      const email = row.recipient_email;
      if (!company && email) {
        const domain = email.split('@')[1]?.toLowerCase();
        if (domain) {
          if (PERSONAL_PROVIDERS.has(domain)) {
            company = "Personal Email";
          } else {
            company = domain.split('.')[0];
            company = company.charAt(0).toUpperCase() + company.slice(1);
          }
        }
      }
      return {
        id: row.id,
        email_id: row.email_id,
        event_type: row.event_type,
        timestamp: row.timestamp,
        contact_name: row.contact_name || "Unknown",
        contact_company: company || "Personal Email",
        recipient_email: email
      };
    });

    await pool.end();
    res.status(200).json(events);

  } catch (error) {
    console.error("🔥 EXACT ERROR in /api/dashboard/recent-events:", error);
    res.status(500).json({ error: error.message, full: error });
  }
}
