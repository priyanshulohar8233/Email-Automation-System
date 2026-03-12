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
            // In a real application we would use the actual backend URL here.
            // Currently assuming the proxy or relative path routes mapped to FastAPI.
            const url = days ? `/api/dashboard/stats?days=${days}` : '/api/dashboard/stats';
            const response = await fetchWithTimeout(url, 10000);

            if (!response.ok) {
                throw new Error(`Error fetching dashboard stats: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Dashboard API Error:", error);
            throw error;
        }
    },
    // New function to fetch email stats (same shape as DashboardStats but could be extended)
    getEmailStats: async (days?: number): Promise<any> => {
        const url = days ? `/api/dashboard/email-stats?days=${days}` : '/api/dashboard/email-stats';
        const response = await fetchWithTimeout(url, 10000);
        if (!response.ok) {
            throw new Error(`Error fetching email stats: ${response.statusText}`);
        }
        return await response.json();
    },
    // New function to fetch recent events for activity table
    getRecentEvents: async (days?: number): Promise<any[]> => {
        const url = days ? `/api/dashboard/recent-events?days=${days}` : '/api/dashboard/recent-events';
        const response = await fetchWithTimeout(url, 10000);
        if (!response.ok) {
            throw new Error(`Error fetching recent events: ${response.statusText}`);
        }
        return await response.json();
    }
};
