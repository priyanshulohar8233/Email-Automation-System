import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { ShieldAlert, Trash2, Search, Filter, MailX, AlertTriangle, CheckCircle, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

interface Suppression {
    id: number;
    email: string;
    reason: string;
    metadata_raw: string | null;
    created_at: string;
}

export default function SuppressionList() {
    const [suppressions, setSuppressions] = useState<Suppression[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("ALL");

    const fetchSuppressions = async () => {
        try {
            const res = await fetch("/api/suppressions");
            if (res.ok) {
                const data = await res.json();
                setSuppressions(data);
            }
        } catch (e) {
            console.error("Failed to fetch suppressions", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSuppressions();
    }, []);

    const removeSuppression = async (id: number) => {
        if (!confirm("Are you sure you want to remove this address from the suppression list? This may impact deliverability if the address is truly invalid.")) return;
        
        try {
            const res = await fetch(`/api/suppressions/${id}`, { method: "DELETE" });
            if (res.ok) {
                setSuppressions(suppressions.filter(s => s.id !== id));
            }
        } catch (e) {
            console.error("Failed to remove suppression", e);
        }
    };

    const filtered = suppressions.filter(s => {
        const matchSearch = s.email.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === "ALL" || s.reason === filter;
        return matchSearch && matchFilter;
    });

    const getReasonIcon = (reason: string) => {
        switch (reason) {
            case "BOUNCE": return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
            case "SPAM": return <ShieldAlert className="h-3.5 w-3.5 text-red-500" />;
            case "UNSUBSCRIBE": return <MailX className="h-3.5 w-3.5 text-slate-500" />;
            default: return <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />;
        }
    };

    const getReasonBadge = (reason: string) => {
        switch (reason) {
            case "BOUNCE": return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/10 text-[10px] font-bold">Hard Bounce</Badge>;
            case "SPAM": return <Badge className="bg-red-500/10 text-red-600 border-red-500/10 text-[10px] font-bold">Spam Report</Badge>;
            case "UNSUBSCRIBE": return <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/10 text-[10px] font-bold">Unsubscribed</Badge>;
            default: return <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/10 text-[10px] font-bold">Manual</Badge>;
        }
    };

    return (
        <div className="space-y-8">
            <PageHeader 
                title="Suppression List" 
                subtitle="Manage addresses blocked by the reputation guard."
            >
                <div className="flex items-center gap-3">
                    <div className="relative w-64">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                         <input 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search blocked emails..."
                            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 ring-indigo-500/20 outline-none"
                         />
                    </div>
                    <div className="flex bg-card border border-border rounded-xl p-1">
                        {["ALL", "BOUNCE", "SPAM", "UNSUBSCRIBE"].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${filter === f ? 'bg-indigo-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </PageHeader>

            <Card className="border-indigo-500/10 shadow-xl overflow-hidden">
                <CardHeader className="bg-indigo-500/5 border-b border-indigo-500/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                             <ShieldAlert className="h-4 w-4 text-indigo-500" />
                             <CardTitle className="text-sm font-bold">Global Blacklist ({filtered.length})</CardTitle>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-indigo-500/20 text-indigo-600 font-bold">
                            Active Protection
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-muted/30 border-b border-border/50">
                                <tr>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email Address</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Added On</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filtered.map((s) => (
                                    <tr key={s.id} className="group hover:bg-muted/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
                                                    <ShieldCheck className="h-3.5 w-3.5" />
                                                </div>
                                                <span className="text-xs font-medium text-foreground">{s.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {getReasonIcon(s.reason)}
                                                {getReasonBadge(s.reason)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {format(new Date(s.created_at), "MMM d, yyyy · HH:mm")}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => removeSuppression(s.id)}
                                                className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-muted-foreground transition-all"
                                                title="Remove from suppression"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && !isLoading && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center opacity-50">
                                            <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">List is clean</div>
                                            <p className="text-[10px] mt-1">No suppressed addresses match your search/filter.</p>
                                        </td>
                                    </tr>
                                )}
                                {isLoading && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center">
                                            <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-100">Deliverability Safeguard Active</h4>
                    <p className="text-[10px] text-indigo-700/70 dark:text-indigo-300/50 leading-relaxed">
                         адреса в этом списке исключаются из всех будущих рассылок автоматически. Это защищает ваш технический рейтинг отправителя (Sender Reputation) и предотвращает попадание писем в спам. Удаляйте адреса только если вы уверены в их валидности.
                    </p>
                </div>
            </div>
        </div>
    );
}
