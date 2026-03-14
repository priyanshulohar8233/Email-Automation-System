import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, ArrowUp, ArrowDown } from "lucide-react";
import { motion } from "motion/react";

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
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Card className={cn(
        "group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10",
        className
      )}>
      {/* Subtle Background Glow */}
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-indigo-500/5 blur-3xl group-hover:bg-indigo-500/10 transition-colors" />
      
      <CardContent className="p-5 h-full flex flex-col justify-between">
        <div className="flex items-start justify-between mb-4">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 p-2.5 group-hover:scale-110 transition-transform duration-300">
            <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        <div>
          <div className="text-2xl font-black text-foreground tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{value}</div>
          <div className="flex items-center gap-1.5 mt-2">
            <div className={cn(
              "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold",
              isPositive 
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            )}>
              {isPositive ? (
                <ArrowUp className="h-2.5 w-2.5" />
              ) : (
                <ArrowDown className="h-2.5 w-2.5" />
              )}
              {Math.abs(growth)}%
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">vs last month</span>
          </div>
        </div>
      </CardContent>
      </Card>
    </motion.div>
  );
}
