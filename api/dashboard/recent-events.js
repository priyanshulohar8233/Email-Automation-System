const db = require('../lib/db');

export default async function handler(req, res) {
  const { days = 30, limit = 15, campaign = "all" } = req.query;
  
  try {
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
      // Assuming campaigns are joined via email_id -> campaign_id -> campaign.name
      // For simplicity, we'll keep it basic or add the join if needed.
      // The Python code joined emails with campaigns.
      sql += ` AND e.campaign_id IN (SELECT id FROM campaigns WHERE name = $1)`;
      params.push(campaign);
    }
    
    sql += ` ORDER BY ee.timestamp DESC LIMIT ${parseInt(limit)}`;
    
    const result = await db.query(sql, params);
    
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
            // Smart extraction: google.com -> Google
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

    return res.status(200).json(events);
  } catch (error) {
    console.error("DB ERROR:", error);
    return res.status(500).json({ 
      detail: "Failed to fetch recent activity", 
      error: error.message 
    });
  }
}
