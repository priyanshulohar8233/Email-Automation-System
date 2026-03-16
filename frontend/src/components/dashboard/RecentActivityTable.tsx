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
import { RefreshCcw, Activity } from "lucide-react";
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
      return base + "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20";
    case "clicked":
      return base + "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border-blue-500/20";
    case "bounced":
      return base + "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border-rose-500/20";
    case "sent":
      return base + "bg-slate-500/10 text-slate-600 dark:text-slate-100 hover:bg-slate-500/20 border-slate-500/30";
    default:
      return base + "bg-slate-500/10 text-slate-500 dark:text-slate-300";
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
    <Card className="border-border bg-card shadow-sm transition-colors duration-300 overflow-hidden">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-foreground text-lg flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-500" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex h-32 items-center justify-center gap-2 text-muted-foreground">
            <RefreshCcw className="h-5 w-5 animate-spin text-indigo-500" />
            <span className="text-sm font-medium">Loading activity...</span>
          </div>
        ) : error || events.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground italic">No Recent Activity</div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[60px] h-10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-6 py-0">
                  #
                </TableHead>
                <TableHead className="h-10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-0">
                  Recipient Name
                </TableHead>
                <TableHead className="h-10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-0">
                  Company
                </TableHead>
                <TableHead className="h-10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-0">
                  Country
                </TableHead>
                <TableHead className="h-10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-0 text-center">
                  Status
                </TableHead>
                <TableHead className="h-10 text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-6 py-0 text-right">
                  Time
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev, index) => (
                <TableRow key={ev.id} className="group border-border transition-colors hover:bg-muted/50">
                  <TableCell className="text-muted-foreground/60 font-medium px-6 py-4">
                    {index + 1}
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground leading-tight text-sm">
                        {ev.recipient_name}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium mt-0.5">
                        {ev.recipient}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-medium text-sm px-4 py-4">
                    {ev.company}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs px-4 py-4">
                    {ev.country || "Unknown"}
                  </TableCell>
                  <TableCell className="text-center px-4 py-4">
                    <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight border ${getBadgeStyles(ev.event_type)}`}>
                      {ev.event_type}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs px-6 py-4 tabular-nums font-medium">
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
