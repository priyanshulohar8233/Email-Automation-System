import React from "react";
import { ThemeToggle } from "./ThemeToggle";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground transition-colors duration-300">
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-muted-foreground transition-colors duration-300">
                        {subtitle}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-3">
                {children}
                <ThemeToggle />
            </div>
        </div>
    );
}
