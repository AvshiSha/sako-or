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
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200">
        <SliderPrimitive.Range className="absolute h-full bg-[#856D55]/90" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }).map((_, index) => (
        <SliderPrimitive.Thumb 
          key={index}
          className="block h-5 w-5 rounded-full border-2 border-[#856D55]/90 bg-white ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" 
        />
      ))}
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
