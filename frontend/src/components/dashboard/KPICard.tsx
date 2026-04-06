import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, ArrowUp, ArrowDown } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string;
  growth: number;
  icon: LucideIcon;
  className?: string;
  loading?: boolean;
  vsLabel?: string;
}

export function KPICard({ label, value, growth, icon: Icon, className, loading, vsLabel = "vs last month" }: KPICardProps) {
  const isPositive = growth >= 0;

  if (loading) {
    return (
      <Card className={cn("apple-kpi-card flex flex-col justify-between animate-pulse", className)}>
        <CardContent className="p-4 h-full flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="h-4 w-24 bg-muted rounded-md" />
            <div className="apple-icon-chip h-10 w-10 rounded-2xl bg-muted/70" />
          </div>
          <div className="mt-4">
            <div className="h-8 w-20 bg-muted rounded-md" />
            <div className="h-3 w-32 bg-muted rounded-md mt-2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("apple-kpi-card group flex flex-col justify-between hover:-translate-y-1", className)}>
      <CardContent className="p-4 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
          <div className="apple-icon-chip rounded-2xl border border-white/8 p-2.5 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:bg-indigo-500/10">
            <Icon className="h-4 w-4 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
          </div>
        </div>

        <div>
          <div className="text-[2rem] font-semibold text-foreground tabular-nums tracking-[-0.04em]">{value}</div>
          <div className="flex items-center gap-1 mt-1">
            {isPositive ? (
              <ArrowUp className="h-3 w-3 text-emerald-500" />
            ) : (
              <ArrowDown className="h-3 w-3 text-red-500" />
            )}
            <span
              className={cn(
                "text-xs font-bold",
                isPositive ? "text-emerald-500" : "text-red-500"
              )}
            >
              {Math.abs(growth)}%
            </span>
            <span className="text-[10px] font-medium text-slate-400 ml-0.5 uppercase tracking-tighter">{vsLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
