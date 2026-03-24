import { useState, useEffect } from "react";
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
  PieChart,
  Pie,
  Cell,
  Legend,
  Sector
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCcw } from "lucide-react";
import { dashboardAPI } from "@/services/dashboardAPI";

const COMPANY_COLORS: Record<string, string> = {
  "MP Consultant LLC": "#FFC107", // Yellow
  "MP Lumina": "#7B61FF",         // Purple
  "A Making Company": "#FF4D4F",  // Red
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 p-4 rounded-2xl shadow-2xl ring-1 ring-white/10">
        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
          {label}
        </p>
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white tabular-nums tracking-tighter">
              {payload[0].value}
            </span>
            <span className="text-xs font-medium text-slate-400">emails sent</span>
          </div>
          <div className="h-0.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 w-full opacity-50" />
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const PieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (data.name === "No Data") return null;
    return (
      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 p-3 rounded-xl shadow-xl ring-1 ring-white/10">
        <p className="text-sm font-semibold text-white flex items-center gap-2 m-0">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: COMPANY_COLORS[data.name] || "#6366F1" }}
          />
          {data.name} - {data.value} Emails
        </p>
      </div>
    );
  }
  return null;
};

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 0 8px rgba(99,102,241,0.4))', transition: 'all 0.3s ease' }}
      />
    </g>
  );
};

export function DashboardCharts({ days = 30, company = "all" }: { days?: number, company?: string }) {
  const [lineData, setLineData] = useState<{ day: string; emails: number }[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Fetch both stats and email stats in parallel
    Promise.all([
      dashboardAPI.getEmailStats(days, company),
      dashboardAPI.getStats(days, "all", company),
      dashboardAPI.getCampaignStatus()
    ])
      .then(([emailStats, stats, companyStatus]) => {
        // Process email stats for line chart
        if (Array.isArray(emailStats)) {
          setLineData(emailStats);
        }

        // Use emails per company (new endpoint) for the donut chart
        if (Array.isArray(companyStatus) && companyStatus.length > 0) {
          const formattedStats = companyStatus.map((stat: any) => ({
            name: stat.company,
            value: stat.total
          }));
          setPieData(formattedStats);
        } else if (stats.raw) {
          // Fallback to old status data if no company data yet
          setPieData([
            { name: "Opened", value: stats.raw.opened },
            { name: "Unread", value: stats.raw.unread },
            { name: "Bounced", value: stats.raw.bounced },
          ]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading charts:", err);
        setError("Failed to load chart data. Please check your connection and try again.");
        setLoading(false);
        setLineData([]);
        setPieData([]);
      });
  }, [days, company]);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(-1);
  };

  const hasData = pieData.length > 0 && pieData.some(d => d.value > 0);
  const chartData = hasData ? pieData : [{ name: "No Data", value: 1 }];

  const axisColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  return (
    <div className="grid grid-cols-12 gap-6">
      <Card className="col-span-12 lg:col-span-8 border-indigo-500/10 shadow-xl shadow-indigo-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
            Emails Sent Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full pt-4">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-slate-400">
                <RefreshCcw className="h-5 w-5 animate-spin text-indigo-500" />
                <span className="text-sm font-semibold">Generating report...</span>
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center text-sm text-destructive font-medium">
                {error}
              </div>
            ) : lineData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400 italic">
                No activity records found for this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lineData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity={1} />
                      <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: isDark ? "#E5E7EB" : "#111827", fontSize: 11, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: axisColor, strokeWidth: 1 }}
                    dy={12}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: isDark ? "#E5E7EB" : "#111827", fontSize: 11, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: axisColor, strokeWidth: 1 }}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                  />
                  <Tooltip
                    cursor={false}
                    content={<CustomTooltip />}
                    animationDuration={200}
                  />
                  <Bar
                    dataKey="emails"
                    fill="url(#barGradient)"
                    radius={[8, 8, 2, 2]}
                    barSize={days === 365 ? 20 : days === 90 ? 30 : 40}
                    animationDuration={1500}
                    animationEasing="ease-out"
                    activeBar={(props: any) => {
                      const { x, y, width, height } = props;
                      return (
                        <rect
                          x={x}
                          y={y - 6}
                          width={width}
                          height={height + 6}
                          fill="#818CF8"
                          rx={8}
                          ry={8}
                          style={{ 
                            filter: 'drop-shadow(0 0 8px rgba(99,102,241,0.6))',
                            transition: 'all 0.3s ease'
                          }}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <CardHeader>
          <CardTitle>Campaign Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full flex flex-col items-center justify-center">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-slate-400">
                <RefreshCcw className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading chart...</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData.some(d => d.value > 0) ? pieData : [{ name: 'No Data', value: 1 }]}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={85}
                    fill="#8884d8"
                    paddingAngle={pieData.some(d => d.value > 0) ? 5 : 0}
                    dataKey="value"
                    stroke="none"
                    animationDuration={1500}
                    animationBegin={200}
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    onMouseEnter={onPieEnter}
                    onMouseLeave={onPieLeave}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === "No Data" ? "#E2E8F0" : (COMPANY_COLORS[entry.name] || "#6366F1")} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<PieTooltip />}
                    cursor={false}
                  />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    iconType="square"
                    wrapperStyle={{ paddingTop: "20px" }}
                    content={(props) => {
                      const { payload } = props;
                      return (
                        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                          {payload?.map((entry: any, index: number) => {
                            const name = entry.value;
                            const value = entry.payload.value;
                            const color = name === "No Data" ? "#E2E8F0" : (COMPANY_COLORS[name] || "#6366F1");
                            return (
                              <div key={`item-${index}`} className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 capitalize">
                                  {name}
                                </span>
                                {pieData.some(d => d.value > 0) && name !== "No Data" && (
                                  <span className="text-xs text-slate-500 font-medium ml-1">
                                    {value} {value === 1 ? 'Email' : 'Emails'}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div >
  );
}
