import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex shrink-0 items-center rounded-full border transition-all duration-200 outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-[#4d65ff]/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Unchecked state
        "data-[state=unchecked]:bg-zinc-800 data-[state=unchecked]:border-white/8",
        // Checked state - teal
        "data-[state=checked]:bg-teal-500",
        "data-[state=checked]:border-teal-400/30",
        // Sizes
        "data-[size=default]:h-[20px] data-[size=default]:w-9",
        "data-[size=sm]:h-4 data-[size=sm]:w-7",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full ring-0 transition-all duration-200",
          // Unchecked
          "data-[state=unchecked]:bg-zinc-400",
          // Checked
          "data-[state=checked]:bg-white",
          // Size variants
          "group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3",
          // Position
          "data-[state=unchecked]:translate-x-0.5",
          "data-[state=checked]:translate-x-[calc(100%-2px)]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
