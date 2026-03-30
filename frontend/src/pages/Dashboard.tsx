import { KPICard } from "@/components/dashboard/KPICard";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { RecentActivityTable } from "@/components/dashboard/RecentActivityTable";
import { Button } from "@/components/ui/button";
import { Calendar, Mail, EyeOff, Send, XCircle, Activity, MousePointerClick, ChevronRight, RefreshCcw, Layers, Check } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { dashboardAPI, DashboardStats } from "@/services/dashboardAPI";
import { DashboardProvider, useDashboard } from "@/context/DashboardContext";

function DashboardContent() {
  const { timeRange, days, updateRange } = useDashboard();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDateMenu, setShowDateMenu] = useState(false);
  
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const company = useMemo(() => {
    return selectedCompanies.length > 0 ? selectedCompanies.join(",") : "all";
  }, [selectedCompanies]);

  const COMPANIES = [
    "A Making Company",
    "MP Consultant LLC",
    "MP Lumina"
  ];

  const formatCompanyName = (name: string) => {
    return name;
  };

  const dateMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dateMenuRef.current && !dateMenuRef.current.contains(event.target as Node)) {
        setShowDateMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchStats = async (signal?: AbortSignal, silently: boolean = false) => {
    try {
      if (!silently) {
        setLoading(true);
        setError(null);
      }
      const data = await dashboardAPI.getStats(days, "all", company, signal, timeRange);
      setStats(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error("Dashboard error:", err);
      if (!silently) {
        setStats({
          totalEmails: 0, openRate: 0, clickRate: 0, bounceRate: 0,
          unread: 0, activeCampaigns: 0, totalEmailsGrowth: 0, openRateGrowth: 0,
          clickRateGrowth: 0, bounceRateGrowth: 0, unreadGrowth: 0, activeCampaignsGrowth: 0,
          vsLabel: "vs last month",
          raw: { bounced: 0, opened: 0, delivered: 0, unread: 0 }
        });
        setError("Dashboard metrics currently unavailable.");
      }
    } finally {
      if (!silently) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchStats(controller.signal);

    const interval = setInterval(() => {
      fetchStats(undefined, true);
    }, 15000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [days, company, timeRange]);

  return (
    <div className="space-y-8">
      {/* Top Section */}
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your email campaigns performance."
      >
        <div className="flex items-center gap-3">
          {/* Date Filter */}
          <div className="relative w-fit min-w-[120px]" ref={dateMenuRef}>
            <div
              style={{ borderRadius: "14px" }}
              onClick={() => setShowDateMenu(!showDateMenu)}
              className={`flex items-center gap-2.5 h-9 px-4 border cursor-pointer transition-all bg-card hover:bg-muted text-xs font-semibold w-fit whitespace-nowrap ${showDateMenu ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-sm' : 'border-border shadow-sm'}`}
            >
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-foreground transition-colors duration-300 capitalize">
                {timeRange}
              </span>
              <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${showDateMenu ? 'rotate-90' : 'rotate-0'}`} />
            </div>

            {showDateMenu && (
              <div
                style={{ borderRadius: "14px" }}
                className="absolute left-0 mt-2 bg-card border border-border shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200 min-w-full w-max"
              >
                {(['week', 'month', 'quarter', 'year'] as const).map((r) => (
                  <div
                    key={r}
                    onClick={() => {
                      updateRange(r);
                      setShowDateMenu(false);
                    }}
                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between capitalize ${timeRange === r ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 font-medium' : 'text-foreground hover:bg-muted'}`}
                  >
                    {r}
                    {timeRange === r && <Activity className="h-3.5 w-3.5" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Company Filter (Multi-select) */}
          <div className="relative w-fit min-w-[150px]">
            <div
              style={{ borderRadius: "14px" }}
              onClick={() => setShowCompanyMenu(!showCompanyMenu)}
              className={`flex items-center gap-2.5 h-9 px-4 border cursor-pointer transition-all bg-card hover:bg-muted text-xs font-semibold w-fit whitespace-nowrap ${showCompanyMenu ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-sm' : 'border-border shadow-sm'}`}
            >
              <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-foreground transition-colors duration-300">
                {selectedCompanies.length === 0 ? "All Companies" : selectedCompanies.length === 1 ? formatCompanyName(selectedCompanies[0]) : `${selectedCompanies.length} Selected`}
              </span>
              <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${showCompanyMenu ? 'rotate-90' : 'rotate-0'}`} />
            </div>

            {showCompanyMenu && (
              <div
                style={{ borderRadius: "14px" }}
                className="absolute right-0 mt-2 bg-card border border-border shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200 min-w-[220px]"
              >
                {COMPANIES.map((company) => (
                  <div
                    key={company}
                    onClick={() => {
                      setSelectedCompanies(prev => 
                        prev.includes(company) 
                          ? prev.filter(c => c !== company) 
                          : [...prev, company]
                      );
                    }}
                    className={`px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted flex items-center justify-between gap-4 ${selectedCompanies.includes(company) ? 'bg-emerald-500/5' : ''}`}
                  >
                    <span className={`text-sm font-semibold truncate ${selectedCompanies.includes(company) ? 'text-emerald-500' : 'text-foreground'}`}>
                      {formatCompanyName(company)}
                    </span>
                    {selectedCompanies.includes(company) && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                  </div>
                ))}
                {selectedCompanies.length > 0 && (
                  <div
                    onClick={() => setSelectedCompanies([])}
                    className="mt-1 border-t border-border px-4 py-2 text-[10px] text-center font-bold text-destructive hover:bg-destructive/10 cursor-pointer uppercase tracking-wider"
                  >
                    Clear Filter
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          label="Total Emails Sent"
          value={stats?.totalEmails.toLocaleString() || "0"}
          growth={stats?.totalEmailsGrowth ?? 0}
          icon={Send}
          loading={loading && !stats}
          vsLabel={stats?.vsLabel}
        />
        <KPICard
          label="Open Rate"
          value={stats ? `${stats.openRate}%` : "0%"}
          growth={stats?.openRateGrowth ?? 0}
          icon={Mail}
          loading={loading && !stats}
          vsLabel={stats?.vsLabel}
        />
        <KPICard
          label="Click Rate"
          value={stats ? `${stats.clickRate}%` : "0%"}
          growth={stats?.clickRateGrowth ?? 0}
          icon={MousePointerClick}
          loading={loading && !stats}
          vsLabel={stats?.vsLabel}
        />
        <KPICard
          label="Unread"
          value={stats?.unread.toLocaleString() || "0"}
          growth={stats?.unreadGrowth ?? 0}
          icon={EyeOff}
          loading={loading && !stats}
          vsLabel={stats?.vsLabel}
        />
        <KPICard
          label="Bounce Rate"
          value={stats ? `${stats.bounceRate}%` : "0%"}
          growth={stats?.bounceRateGrowth ?? 0}
          icon={XCircle}
          loading={loading && !stats}
          vsLabel={stats?.vsLabel}
        />
        <KPICard
          label="Active Campaigns"
          value={stats?.activeCampaigns.toString() || "0"}
          growth={stats?.activeCampaignsGrowth ?? 0}
          icon={Activity}
          loading={loading && !stats}
          vsLabel={stats?.vsLabel}
        />
      </div>

      {error && !stats && (
        <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-center transition-colors duration-300">
          <p className="text-sm font-semibold text-destructive mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchStats()} className="rounded-xl h-9 border-border hover:bg-muted font-semibold text-xs">
            <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Try Again
          </Button>
        </div>
      )}

      {/* Charts Section */}
      <DashboardCharts days={days} company={company} />

      {/* Recent Activity - Now synced with dashboard filters */}
      <div className="grid gap-4">
        <RecentActivityTable days={days} company={company} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
