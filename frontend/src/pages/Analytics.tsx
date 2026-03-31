import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { ChevronRight, Check, Layers, FastForward, MousePointer2, AlertCircle, Eye, Globe, Activity, EyeOff, Calendar } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { RealtimeFeed } from "@/components/dashboard/RealtimeFeed";
import { DashboardProvider, useDashboard } from "@/context/DashboardContext";

function AnalyticsContent() {
  const { timeRange, days, updateRange, selectedCompanies, setSelectedCompanies, companyFilter } = useDashboard();
  
  const [analyticsData, setAnalyticsData] = useState<any>({
    deliveredEmails: 0,
    openRate: 0,
    clickRate: 0,
    spamRate: 0,
    openRateGrowth: 0,
    clickRateGrowth: 0,
    performanceData: [],
    deviceData: [],
    locationsData: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // Local state for campaign (stays for granular override if needed, but defaults to 'all')
  const [campaign, setCampaign] = useState("all");
  const [showCampaignMenu, setShowCampaignMenu] = useState(false);
  const campaignMenuRef = useRef<HTMLDivElement>(null);
  
  // Date and Company Menu States (copied from Dashboard for sync UI)
  const [showDateMenu, setShowDateMenu] = useState(false);
  const dateMenuRef = useRef<HTMLDivElement>(null);
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const companyMenuRef = useRef<HTMLDivElement>(null);

  const [availableCampaigns, setAvailableCampaigns] = useState<string[]>([]);
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);

  // Fetch meta data
  useEffect(() => {
    async function fetchMeta() {
      try {
        const [campRes, compRes] = await Promise.all([
          fetch("/api/campaigns/names"),
          fetch("/api/companies")
        ]);
        if (campRes.ok) setAvailableCampaigns(await campRes.json());
        if (compRes.ok) setAvailableCompanies(await compRes.json());
      } catch (e) {
        console.error("Failed to fetch meta names", e);
      }
    }
    fetchMeta();
  }, []);

  // Click outside handlers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (campaignMenuRef.current && !campaignMenuRef.current.contains(event.target as Node)) setShowCampaignMenu(false);
      if (dateMenuRef.current && !dateMenuRef.current.contains(event.target as Node)) setShowDateMenu(false);
      if (companyMenuRef.current && !companyMenuRef.current.contains(event.target as Node)) setShowCompanyMenu(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchAnalytics = async (signal?: AbortSignal, silently = false) => {
    try {
      if (!silently) setIsLoading(true);
      
      // SYNCED API CALL: Uses timeRange, companyFilter, and campaign
      let url = `/api/analytics?campaign=${encodeURIComponent(campaign)}&time_range=${timeRange}&days=${days}`;
      if (companyFilter && companyFilter !== "all") url += `&company=${encodeURIComponent(companyFilter)}`;
      
      const response = await fetch(url, { signal });
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Failed to fetch analytics:", error);
      }
    } finally {
      if (!silently) setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchAnalytics(controller.signal);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchAnalytics(controller.signal, true);
      }
    }, 15000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [campaign, timeRange, companyFilter]);

  const formatCompanyName = (name: string) => {
    if (name.length > 20) return name.substring(0, 18) + "...";
    return name;
  };

  const toggleCompany = (name: string) => {
    if (selectedCompanies.includes(name)) {
      setSelectedCompanies(selectedCompanies.filter(c => c !== name));
    } else {
      setSelectedCompanies([...selectedCompanies, name]);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        subtitle="Deep dive into your campaign performance."
      >
        <div className="flex items-center gap-3">
          {/* 1. Date Filter (Synced with Dashboard) */}
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

          {/* 2. Company Filter (Synced with Dashboard) */}
          <div className="relative w-fit min-w-[150px]" ref={companyMenuRef}>
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
                className="absolute right-0 mt-2 bg-card border border-border shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200 min-w-[200px]"
              >
                <div
                  onClick={() => {
                    setSelectedCompanies([]);
                    setShowCompanyMenu(false);
                  }}
                  className={`px-4 py-2.5 text-xs cursor-pointer transition-colors flex items-center justify-between border-b border-border/50 hover:bg-muted ${selectedCompanies.length === 0 ? 'text-emerald-600 font-bold' : 'text-muted-foreground'}`}
                >
                  All Companies
                  {selectedCompanies.length === 0 && <Check className="h-3 w-3" />}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {availableCompanies.map((name) => (
                    <div
                      key={name}
                      onClick={() => toggleCompany(name)}
                      className={`px-4 py-2 text-[11px] cursor-pointer transition-colors flex items-center justify-between hover:bg-muted ${selectedCompanies.includes(name) ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-foreground'}`}
                    >
                      {name}
                      {selectedCompanies.includes(name) && <Check className="h-3 w-3" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Campaign Selector (Granular Override) */}
          <div className="relative w-72" ref={campaignMenuRef}>
            <div
              style={{ borderRadius: "14px" }}
              onClick={() => setShowCampaignMenu(!showCampaignMenu)}
              className={`flex items-center gap-2 h-9 px-4 border cursor-pointer transition-all bg-card hover:bg-muted text-xs font-semibold w-full ${showCampaignMenu ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-sm' : 'border-border shadow-sm'}`}
            >
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-foreground flex-1 truncate transition-colors duration-300">
                {campaign === "all" ? "All Campaigns" : campaign}
              </span>
              <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showCampaignMenu ? 'rotate-90' : 'rotate-0'}`} />
            </div>

            {showCampaignMenu && (
              <div
                style={{ borderRadius: "14px" }}
                className="absolute left-0 right-0 mt-2 bg-card border border-border shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                {[
                  { val: "all", label: "All Campaigns" },
                  ...availableCampaigns.map(name => ({ val: name, label: name }))
                ].map((opt) => (
                  <div
                    key={opt.val}
                    onClick={() => {
                      setCampaign(opt.val);
                      setShowCampaignMenu(false);
                    }}
                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between ${campaign === opt.val ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 font-medium' : 'text-foreground hover:bg-muted'}`}
                  >
                    {opt.label}
                    {campaign === opt.val && <Check className="h-4 w-4" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PageHeader>

      {/* Analytics Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-indigo-500/10 shadow-sm bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Delivered</CardTitle>
            <FastForward className="h-3.5 w-3.5 text-emerald-500 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground tabular-nums">{analyticsData.deliveredEmails?.toLocaleString() || 0}</div>
            <p className={`text-[10px] mt-1 flex items-center gap-1 ${analyticsData.deliveredEmailsGrowth >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              <span className="font-bold">{analyticsData.deliveredEmailsGrowth > 0 ? "+" : ""}{analyticsData.deliveredEmailsGrowth}%</span>
              <span className="text-muted-foreground/50 font-medium capitalize">vs last {timeRange}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-indigo-500/10 shadow-sm bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Open Rate</CardTitle>
            <Eye className="h-3.5 w-3.5 text-indigo-500 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground tabular-nums">{analyticsData.openRate}%</div>
            <p className={`text-[10px] mt-1 flex items-center gap-1 ${analyticsData.openRateGrowth >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              <span className="font-bold">{analyticsData.openRateGrowth > 0 ? "+" : ""}{analyticsData.openRateGrowth}%</span>
              <span className="text-muted-foreground/50 font-medium capitalize">vs last {timeRange}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-indigo-500/10 shadow-sm bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Click Rate</CardTitle>
            <MousePointer2 className="h-3.5 w-3.5 text-violet-500 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground tabular-nums">{analyticsData.clickRate}%</div>
            <p className={`text-[10px] mt-1 flex items-center gap-1 ${analyticsData.clickRateGrowth >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              <span className="font-bold">{analyticsData.clickRateGrowth > 0 ? "+" : ""}{analyticsData.clickRateGrowth}%</span>
              <span className="text-muted-foreground/50 font-medium capitalize">vs last {timeRange}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-indigo-500/10 shadow-sm bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Unread</CardTitle>
            <EyeOff className="h-3.5 w-3.5 text-amber-500 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground tabular-nums">{analyticsData.unread?.toLocaleString() || 0}</div>
            <p className="text-[10px] mt-1 flex items-center gap-1 text-muted-foreground">
              <span className="font-medium">Total unread emails</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-indigo-500/10 shadow-sm bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Spam Reports</CardTitle>
            <AlertCircle className="h-3.5 w-3.5 text-red-500 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground tabular-nums">{analyticsData.spamRate || 0}%</div>
            <p className={`text-[10px] mt-1 flex items-center gap-1 ${analyticsData.spamRateGrowth <= 0 ? "text-emerald-500" : "text-red-500"}`}>
              <span className="font-bold">{analyticsData.spamRateGrowth > 0 ? "+" : ""}{analyticsData.spamRateGrowth}%</span>
              <span className="text-muted-foreground/50 font-medium capitalize">vs last {timeRange}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 h-[600px]">
          <RealtimeFeed campaignName={campaign} companyName={companyFilter} />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.performanceData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderRadius: '12px',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))'
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="opens" stroke="#4F46E5" strokeWidth={3} dot={false} name="Opens" />
                    <Line type="monotone" dataKey="clicks" stroke="#22C55E" strokeWidth={3} dot={false} name="Clicks" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Engagement by Device</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.deviceData} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                      <Bar dataKey="value" fill="#4F46E5" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Locations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.locationsData && analyticsData.locationsData.length > 0 ? (
                    analyticsData.locationsData.map((loc: any, i: number) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold">{loc.city}</span>
                          <span className="text-[10px] text-muted-foreground">{loc.country}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-mono">{loc.opens}</span>
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500" style={{ width: `${loc.rate}%` }} />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
                      <Globe className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">No location data yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Card className="border-indigo-500/10 shadow-xl shadow-indigo-500/5 overflow-hidden">
        <CardHeader className="border-b border-indigo-500/5 bg-indigo-500/5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <MousePointer2 className="h-4 w-4 text-indigo-500" />
                Link Performance
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-0.5">
                Which of your links are getting the most clicks?
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] h-5 border-indigo-500/20 text-indigo-600 bg-indigo-500/10 px-2 font-bold uppercase tracking-tight">
              Real-time Analytics
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted/30 border-b border-border/50">
                <tr>
                  <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Destination URL</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center">Total Clicks</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Engagement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {analyticsData.linkData && analyticsData.linkData.length > 0 ? (
                  analyticsData.linkData.map((link: any, i: number) => (
                    <tr key={i} className="group hover:bg-muted/20 transition-all duration-300">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 group-hover:scale-110 transition-transform">
                            <Globe className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-medium text-foreground truncate max-w-[400px]">{link.url}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/10 font-mono text-xs px-3 h-6">
                          {link.clicks}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000"
                              style={{ width: `${Math.min(100, (link.clicks / (analyticsData.deliveredEmails || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground w-10 text-right">
                            {((link.clicks / (analyticsData.deliveredEmails || 1)) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center opacity-50">
                      <MousePointer2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">No link activity recorded yet</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Analytics() {
  return (
    <DashboardProvider>
      <AnalyticsContent />
    </DashboardProvider>
  );
}
