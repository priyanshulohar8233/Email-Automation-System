const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

// Global Prisma Client for serverless stability
const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

const app = express();
app.use(cors());
app.use(express.json());

// SaaS Grade: Health Check with DB ping
app.get('/api/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
    } catch (error) {
        return res.status(500).json({ status: "error", db: "disconnected", error: error.message });
    }
});

// GET /api/dashboard/stats - Unified metrics
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const vsLabel = req.query.time_range === 'week' ? 'vs last week' : 'vs last month';
        
        const now = new Date();
        const pastDate = new Date();
        pastDate.setDate(now.getDate() - days);

        // Fetch using Prisma findMany as requested
        const campaigns = await prisma.campaign.findMany({
            where: { created_at: { gte: pastDate, lte: now } }
        });

        let totalEmails = 0;
        let delivered = 0;
        let bounced = 0;
        let unread = 0;

        campaigns.forEach(c => {
            totalEmails += c.sent_count || 0;
            delivered += c.delivered_count || 0;
            bounced += c.bounce_count || 0;
            unread += c.unread_count || 0;
        });

        const activeCampaigns = campaigns.filter(c => c.status === 'RUNNING').length;
        const openRate = totalEmails > 0 ? (delivered / totalEmails) * 100 : 0; // Simplified for MVP
        const bounceRate = totalEmails > 0 ? (bounced / totalEmails) * 100 : 0;

        return res.status(200).json({
            totalEmails,
            delivered,
            bounced,
            unread,
            openRate: parseFloat(openRate.toFixed(1)),
            clickRate: 0,
            bounceRate: parseFloat(bounceRate.toFixed(1)),
            activeCampaigns,
            vsLabel,
            totalEmailsGrowth: 0,
            openRateGrowth: 0
        });
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        return res.status(200).json({ 
            totalEmails: 0, openRate: 0, clickRate: 0, bounceRate: 0, unread: 0, activeCampaigns: 0, vsLabel: '' 
        });
    }
});

// GET /api/dashboard/email-stats - Chart Data
app.get('/api/dashboard/email-stats', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        const emails = await prisma.email.findMany({
            where: { sent_at: { gte: startDate }, status: { in: ['SENT', 'DELIVERED', 'BOUNCED'] } },
            select: { sent_at: true }
        });

        const chartData = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(startDate.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
            const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
            // Approximate local time bucket
            const count = emails.filter(e => e.sent_at.getDate() === d.getDate()).length;
            chartData.push({ day: label, emails: count });
        }

        return res.status(200).json(chartData);
    } catch (error) {
        console.error("Email Stats Error:", error);
        return res.status(200).json([]);
    }
});

// GET /api/campaign-status
app.get('/api/campaign-status', async (req, res) => {
    try {
        const campaigns = await prisma.campaign.findMany();
        const stats = {
            running: campaigns.filter(c => c.status === "RUNNING").length,
            completed: campaigns.filter(c => c.status === "COMPLETED").length,
            failed: campaigns.filter(c => c.status === "FAILED" || c.status === "ERROR").length,
            draft: campaigns.filter(c => c.status === "DRAFT").length
        };
        // The frontend chart often expects an array of { name, value, fill }
        const chartRes = [
            { name: "Running", value: stats.running, fill: "#3b82f6" },
            { name: "Completed", value: stats.completed, fill: "#22c55e" },
            { name: "Draft", value: stats.draft, fill: "#94a3b8" },
            { name: "Failed", value: stats.failed, fill: "#ef4444" } // Also maps to Bounced/Failed in UI
        ];
        return res.status(200).json(chartRes);
    } catch (error) {
        console.error("Campaign Status Error:", error);
        return res.status(200).json([]);
    }
});

// GET /api/activity
app.get('/api/activity', async (req, res) => {
    try {
        const recentEvents = await prisma.email.findMany({
            take: 10,
            orderBy: { sent_at: 'desc' },
            include: { campaign: true }
        });

        const activities = recentEvents.map(e => ({
            id: e.id,
            recipient_email: e.recipient_email,
            recipient_name: e.recipient_email.split("@")[0] || "Unknown",
            sender: "System",
            company: e.campaign?.name || "Global",
            status: e.status,
            timestamp: e.sent_at.toISOString()
        }));

        return res.status(200).json(activities);
    } catch (error) {
        console.error("Activity Error:", error);
        return res.status(200).json([]);
    }
});

// GET /api/campaigns - List
app.get('/api/campaigns', async (req, res) => {
    try {
        const campaigns = await prisma.campaign.findMany({
            orderBy: { created_at: 'desc' },
            take: 50
        });
        return res.status(200).json(campaigns);
    } catch (error) {
        console.error("Campaigns array Error:", error);
        return res.status(200).json([]);
    }
});

module.exports = app;
