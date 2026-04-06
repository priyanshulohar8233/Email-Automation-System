import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[-0.01em] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-lg transition-[background-color,border-color,color,box-shadow] focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-indigo-500/20 bg-indigo-600 text-white hover:bg-indigo-700",
        secondary:
          "border-transparent bg-muted/80 text-muted-foreground hover:bg-muted/90",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground border-border/80 bg-card/60",
        success: "border-transparent bg-green-500 text-white hover:bg-green-600",
        warning: "border-transparent bg-amber-500 text-white hover:bg-amber-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> {
  children?: React.ReactNode;
  className?: string;
}

function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
