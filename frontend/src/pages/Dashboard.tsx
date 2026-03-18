import { KPICard } from "@/components/dashboard/KPICard";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { RecentActivityTable } from "@/components/dashboard/RecentActivityTable";
import { Button } from "@/components/ui/button";
import { Calendar, Mail, EyeOff, Send, XCircle, Activity, MousePointerClick, ChevronRight, RefreshCcw, Sun, Moon, Layers, Check } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CreateCampaignModal } from "@/components/dashboard/CreateCampaignModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { dashboardAPI, DashboardStats } from "@/services/dashboardAPI";

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [days, setDays] = useState<number>(() => {
    const saved = localStorage.getItem("dashboard_days");
    return saved ? parseInt(saved) : 30;
  });

  useEffect(() => {
    localStorage.setItem("dashboard_days", days.toString());
  }, [days]);

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
      const data = await dashboardAPI.getStats(days, "all", signal);
      setStats(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!silently) setError("Failed to load dashboard metrics. Please try again.");
    } finally {
      if (!silently) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchStats(controller.signal);

    const interval = setInterval(() => {
      fetchStats(undefined, true);
    }, 30000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [days]);

  return (
    <div className="space-y-8">
      {/* Top Section */}
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your email campaigns performance."
      >
        <div className="relative w-fit min-w-[120px]" ref={dateMenuRef}>
          <div
            style={{ borderRadius: "14px" }}
            onClick={() => setShowDateMenu(!showDateMenu)}
            className={`flex items-center gap-2.5 h-9 px-4 border cursor-pointer transition-all bg-card hover:bg-muted text-xs font-semibold w-fit whitespace-nowrap ${showDateMenu ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-sm' : 'border-border shadow-sm'}`}
          >
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-foreground transition-colors duration-300">
              {days === 7 ? "Week" : days === 30 ? "Month" : days === 90 ? "Quarter" : "Year"}
            </span>
            <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0 ${showDateMenu ? 'rotate-90' : 'rotate-0'}`} />
          </div>

          {showDateMenu && (
            <div
              style={{ borderRadius: "14px" }}
              className="absolute left-0 mt-2 bg-card border border-border shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200 min-w-full w-max"
            >
              {[
                { val: 7, label: "Week" },
                { val: 30, label: "Month" },
                { val: 90, label: "Quarter" },
                { val: 365, label: "Year" }
              ].map((opt) => (
                <div
                  key={opt.val}
                  onClick={() => {
                    setDays(opt.val);
                    setShowDateMenu(false);
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between ${days === opt.val ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 font-medium' : 'text-foreground hover:bg-muted'}`}
                >
                  {opt.label}
                  {days === opt.val && <Activity className="h-3.5 w-3.5" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </PageHeader>

      {/* KPI Cards */}
      {loading ? (
        <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border bg-card shadow-sm transition-colors duration-300">
          <RefreshCcw className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="ml-3 text-sm font-semibold text-muted-foreground">Loading metrics...</span>
        </div>
      ) : error ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-center transition-colors duration-300">
          <p className="text-sm font-semibold text-destructive mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchStats} className="rounded-xl h-9 border-border hover:bg-muted font-semibold text-xs">
            <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Try Again
          </Button>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard
            label="Total Emails Sent"
            value={stats.totalEmails.toLocaleString()}
            growth={stats.totalEmailsGrowth ?? 0}
            icon={Send}
          />
          <KPICard
            label="Open Rate"
            value={`${stats.openRate}%`}
            growth={stats.openRateGrowth ?? 0}
            icon={Mail}
          />
          <KPICard
            label="Click Rate"
            value={`${stats.clickRate}%`}
            growth={stats.clickRateGrowth ?? 0}
            icon={MousePointerClick}
          />
          <KPICard
            label="Unread"
            value={stats.unread.toLocaleString()}
            growth={stats.unreadGrowth ?? 0}
            icon={EyeOff}
          />
          <KPICard
            label="Bounce Rate"
            value={`${stats.bounceRate}%`}
            growth={stats.bounceRateGrowth ?? 0}
            icon={XCircle}
          />
          <KPICard
            label="Active Campaigns"
            value={stats.activeCampaigns.toString()}
            growth={stats.activeCampaignsGrowth ?? 0}
            icon={Activity}
          />
        </div>
      ) : null}

      {/* Charts Section */}
      <DashboardCharts days={days} />

      {/* Recent Activity */}
      <div className="grid gap-4">
        <RecentActivityTable days={days} />
      </div>
    </div>
  );
}
