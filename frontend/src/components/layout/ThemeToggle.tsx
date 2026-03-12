import { Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";

export function ThemeToggle() {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== "undefined") {
            const savedTheme = localStorage.getItem("theme");
            if (savedTheme) return savedTheme === "dark";
            return window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        return false;
    });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme", "dark");
        } else {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("theme", "light");
        }
    }, [isDarkMode]);

    return (
        <div
            style={{ borderRadius: "14px" }}
            className="flex items-center bg-card border border-border h-9 p-1 relative shadow-sm transition-colors duration-300"
        >
            {/* Sliding Highlight */}
            <div
                style={{ borderRadius: "10px" }}
                className={`absolute h-7 w-[36px] bg-indigo-600 transition-all duration-300 shadow-sm ${!isDarkMode ? 'translate-x-[36px]' : 'translate-x-0'}`}
            />

            <button
                onClick={() => setIsDarkMode(true)}
                className={`relative z-10 w-9 h-7 flex items-center justify-center transition-colors ${isDarkMode ? 'text-white' : 'text-muted-foreground dark:text-slate-500 hover:text-foreground dark:hover:text-slate-300'}`}
                title="Dark Mode"
            >
                <Moon className="h-3.5 w-3.5" />
            </button>

            <button
                onClick={() => setIsDarkMode(false)}
                className={`relative z-10 w-9 h-7 flex items-center justify-center transition-colors ${!isDarkMode ? 'text-white' : 'text-muted-foreground dark:text-slate-500 hover:text-foreground dark:hover:text-slate-300'}`}
                title="Light Mode"
            >
                <Sun className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}
