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
  event_type: string;
  timestamp: string;
  location: string;
}

function getBadgeVariant(event_type: string): "success" | "destructive" | "secondary" | "default" {
  switch (event_type.toLowerCase()) {
    case "opened": return "success";
    case "clicked": return "success";
    case "bounced": return "destructive";
    default: return "secondary";
  }
}

function formatTime(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? "s" : ""} ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} hour${diffH > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString();
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
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
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
              <TableRow>
                <TableHead>Email ID</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="font-medium">#{ev.email_id}</TableCell>
                  <TableCell>{ev.recipient}</TableCell>
                  <TableCell className="text-xs text-slate-500">{ev.location}</TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(ev.event_type)}>
                      {ev.event_type.charAt(0).toUpperCase() + ev.event_type.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">{formatTime(ev.timestamp)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
