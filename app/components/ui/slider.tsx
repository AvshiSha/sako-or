import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, value, defaultValue, ...props }, ref) => {
  // Radix UI automatically creates thumbs based on the value array length
  // We need to explicitly render thumbs for each value in the array
  // For controlled mode, always use value prop (never fallback to defaultValue after mount)
  const sliderValue = value ?? defaultValue ?? [0];
  const thumbCount = Array.isArray(sliderValue) ? sliderValue.length : 1;
  
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      value={value} // Always pass value prop explicitly (controlled mode)
      defaultValue={defaultValue} // Only used if value is undefined (uncontrolled mode)
      {...props}
    >
      {/* 438:3105 draws a heavy black rule with two ringed handles. The unselected
          track stays light so the chosen range is still legible; at the default
          full range the two read as the single black line the frame shows. The old
          #856D55 was the pre-redesign brand colour and is not in the token set. */}
      <SliderPrimitive.Track className="relative h-[5px] w-full grow overflow-hidden rounded-full bg-sako-gray-200">
        <SliderPrimitive.Range className="absolute h-full bg-sako-ink-900" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }).map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="block h-[18px] w-[18px] rounded-full border-2 border-sako-ink-900 bg-surface-primary ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sako-ink-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
