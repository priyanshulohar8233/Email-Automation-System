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
const fetchWithTimeout = (url: string, options: RequestInit = {}, timeout: number = 10000): Promise<Response> => {
    const controller = new AbortController();
    const { signal } = controller;
    
    // If a signal was passed in, we need to handle it
    if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
    }

    const fetchPromise = fetch(url, { ...options, signal });
    const timeoutPromise = new Promise<Response>((_, reject) =>
        setTimeout(() => {
            controller.abort();
            reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout)
    );

    return Promise.race([fetchPromise, timeoutPromise]);
};

export const dashboardAPI = {
    getStats: async (days?: number, campaign: string = "all", company?: string, signal?: AbortSignal): Promise<DashboardStats> => {
        try {
            let url = `/api/dashboard/stats?campaign=${encodeURIComponent(campaign)}`;
            if (days) url += `&days=${days}`;
            if (company && company !== "all") url += `&company=${encodeURIComponent(company)}`;
            
            const response = await fetchWithTimeout(url, { 
                signal,
                cache: 'no-store'
            }, 10000);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Dashboard API Stats Error [${response.status}]: ${response.statusText}`, errorText);
                throw new Error(`Error fetching dashboard stats: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Fetch aborted');
                throw error;
            }
            console.error("Dashboard API Error:", error);
            throw error;
        }
    },
    getEmailStats: async (days?: number, company?: string, signal?: AbortSignal): Promise<any> => {
        let url = days ? `/api/dashboard/email-stats?days=${days}` : '/api/dashboard/email-stats';
        if (company && company !== "all") {
            url += (url.includes('?') ? '&' : '?') + `company=${encodeURIComponent(company)}`;
        }
        const response = await fetchWithTimeout(url, { 
            signal,
            cache: 'no-store'
        }, 10000);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Dashboard API Email Stats Error [${response.status}]: ${response.statusText}`, errorText);
            throw new Error(`Error fetching email stats: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    },
    getRecentEvents: async (days?: number, company?: string, signal?: AbortSignal): Promise<any[]> => {
        let url = days ? `/api/dashboard/recent-events?days=${days}` : '/api/dashboard/recent-events';
        if (company && company !== "all") {
            url += (url.includes('?') ? '&' : '?') + `company=${encodeURIComponent(company)}`;
        }
        const response = await fetchWithTimeout(url, { 
            signal,
            cache: 'no-store'
        }, 10000);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Dashboard API Recent Events Error [${response.status}]: ${response.statusText}`, errorText);
            throw new Error(`Error fetching recent events: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    },
    getEmailsPerCompany: async (days?: number, signal?: AbortSignal): Promise<any[]> => {
        const url = `/api/analytics/emails-per-company?days=${days || 30}`;
        const response = await fetchWithTimeout(url, { 
            signal,
            cache: 'no-store'
        }, 10000);
        if (!response.ok) {
            throw new Error(`Error fetching emails per company: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    },
    updateCompany: async (email: string, company: string): Promise<any> => {
        const response = await fetch('/api/contacts/company', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, company }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error updating company: ${response.status} ${errorText}`);
        }
        return await response.json();
    }
};
