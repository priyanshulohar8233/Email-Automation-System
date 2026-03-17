const db = require('../lib/db');

export default async function handler(req, res) {
  const { days = 30 } = req.query;
  
  try {
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
    
    const result = await db.query(query);
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
      activeCampaigns: 0, // Placeholder until campaigns table is checked
      totalEmailsGrowth: 0.0,
      openRateGrowth: 0.0,
      clickRateGrowth: 0.0,
      activeCampaignsGrowth: 0.0,
      raw: {
        bounced: bounced,
        opened: opened,
        delivered: delivered,
        unread: Math.max(0, delivered - opened)
      }
    };

    return res.status(200).json(stats);
  } catch (error) {
    console.error("DB ERROR:", error);
    return res.status(500).json({ 
      detail: "Failed to fetch dashboard metrics", 
      error: error.message 
    });
  }
}
