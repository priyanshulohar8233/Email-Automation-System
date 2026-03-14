import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, ShieldCheck, AlertTriangle, Cpu, Zap, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SystemHealth() {
  const [healthData, setHealthData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchHealth = async () => {
    try {
      const response = await fetch("/api/analytics/system-health");
      if (response.ok) {
        const data = await response.json();
        setHealthData(data);
        setLastRefreshed(new Date());
      }
    } catch (error) {
      console.error("Failed to fetch system health:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  if (!healthData && isLoading) {
    return (
      <Card className="h-full border-indigo-500/10 bg-card/50 backdrop-blur-sm animate-pulse">
        <div className="h-full flex items-center justify-center p-8">
          <div className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Waking up engine...</div>
        </div>
      </Card>
    );
  }

  const isCritical = healthData?.reputation.status.includes("Critical");
  const isWarning = healthData?.reputation.status === "Warning";

  return (
    <Card className="h-full border-indigo-500/10 shadow-xl shadow-indigo-500/5 bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col">
      <CardHeader className="border-b border-indigo-500/5 bg-indigo-500/5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-indigo-500" />
            <CardTitle className="text-sm font-bold">System Health</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">
              Last sync: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button 
              onClick={fetchHealth}
              className="p-1 hover:bg-muted rounded-full transition-colors"
            >
              <RefreshCw className={cn("h-3 w-3 text-muted-foreground", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 flex-1 space-y-6">
        {/* Reputation Guard */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              Reputation Guard
            </span>
            <Badge 
              className={cn(
                "text-[10px] font-bold uppercase h-5",
                isCritical ? "bg-red-500/10 text-red-500 border-red-500/20" : 
                isWarning ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : 
                "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              )}
              variant="outline"
            >
              {healthData?.reputation.status}
            </Badge>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-end justify-between mb-2">
              <div className="space-y-0.5">
                <div className="text-xl font-bold tabular-nums">
                  {healthData?.reputation.bounce_rate}%
                </div>
                <div className="text-[10px] text-muted-foreground font-medium">Bounces (Last 100)</div>
              </div>
              <div className="text-right space-y-0.5">
                <div className="text-xs font-bold text-muted-foreground tabular-nums">3.0%</div>
                <div className="text-[10px] text-muted-foreground font-medium">Safe Limit</div>
              </div>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-1000",
                  isCritical ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(100, (healthData?.reputation.bounce_rate / 3) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Queues Status */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Zap className="h-3 w-3" />
            Core Queues
          </span>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <div className="text-xs font-bold text-indigo-500 mb-1">Transactional</div>
              <div className="text-lg font-bold tabular-nums">{healthData?.queues.transactional}</div>
              <div className="text-[10px] text-muted-foreground font-medium mt-1">Pending jobs</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <div className="text-xs font-bold text-violet-500 mb-1">Marketing</div>
              <div className="text-lg font-bold tabular-nums">{healthData?.queues.marketing}</div>
              <div className="text-[10px] text-muted-foreground font-medium mt-1">Scheduled tasks</div>
            </div>
          </div>
        </div>

        {/* Velocity */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            Delivery Velocity
          </span>
          <div className="flex flex-col gap-2">
             <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                <span className="text-xs font-medium">Avg. Hourly Throughput</span>
                <span className="text-xs font-bold font-mono">
                  {healthData?.velocity.delivered_last_hour} / hr
                </span>
             </div>
             <p className="text-[9px] text-muted-foreground px-1 leading-relaxed">
               Adaptive rate limiting is currently active. System is optimized for 50 emails/min per workspace to maintain peak deliverability.
             </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
