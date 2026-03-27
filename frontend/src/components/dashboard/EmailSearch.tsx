import React, { useState, useEffect, useRef } from "react";
import { Search, X, Calendar, Globe, Building2, User, Clock, Check, ChevronRight } from "lucide-react";
import { dashboardAPI } from "@/services/dashboardAPI";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// --- Types ---
interface StatusEvent {
  status: string;
  time: string;
}

interface SearchResult {
  id: number;
  email_id: number;
  recipient_email: string;
  recipient_name: string;
  campaign: string;
  company: string;
  country: string;
  status: string;
  status_history: StatusEvent[];
  time: string;
}

// --- Components ---

/** 
 * Detailed Timeline Badge for the panel 
 */
function TimelineItem({ event, isLast }: { event: StatusEvent; isLast: boolean; key?: any }) {
  const date = new Date(event.time);
  return (
    <div className="relative flex gap-4 pb-8 items-start group">
      {!isLast && (
        <div className="absolute left-[11px] top-6 w-[2px] h-[calc(100%-12px)] bg-indigo-500/20 group-hover:bg-indigo-500/40 transition-colors" />
      )}
      <div className={cn(
        "z-10 h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all shadow-sm",
        "bg-card border-indigo-500/50 text-indigo-500 group-hover:border-indigo-500"
      )}>
        <Check className="h-3 w-3" />
      </div>
      <div className="flex flex-col gap-1 pt-0.5">
        <span className="text-sm font-bold text-foreground capitalize">{event.status.toLowerCase()}</span>
        <span className="text-xs text-muted-foreground font-medium">
          {format(date, "MMM dd, yyyy • hh:mm:ss a")}
        </span>
      </div>
    </div>
  );
}

/**
 * Main Email Search Component
 */
export function EmailSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced Search
  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await dashboardAPI.searchEmail(query);
        setResults(data as SearchResult[]);
        setIsOpen(true);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Click Outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full max-w-xl" ref={searchRef}>
      {/* Search Bar Input */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text"
          placeholder="Search by email (e.g. john@gmail.com)"
          className="h-11 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 3 && setIsOpen(true)}
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[400px] overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-3 py-2 border-b border-border/50 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Search Results</span>
          </div>
          <div className="space-y-1">
            {results.map((res) => (
              <button
                key={res.id}
                onClick={() => {
                  setSelectedResult(res);
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-4 rounded-xl p-3 text-left hover:bg-muted/50 transition-all border border-transparent hover:border-border/50 group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500 group-hover:scale-110 transition-transform">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-3">
                    <span className="truncate text-sm font-bold text-foreground">
                      {res.recipient_name || res.recipient_email.split('@')[0]}
                    </span>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-tight">
                      {res.campaign}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate font-medium">{res.recipient_email}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detail Panel (Drawer style) */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div 
            className="h-full w-full max-w-md bg-card border-l border-border shadow-2xl animate-in slide-in-from-right duration-500 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-border p-6 bg-muted/20">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-500" />
                Activity Detail
              </h2>
              <button 
                onClick={() => setSelectedResult(null)}
                className="rounded-full p-2 hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Profile Card */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center font-bold text-2xl text-indigo-500 border border-indigo-500/20">
                    {(selectedResult.recipient_name || selectedResult.recipient_email)[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">
                      {selectedResult.recipient_name || "Unknown"}
                    </h3>
                    <p className="text-sm font-medium text-muted-foreground">{selectedResult.recipient_email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Campaign</span>
                    <span className="text-sm font-bold flex items-center gap-1.5 leading-none">
                      <Calendar className="h-3 w-3 text-indigo-500" />
                      {selectedResult.campaign}
                    </span>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Company</span>
                    <span className="text-sm font-bold flex items-center gap-1.5 leading-none">
                      <Building2 className="h-3 w-3 text-indigo-500" />
                      {selectedResult.company}
                    </span>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Country</span>
                    <span className="text-sm font-bold flex items-center gap-1.5 leading-none">
                      <Globe className="h-3 w-3 text-indigo-500" />
                      {selectedResult.country}
                    </span>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Latest Status</span>
                    <span className="text-sm font-bold flex items-center gap-1.5 leading-none">
                      <Clock className="h-3 w-3 text-indigo-500" />
                      {selectedResult.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Timeline */}
              <div className="space-y-6">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Recipient Journey</h4>
                <div className="pl-2">
                  {selectedResult.status_history?.length > 0 ? (
                    [...selectedResult.status_history]
                      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
                      .map((event, idx, arr) => (
                        <TimelineItem 
                          key={event.status + event.time} 
                          event={event} 
                          isLast={idx === arr.length - 1} 
                        />
                      ))
                  ) : (
                    <div className="text-sm text-muted-foreground italic">No events found.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Panel Footer */}
            <div className="p-6 border-t border-border bg-muted/10">
              <button 
                onClick={() => setSelectedResult(null)}
                className="w-full py-3 rounded-xl bg-foreground text-background font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-foreground/10"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Activity(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
