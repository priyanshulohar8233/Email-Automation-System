import { Sun, Moon } from "lucide-react";
import { useState, type MouseEvent } from "react";

type ViewTransitionHandle = {
    ready: Promise<void>;
    finished: Promise<void>;
};

type ThemeTransitionDocument = Document & {
    startViewTransition?: (updateCallback: () => void) => ViewTransitionHandle;
};

export function ThemeToggle() {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== "undefined") {
            const savedTheme = localStorage.getItem("theme");
            if (savedTheme) return savedTheme === "dark";
            return window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        return false;
    });

    const getTransitionOrigin = (event: MouseEvent<HTMLButtonElement>) => {
        if (event.clientX !== 0 || event.clientY !== 0) {
            return { x: event.clientX, y: event.clientY };
        }

        const rect = event.currentTarget.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        };
    };

    const animateThemeReveal = (transition: ViewTransitionHandle, x: number, y: number) => {
        transition.ready
            .then(() => {
                const endRadius = Math.hypot(
                    Math.max(x, window.innerWidth - x),
                    Math.max(y, window.innerHeight - y),
                );

                document.documentElement.animate(
                    {
                        opacity: [1, 0],
                        filter: ["blur(0px)", "blur(2px)"],
                    },
                    {
                        duration: 220,
                        easing: "ease-out",
                        fill: "both",
                        pseudoElement: "::view-transition-old(root)",
                    },
                );

                document.documentElement.animate(
                    {
                        clipPath: [
                            `circle(0px at ${x}px ${y}px)`,
                            `circle(${endRadius}px at ${x}px ${y}px)`,
                        ],
                        opacity: [0.45, 1],
                        filter: ["brightness(1.08) saturate(1.04)", "brightness(1) saturate(1)"],
                        transform: ["scale(0.985)", "scale(1)"],
                    },
                    {
                        duration: 720,
                        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                        fill: "both",
                        pseudoElement: "::view-transition-new(root)",
                    },
                );
            })
            .catch(() => {
                // If the browser cancels the transition, the theme still updates normally.
            });
    };

    const toggleTheme = (event: MouseEvent<HTMLButtonElement>, dark: boolean) => {
        if (dark === isDarkMode) return;

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

        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const transitionDocument = document as ThemeTransitionDocument;
        const supportsViewTransition = typeof transitionDocument.startViewTransition === "function";

        if (prefersReducedMotion || !supportsViewTransition) {
            updateTheme();
            return;
        }

        // Freeze page-level transitions while the snapshot animation is running.
        document.documentElement.classList.add("no-transition");
        const { x, y } = getTransitionOrigin(event);

        const cleanup = () => {
            setTimeout(() => {
                document.documentElement.classList.remove("no-transition");
            }, 80);
        };

        const transition = transitionDocument.startViewTransition!(updateTheme);
        animateThemeReveal(transition, x, y);
        transition.finished.finally(cleanup);
    };

    return (
        <div
            style={{ borderRadius: "14px" }}
            className="theme-toggle flex items-center bg-card border border-border h-9 p-1 relative shadow-sm transition-colors duration-300"
        >
            {/* Sliding Highlight */}
            <div
                style={{ borderRadius: "10px" }}
                className={`absolute h-7 w-[36px] bg-indigo-600 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) shadow-sm ${!isDarkMode ? 'translate-x-[36px]' : 'translate-x-0'}`}
            />

            <button
                onClick={(event) => toggleTheme(event, true)}
                className={`relative z-10 w-9 h-7 flex items-center justify-center transition-all duration-500 ${isDarkMode ? 'text-white' : 'text-muted-foreground dark:text-slate-500 hover:text-foreground dark:hover:text-slate-300'}`}
                title="Dark Mode"
            >
                <Moon className={`h-3.5 w-3.5 transition-transform duration-500 ${isDarkMode ? 'scale-110 rotate-0' : 'scale-100 -rotate-12'}`} />
            </button>

            <button
                onClick={(event) => toggleTheme(event, false)}
                className={`relative z-10 w-9 h-7 flex items-center justify-center transition-all duration-500 ${!isDarkMode ? 'text-white' : 'text-muted-foreground dark:text-slate-500 hover:text-foreground dark:hover:text-slate-300'}`}
                title="Light Mode"
            >
                <Sun className={`h-3.5 w-3.5 transition-transform duration-500 ${!isDarkMode ? 'scale-110 rotate-0' : 'scale-100 rotate-45'}`} />
            </button>
        </div>
    );
}
