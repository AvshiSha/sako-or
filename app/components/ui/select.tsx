"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Value>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Value
    ref={ref}
    className={cn(
      "block w-full font-medium",
      // Default: selected value styling (dark, visible) - this applies when NOT a placeholder
      "text-slate-900 opacity-100",
      // Placeholder styling (lighter, more visible) - only when data-placeholder attribute exists
      "[&[data-placeholder]]:!text-slate-400 [&[data-placeholder]]:!font-normal [&[data-placeholder]]:!opacity-100",
      // Ensure selected text is always visible
      "[&:not([data-placeholder])]:!text-slate-900 [&:not([data-placeholder])]:!opacity-100",
      className
    )}
    {...props}
  />
))
SelectValue.displayName = SelectPrimitive.Value.displayName

interface SelectTriggerProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
  dir?: "ltr" | "rtl";
}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, dir = "ltr", ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    dir={dir}
    className={cn(
      "flex h-10 w-full items-center rounded-md border border-[#856D55]/70 bg-[#E1DBD7]/70 px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-[#856D55] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
      dir === "rtl" && "flex-row gap-2 [&>span]:flex-1 [&>span]:min-w-0 [&>span]:text-right [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap [&>span]:block [&>span]:text-slate-900",
      dir === "ltr" && "flex-row gap-2 [&>span]:flex-1 [&>span]:min-w-0 [&>span]:text-left [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap [&>span]:block [&>span]:text-slate-900",
      className
    )}
    {...props}
  >
    {dir === "ltr" && (
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-5 w-5 text-[#856D55] transition-transform duration-300 ease-in-out [&[data-state=open]]:rotate-180 shrink-0 flex-shrink-0" />
      </SelectPrimitive.Icon>
    )}
    {children}
    {dir === "rtl" && (
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-5 w-5 text-[#856D55] transition-transform duration-300 ease-in-out [&[data-state=open]]:rotate-180 shrink-0 flex-shrink-0" />
      </SelectPrimitive.Icon>
    )}
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

interface SelectContentProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> {
  dir?: "ltr" | "rtl";
}

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(({ className, children, position = "popper", dir = "ltr", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      dir={dir}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-white text-gray-950 shadow-md select-content",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

interface SelectItemProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  dir?: "ltr" | "rtl";
}

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, dir = "ltr", ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    dir={dir}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 text-sm outline-none focus:bg-gray-100 focus:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors duration-150 hover:bg-gray-50",
      dir === "rtl" ? "pr-8 pl-2" : "pl-8 pr-2",
      className
    )}
    {...props}
  >
    <span className={cn(
      "absolute flex h-3.5 w-3.5 items-center justify-center",
      dir === "rtl" ? "right-2" : "left-2"
    )}>
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText className={dir === "rtl" ? "text-right" : "text-left"}>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-gray-100", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}

