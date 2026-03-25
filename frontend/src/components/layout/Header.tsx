import React from "react";
import { ThemeToggle } from "./ThemeToggle";
import { Bell } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-background/80 px-8 backdrop-blur-md transition-all duration-300">
      <div className="flex w-full items-center justify-between">
        <div className="flex-1">
          {/* EmailSearch Removed as per UI Cleanup Request */}
        </div>
        
        <div className="flex items-center gap-4">
          <button className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 flex h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-background" />
          </button>
          
          <div className="h-8 w-[1px] bg-border mx-1" />
          
          <ThemeToggle />
          
          <button className="flex items-center gap-2 rounded-full border border-border bg-card p-1 pr-3 hover:bg-muted transition-colors group">
            <div className="h-7 w-7 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xs ring-1 ring-indigo-500/20 group-hover:scale-105 transition-transform">
              PL
            </div>
            <span className="text-sm font-semibold text-foreground">Admin</span>
          </button>
        </div>
      </div>
    </header>
  );
}
