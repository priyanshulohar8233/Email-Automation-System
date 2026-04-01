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

    const animateThemeReveal = (transition: ViewTransitionHandle, x: number, y: number, dark: boolean) => {
        transition.ready
            .then(() => {
                const startRadius = 24;
                const endRadius = Math.hypot(
                    Math.max(x, window.innerWidth - x),
                    Math.max(y, window.innerHeight - y),
                );
                const midRadius = endRadius * 0.42;
                const lateRadius = endRadius * 0.78;
                const bloomFilter = dark
                    ? "brightness(1.18) saturate(1.16) contrast(1.04)"
                    : "brightness(1.12) saturate(1.08) contrast(1.02)";

                document.documentElement.animate(
                    {
                        opacity: [1, 0.96, 0.22, 0],
                        filter: [
                            "blur(0px) brightness(1)",
                            "blur(1px) brightness(1.02)",
                            "blur(8px) brightness(0.98)",
                            "blur(14px) brightness(0.94)",
                        ],
                        transform: [
                            "scale(1)",
                            "scale(1.006)",
                            "scale(1.016)",
                            "scale(1.024)",
                        ],
                    },
                    {
                        duration: 520,
                        easing: "cubic-bezier(0.32, 0, 0.67, 0)",
                        fill: "both",
                        pseudoElement: "::view-transition-old(root)",
                    },
                );

                document.documentElement.animate(
                    {
                        clipPath: [
                            `circle(${startRadius}px at ${x}px ${y}px)`,
                            `circle(${midRadius}px at ${x}px ${y}px)`,
                            `circle(${lateRadius}px at ${x}px ${y}px)`,
                            `circle(${endRadius * 1.04}px at ${x}px ${y}px)`,
                        ],
                        opacity: [0.2, 0.72, 0.96, 1],
                        filter: [
                            `${bloomFilter} blur(18px)`,
                            `${bloomFilter} blur(10px)`,
                            "brightness(1.03) saturate(1.02) blur(4px)",
                            "brightness(1) saturate(1) blur(0px)",
                        ],
                        transform: [
                            "scale(0.94)",
                            "scale(0.972)",
                            "scale(0.992)",
                            "scale(1)",
                        ],
                        offset: [0, 0.34, 0.72, 1],
                    },
                    {
                        duration: 980,
                        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
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
        animateThemeReveal(transition, x, y, dark);
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
                className={`absolute h-7 w-[36px] bg-gradient-to-br from-indigo-500 via-violet-500 to-blue-500 transition-all duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] shadow-[0_8px_24px_rgba(79,70,229,0.32)] ${!isDarkMode ? 'translate-x-[36px] scale-[0.98]' : 'translate-x-0 scale-100'}`}
            />

            <button
                onClick={(event) => toggleTheme(event, true)}
                className={`relative z-10 w-9 h-7 flex items-center justify-center transition-all duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${isDarkMode ? 'text-white' : 'text-muted-foreground dark:text-slate-500 hover:text-foreground dark:hover:text-slate-300'}`}
                title="Dark Mode"
            >
                <Moon className={`h-3.5 w-3.5 transition-transform duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${isDarkMode ? 'scale-110 rotate-0' : 'scale-100 -rotate-12'}`} />
            </button>

            <button
                onClick={(event) => toggleTheme(event, false)}
                className={`relative z-10 w-9 h-7 flex items-center justify-center transition-all duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${!isDarkMode ? 'text-white' : 'text-muted-foreground dark:text-slate-500 hover:text-foreground dark:hover:text-slate-300'}`}
                title="Light Mode"
            >
                <Sun className={`h-3.5 w-3.5 transition-transform duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${!isDarkMode ? 'scale-110 rotate-0' : 'scale-100 rotate-45'}`} />
            </button>
        </div>
    );
}
