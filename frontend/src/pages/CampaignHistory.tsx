import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  ChevronDown,
  Check,
  Mail,
  RefreshCw,
  History,
  TrendingUp,
  BarChart3,
  MousePointer2,
  Send,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { dashboardAPI } from "@/services/dashboardAPI";
import { cn } from "@/lib/utils";
import { dayjs, formatIST } from "@/lib/timeUtils";

interface CampaignHistoryData {
  id: number;
  name: string;
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  status: string;
}

interface EmailHistoryStatusEntry {
  status?: string;
  time?: string;
}

interface EmailHistoryData {
  id: number;
  email_id?: number;
  recipient_email?: string;
  recipient_name?: string;
  sender?: string;
  company?: string;
  campaign_name?: string;
  subject?: string;
  status?: string;
  status_history?: EmailHistoryStatusEntry[];
  country?: string;
  timestamp?: string;
}

type HistoryView = "campaign" | "email";
type DateFilter = "all" | "today" | "yesterday" | "7d" | "30d";

const DATE_OPTIONS: Array<{ id: DateFilter; label: string }> = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
];

const REAL_EMAIL_HISTORY_STATUSES = new Set([
  "SENT",
  "DELIVERED",
  "OPENED",
  "CLICKED",
  "BOUNCED",
  "SPAM",
  "DROPPED",
  "FAILED",
]);

const EXCLUDED_EMAIL_HISTORY_STATUSES = new Set([
  "QUEUED",
  "PENDING",
  "DRAFT",
  "SCHEDULED",
]);

const DELIVERED_LIKE_STATUSES = new Set(["DELIVERED", "OPENED", "CLICKED"]);
const OPENED_LIKE_STATUSES = new Set(["OPENED", "CLICKED"]);
const CLICKED_LIKE_STATUSES = new Set(["CLICKED"]);

function normalizeStatus(status?: string) {
  return (status || "").trim().toUpperCase();
}

function formatStatusLabel(status?: string) {
  const normalized = normalizeStatus(status);
  if (!normalized) return "UNKNOWN";
  return normalized.replace(/_/g, " ");
}

function getHistoryStatuses(statusHistory?: EmailHistoryStatusEntry[]) {
  return (statusHistory || [])
    .map((entry) => normalizeStatus(entry?.status))
    .filter(Boolean);
}

function includesAnyStatus(statuses: string[], allowed: Set<string>) {
  return statuses.some((status) => allowed.has(status));
}

function matchesSearch(values: Array<string | undefined>, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return values.some((value) =>
    (value || "").toLowerCase().includes(normalizedQuery)
  );
}

function matchesDateFilter(value: string | undefined, filter: DateFilter) {
  if (!value || filter === "all") return true;

  const now = dayjs().tz("Asia/Kolkata");
  const target = dayjs(value).tz("Asia/Kolkata");

  if (!target.isValid()) return false;

  if (filter === "today") {
    return target.isSame(now, "day");
  }

  if (filter === "yesterday") {
    return target.isSame(now.subtract(1, "day"), "day");
  }

  if (filter === "7d") {
    return target.isAfter(now.subtract(7, "day")) || target.isSame(now.subtract(7, "day"), "day");
  }

  if (filter === "30d") {
    return target.isAfter(now.subtract(30, "day")) || target.isSame(now.subtract(30, "day"), "day");
  }

  return true;
}

function getStatusColor(status: string) {
  switch (normalizeStatus(status)) {
    case "RUNNING":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "COMPLETE":
    case "COMPLETED":
      return "text-purple-400 bg-purple-400/10 border-purple-400/20";
    case "DELIVERED":
    case "OPENED":
    case "CLICKED":
      return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";
    case "SENT":
      return "text-indigo-400 bg-indigo-400/10 border-indigo-400/20";
    case "BOUNCED":
    case "FAILED":
    case "SPAM":
    case "DROPPED":
      return "text-rose-400 bg-rose-400/10 border-rose-400/20";
    default:
      return "text-slate-400 bg-slate-400/10 border-slate-400/20";
  }
}

function getInitials(value: string) {
  return (value || "?").charAt(0).toUpperCase();
}

export default function CampaignHistory() {
  const [campaignData, setCampaignData] = useState<CampaignHistoryData[]>([]);
  const [emailData, setEmailData] = useState<EmailHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [activeView, setActiveView] = useState<HistoryView>("campaign");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDateMenu, setShowDateMenu] = useState(false);
  const dateMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dateMenuRef.current && !dateMenuRef.current.contains(event.target as Node)) {
        setShowDateMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignHistory, emailHistory] = await Promise.all([
        dashboardAPI.getCampaignHistory(),
        dashboardAPI.getActivity(3650),
      ]);

      setCampaignData(campaignHistory as CampaignHistoryData[]);
      setEmailData(emailHistory as EmailHistoryData[]);
    } catch (err) {
      setError("Failed to fetch activity history.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredCampaigns = useMemo(() => {
    return campaignData.filter((campaign) => {
      if (!matchesDateFilter(campaign.date, dateFilter)) return false;
      return matchesSearch(
        [campaign.name, campaign.status, formatIST(campaign.date)],
        searchQuery
      );
    });
  }, [campaignData, dateFilter, searchQuery]);

  const filteredEmails = useMemo(() => {
    return emailData.filter((email) => {
      const statuses = [
        normalizeStatus(email.status),
        ...getHistoryStatuses(email.status_history),
      ].filter(Boolean);

      if (
        EXCLUDED_EMAIL_HISTORY_STATUSES.has(normalizeStatus(email.status)) ||
        !includesAnyStatus(statuses, REAL_EMAIL_HISTORY_STATUSES)
      ) {
        return false;
      }

      if (!matchesDateFilter(email.timestamp, dateFilter)) return false;

      return matchesSearch(
        [
          email.recipient_name,
          email.recipient_email,
          email.campaign_name,
          email.subject,
          email.sender,
          email.company,
          email.country,
          formatStatusLabel(email.status),
        ],
        searchQuery
      );
    });
  }, [emailData, dateFilter, searchQuery]);

  const campaignSummary = useMemo(
    () => ({
      totalSent: filteredCampaigns.reduce((acc, curr) => acc + curr.sent, 0),
      delivered: filteredCampaigns.reduce((acc, curr) => acc + curr.delivered, 0),
      opened: filteredCampaigns.reduce((acc, curr) => acc + curr.opened, 0),
      clicked: filteredCampaigns.reduce((acc, curr) => acc + curr.clicked, 0),
    }),
    [filteredCampaigns]
  );

  const emailSummary = useMemo(() => {
    return filteredEmails.reduce(
      (acc, email) => {
        const statuses = [
          normalizeStatus(email.status),
          ...getHistoryStatuses(email.status_history),
        ].filter(Boolean);

        acc.totalSent += 1;
        if (includesAnyStatus(statuses, DELIVERED_LIKE_STATUSES)) acc.delivered += 1;
        if (includesAnyStatus(statuses, OPENED_LIKE_STATUSES)) acc.opened += 1;
        if (includesAnyStatus(statuses, CLICKED_LIKE_STATUSES)) acc.clicked += 1;
        return acc;
      },
      { totalSent: 0, delivered: 0, opened: 0, clicked: 0 }
    );
  }, [filteredEmails]);

  const summary = activeView === "campaign" ? campaignSummary : emailSummary;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Activity History"
        subtitle="Track campaign logs and every sent email from one searchable workspace."
      >
        <div className="relative" ref={dateMenuRef}>
          <Button
            variant="outline"
            style={{ borderRadius: "14px" }}
            onClick={() => setShowDateMenu(!showDateMenu)}
            className="gap-2 h-9 border-border bg-card hover:bg-muted font-bold text-xs shadow-sm pl-4 pr-3 min-w-[140px]"
          >
            <Calendar className="h-3.5 w-3.5 text-indigo-500" />
            {DATE_OPTIONS.find((opt) => opt.id === dateFilter)?.label}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                showDateMenu && "rotate-180"
              )}
            />
          </Button>

          {showDateMenu && (
            <div className="absolute right-0 mt-2 min-w-[180px] bg-card border border-border rounded-2xl shadow-2xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
              {DATE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setDateFilter(opt.id);
                    setShowDateMenu(false);
                  }}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-xs font-bold flex items-center justify-between transition-colors",
                    dateFilter === opt.id
                      ? "bg-indigo-500/10 text-indigo-500"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {opt.label}
                  {dateFilter === opt.id && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </PageHeader>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="inline-flex w-full xl:w-auto rounded-2xl border border-border bg-card/80 p-1 shadow-sm">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActiveView("campaign")}
            className={cn(
              "flex-1 xl:flex-none rounded-xl px-5 text-xs font-black uppercase tracking-widest",
              activeView === "campaign"
                ? "bg-indigo-500 text-white hover:bg-indigo-500/90 hover:text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Campaign History
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setActiveView("email")}
            className={cn(
              "flex-1 xl:flex-none rounded-xl px-5 text-xs font-black uppercase tracking-widest",
              activeView === "email"
                ? "bg-indigo-500 text-white hover:bg-indigo-500/90 hover:text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Email History
          </Button>
        </div>

        <div className="relative w-full xl:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={
              activeView === "campaign"
                ? "Search campaign history..."
                : "Search email, recipient, campaign, company..."
            }
            className="h-11 rounded-2xl border-border bg-card pl-11 pr-4 text-sm shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {activeView === "campaign" ? "Total Sent" : "Total Emails"}
                </p>
                <h3 className="text-xl font-bold text-foreground">
                  {summary.totalSent.toLocaleString()}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Delivered
                </p>
                <h3 className="text-xl font-bold text-foreground">
                  {summary.delivered.toLocaleString()}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Opened
                </p>
                <h3 className="text-xl font-bold text-foreground">
                  {summary.opened.toLocaleString()}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                {activeView === "campaign" ? (
                  <MousePointer2 className="h-5 w-5" />
                ) : (
                  <Mail className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {activeView === "campaign" ? "Clicked" : "Clicked"}
                </p>
                <h3 className="text-xl font-bold text-foreground">
                  {summary.clicked.toLocaleString()}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card shadow-xl overflow-hidden rounded-2xl">
        <CardHeader className="border-b border-border bg-muted/20 pb-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-500" />
              {activeView === "campaign" ? "Campaign Logs" : "Email Logs"}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl h-8 text-[10px] font-bold uppercase tracking-widest hover:bg-muted"
              onClick={fetchHistory}
            >
              <RefreshCw className={cn("h-3 w-3 mr-2", loading && "animate-spin")} />
              Sync Data
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
              <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                Fetching History...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-6">
              <History className="h-12 w-12 text-rose-400/40 mb-4" />
              <p className="text-sm font-bold text-foreground">{error}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please try syncing again in a moment.
              </p>
            </div>
          ) : activeView === "campaign" ? (
            filteredCampaigns.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="w-16"></TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground py-4">
                      Campaign Name
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">
                      Date
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">
                      Sent
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">
                      Delivered
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">
                      Opened
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">
                      Clicked
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.map((campaign) => (
                    <TableRow
                      key={campaign.id}
                      className="border-border hover:bg-muted/30 transition-all group"
                    >
                      <TableCell className="py-4 pl-6">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold text-xs group-hover:scale-110 transition-transform border border-indigo-500/20">
                          {getInitials(campaign.name)}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-sm text-foreground py-4">
                        {campaign.name}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {formatIST(campaign.date)}
                      </TableCell>
                      <TableCell className="text-xs font-black text-foreground">
                        {campaign.sent.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-emerald-500/80">
                        {campaign.delivered.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-blue-500/80">
                        {campaign.opened.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-purple-500/80">
                        {campaign.clicked.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full px-3 py-0.5 text-[10px] font-bold border",
                            getStatusColor(campaign.status)
                          )}
                        >
                          {formatStatusLabel(campaign.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <History className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <p className="text-sm font-bold text-foreground">No Campaign History Found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try adjusting the search or date filter.
                </p>
              </div>
            )
          ) : filteredEmails.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="w-16"></TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground py-4">
                    Recipient
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">
                    Campaign
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">
                    Subject
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">
                    Company
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground">
                    Time
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmails.map((email) => (
                  <TableRow
                    key={email.id ?? email.email_id ?? `${email.recipient_email}-${email.timestamp}`}
                    className="border-border hover:bg-muted/30 transition-all group"
                  >
                    <TableCell className="py-4 pl-6">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold text-xs group-hover:scale-110 transition-transform border border-indigo-500/20">
                        {getInitials(email.recipient_name || email.recipient_email || email.campaign_name || "E")}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="font-bold text-sm text-foreground">
                        {email.recipient_name || "Unknown Recipient"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {email.recipient_email || "No email address"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-foreground">
                      {email.campaign_name || "Direct Send"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[240px]">
                      <div className="font-medium text-foreground truncate">
                        {email.subject || "No Subject"}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 truncate">
                        {email.sender || email.company || "Unknown Sender"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="font-semibold text-foreground">
                        {email.company || "Unknown"}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {email.country || "Unknown"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-3 py-0.5 text-[10px] font-bold border",
                          getStatusColor(email.status || "")
                        )}
                      >
                        {formatStatusLabel(email.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {formatIST(email.timestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Mail className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="text-sm font-bold text-foreground">No Email History Found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Sent emails will appear here once they match your filters.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
