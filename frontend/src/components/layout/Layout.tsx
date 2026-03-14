import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ClawdAssistant } from "../dashboard/ClawdAssistant";
import { 
  Search, 
  Bell, 
  HelpCircle, 
  Settings as SettingsIcon,
  SearchIcon,
  Command
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

export default function Layout() {
  const location = useLocation();
  
  // Custom page titles based on route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Overview';
    if (path.startsWith('/campaigns')) return 'Campaigns';
    if (path.startsWith('/contacts')) return 'Subscribers';
    if (path.startsWith('/analytics')) return 'Performance';
    if (path.startsWith('/templates')) return 'Templates';
    if (path.startsWith('/automations')) return 'Automations';
    if (path.startsWith('/settings')) return 'Settings';
    return 'Email Automation System';
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-all duration-500 selection:bg-indigo-500/10">
      <Sidebar />
      
      <main className="pl-[260px] min-h-screen flex flex-col">
        {/* TopBar - Glassmorphism Navigation */}
        <header className="sticky top-0 z-30 h-16 w-full glass-nav px-8 flex items-center justify-between border-b border-border/40">
          <div className="flex items-center gap-6">
            <h2 className="text-sm font-bold tracking-tight text-foreground uppercase">{getPageTitle()}</h2>
            
            {/* Global Search CMD+K style */}
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-muted/40 border border-border/50 text-muted-foreground w-64 hover:bg-muted/60 transition-all cursor-text group">
              <SearchIcon className="h-3.5 w-3.5 group-hover:text-indigo-500 transition-colors" />
              <span className="text-[10px] font-medium flex-1">Search anything...</span>
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-background border border-border/50 shadow-xs">
                <Command className="h-2 w-2" />
                <span className="text-[8px] font-black uppercase">K</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 border-r border-border/40 pr-4">
              <button className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase hidden lg:block">Docs</span>
              </button>
              <button className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all relative">
                <Bell className="h-4 w-4" />
                <div className="absolute top-2.5 right-2.5 h-1.5 w-1.5 bg-indigo-500 rounded-full border border-background" />
              </button>
            </div>
            
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-bold text-foreground leading-none mb-0.5">Priyanshu Lohar</p>
                <p className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest leading-none">Admin</p>
              </div>
              <div className="h-8 w-8 rounded-xl bg-muted border border-border/50 flex items-center justify-center p-0.5 overflow-hidden group cursor-pointer hover:ring-2 hover:ring-indigo-500/20 transition-all">
                <div className="h-full w-full rounded-lg bg-linear-to-tr from-indigo-500 to-violet-500 animate-pulse" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content with Transitions */}
        <div className="flex-1 overflow-auto bg-linear-to-b from-background via-background to-muted/10">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mx-auto max-w-[1440px] p-8 relative min-h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <ClawdAssistant />
    </div>
  );
}
