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
        "focus-visible:ring-[3px] focus-visible:ring-violet-500/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Unchecked state
        "data-[state=unchecked]:bg-zinc-800/80 data-[state=unchecked]:border-white/10",
        // Checked state - violet gradient
        "data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-500 data-[state=checked]:to-purple-600",
        "data-[state=checked]:border-violet-400/30 data-[state=checked]:shadow-[0_0_12px_rgba(139,92,246,0.3)]",
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
          // Unchecked - subtle gray
          "data-[state=unchecked]:bg-zinc-400",
          // Checked - white with glow
          "data-[state=checked]:bg-white data-[state=checked]:shadow-[0_0_8px_rgba(255,255,255,0.4)]",
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
