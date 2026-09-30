import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  "w-full ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        // Pre-redesign control. Still the default so the one remaining consumer,
        // and anything in admin, is untouched by the storefront work.
        default:
          "flex h-10 rounded-md border border-[#856D55]/70 bg-[#E1DBD7]/70 px-3 py-2 text-base placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#856D55] md:text-sm",
        // Design system field, checkout 438:2751 "Form Input Field". No box: the
        // rule under the field IS the control, so the input itself is transparent
        // and borderless and the hairline belongs to the Field wrapper below.
        // Pair with <Field>, which carries the 9px caption and the 54px height.
        sako:
          "flex-1 border-0 bg-transparent p-0 font-ploni text-[14px] leading-none text-text-primary placeholder:text-text-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface InputProps
  extends React.ComponentProps<"input">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input, inputVariants }
