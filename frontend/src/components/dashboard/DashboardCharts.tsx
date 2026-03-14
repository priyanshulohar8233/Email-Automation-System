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
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-3 rounded-xl shadow-2xl">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <p className="text-sm font-semibold text-white">
            {payload[0].value} <span className="text-slate-400 font-normal">emails</span>
          </p>
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
        // Process email stats for line chart (dates/emails object)
        if (emailStats && emailStats.dates && emailStats.emails) {
          const formatted = emailStats.dates.map((date: string, i: number) => ({
            day: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
            emails: emailStats.emails[i]
          }));
          setLineData(formatted);
        }

        // Process stats for pie chart
        const total = stats.deliveredCount || stats.totalEmails || 0;
        const opened = stats.openedCount || 0;
        const bounced = stats.bouncedCount || 0;
        const unread = Math.max(0, total - opened);

        setPieData([
          { name: "Opened", value: opened },
          { name: "Unread", value: unread },
          { name: "Bounced", value: bounced },
        ]);
        
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading charts:", err);
        setError("Failed to load chart data. Please check your connection and try again.");
        setLoading(false);
        // Set placeholder data to show some UI
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
      <Card className="col-span-12 lg:col-span-8">
        <CardHeader>
          <CardTitle>Emails Sent Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-slate-400">
                <RefreshCcw className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading chart...</span>
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center text-sm text-destructive">
                {error}
              </div>
            ) : lineData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No email data available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lineData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.5} />
                  <XAxis
                    dataKey="day"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}`}
                    dx={-10}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)', radius: [6, 6, 0, 0] }}
                    content={<CustomTooltip />}
                  />
                  <Bar
                    dataKey="emails"
                    fill="#6366F1"
                    radius={[6, 6, 0, 0]}
                    barSize={32}
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                    activeBar={{
                      fill: '#818CF8',
                      stroke: '#C7D2FE',
                      strokeWidth: 1,
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
