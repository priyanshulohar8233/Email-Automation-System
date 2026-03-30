/// <reference types="vite/client" />
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
    vsLabel?: string;
}

// Helper function to add timeout to fetch calls
const fetchWithTimeout = (url: string, options: RequestInit = {}, timeout: number = 30000): Promise<Response> => {
    const controller = new AbortController();
    const { signal } = controller;
    
    // Auto-detect user timezone and include in headers
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const headers = {
        ...options.headers,
        "X-Timezone": userTz
    };
    
    // If a signal was passed in, we need to handle it
    if (options.signal && typeof options.signal.addEventListener === 'function') {
        options.signal.addEventListener('abort', () => controller.abort());
    }

    const fetchPromise = fetch(url, { ...options, headers, signal });
    const timeoutPromise = new Promise<Response>((_, reject) =>
        setTimeout(() => {
            controller.abort();
            reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout)
    );

    return Promise.race([fetchPromise, timeoutPromise]);
};

// Unified API URL logic for both Dev (Proxy) and Production (Absolute)
// Support both standard Vite (VITE_) and Vercel/Next.js style (NEXT_PUBLIC_) env vars
const BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.NEXT_PUBLIC_API_URL || "";
const API_URL = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;

export const dashboardAPI = {
    getStats: async (days?: number, campaign: string = "all", company?: string, signal?: AbortSignal, range: string = "month"): Promise<DashboardStats> => {
        try {
            let url = `${API_URL}/api/dashboard/stats?campaign=${encodeURIComponent(campaign)}&time_range=${range}`;
            if (days) url += `&days=${days}`;
            if (company && company !== "all") url += `&company=${encodeURIComponent(company)}`;
            
            const response = await fetchWithTimeout(url, { 
                signal,
                cache: 'no-store'
            });

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
    getEmailStats: async (days?: number, company?: string, signal?: AbortSignal, range: string = "month"): Promise<any> => {
        let url = `${API_URL}/api/dashboard/email-stats?range=${range}`;
        if (days) url += `&days=${days}`;
        if (company && company !== "all") {
            url += `&company=${encodeURIComponent(company)}`;
        }
        const response = await fetchWithTimeout(url, { 
            signal,
            cache: 'no-store'
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Dashboard API Email Stats Error [${response.status}]: ${response.statusText}`, errorText);
            throw new Error(`Error fetching email stats: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    },
    getRecentEvents: async (days?: number, company?: string, signal?: AbortSignal, range: string = "month"): Promise<any[]> => {
        let url = `${API_URL}/api/dashboard/recent-events?range=${range}`;
        if (days) url += `&days=${days}`;
        if (company && company !== "all") {
            url += `&company=${encodeURIComponent(company)}`;
        }
        const response = await fetchWithTimeout(url, { 
            signal,
            cache: 'no-store'
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Dashboard API Recent Events Error [${response.status}]: ${response.statusText}`, errorText);
            throw new Error(`Error fetching recent events: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    },
    getEmailsPerCompany: async (days?: number, signal?: AbortSignal): Promise<any[]> => {
        const url = `${API_URL}/api/analytics/emails-per-company?days=${days || 30}`;
        try {
            const response = await fetchWithTimeout(url, { 
                signal,
                cache: 'no-store'
            });
            if (!response.ok) {
                console.error(`Error fetching emails per company: ${response.status} ${response.statusText}`);
                return [];
            }
            const json = await response.json();
            return json.success ? json.data : [];
        } catch (error) {
            console.error("Dashboard API Email Stats Error:", error);
            return []; // Fallback to empty array to show "No Data" gracefully
        }
    },
    getActivity: async (signal?: AbortSignal, days: number = 30, range: string = "month"): Promise<any[]> => {
        const url = `${API_URL}/api/activity?range=${range}&days=${days}`;
        const response = await fetchWithTimeout(url, { signal, cache: 'no-store' });
        if (!response.ok) throw new Error("Error fetching activity");
        return await response.json();
    },
    getCampaignStatus: async (days?: number, signal?: AbortSignal, range: string = "month"): Promise<any[]> => {
        const url = `${API_URL}/api/campaign-status?range=${range}${days ? `&days=${days}` : ''}`;
        const response = await fetchWithTimeout(url, { signal, cache: 'no-store' });
        if (!response.ok) throw new Error("Error fetching campaign status");
        return await response.json();
    },
    updateCompany: async (email: string, company: string): Promise<any> => {
        const response = await fetchWithTimeout(`${API_URL}/api/contacts/company`, {
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
    },
    getCampaignHistory: async (date?: string, signal?: AbortSignal): Promise<any[]> => {
        let url = `${API_URL}/api/campaigns/history`;
        if (date) url += `?date=${date}`;
        const response = await fetchWithTimeout(url, { signal, cache: 'no-store' });
        if (!response.ok) throw new Error("Error fetching campaign history");
        return await response.json();
    },
    searchEmail: async (email: string, signal?: AbortSignal): Promise<any[]> => {
        const url = `${API_URL}/api/search/email?email=${encodeURIComponent(email)}`;
        const response = await fetchWithTimeout(url, { signal, cache: 'no-store' });
        if (!response.ok) throw new Error("Error searching email");
        return await response.json();
    },
    getActivityDetail: async (logId: number, signal?: AbortSignal): Promise<any> => {
        const url = `${API_URL}/api/activity/${logId}`;
        const response = await fetchWithTimeout(url, { signal, cache: 'no-store' });
        if (!response.ok) throw new Error("Error fetching activity detail");
        return await response.json();
    }
};
