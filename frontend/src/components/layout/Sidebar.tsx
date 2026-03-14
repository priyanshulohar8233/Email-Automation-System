import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Mail,
  FileText,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Zap,
  Cpu,
  Link2,
  ShieldAlert,
  ChevronDown,
  Plus
} from "lucide-react";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Mail, label: "Campaigns", href: "/campaigns" },
  { icon: FileText, label: "Templates", href: "/templates/custom", subItems: [
      { label: "Custom Builder", href: "/templates/custom" },
      { label: "AI Templates", href: "/templates/feature" }
    ]
  },
  { icon: Users, label: "Subscribers", href: "/contacts" },
  { icon: Cpu, label: "Automations", href: "/automations" },
  { icon: Link2, label: "Integrations", href: "/integrations" },
  { icon: BarChart3, label: "Analytics", href: "/analytics", subItems: [
      { label: "Performance", href: "/analytics" },
      { label: "Suppression List", href: "/analytics/suppressions" }
    ]
  },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="flex h-screen w-[260px] flex-col border-r border-border/50 bg-card/80 backdrop-blur-xl fixed left-0 top-0 z-40 transition-all duration-500">
      {/* Workspace Switcher Area */}
      <div className="p-4 border-b border-border/40">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border/50 group">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground tracking-tight">Email Automation System</span>
              <span className="text-[10px] text-muted-foreground font-medium">Growth Tech Inc.</span>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 custom-scrollbar">
        <div className="mb-4 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Main Menu</div>
        <nav className="space-y-1">
          {sidebarItems.map((item) => {
            const isBaseActive = item.subItems
              ? location.pathname.startsWith(item.href)
              : location.pathname === item.href;

            return (
              <div key={item.label} className="space-y-1">
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all group relative overflow-hidden",
                    isBaseActive
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                      : "text-slate-600 dark:text-slate-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 hover:text-indigo-600 dark:hover:text-indigo-400"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", isBaseActive ? "text-white" : "text-slate-400 dark:text-slate-500")} />
                  <span className="relative z-10">{item.label}</span>
                  {isBaseActive && (
                      <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20" />
                  )}
                </Link>
                {item.subItems && isBaseActive && (
                  <div className="ml-4 pl-4 border-l border-border/50 space-y-1 mt-1 animate-in slide-in-from-left-2 duration-300">
                    {item.subItems.map((subItem) => {
                      const isSubActive = location.pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.label}
                          to={subItem.href}
                          className={cn(
                            "block rounded-lg px-3 py-2 text-xs font-semibold tracking-tight transition-all",
                            isSubActive
                              ? "text-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40"
                              : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:translate-x-1"
                          )}
                        >
                          {subItem.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-8 mb-4 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Team</div>
        <button className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-muted/50 transition-colors border border-dashed border-border/50 mb-2">
            <Plus className="h-4 w-4" /> Invite Member
        </button>
      </div>

      <div className="p-4 border-t border-border/40">
        <div className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-transparent hover:border-border/50 transition-all cursor-pointer group">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-linear-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-xs font-black text-white shadow-md shadow-indigo-500/20 group-hover:rotate-12 transition-transform">
              PL
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground">Priyanshu</span>
              <span className="text-[10px] text-muted-foreground font-medium">Pro Plan</span>
            </div>
          </div>
          <button onClick={() => {/* Logout logic here */}} className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
