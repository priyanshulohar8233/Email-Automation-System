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
  periodLabel?: string;
}

export function KPICard({ label, value, growth, icon: Icon, className, loading, periodLabel = "month" }: KPICardProps) {
  const isPositive = growth >= 0;

  if (loading) {
    return (
      <Card className={cn("flex flex-col justify-between shadow-sm animate-pulse", className)}>
        <CardContent className="p-4 h-full flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="h-4 w-24 bg-muted rounded-md" />
            <div className="rounded-full bg-muted p-2 w-8 h-8" />
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
    <Card className={cn("flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300 group", className)}>
      <CardContent className="p-4 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
          <div className="rounded-full bg-muted p-2 group-hover:bg-indigo-500/10 transition-colors">
            <Icon className="h-4 w-4 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
          </div>
        </div>

        <div>
          <div className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{value}</div>
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
            <span className="text-[10px] font-bold text-slate-400 ml-0.5 uppercase tracking-tighter">vs last {periodLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
