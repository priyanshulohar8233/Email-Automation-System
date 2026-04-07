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
  History
} from "lucide-react";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Mail, label: "Campaigns", href: "/campaigns" },
  {
    icon: FileText,
    label: "Templates",
    href: "/templates/custom",
    subItems: [
      { label: "Standard Layout", href: "/templates/standard-layout" },
      { label: "Custom Builder", href: "/templates/custom" },
      { label: "AI Templates", href: "/templates/feature" }
    ]
  },
  { icon: Users, label: "Contacts", href: "/contacts" },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
  { icon: Settings, label: "Settings", href: "/settings" },
  { icon: History, label: "Activity History", href: "/history" },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="sidebar-panel z-40 flex flex-col text-foreground transition-colors duration-300">
      <div className="sidebar-brand-panel flex h-20 items-center px-6">
        <div className="flex items-center gap-3 text-indigo-600">
          <div className="sidebar-icon-chip flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10">
            <Zap className="h-5 w-5 fill-current" />
          </div>
          <div>
            <span className="block text-[1.55rem] font-bold tracking-[-0.04em] text-indigo-600">MailFlow</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              AI Outreach Studio
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4">
        <nav className="space-y-1.5">
          {sidebarItems.map((item) => {
            const isBaseActive = item.subItems
              ? location.pathname.startsWith('/templates')
              : location.pathname === item.href;

            return (
              <div key={item.label} className="space-y-1">
                <Link
                  to={item.href}
                  data-active={isBaseActive}
                  className={cn(
                    "sidebar-nav-item flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-all duration-300",
                    isBaseActive
                      ? "text-indigo-600"
                      : "text-slate-600 dark:text-slate-400 hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100"
                  )}
                >
                  <span
                    className={cn(
                      "sidebar-icon-chip flex h-9 w-9 items-center justify-center rounded-2xl border transition-all duration-300",
                      isBaseActive
                        ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-500"
                        : "border-border/60 bg-card/40 text-slate-400 dark:text-slate-500"
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                  </span>
                  {item.label}
                </Link>
                {item.subItems && isBaseActive && (
                  <div className="ml-11 mt-1.5 space-y-1.5">
                    {item.subItems.map((subItem) => {
                      const isSubActive = location.pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.label}
                          to={subItem.href}
                          data-active={isSubActive}
                          className={cn(
                            "sidebar-subnav-item block rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
                            isSubActive
                              ? "text-indigo-600 font-semibold"
                              : "text-slate-500 dark:text-slate-400 hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100"
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
      </div>

      <div className="border-t border-border/50 p-4">
        <button className="sidebar-logout-item flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold text-slate-600 dark:text-slate-400 transition-all duration-300 hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100">
          <span className="sidebar-icon-chip flex h-9 w-9 items-center justify-center rounded-2xl border border-border/60 bg-card/40 text-slate-400 dark:text-slate-500">
            <LogOut className="h-[18px] w-[18px]" />
          </span>
          Logout
        </button>
      </div>
    </div>
  );
}
