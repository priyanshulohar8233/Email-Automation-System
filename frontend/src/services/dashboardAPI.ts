export interface DashboardStats {
    totalEmails: number;
    openRate: number;
    clickRate: number;
    unread: number;
    bounceRate: number;
    activeCampaigns: number;
    totalEmailsGrowth?: number;
    openRateGrowth?: number;
    clickRateGrowth?: number;
    unreadGrowth?: number;
    bounceRateGrowth?: number;
    activeCampaignsGrowth?: number;
    raw?: {
        bounced: number;
        opened: number;
        delivered: number;
        unread: number;
    };
}

// Helper function to add timeout to fetch calls
const fetchWithTimeout = (url: string, timeout: number = 10000): Promise<Response> => {
    return Promise.race([
        fetch(url),
        new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
        )
    ]);
};

export const dashboardAPI = {
    getStats: async (days?: number): Promise<DashboardStats> => {
        try {
            const url = days ? `/api/dashboard/stats?days=${days}` : '/api/dashboard/stats';
            // Increased timeout to 30s to handle remote database latency
            const response = await fetchWithTimeout(url, 30000);

            if (!response.ok) {
                const errorText = await response.text();
                let message = `Error ${response.status}: ${response.statusText}`;
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.detail) message = errorJson.detail;
                } catch (e) { /* use default message */ }
                
                console.error(`Dashboard API Stats Error:`, message);
                throw new Error(message);
            }
            const data = await response.json();
            // Ensure numeric values are valid
            return {
                ...data,
                totalEmails: data.totalEmails || 0,
                openRate: data.openRate || 0,
                clickRate: data.clickRate || 0,
                unread: data.unread || 0,
                bounceRate: data.bounceRate || 0,
                activeCampaigns: data.activeCampaigns || 0
            };
        } catch (error) {
            console.error("Dashboard API Error:", error);
            throw error;
        }
    },
    // New function to fetch email stats (same shape as DashboardStats but could be extended)
    getEmailStats: async (days?: number): Promise<any> => {
        const url = days ? `/api/dashboard/email-stats?days=${days}` : '/api/dashboard/email-stats';
        // Increased timeout to 30s to handle remote database latency
        const response = await fetchWithTimeout(url, 30000);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Dashboard API Email Stats Error [${response.status}]: ${response.statusText}`, errorText);
            throw new Error(`Error fetching email stats: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    },
    // New function to fetch recent events for activity table
    getRecentEvents: async (days?: number): Promise<any[]> => {
        const url = days ? `/api/dashboard/recent-events?days=${days}` : '/api/dashboard/recent-events';
        // Increased timeout to 30s to handle remote database latency
        const response = await fetchWithTimeout(url, 30000);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Dashboard API Recent Events Error [${response.status}]: ${response.statusText}`, errorText);
            throw new Error(`Error fetching recent events: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    }
};
