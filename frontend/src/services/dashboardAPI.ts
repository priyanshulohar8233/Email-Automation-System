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

// For production on Vercel, this should be set to your backend URL.
// In development, it defaults to empty string to use the Vite proxy.
const getApiBaseUrl = () => {
    try {
        // @ts-ignore
        return import.meta.env.VITE_API_URL || '';
    } catch (e) {
        return '';
    }
};
const API_BASE_URL = getApiBaseUrl();

export const dashboardAPI = {
    getStats: async (days?: number, signal?: AbortSignal): Promise<DashboardStats> => {
        try {
            const url = days ? `${API_BASE_URL}/api/dashboard/stats?days=${days}` : `${API_BASE_URL}/api/dashboard/stats`;
            console.log(`[dashboardAPI] Requesting stats from: ${url}`);
            
            const response = await fetchWithTimeout(url, { 
                signal,
                cache: 'no-store'
            }, 10000);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[dashboardAPI] Stats Error [${response.status}]: ${response.statusText}`, errorText);
                throw new Error(`Error fetching dashboard stats: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('[dashboardAPI] Fetch aborted');
                throw error;
            }
            console.error("[dashboardAPI] Stats Exception:", error);
            throw error;
        }
    },
    getEmailStats: async (days?: number, signal?: AbortSignal): Promise<any> => {
        const url = days ? `${API_BASE_URL}/api/dashboard/email-stats?days=${days}` : `${API_BASE_URL}/api/dashboard/email-stats`;
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
    getRecentEvents: async (days?: number, signal?: AbortSignal): Promise<any[]> => {
        const url = days ? `${API_BASE_URL}/api/dashboard/recent-events?days=${days}` : `${API_BASE_URL}/api/dashboard/recent-events`;
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
    updateCompany: async (email: string, company: string): Promise<any> => {
        const response = await fetch(`${API_BASE_URL}/api/contacts/company`, {
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
