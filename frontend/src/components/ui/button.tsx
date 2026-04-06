import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[14px] border text-sm font-semibold tracking-[-0.01em] ring-offset-background backdrop-blur-xl transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-300 will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.985]",
  {
    variants: {
      variant: {
        default: "border-indigo-500/20 bg-[linear-gradient(180deg,#7066FF_0%,#4F46E5_100%)] text-white shadow-[0_18px_38px_rgba(79,70,229,0.26)] hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(79,70,229,0.34)]",
        destructive:
          "border-red-500/20 bg-[linear-gradient(180deg,#FB7185_0%,#EF4444_100%)] text-white shadow-[0_18px_36px_rgba(239,68,68,0.22)] hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(239,68,68,0.3)]",
        outline:
          "border-border/80 bg-card/70 text-foreground shadow-[0_12px_28px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:bg-muted/80",
        secondary:
          "border-white/10 bg-muted/70 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:-translate-y-0.5 hover:bg-slate-200/80 dark:hover:bg-slate-700/80",
        ghost: "border-transparent bg-transparent shadow-none hover:bg-muted/70 hover:text-foreground",
        link: "text-indigo-600 dark:text-indigo-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10 rounded-[14px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
