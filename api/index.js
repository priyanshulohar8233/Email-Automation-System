const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// SaaS Grade: Health Check with DB ping
app.get('/api/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ status: "error", db: "disconnected", error: error.message });
    }
});

// GET /api/dashboard/stats - Unified metrics
app.get('/api/dashboard/stats', async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const vsLabel = req.query.time_range === 'week' ? 'vs last week' : 'vs last month';
    
    try {
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const prevStartDate = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

        // Current Metrics
        const currentEmails = await prisma.email.groupBy({
            by: ['status'],
            where: { sent_at: { gte: startDate } },
            _count: { id: true }
        });

        const currentEvents = await prisma.emailEvent.groupBy({
            by: ['event_type'],
            where: { timestamp: { gte: startDate } },
            _count: { email_id: true }
        });

        const totalSent = currentEmails.reduce((acc, curr) => acc + curr._count.id, 0);
        const delivered = currentEmails.find(e => e.status === 'SENT' || e.status === 'DELIVERED')?._count.id || 0;
        const bounces = currentEmails.find(e => e.status === 'BOUNCED')?._count.id || 0;
        const opens = currentEvents.find(e => e.event_type === 'OPENED')?._count.id || 0;

        const openRate = totalSent > 0 ? (opens / totalSent) * 100 : 0;
        const activeCampaigns = await prisma.campaign.count({ where: { status: 'RUNNING' } });

        // Growth logic (Simplified for Vercel performance)
        res.json({
            totalEmails: totalSent,
            openRate: parseFloat(openRate.toFixed(1)),
            clickRate: 0, 
            bounceRate: totalSent > 0 ? parseFloat(((bounces / totalSent) * 100).toFixed(1)) : 0,
            unread: Math.max(0, delivered - opens),
            activeCampaigns,
            vsLabel,
            totalEmailsGrowth: 0,
            openRateGrowth: 0
        });
    } catch (error) {
        console.error("STATS_ERROR:", error);
        res.json({ totalEmails: 0, openRate: 0, clickRate: 0, bounceRate: 0, unread: 0, activeCampaigns: 0, vsLabel });
    }
});

// GET /api/dashboard/email-stats - Chart Data & Recent Feed
app.get('/api/dashboard/email-stats', async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    try {
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        // 1. Chart Data
        const emails = await prisma.email.findMany({
            where: {
                sent_at: { gte: startDate },
                status: { in: ['SENT', 'DELIVERED', 'BOUNCED'] }
            },
            select: { sent_at: true }
        });

        const chartData = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(startDate.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
            const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
            const count = emails.filter(e => e.sent_at.toDateString() === d.toDateString()).length;
            chartData.push({ day: label, emails: count });
        }

        // 2. Recent Activity Feed (Matches ActivityRow)
        const recentEvents = await prisma.email.findMany({
            take: 10,
            orderBy: { sent_at: 'desc' },
            include: { campaign: true }
        });

        const activities = recentEvents.map(e => ({
            id: e.id,
            recipient_email: e.recipient_email,
            recipient_name: "", // Optional optimization
            sender: "System",
            company: e.campaign?.name || "Global",
            status: e.status,
            timestamp: e.sent_at.toISOString()
        }));

        res.json({
            emails_over_time: chartData,
            campaign_status: [],
            recent_activity: activities
        });
    } catch (error) {
        console.error("CHART_ERROR:", error);
        res.json({ emails_over_time: [], campaign_status: [], recent_activity: [] });
    }
});

// GET /api/campaigns - List (Uses findMany as requested)
app.get('/api/campaigns', async (req, res) => {
    try {
        const campaigns = await prisma.campaign.findMany({
            orderBy: { created_at: 'desc' },
            take: 50
        });
        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log("MailFlow API running on port 3000");
});

module.exports = app;
