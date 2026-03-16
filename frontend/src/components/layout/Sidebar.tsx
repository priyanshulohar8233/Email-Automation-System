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
  Zap
} from "lucide-react";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Mail, label: "Campaigns", href: "/campaigns" },
  {
    icon: FileText,
    label: "Templates",
    href: "/templates/custom",
    subItems: [
      { label: "Custom Builder", href: "/templates/custom" },
      { label: "AI Templates", href: "/templates/feature" }
    ]
  },
  { icon: Users, label: "Contacts", href: "/contacts" },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="flex h-screen w-[260px] flex-col border-r border-border bg-card fixed left-0 top-0 z-40 transition-colors duration-300">
      <div className="flex h-32 flex-col justify-center px-6 border-b border-border">
        <Link to="/" className="flex items-center gap-4 group/logo mb-1">
          <div className="relative flex items-center justify-center h-14 w-14 overflow-hidden rounded-xl bg-indigo-600/10 transition-transform group-hover/logo:scale-110 shadow-sm border border-indigo-600/20">
            <img 
              src="/veltrion-logo.png" 
              alt="VELTRION Logo" 
              className="h-full w-full object-cover" 
            />
          </div>
          <span className="text-2xl font-black tracking-tighter text-foreground">VELTRION</span>
        </Link>
        <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-widest pl-1 border-l-2 border-indigo-600/30 ml-[72px]">
          Smart Email Automation & Tracking Platform
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4">
        <nav className="space-y-1">
          {sidebarItems.map((item) => {
            // Check if active based on whether it starts with the section's base path for items with subItems
            const isBaseActive = item.subItems
              ? location.pathname.startsWith('/templates')
              : location.pathname === item.href;

            return (
              <div key={item.label} className="space-y-1">
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    isBaseActive
                      ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isBaseActive ? "text-indigo-600" : "text-slate-400 dark:text-slate-500")} />
                  {item.label}
                </Link>
                {item.subItems && isBaseActive && (
                  <div className="ml-9 space-y-1 mt-1">
                    {item.subItems.map((subItem) => {
                      const isSubActive = location.pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.label}
                          to={subItem.href}
                          className={cn(
                            "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            isSubActive
                              ? "text-indigo-600 font-semibold"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
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

      <div className="border-t border-border p-4">
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100">
          <LogOut className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          Logout
        </button>
      </div>
    </div>
  );
}
