/**
 * Enhanced Button Component - UI System
 * 
 * Enhanced shadcn/ui Button with AI control hooks and animation coordination.
 * Maintains backward compatibility while adding AI navigation capabilities.
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AIControlProps, NavigationCommand } from "@/lib/ui/types";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface EnhancedButtonProps 
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants>,
    AIControlProps {
  asChild?: boolean;
  animated?: boolean;
  aiId?: string; // Unique identifier for AI targeting
}

const EnhancedButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    asChild = false, 
    animated = true,
    aiControlEnabled = false,
    aiId,
    onAINavigate,
    onAIHighlight,
    onClick,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "button";
    const MotionComp = asChild ? motion.div : motion.button;

    // Handle AI navigation commands
    const handleAICommand = React.useCallback((command: NavigationCommand) => {
      if (onAINavigate) {
        onAINavigate(command);
      }
    }, [onAINavigate]);

    // Enhanced click handler that notifies AI system
    const handleClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
      // Call original onClick
      if (onClick) {
        onClick(event);
      }

      // Notify AI system of user interaction
      if (aiControlEnabled && onAINavigate) {
        const command: NavigationCommand = {
          action: 'navigate',
          target: aiId || event.currentTarget.id || 'button',
          metadata: {
            source: 'user',
            timestamp: Date.now(),
            sessionId: 'current', // Would be replaced with actual session ID
          },
        };
        handleAICommand(command);
      }
    }, [onClick, aiControlEnabled, aiId, onAINavigate, handleAICommand]);

    // Animation variants for AI interactions
    const animationVariants = {
      initial: { scale: 1 },
      hover: { scale: animated ? 1.02 : 1 },
      tap: { scale: animated ? 0.98 : 1 },
      aiHighlight: { 
        scale: 1.05,
        boxShadow: "0 0 0 2px var(--primary)",
        transition: { duration: 0.3 }
      },
    };

    // Add AI-specific attributes
    const aiAttributes = aiControlEnabled ? {
      'data-ai-controllable': 'true',
      'data-ai-id': aiId,
      'data-ai-type': 'button',
    } : {};

    if (animated && !asChild) {
      return (
        <motion.button
          ref={ref}
          data-slot="button"
          className={cn(buttonVariants({ variant, size, className }))}
          variants={animationVariants}
          initial="initial"
          whileHover="hover"
          whileTap="tap"
          onClick={handleClick}
          {...aiAttributes}
          {...props}
        />
      );
    }

    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        onClick={handleClick}
        {...aiAttributes}
        {...props}
      />
    );
  }
);

EnhancedButton.displayName = "EnhancedButton";

export { EnhancedButton, buttonVariants };
export type { EnhancedButtonProps };