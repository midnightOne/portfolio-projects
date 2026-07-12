"use client"

/**
 * Dialog — customized shadcn/ui Radix wrapper with AI-surface coexistence
 * (ui-system task 3.7; owner 2026-07-11: "the AI UI should be always on top…
 * if the modal is open and the user clicks inside of the AI parts of the UI,
 * the modal should still stay open").
 *
 * Mechanism (recorded in ui-system design.md):
 *  - Radix runs NON-modal (`modal={false}`): no body pointer-events lock and
 *    no focus trap, so the AI pill/sidebar (z-layer above the modal band)
 *    stay fully interactive while a dialog is open.
 *  - The Content element itself is the full-viewport scrim: page content is
 *    still pointer-blocked and visually dimmed, and a pointerdown on the true
 *    backdrop closes the dialog (matching Radix modal behavior).
 *  - Outside interactions are re-scoped: events originating inside
 *    `[data-ai-surface]` never dismiss; focus leaving the dialog (e.g. into
 *    the pill input) never dismisses. Esc and the close button work as before.
 *  - Scroll lock + scrollbar compensation are re-implemented here (Radix only
 *    locks in modal mode); `aria-modal` is set manually so the PAGE content
 *    keeps modal semantics for assistive tech — the AI layer is deliberately
 *    presented as a separate companion surface.
 *  - z-index comes from the central scale (Req 5.2): Z_LAYERS.modalContent.
 */

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Z_LAYERS } from "@/lib/ui/ai-visual-config"

function Dialog({
  modal = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" modal={modal} {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

/**
 * Kept for API compatibility. In non-modal mode Radix renders no overlay —
 * DialogContent now paints its own scrim — so standalone usage is a no-op
 * unless the dialog opts back into `modal`.
 */
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/50",
        className
      )}
      style={{ zIndex: Z_LAYERS.modalOverlay }}
      {...props}
    />
  )
}

/** True when an outside-interaction event originated inside an AI surface. */
export function isAISurfaceTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-ai-surface]") !== null
}

// Page scroll lock with scrollbar compensation (nesting-safe). Radix's own
// lock only applies in modal mode.
let scrollLockCount = 0
function useDialogScrollLock() {
  React.useEffect(() => {
    scrollLockCount++
    if (scrollLockCount === 1) {
      const root = document.documentElement
      const scrollbar = window.innerWidth - root.clientWidth
      root.style.overflow = "hidden"
      if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`
    }
    return () => {
      scrollLockCount--
      if (scrollLockCount === 0) {
        const root = document.documentElement
        root.style.overflow = ""
        root.style.paddingRight = ""
      }
    }
  }, [])
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  overlayClassName,
  style,
  onInteractOutside,
  onFocusOutside,
  onPointerDown,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  /** Extra classes for the full-viewport scrim container. */
  overlayClassName?: string
}) {
  useDialogScrollLock()
  const closeRef = React.useRef<HTMLButtonElement>(null)

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogPrimitive.Content
        data-slot="dialog-content"
        aria-modal="true"
        className={cn(
          // The Content element is the scrim: full viewport, centers the panel.
          "group fixed inset-0 grid place-items-center overflow-y-auto bg-black/50 p-4",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
          overlayClassName
        )}
        style={{ zIndex: Z_LAYERS.modalContent }}
        onPointerDown={(event) => {
          onPointerDown?.(event)
          // A press on the true backdrop (not the panel) closes the dialog.
          if (!event.defaultPrevented && event.target === event.currentTarget) {
            closeRef.current?.click()
          }
        }}
        onInteractOutside={(event) => {
          onInteractOutside?.(event)
          // Interacting with the AI pill/sidebar/chips must not dismiss (3.7).
          if (!event.defaultPrevented && isAISurfaceTarget(event.target)) {
            event.preventDefault()
          }
        }}
        onFocusOutside={(event) => {
          onFocusOutside?.(event)
          // Focus moving into the always-on-top AI layer never dismisses.
          event.preventDefault()
        }}
        {...props}
      >
        <div
          data-slot="dialog-panel"
          className={cn(
            "relative grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-lg border bg-background p-6 shadow-lg sm:max-w-lg",
            "group-data-[state=open]:animate-in group-data-[state=closed]:animate-out group-data-[state=closed]:fade-out-0 group-data-[state=open]:fade-in-0 group-data-[state=closed]:zoom-out-95 group-data-[state=open]:zoom-in-95 duration-200",
            className
          )}
          style={style}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </div>
        {/* Hidden dismisser the backdrop handler drives (works controlled & uncontrolled). */}
        <DialogPrimitive.Close ref={closeRef} tabIndex={-1} aria-hidden="true" className="hidden" />
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
