import { Sun, Moon } from "lucide-react";
import { useState } from "react";

export function ThemeToggle() {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== "undefined") {
            const savedTheme = localStorage.getItem("theme");
            if (savedTheme) return savedTheme === "dark";
            return window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        return false;
    });

    const toggleTheme = (dark: boolean) => {
        if (dark === isDarkMode) return;

        // Apply no-transition to prevent micro-lag during the state swap
        document.documentElement.classList.add("no-transition");

        const updateTheme = () => {
            if (dark) {
                document.documentElement.classList.add("dark");
                localStorage.setItem("theme", "dark");
            } else {
                document.documentElement.classList.remove("dark");
                localStorage.setItem("theme", "light");
            }
            setIsDarkMode(dark);
        };

        const cleanup = () => {
            // Short delay to ensure the new state is painted before re-enabling transitions
            setTimeout(() => {
                document.documentElement.classList.remove("no-transition");
            }, 50);
        };

        // Check for View Transitions API support
        if (!(document as any).startViewTransition) {
            updateTheme();
            cleanup();
            return;
        }

        const transition = (document as any).startViewTransition(updateTheme);
        transition.finished.finally(cleanup);
    };

    return (
        <div
            style={{ borderRadius: "14px" }}
            className="flex items-center bg-card border border-border h-9 p-1 relative shadow-sm transition-colors duration-300"
        >
            {/* Sliding Highlight */}
            <div
                style={{ borderRadius: "10px" }}
                className={`absolute h-7 w-[36px] bg-indigo-600 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) shadow-sm ${!isDarkMode ? 'translate-x-[36px]' : 'translate-x-0'}`}
            />

            <button
                onClick={() => toggleTheme(true)}
                className={`relative z-10 w-9 h-7 flex items-center justify-center transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-muted-foreground dark:text-slate-500 hover:text-foreground dark:hover:text-slate-300'}`}
                title="Dark Mode"
            >
                <Moon className={`h-3.5 w-3.5 transition-transform duration-500 ${isDarkMode ? 'scale-110 rotate-0' : 'scale-100 -rotate-12'}`} />
            </button>

            <button
                onClick={() => toggleTheme(false)}
                className={`relative z-10 w-9 h-7 flex items-center justify-center transition-all duration-500 ${!isDarkMode ? 'text-white' : 'text-muted-foreground dark:text-slate-500 hover:text-foreground dark:hover:text-slate-300'}`}
                title="Light Mode"
            >
                <Sun className={`h-3.5 w-3.5 transition-transform duration-500 ${!isDarkMode ? 'scale-110 rotate-0' : 'scale-100 rotate-45'}`} />
            </button>
        </div>
    );
}
