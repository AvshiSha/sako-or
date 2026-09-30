"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { cva, type VariantProps } from "class-variance-authority"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const checkboxVariants = cva(
  "grid shrink-0 place-content-center border ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        // Pre-redesign control, kept as the default for the remaining consumer.
        default:
          "peer h-4 w-4 rounded-sm border-[#856D55]/70 bg-[#E1DBD7]/70 focus-visible:ring-[#856D55] data-[state=checked]:border-[#856D55] data-[state=checked]:bg-[#856D55]",
        // Design system checkbox, checkout 438:2744. 16px, a 1px pure-black edge
        // and the DS's 2px radius — one of only two places the system rounds
        // anything. Unchecked is a flat #d9d9d9 fill rather than transparent.
        sako:
          "size-[16px] rounded-sako-sm border-sako-black bg-input-unchecked focus-visible:ring-sako-ink-900 data-[state=checked]:bg-sako-ink-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxVariants> {}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, variant, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(checkboxVariants({ variant, className }))}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="grid place-content-center text-current">
      {/* GAP: 438:2744 ships no checked state. The tick on the frame is a loose
          vector (438:2821) positioned over the box at the page root rather than
          inside the component, so there is no asset to export and no checked
          variant to read. Sized to that vector's 12x11.5 and inverted on the ink
          fill; worth a design fix so the component carries its own state. */}
      <Check
        className={cn(
          "h-4 w-4 text-white",
          variant === "sako" && "h-[11.5px] w-[12px] text-text-inverse"
        )}
        strokeWidth={variant === "sako" ? 3 : 2}
      />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox, checkboxVariants }
