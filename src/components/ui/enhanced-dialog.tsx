/**
 * Enhanced Dialog Component - UI System
 * 
 * Enhanced shadcn/ui Dialog with AI control hooks and GSAP animation coordination.
 * Maintains backward compatibility while adding AI modal management capabilities.
 */

"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AIControlProps, NavigationCommand, ModalOptions } from "@/lib/ui/types";

interface EnhancedDialogProps 
  extends React.ComponentProps<typeof DialogPrimitive.Root>,
    AIControlProps {
  aiId?: string;
}

function EnhancedDialog({ aiControlEnabled = false, aiId, onAINavigate, ...props }: EnhancedDialogProps) {
  // Handle AI navigation commands
  const handleAICommand = React.useCallback((command: NavigationCommand) => {
    if (onAINavigate) {
      onAINavigate(command);
    }
  }, [onAINavigate]);

  // Add AI-specific attributes
  const aiAttributes = aiControlEnabled ? {
    'data-ai-controllable': 'true',
    'data-ai-id': aiId,
    'data-ai-type': 'dialog',
  } : {};

  return (
    <DialogPrimitive.Root 
      data-slot="dialog" 
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

function EnhancedDialogOverlay({
  className,
  animated = true,
  ...props
}: EnhancedDialogOverlayProps) {
  if (animated) {
    // Filter out conflicting props for motion.div
    const { 
      onDrag, 
      onDragStart, 
      onDragEnd,
      onAnimationStart,
      onAnimationEnd,
      onAnimationIteration,
      ...motionProps 
    } = props;
    
    return (
      <DialogPrimitive.Overlay asChild>
        <motion.div
          data-slot="dialog-overlay"
          className={cn(
            "fixed inset-0 z-50 bg-black/50",
            className
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          {...motionProps}
        />
      </DialogPrimitive.Overlay>
    );
  }

  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
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
  ...props
}: EnhancedDialogContentProps) {
  // Handle AI navigation commands
  const handleAICommand = React.useCallback((command: NavigationCommand) => {
    if (onAINavigate) {
      onAINavigate(command);
    }
  }, [onAINavigate]);

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

  if (animated) {
    // Filter out conflicting props for motion.div
    const { 
      onDrag, 
      onDragStart, 
      onDragEnd,
      onAnimationStart,
      onAnimationEnd,
      onAnimationIteration,
      ...motionProps 
    } = props;
    
    return (
      <EnhancedDialogPortal>
        <EnhancedDialogOverlay animated={animated} />
        <DialogPrimitive.Content asChild>
          <motion.div
            data-slot="dialog-content"
            className={cn(
              "bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg sm:max-w-lg",
              className
            )}
            variants={getAnimationVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeOut" }}
            {...aiAttributes}
            {...motionProps}
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
          </motion.div>
        </DialogPrimitive.Content>
      </EnhancedDialogPortal>
    );
  }

  return (
    <EnhancedDialogPortal>
      <EnhancedDialogOverlay animated={false} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...aiAttributes}
        {...props}
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