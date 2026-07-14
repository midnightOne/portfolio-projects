/**
 * Enhanced Dialog Component - UI System
 *
 * Enhanced shadcn/ui Dialog with AI control hooks and GSAP animation coordination.
 * Maintains backward compatibility while adding AI modal management capabilities.
 *
 * AI-surface coexistence (ui-system task 3.7): same mechanism as dialog.tsx —
 * non-modal Radix root, the Content element doubles as the full-viewport
 * scrim, outside interactions scoped so `[data-ai-surface]` never dismisses,
 * scroll lock + aria-modal handled here, z from the central scale (Req 5.2).
 */

"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AIControlProps } from "@/lib/ui/types";
import { Z_LAYERS } from "@/lib/ui/ai-visual-config";
import { isAISurfaceTarget } from "./dialog";
import { ScrollLock } from "./use-scroll-lock";

interface EnhancedDialogProps
  extends React.ComponentProps<typeof DialogPrimitive.Root>,
    AIControlProps {
  aiId?: string;
}

function EnhancedDialog({ aiControlEnabled = false, aiId, onAINavigate, modal = false, ...props }: EnhancedDialogProps) {
  // Add AI-specific attributes
  const aiAttributes = aiControlEnabled ? {
    'data-ai-controllable': 'true',
    'data-ai-id': aiId,
    'data-ai-type': 'dialog',
  } : {};

  return (
    <DialogPrimitive.Root
      data-slot="dialog"
      modal={modal}
      {...aiAttributes}
      {...props}
    />
  );
}

function EnhancedDialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function EnhancedDialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function EnhancedDialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

interface EnhancedDialogOverlayProps
  extends React.ComponentProps<typeof DialogPrimitive.Overlay> {
  animated?: boolean;
}

/**
 * Kept for API compatibility (no-op while the root runs non-modal —
 * EnhancedDialogContent paints its own scrim).
 */
function EnhancedDialogOverlay({
  className,
  animated = true,
  ...props
}: EnhancedDialogOverlayProps) {
  void animated;
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
  );
}

interface EnhancedDialogContentProps
  extends React.ComponentProps<typeof DialogPrimitive.Content>,
    AIControlProps {
  showCloseButton?: boolean;
  animated?: boolean;
  animationType?: 'fade' | 'slide' | 'scale';
  aiId?: string;
  /** Extra classes for the full-viewport scrim container. */
  overlayClassName?: string;
}

function EnhancedDialogContent({
  className,
  children,
  showCloseButton = true,
  animated = true,
  animationType = 'scale',
  aiControlEnabled = false,
  aiId,
  onAINavigate,
  onAIHighlight,
  overlayClassName,
  style,
  onInteractOutside,
  onFocusOutside,
  onPointerDown,
  ...props
}: EnhancedDialogContentProps) {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  void onAINavigate;
  void onAIHighlight;

  // Animation variants based on type
  const getAnimationVariants = () => {
    switch (animationType) {
      case 'fade':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        };
      case 'slide':
        return {
          initial: { opacity: 0, y: -50 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -50 },
        };
      case 'scale':
      default:
        return {
          initial: { opacity: 0, scale: 0.95 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.95 },
        };
    }
  };

  // Add AI-specific attributes
  const aiAttributes = aiControlEnabled ? {
    'data-ai-controllable': 'true',
    'data-ai-id': aiId,
    'data-ai-type': 'dialog-content',
  } : {};

  const panelClassName = cn(
    "relative grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-lg border bg-background p-6 shadow-lg sm:max-w-lg",
    !animated &&
      "group-data-[state=open]:animate-in group-data-[state=closed]:animate-out group-data-[state=closed]:fade-out-0 group-data-[state=open]:fade-in-0 group-data-[state=closed]:zoom-out-95 group-data-[state=open]:zoom-in-95 duration-200",
    className
  );

  const closeButton = showCloseButton && (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
    >
      <XIcon />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  );

  return (
    <EnhancedDialogPortal>
      <DialogPrimitive.Content
        data-slot="dialog-content"
        aria-modal="true"
        className={cn(
          "group fixed inset-0 grid place-items-center overflow-y-auto bg-black/50 p-4",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
          overlayClassName
        )}
        style={{ zIndex: Z_LAYERS.modalContent }}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          if (!event.defaultPrevented && event.target === event.currentTarget) {
            closeRef.current?.click();
          }
        }}
        onInteractOutside={(event) => {
          onInteractOutside?.(event);
          if (!event.defaultPrevented && isAISurfaceTarget(event.target)) {
            event.preventDefault();
          }
        }}
        onFocusOutside={(event) => {
          onFocusOutside?.(event);
          event.preventDefault();
        }}
        {...props}
      >
        {/* Inside Content so it locks scroll only while the dialog is open
            (Radix mounts this subtree only when open). */}
        <ScrollLock />
        {animated ? (
          <motion.div
            data-slot="dialog-panel"
            className={panelClassName}
            style={style as React.CSSProperties}
            variants={getAnimationVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeOut" }}
            {...aiAttributes}
          >
            {children}
            {closeButton}
          </motion.div>
        ) : (
          <div data-slot="dialog-panel" className={panelClassName} style={style} {...aiAttributes}>
            {children}
            {closeButton}
          </div>
        )}
        <DialogPrimitive.Close ref={closeRef} tabIndex={-1} aria-hidden="true" className="hidden" />
      </DialogPrimitive.Content>
    </EnhancedDialogPortal>
  );
}

function EnhancedDialogHeader({
  className,
  aiId,
  ...props
}: React.ComponentProps<"div"> & { aiId?: string }) {
  return (
    <div
      data-slot="dialog-header"
      data-ai-id={aiId}
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function EnhancedDialogFooter({
  className,
  aiId,
  ...props
}: React.ComponentProps<"div"> & { aiId?: string }) {
  return (
    <div
      data-slot="dialog-footer"
      data-ai-id={aiId}
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

function EnhancedDialogTitle({
  className,
  aiId,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title> & { aiId?: string }) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      data-ai-id={aiId}
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function EnhancedDialogDescription({
  className,
  aiId,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description> & { aiId?: string }) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      data-ai-id={aiId}
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  EnhancedDialog,
  EnhancedDialogClose,
  EnhancedDialogContent,
  EnhancedDialogDescription,
  EnhancedDialogFooter,
  EnhancedDialogHeader,
  EnhancedDialogOverlay,
  EnhancedDialogPortal,
  EnhancedDialogTitle,
  EnhancedDialogTrigger,
};

export type { EnhancedDialogProps, EnhancedDialogContentProps };
