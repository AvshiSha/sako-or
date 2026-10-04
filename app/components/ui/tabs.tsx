import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

/**
 * `sako` is the design system's ruled switch: no pill, no tray, no shadow —
 * just the labels sitting on the same hairline the form fields use, the chosen
 * one carrying a 2px ink rule and the other a subtle one. It is the Checkout
 * Tabs construction, drawn in Label/Tag (12px DemiBold at 1.2px tracking).
 *
 * Radix is kept underneath rather than hand-rolled so the arrow-key roving
 * focus, the aria-selected wiring and the tab/panel association come for free.
 */
const tabsListVariants = cva("", {
  variants: {
    variant: {
      default:
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      sako: "flex w-full items-stretch",
    },
  },
  defaultVariants: { variant: "default" },
})

const tabsTriggerVariants = cva("", {
  variants: {
    variant: {
      default:
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      sako: cn(
        "flex-1 cursor-pointer border-b pb-[12px] font-ploni text-[12px] font-semibold tracking-[1.2px] transition-[color,border-color]",
        "border-border-subtle text-text-secondary hover:text-text-primary",
        "data-[state=active]:border-b-2 data-[state=active]:border-sako-ink-900 data-[state=active]:pb-[11px] data-[state=active]:text-text-primary",
        // The rule is the only thing marking the choice, so the keyboard needs
        // a mark of its own that does not move anything: an offset outline.
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sako-ink-900",
        "disabled:cursor-not-allowed disabled:text-sako-gray-500"
      ),
    },
  },
  defaultVariants: { variant: "default" },
})

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> &
    VariantProps<typeof tabsListVariants>
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant }), className)}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> &
    VariantProps<typeof tabsTriggerVariants>
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), className)}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
