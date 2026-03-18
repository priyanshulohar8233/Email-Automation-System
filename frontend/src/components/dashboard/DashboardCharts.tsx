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
  Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCcw } from "lucide-react";
import { dashboardAPI } from "@/services/dashboardAPI";

const COLOR_MAP: Record<string, string> = {
  Opened: "#6366F1", // Indigo
  Unread: "#10B981", // Emerald
  Bounced: "#F59E0B", // Amber
  "No Data": "#E2E8F0", // Slate
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

export function DashboardCharts({ days = 30 }: { days?: number }) {
  const [lineData, setLineData] = useState<{ day: string; emails: number }[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Fetch both stats and email stats in parallel
    Promise.all([
      dashboardAPI.getEmailStats(days),
      dashboardAPI.getStats(days)
    ])
      .then(([emailStats, stats]) => {
        // Process email stats for line chart
        if (Array.isArray(emailStats)) {
          setLineData(emailStats);
        }

        if (stats.raw) {
          setPieData([
            { name: "Opened", value: stats.raw.opened },
            { name: "Unread", value: stats.raw.unread },
            { name: "Bounced", value: stats.raw.bounced },
          ]);
        } else {
          // Fallback to rate-based approximation if raw is missing
          const total = stats.totalEmails || 0;
          const opened = Math.round(total * (stats.openRate / 100));
          const bounced = Math.round(total * (stats.bounceRate / 100));
          const unread = Math.max(0, total - opened - bounced);

          setPieData([
            { name: "Opened", value: opened },
            { name: "Unread", value: unread },
            { name: "Bounced", value: bounced },
          ]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading charts:", err);
        setError("Failed to load chart data. Please check your connection and try again.");
        setLoading(false);
        setLineData([]);
        setPieData([
          { name: "Delivered", value: 0 },
          { name: "Opened", value: 0 },
          { name: "Unread", value: 0 },
          { name: "Bounced", value: 0 },
        ]);
      });
  }, [days]);

  const hasData = pieData.some(d => d.value > 0);
  const chartData = hasData ? pieData : [{ name: "No Data", value: 1 }];

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
                <BarChart data={lineData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity={1} />
                      <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="day"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    fontWeight={600}
                    tickLine={false}
                    axisLine={false}
                    dy={12}
                    interval={days === 365 ? 1 : 0}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    fontWeight={600}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4, radius: [8, 8, 0, 0] }}
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
                    activeBar={{
                      fill: '#818CF8',
                      stroke: '#6366F1',
                      strokeWidth: 2,
                      radius: [10, 10, 2, 2]
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
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLOR_MAP[entry.name] || "#CBD5E1"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    iconType="square"
                    content={(props) => {
                      const { payload } = props;
                      return (
                        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4">
                          {payload?.map((entry: any, index: number) => (
                            <div key={`item-${index}`} className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR_MAP[entry.value] || entry.color }} />
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 capitalize">
                                {entry.value}
                              </span>
                              {pieData.some(d => d.value > 0) && entry.value !== "No Data" && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({pieData.find(d => d.name === entry.value)?.value || 0})
                                </span>
                              )}
                            </div>
                          ))}
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
