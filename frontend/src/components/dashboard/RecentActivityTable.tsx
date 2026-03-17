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
import { RefreshCcw, Activity, Pencil, Check, X } from "lucide-react";
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
  const type = event_type.toLowerCase();
  
  if (type === "delivered") {
    return base + "bg-[#A5C89E] text-[#1f3d1f] border-[#AEB877] dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
  }
  if (type === "opened") {
    return base + "bg-[#D8E983] text-[#2f4f2f] border-[#A5C89E] dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
  }
  if (type === "clicked") {
    return base + "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  }
  if (type === "bounced") {
    return base + "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
  }
  if (type === "sent") {
    return base + "bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700";
  }
  
  return base + "bg-muted text-muted-foreground border-border";
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
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Detect dark mode to apply direct style fixes
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkTheme();
    
    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const fetchEvents = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardAPI.getRecentEvents(days, signal);
      setEvents(data);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError("Failed to load recent activity.");
        console.error("Failed to load recent activity:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchEvents(controller.signal);
    return () => controller.abort();
  }, [days]);

  const handleUpdateCompany = async (eventId: number, email: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    
    try {
      setIsSaving(true);
      await dashboardAPI.updateCompany(email, trimmed);
      
      // Update local state for immediate feedback
      setEvents(prev => prev.map(ev => 
        ev.recipient === email ? { ...ev, company: trimmed } : ev
      ));
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update company:", err);
      // Optional: Show error toast/notification
    } finally {
      setIsSaving(false);
    }
  };

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
                <TableRow key={ev.id} className="group hover:bg-muted/50 transition-colors duration-200 border-b border-border/50">
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
                  <TableCell className="px-4 py-4">
                    <div className="flex items-center min-h-[32px]">
                      {editingId === ev.id ? (
                        <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-left-2 duration-200">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateCompany(ev.id, ev.recipient);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="flex-1 px-2 py-1 text-sm bg-background border border-indigo-500 rounded-md outline-none ring-1 ring-indigo-500 focus:border-indigo-600 focus:ring-indigo-600 transition-all"
                            autoFocus
                            disabled={isSaving}
                          />
                          <button 
                            onClick={() => handleUpdateCompany(ev.id, ev.recipient)}
                            disabled={isSaving}
                            className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-md transition-colors"
                            title="Save"
                          >
                            <Check className={`h-4 w-4 ${isSaving ? 'animate-pulse' : ''}`} />
                          </button>
                          <button 
                            onClick={() => setEditingId(null)}
                            disabled={isSaving}
                            className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 transition-all duration-300">
                          <span className="font-semibold text-foreground truncate max-w-[120px]">
                            {ev.company}
                          </span>
                          <button
                            onClick={() => {
                              setEditingId(ev.id);
                              setEditValue(ev.company);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-md transition-all focus:opacity-100 outline-none"
                            title="Update Company"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs px-4 py-4">
                    {ev.country || "Unknown"}
                  </TableCell>
                  <TableCell className="text-center px-4 py-4">
                    <div 
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-tight border ${getBadgeStyles(ev.event_type)}`}
                      style={ev.event_type.toLowerCase() === 'sent' ? { color: isDarkMode ? '#ffffff' : '#64748b' } : {}}
                    >
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
