import React from "react";
import { ThemeToggle } from "./ThemeToggle";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
    return (
        <div className="page-header-shell mb-8 flex flex-col gap-5 rounded-[28px] px-6 py-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1.5">
                <h1 className="text-[2rem] font-bold tracking-[-0.05em] text-foreground transition-colors duration-300">
                    {title}
                </h1>
                {subtitle && (
                    <p className="max-w-2xl text-[15px] font-medium text-muted-foreground transition-colors duration-300">
                        {subtitle}
                    </p>
                )}
            </div>
            <div className="page-header-toolbar flex items-center gap-3 self-start rounded-[20px] px-3 py-2 md:self-auto">
                {children}
                <ThemeToggle />
            </div>
        </div>
    );
}
