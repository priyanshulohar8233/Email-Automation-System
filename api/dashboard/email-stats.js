const { Pool } = require('pg');

export default async function handler(req, res) {
  try {
    console.log("STEP 1: API HIT - /api/dashboard/email-stats");
    console.log("ENV CHECK: DATABASE_URL_NEW is", process.env.DATABASE_URL_NEW ? "DEFINED" : "UNDEFINED");
    
    if (!process.env.DATABASE_URL_NEW) {
        throw new Error("DATABASE_URL_NEW is not defined in environment variables");
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL_NEW,
      ssl: { rejectUnauthorized: false }
    });

    console.log("STEP 2: DB CONNECT ATTEMPT");

    // Test simple connectivity
    const testResult = await pool.query('SELECT NOW()');
    console.log("STEP 3: DB CONNECT SUCCESS (Simple Query)");

    const { days = 30 } = req.query;
    console.log(`STEP 4: EXECUTING MAIN QUERY (Days: ${days})`);

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
    
    const timeSeriesResult = await pool.query(timeSeriesQuery);
    console.log("STEP 5: MAIN QUERY SUCCESS");

    const chartData = timeSeriesResult.rows.map(row => ({
      day: row.day_name,
      emails: parseInt(row.count)
    }));

    // Cleanup pool in serverless context (though pg pool manages itself, explicit end is sometimes needed for fast cold starts)
    await pool.end();

    res.status(200).json(chartData);

  } catch (error) {
    console.error("🔥 EXACT ERROR:", error);

    res.status(500).json({
      error: error.message,
      stack: error.stack,
      full: error,
      env_defined: !!process.env.DATABASE_URL_NEW
    });
  }
}
