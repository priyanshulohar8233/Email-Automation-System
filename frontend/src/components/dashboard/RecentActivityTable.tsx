import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCcw } from "lucide-react";
import { dashboardAPI } from "@/services/dashboardAPI";

interface RecentEvent {
  id: number;
  email_id: number;
  recipient: string;
  recipient_name: string;
  company: string;
  country: string;
  event_type: string;
  timestamp: string;
  location: string;
}

function getBadgeStyles(event_type: string): string {
  const base = "transition-all duration-200 hover:scale-105 cursor-default ";
  switch (event_type.toLowerCase()) {
    case "delivered":
    case "opened":
      return base + "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20";
    case "clicked":
      return base + "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20";
    case "bounced":
      return base + "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/20";
    case "sent":
      return base + "bg-slate-500/10 text-slate-100 hover:bg-slate-500/20 border-slate-500/30";
    default:
      return base + "bg-slate-500/10 text-slate-300";
  }
}

function formatTime(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  if (isToday) {
    return timeStr;
  } else {
    const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
    return `${dateStr} (${timeStr})`;
  }
}

export function RecentActivityTable({ days = 30 }: { days?: number }) {
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardAPI.getRecentEvents(days)
      .then((data) => { setEvents(data); setLoading(false); })
      .catch(() => { setError("Failed to load recent activity."); setLoading(false); });
  }, [days]);

  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-slate-100">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-24 items-center justify-center gap-2 text-slate-400">
            <RefreshCcw className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading activity...</span>
          </div>
        ) : error || events.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-slate-400">No Recent Activity</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="w-[60px] text-xs font-semibold uppercase tracking-wider text-slate-400">
                  #
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Recipient Name
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Company
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Country
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-300 text-center">
                  Status
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-300 text-right">
                  Time
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev, index) => (
                <TableRow key={ev.id} className="group border-slate-800 transition-colors hover:bg-slate-800/30">
                  <TableCell className="text-slate-500 font-medium py-4">
                    {index + 1}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-100 leading-tight">
                        {ev.recipient_name}
                      </span>
                      <span className="text-xs text-slate-400 mt-0.5">
                        {ev.recipient}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300 py-4">
                    {ev.company}
                  </TableCell>
                  <TableCell className="text-slate-400 text-sm py-4">
                    {ev.country || "Unknown"}
                  </TableCell>
                  <TableCell className="text-center py-4">
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeStyles(ev.event_type)}`}>
                      {ev.event_type.charAt(0).toUpperCase() + ev.event_type.slice(1)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-slate-300 text-sm py-4 tabular-nums">
                    {formatTime(ev.timestamp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
