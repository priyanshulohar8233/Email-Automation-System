import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Check, Eye, MousePointer2, AlertCircle, RefreshCw, Globe, Smartphone, Monitor } from "lucide-react";
import { format } from "date-fns";

interface RealtimeEvent {
    id: number;
    type: string;
    email: string;
    subject: string;
    timestamp: string;
    metadata: {
        browser?: string;
        os?: string;
        device?: string;
        location?: string;
        url?: string;
    };
}

export function RealtimeFeed({ campaignName = "all", limit = 10 }: { campaignName?: string, limit?: number }) {
    const [events, setEvents] = useState<RealtimeEvent[]>([]);
    const [isPaused, setIsPaused] = useState(false);
    const [lastFetch, setLastFetch] = useState<Date>(new Date());

    const fetchEvents = async () => {
        try {
            const url = campaignName === "all" ? `/api/analytics/realtime?limit=${limit}` : `/api/analytics/realtime?limit=${limit}&campaign=${encodeURIComponent(campaignName)}`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setEvents(data);
                setLastFetch(new Date());
            }
        } catch (error) {
            console.error("Realtime fetch failed:", error);
        }
    };

    useEffect(() => {
        fetchEvents();
        const interval = setInterval(() => {
            if (!isPaused) fetchEvents();
        }, 5000);
        return () => clearInterval(interval);
    }, [isPaused, campaignName]);

    const getIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case "sent": return <Mail className="h-4 w-4 text-blue-500" />;
            case "delivered": return <Check className="h-4 w-4 text-emerald-500" />;
            case "opened": return <Eye className="h-4 w-4 text-indigo-500" />;
            case "clicked": return <MousePointer2 className="h-4 w-4 text-violet-500" />;
            case "bounced": return <AlertCircle className="h-4 w-4 text-red-500" />;
            default: return <Mail className="h-4 w-4 text-slate-400" />;
        }
    };

    return (
        <Card className="h-full flex flex-col border-indigo-500/10 shadow-xl shadow-indigo-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
                <div className="space-y-0.5">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        Real-time Activity
                        <div className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </div>
                    </CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                        Live updates from your delivery engine
                    </CardDescription>
                </div>
                <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="p-2 hover:bg-muted rounded-xl transition-colors"
                >
                    <RefreshCw className={`h-4 w-4 text-muted-foreground ${isPaused ? "" : "animate-spin-slow"}`} />
                </button>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0 scrollbar-hide">
                <div className="divide-y divide-border/50">
                    {events.map((event) => (
                        <div key={event.id} className="p-4 hover:bg-muted/30 transition-all group relative overflow-hidden">
                            <div className="flex items-start gap-4">
                                <div className="mt-1 p-2 rounded-xl bg-card border border-border group-hover:scale-110 transition-transform shadow-sm">
                                    {getIcon(event.type)}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-bold text-foreground truncate">{event.email}</p>
                                        <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap bg-muted px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                            {format(new Date(event.timestamp), "h:mm a")}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate italic">
                                        {event.subject || "No subject"}
                                    </p>

                                    <div className="flex items-center gap-3 pt-1">
                                        <div className="flex items-center gap-1 text-[10px] font-medium text-foreground/70">
                                            {event.metadata.device === "Mobile" ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                                            {event.metadata.browser}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] font-medium text-foreground/70">
                                            <Globe className="h-3 w-3" />
                                            {event.metadata.location}
                                        </div>
                                        {event.type === "clicked" && (
                                            <Badge variant="outline" className="text-[8px] h-4 border-violet-500/20 text-violet-600 bg-violet-500/5 px-1 uppercase tracking-widest" {...{ className: "text-[8px] h-4 border-violet-500/20 text-violet-600 bg-violet-500/5 px-1 uppercase tracking-widest" } as any}>
                                                Click Tracked
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {events.length === 0 && (
                        <div className="flex flex-col items-center justify-center p-12 text-center opacity-50">
                            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-sm font-medium">Listening for incoming events...</p>
                        </div>
                    )}
                </div>
            </CardContent>
            <div className="p-3 bg-muted/20 border-t border-border/50 text-center">
                <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">
                    Last Refreshed: {format(lastFetch, "HH:mm:ss")}
                </p>
            </div>
        </Card>
    );
}
