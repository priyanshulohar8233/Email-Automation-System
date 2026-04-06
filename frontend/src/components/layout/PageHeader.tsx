import React from "react";
import { ThemeToggle } from "./ThemeToggle";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
    return (
        <div className="apple-page-header mb-8 flex flex-col gap-5 px-6 py-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
                <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-foreground transition-colors duration-300">
                    {title}
                </h1>
                {subtitle && (
                    <p className="max-w-2xl text-[15px] font-medium text-muted-foreground transition-colors duration-300">
                        {subtitle}
                    </p>
                )}
            </div>
            <div className="apple-toolbar-shell flex items-center gap-3 self-start px-3 py-2 md:self-auto">
                {children}
                <ThemeToggle />
            </div>
        </div>
    );
}
