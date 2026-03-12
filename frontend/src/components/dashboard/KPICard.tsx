import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, ArrowUp, ArrowDown } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string;
  growth: number;
  icon: LucideIcon;
  className?: string;
}

export function KPICard({ label, value, growth, icon: Icon, className }: KPICardProps) {
  const isPositive = growth >= 0;

  return (
    <Card className={cn("flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-4 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <div className="rounded-full bg-muted p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div>
          <div className="text-2xl font-bold text-foreground">{value}</div>
          <div className="flex items-center gap-1 mt-1">
            {isPositive ? (
              <ArrowUp className="h-3 w-3 text-emerald-500" />
            ) : (
              <ArrowDown className="h-3 w-3 text-red-500" />
            )}
            <span
              className={cn(
                "text-xs font-medium",
                isPositive ? "text-emerald-600" : "text-red-600"
              )}
            >
              {Math.abs(growth)}%
            </span>
            <span className="text-xs text-slate-400 ml-1">vs last month</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
