import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Design system CTA, 438:2703 / 438:3915. Sharp-cornered filled bar on
        // ink-900 with a paper-100 label. Pair with size="sako", which carries the
        // designed type and padding. disabled:opacity-100 cancels the base's 50%
        // fade: the design expresses unavailable as a flat grey fill, not a ghost.
        sako:
          "rounded-none border border-btn-primary-bg bg-btn-primary-bg text-btn-primary-text hover:bg-sako-ink-800 disabled:border-sako-gray-500 disabled:bg-sako-gray-500 disabled:opacity-100",
        // CTA Button State=Outlined, 438:7685. The same 54px bar drawn as a
        // 1px ink edge on the page ground with an ink label — the design
        // system's only secondary action. Disabled greys the edge and the label
        // rather than fading the whole control.
        sakoOutlined:
          "rounded-none border border-border-default bg-transparent text-btn-secondary-text hover:bg-sako-ink-900 hover:text-btn-primary-text disabled:border-sako-gray-500 disabled:bg-transparent disabled:text-sako-gray-500 disabled:opacity-100",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        // Typography/Button/Label: Ploni Bold 16 / 100% line-height, over the
        // frame's 14px vertical padding. That comes to a 44px content box, which is
        // also the touch-target minimum, so no mobile-specific override is needed.
        sako: "h-auto w-full px-6 py-[14px] font-ploni text-[16px] font-bold leading-none",
        // The CTA bar at the height the design system actually draws it: 54px,
        // 438:7683 / 438:7685. `sako` above predates this and comes out at 44px
        // from its padding, which is why checkout and contact each hand-rolled
        // their own 58/56px bar. New work should use this one.
        sakoBar: "h-[54px] w-full px-[19px] font-ploni text-[16px] font-bold leading-none",
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
