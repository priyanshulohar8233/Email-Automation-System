import { useState, useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCcw, Activity, ChevronDown, Check } from "lucide-react";
import { dashboardAPI } from "@/services/dashboardAPI";
import { useDashboard } from "@/context/DashboardContext";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ActivityRow {
  id: number;
  email_id?: number;
  recipient_email: string;
  recipient_name: string;
  sender: string;
  company: string;
  status: string;
  status_history: { status: string; time: string }[];
  country: string;
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract display name from email if recipient_name is blank */
function extractName(name: string, email: string): string {
  if (name && name.trim()) return name.trim();
  const prefix = email.split("@")[0];
  return prefix?.replace(/[._-]/g, " ").replace(/\b\w/g, c => c?.toUpperCase()) || "";
}

/** Company from email domain */
function extractCompany(company: string, email: string): string {
  if (company && company !== "Unknown" && company.trim()) return company;
  const domain = email.split("@")[1] || "";
  const host = domain.split(".")[0];
  const personal = ["gmail", "yahoo", "hotmail", "outlook", "icloud", "aol", "proton"];
  if (personal.includes(host.toLowerCase())) return "Personal Email";
  return host?.charAt(0)?.toUpperCase() + host?.slice(1) || "";
}

/** Smart time: today → "10:00 PM", older → "24/03/26 (10:00 PM)" */
function formatTime(ts: string): string {
  if (!ts) return "—";
  const date = new Date(ts);
  const now = new Date();
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === now.toDateString()) return timeStr;
  const dateStr = date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return `${dateStr} (${timeStr})`;
}

/** Priority order for statuses */
const STATUS_ORDER = ["BOUNCED", "SENT", "DELIVERED", "OPENED", "CLICKED"];

function getStatusPriority(s: string) {
  return STATUS_ORDER.indexOf(s?.toUpperCase() || "");
}

/** Badge style per status */
function getBadgeClass(status: string): string {
  const s = status?.toUpperCase() || "";
  const base = "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all select-none gap-1.5 hover:bg-opacity-20";
  if (s === "OPENED")    return base + " bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (s === "CLICKED")   return base + " bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (s === "DELIVERED") return base + " bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
  if (s === "BOUNCED")   return base + " bg-rose-500/10 text-rose-400 border-rose-500/20";
  return base + " bg-slate-500/10 border-slate-500/20 text-slate-400";
}

/** Timeline dot color */
function getDotClass(status: string): string {
  const s = status?.toUpperCase() || "";
  if (s === "OPENED")    return "bg-emerald-400";
  if (s === "CLICKED")   return "bg-blue-400";
  if (s === "DELIVERED") return "bg-teal-400";
  if (s === "BOUNCED")   return "bg-rose-400";
  return "bg-slate-400";
}

// ─── Status Dropdown ─────────────────────────────────────────────────────────
function StatusDropdown({ status, history }: { status: string; history: { status: string; time: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className={getBadgeClass(status)}
        title="Click to see full timeline"
      >
        <span>{status}</span>
        <ChevronDown className={`h-2.5 w-2.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-56 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 right-0">
          <div className="px-3 py-2 border-b border-border bg-muted/20">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground italic">Event Timeline</span>
          </div>
          <ul className="py-1">
            {history.map((h, i) => (
              <li key={h.status} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getDotClass(h.status)} shadow-[0_0_8px_rgba(0,0,0,0.2)]`} />
                <span className={`text-[11px] font-bold flex-1 ${i === 0 ? "text-foreground" : "text-muted-foreground/80"}`}>
                  {h.status?.charAt(0)?.toUpperCase() + h.status?.slice(1)?.toLowerCase() || h.status}
                </span>
                <div className="flex items-center gap-2">
                  <Check className={`h-3 w-3 flex-shrink-0 ${i === 0 ? "text-emerald-400" : "text-muted-foreground/40"}`} />
                  <span className="text-[10px] tabular-nums font-bold text-muted-foreground/70">
                    {formatTime(h.time)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function RecentActivityTable() {
  const { days, companyString: company } = useDashboard();
  const [events, setEvents] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async (signal?: AbortSignal, silently = false) => {
    if (!silently) { setLoading(true); setError(null); }
    try {
      const data = await dashboardAPI.getActivity(days, company, signal);
      setEvents(data as ActivityRow[]);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        if (!silently) setError("Failed to load recent activity.");
      }
    } finally {
      if (!silently) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchEvents(controller.signal);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchEvents(controller.signal, true);
      }
    }, 10000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [days, company]);

  return (
    <Card className="border-white/5 bg-[#1e293b] shadow-2xl transition-all duration-300 overflow-hidden ring-1 ring-white/5">
      <CardHeader className="pb-4 border-b border-white/5 bg-white/[0.02]">
        <CardTitle className="text-slate-100 text-lg font-bold flex items-center gap-2.5">
          <Activity className="h-5 w-5 text-indigo-500" />
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
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground italic">
            No Recent Activity
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="w-[60px] h-12 text-[11px] font-bold uppercase tracking-wider text-slate-400 px-6">#</TableHead>
                <TableHead className="h-12 text-[11px] font-bold uppercase tracking-wider text-slate-400 px-4">Recipient</TableHead>
                <TableHead className="h-12 text-[11px] font-bold uppercase tracking-wider text-slate-400 px-4">Sender</TableHead>
                <TableHead className="h-12 text-[11px] font-bold uppercase tracking-wider text-slate-400 px-4">Company</TableHead>
                <TableHead className="h-12 text-[11px] font-bold uppercase tracking-wider text-slate-400 px-4">Country</TableHead>
                <TableHead className="h-12 text-[11px] font-bold uppercase tracking-wider text-slate-400 px-4 text-center">Status</TableHead>
                <TableHead className="h-12 text-[11px] font-bold uppercase tracking-wider text-slate-400 px-6 text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev, index) => {
                const displayName = extractName(ev.recipient_name, ev.recipient_email);
                const displayCompany = extractCompany(ev.company, ev.recipient_email);
                // Ensure status_history has the current status object if backend returns empty history for legacy reasons
                const history = ev.status_history?.length 
                  ? ev.status_history 
                  : [{ status: ev.status, time: ev.timestamp }];

                return (
                  <TableRow key={ev.id} className="group hover:bg-slate-800/40 transition-colors duration-200 border-b border-white/5 last:border-0">
                    {/* # */}
                    <TableCell className="text-slate-500 font-medium px-6 py-4 text-sm">
                      {index + 1}
                    </TableCell>

                    {/* Recipient: Name + Email */}
                    <TableCell className="px-4 py-4 text-[13px]">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-100 mb-0.5">
                          {displayName}
                        </span>
                        <span className="text-[11px] text-slate-400/80 font-medium">
                          {ev.recipient_email}
                        </span>
                      </div>
                    </TableCell>

                    {/* Sender */}
                    <TableCell className="px-4 py-4 text-[13px]">
                      <span className="font-bold text-indigo-400">
                        {ev.sender || "MP Consultant LLC"}
                      </span>
                    </TableCell>

                    {/* Company */}
                    <TableCell className="px-4 py-4 text-[13px]">
                      <span className="font-semibold text-slate-200">
                        {displayCompany}
                      </span>
                    </TableCell>

                    {/* Country */}
                    <TableCell className="px-4 py-4 text-[13px]">
                      <span className="font-medium text-slate-400">
                        {ev.country && ev.country !== "Unknown" ? ev.country : "Unknown"}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center px-4 py-4">
                      <StatusDropdown status={ev.status} history={history} />
                    </TableCell>

                    {/* Time */}
                    <TableCell className="text-right text-slate-400 text-xs px-6 py-4 tabular-nums font-medium whitespace-nowrap">
                      {formatTime(ev.timestamp)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
