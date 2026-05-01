import * as React from "react"
import { Dialog } from "radix-ui"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export const Sheet = Dialog.Root
export const SheetTrigger = Dialog.Trigger
export const SheetClose = Dialog.Close

interface SheetContentProps {
  side?: "left" | "right"
  className?: string
  children?: React.ReactNode
}

export function SheetContent({ side = "left", className, children }: SheetContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <Dialog.Content
        className={cn(
          "fixed z-50 h-full w-3/4 max-w-xs bg-white shadow-xl flex flex-col",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "left"
            ? "left-0 top-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
            : "right-0 top-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          className
        )}
      >
        {children}
        <Dialog.Close className="absolute right-4 top-4 rounded-sm p-1 opacity-70 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring">
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  )
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-6 pb-4", className)} {...props} />
}

export function SheetTitle({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Dialog.Title className={cn("text-base font-semibold text-gray-900", className)}>
      {children}
    </Dialog.Title>
  )
}
