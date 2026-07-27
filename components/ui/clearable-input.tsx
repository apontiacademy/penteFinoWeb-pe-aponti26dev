'use client'

import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

type ClearableInputProps = React.ComponentProps<typeof Input> & {
  onClear: () => void
}

function ClearableInput({ value, onClear, className, ...props }: ClearableInputProps) {
  const hasValue = typeof value === "string" && value.length > 0

  return (
    <div className="relative">
      <Input
        value={value}
        className={cn(hasValue && "pr-7", className)}
        {...props}
      />
      {hasValue && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Limpar filtro"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

export { ClearableInput }
