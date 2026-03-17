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

    const { days = 30, limit = 15, campaign = "all" } = req.query;

    let sql = `
      SELECT 
        ee.id,
        ee.email_id,
        ee.event_type,
        ee.timestamp,
        ee.country,
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
    await pool.end();
    
    const PERSONAL_PROVIDERS = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com"]);
    
    const events = result.rows.map(row => {
      let company = row.contact_company;
      const email = row.recipient_email;
      let name = row.contact_name;
      
      if (!name && email) {
        // Fallback: extract name from email prefix (john.doe@example.com -> John Doe)
        const prefix = email.split('@')[0];
        name = prefix.split(/[._-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      }

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
        recipient: email,
        recipient_name: name || "Unknown",
        company: company || "Personal Email",
        country: row.country || "Unknown",
        event_type: row.event_type,
        timestamp: row.timestamp
      };
    });

    res.status(200).json(events);
  } catch (error) {
    console.error("🔥 ERROR in recent-events:", error);
    res.status(500).json({ error: error.message });
  }
}
