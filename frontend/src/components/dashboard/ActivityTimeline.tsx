import { formatIST } from "@/lib/timeUtils";
import { Check, Mail, MousePointer2, Eye, AlertCircle, UserX, Clock, FastForward } from "lucide-react";

interface Event {
    id: number;
    event_type: string;
    timestamp: string;
    ip_address?: string;
    user_agent?: string;
    browser?: string;
    os?: string;
    device?: string;
    city?: string;
    country?: string;
    url?: string;
}

interface ActivityTimelineProps {
    events: Event[];
}

export function ActivityTimeline({ events }: ActivityTimelineProps) {
    const getEventIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case "sent": return <Mail className="h-4 w-4 text-blue-500" />;
            case "delivered": return <Check className="h-4 w-4 text-emerald-500" />;
            case "opened": return <Eye className="h-4 w-4 text-indigo-500" />;
            case "clicked": return <MousePointer2 className="h-4 w-4 text-violet-500" />;
            case "bounced": return <AlertCircle className="h-4 w-4 text-red-500" />;
            case "spam_report": return <AlertCircle className="h-4 w-4 text-orange-500" />;
            case "unsubscribed": return <UserX className="h-4 w-4 text-slate-500" />;
            case "deferred": return <Clock className="h-4 w-4 text-amber-500" />;
            case "dropped": return <FastForward className="h-4 w-4 text-red-700" />;
            default: return <Mail className="h-4 w-4 text-slate-400" />;
        }
    };

    return (
        <div className="relative space-y-4">
            {events.map((event, idx) => (
                <div key={event.id} className="group relative pl-8 pb-4 last:pb-0">
                    {/* Connection Line */}
                    {idx !== events.length - 1 && (
                        <div className="absolute left-[15px] top-[24px] bottom-0 w-[2px] bg-border group-hover:bg-indigo-500/30 transition-colors" />
                    )}

                    {/* Icon Circle */}
                    <div className="absolute left-0 top-1 w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center shadow-sm z-10 group-hover:border-indigo-500 group-hover:scale-110 transition-all duration-300">
                        {getEventIcon(event.event_type)}
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold capitalize text-foreground">
                                {event.event_type.replace("_", " ")}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                {formatIST(event.timestamp)}
                            </span>
                        </div>

                        <div className="text-xs text-muted-foreground leading-relaxed">
                            {event.event_type === "clicked" && event.url && (
                                <p className="text-indigo-600 dark:text-indigo-400 font-medium truncate mb-1">
                                    Clicked: {event.url}
                                </p>
                            )}

                            {event.browser && (
                                <p>
                                    {event.browser} on {event.os} ({event.device})
                                </p>
                            )}

                            {event.city && (
                                <p className="flex items-center gap-1">
                                    {event.city}, {event.country} • {event.ip_address}
                                </p>
                            )}

                            {event.event_type === "sent" && (
                                <p>Email was successfully processed and handed off for delivery.</p>
                            )}
                        </div>
                    </div>
                </div>
            ))}

            {events.length === 0 && (
                <div className="text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border">
                    <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground font-medium">No activity recorded for this email yet.</p>
                </div>
            )}
        </div>
    );
}
