import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * The field value's type size — and the one place the iOS zoom floor is handled.
 *
 * 14px is the design system's value (checkout 438:2752). iOS Safari zooms the
 * whole page in when a control it is focusing computes to under 16px, so the
 * designed size is also the bug: tapping any field shifted the viewport and left
 * the customer pinching back out mid-form.
 *
 * Raising the computed size is the only fix that keeps pinch-to-zoom working.
 * `maximum-scale=1` / `user-scalable=no` on the viewport meta would also stop it
 * and is deliberately NOT used — it takes zoom away from everyone, on every page,
 * to fix four forms.
 *
 * `pointer-coarse`, not a width breakpoint: the zoom is a touch-device behaviour
 * rather than a narrow-window one. This keeps the designed 14px on every desktop
 * at every width — including a window dragged to phone width, where `max-sm:`
 * would have changed type the design never meant to change — and still covers the
 * iPad, which is 768px wide and would sit on the desktop side of any `md:` line.
 *
 * The 2px costs no layout. The value line is `flex-1` inside <Field>'s fixed 54px
 * cell, so its box is 33px at either size and only the glyphs grow; the contact
 * form's textarea keeps its explicit `leading-[22px]`. Measured, not assumed —
 * both cells come back identical at 390px wide.
 */
export const FIELD_VALUE_TEXT = "text-[14px] pointer-coarse:text-[16px]"

/**
 * The boxed field's type size — the order summary's coupon and points controls,
 * which are drawn as bordered boxes rather than on a rule and so start from a
 * different number than the fields above.
 *
 * Same iOS zoom floor, different trap. These two are drawn at 16px (cart
 * 438:3991), which is exactly Safari's threshold rather than under it — and
 * exactly at the threshold is not enough. `font-ploni` loads with
 * `font-display: swap`, and the `ploni Fallback` face Next generates for it
 * carries `size-adjust: 97.13%`, so for the whole swap window the declared 16px
 * is *used* as 15.54px. On a phone that window is precisely when someone taps
 * the coupon field, Safari measures 15.54px, and the page zooms.
 *
 * One pixel on touch devices puts the used size back over the floor —
 * 17 × 0.9713 = 16.51px in the fallback, 17px once Ploni lands — and costs no
 * layout: both fields are fixed-height boxes (54px for the coupon row) with the
 * input stretched inside, so only the glyphs change.
 *
 * `pointer-coarse` rather than a width breakpoint, and never
 * `maximum-scale=1` / `user-scalable=no`, for the reasons spelled out above.
 */
export const FIELD_BOX_TEXT = "text-[16px] pointer-coarse:text-[17px]"

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
        // disabled:opacity-100 cancels the base 50% fade — unavailable is a flat
        // grey here, as it is on the CTA, not a ghost of the enabled control.
        sako:
          `flex-1 border-0 bg-transparent p-0 font-ploni ${FIELD_VALUE_TEXT} leading-none text-text-primary placeholder:text-text-secondary disabled:opacity-100 disabled:text-sako-gray-500 disabled:placeholder:text-sako-gray-500`,
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
