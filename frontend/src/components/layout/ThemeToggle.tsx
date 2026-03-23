import { Sun, Moon } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import React from "react";

export function ThemeToggle() {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== "undefined") {
            const savedTheme = localStorage.getItem("theme");
            if (savedTheme) return savedTheme === "dark";
            return window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        return false;
    });

    const isFirstRender = useRef(true);

    const toggleTheme = (event: React.MouseEvent, dark: boolean) => {
        if (dark === isDarkMode) return;

        const updateTheme = () => {
            setIsDarkMode(dark);
            if (dark) {
                document.documentElement.classList.add("dark");
                localStorage.setItem("theme", "dark");
            } else {
                document.documentElement.classList.remove("dark");
                localStorage.setItem("theme", "light");
            }
        };

        // Check for View Transitions API support
        if (!(document as any).startViewTransition) {
            updateTheme();
            return;
        }

        // Calculate click coordinates for the radial reveal
        const x = event.clientX;
        const y = event.clientY;
        document.documentElement.style.setProperty('--x', `${x}px`);
        document.documentElement.style.setProperty('--y', `${y}px`);

        (document as any).startViewTransition(updateTheme);
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
                onClick={(e) => toggleTheme(e, true)}
                className={`relative z-10 w-9 h-7 flex items-center justify-center transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-muted-foreground dark:text-slate-500 hover:text-foreground dark:hover:text-slate-300'}`}
                title="Dark Mode"
            >
                <Moon className={`h-3.5 w-3.5 transition-transform duration-500 ${isDarkMode ? 'scale-110 rotate-0' : 'scale-100 -rotate-12'}`} />
            </button>

            <button
                onClick={(e) => toggleTheme(e, false)}
                className={`relative z-10 w-9 h-7 flex items-center justify-center transition-all duration-500 ${!isDarkMode ? 'text-white' : 'text-muted-foreground dark:text-slate-500 hover:text-foreground dark:hover:text-slate-300'}`}
                title="Light Mode"
            >
                <Sun className={`h-3.5 w-3.5 transition-transform duration-500 ${!isDarkMode ? 'scale-110 rotate-0' : 'scale-100 rotate-45'}`} />
            </button>
        </div>
    );
}
