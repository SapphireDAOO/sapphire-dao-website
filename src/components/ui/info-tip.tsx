"use client"

import * as React from "react"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

const stopProp = (e: React.SyntheticEvent) => e.stopPropagation()

/**
 * An info icon whose tooltip opens on hover and on tap: Radix tooltips ignore
 * touch, so on a phone the tap toggles it instead. Clicks never reach a
 * clickable parent such as an invoice card.
 */
const InfoTip = ({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) => {
  const [open, setOpen] = React.useState(false)
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((value) => !value)
          }}
          onMouseDown={stopProp}
          className={cn(
            "flex items-center rounded p-0.5 text-gray-500 transition-colors hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300",
            className
          )}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      {/* Portalled, but React still bubbles its clicks to the card. */}
      <TooltipContent
        className="w-60 p-3 text-xs"
        onClick={stopProp}
        onMouseDown={stopProp}
      >
        {children}
      </TooltipContent>
    </Tooltip>
  )
}

export { InfoTip }
