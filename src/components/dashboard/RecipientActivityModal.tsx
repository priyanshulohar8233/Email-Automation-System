import { useState, useEffect } from "react";
import { X, User, Mail, Globe, Clock, Eye } from "lucide-react";
import { ActivityTimeline } from "./ActivityTimeline";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface RecipientActivityModalProps {
    contactId: string;
    email: string;
    name: string;
    onClose: () => void;
}

export function RecipientActivityModal({ contactId, email, name, onClose }: RecipientActivityModalProps) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchActivity() {
            try {
                // In this system, we track events by email address for recipient level
                const response = await fetch(`/api/analytics/realtime?limit=100`);
                if (response.ok) {
                    const data = await response.json();
                    // Filter events for this specific email
                    const filtered = data.filter((ev: any) => ev.email === email);
                    setEvents(filtered.map((ev: any) => ({
                        ...ev,
                        event_type: ev.type,
                        // map other fields to match ActivityTimeline expectations
                        browser: ev.metadata.browser,
                        os: ev.metadata.os,
                        device: ev.metadata.device,
                        city: ev.metadata.location.split(',')[0],
                        country: ev.metadata.location.split(',')[1]
                    })));
                }
            } catch (error) {
                console.error("Failed to fetch recipient activity:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchActivity();
    }, [email]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
            <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border-indigo-500/20 shadow-indigo-500/10 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b pb-4 bg-muted/30">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-600/20">
                            {name.charAt(0)}
                        </div>
                        <div>
                            <CardTitle className="text-xl font-bold">{name}</CardTitle>
                            <p className="text-xs text-muted-foreground font-medium">{email}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    <div className="space-y-8">
                        {/* Profile Summary */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 text-center">
                                <Mail className="h-4 w-4 mx-auto mb-2 text-indigo-600" />
                                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-widest">Sent</p>
                                <p className="text-lg font-bold">{events.filter((e: any) => e.event_type === "sent").length}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 text-center">
                                <Eye className="h-4 w-4 mx-auto mb-2 text-indigo-600" />
                                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-widest">Opens</p>
                                <p className="text-lg font-bold">{events.filter((e: any) => e.event_type === "opened").length}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 text-center">
                                <Globe className="h-4 w-4 mx-auto mb-2 text-indigo-600" />
                                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-widest">Clicks</p>
                                <p className="text-lg font-bold">{events.filter((e: any) => e.event_type === "clicked").length}</p>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
                                <Clock className="h-4 w-4" /> Activity History
                            </h3>
                            <ActivityTimeline events={events} />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
