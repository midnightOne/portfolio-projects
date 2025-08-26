/**
 * Enhanced Card Component - UI System
 * 
 * Enhanced shadcn/ui Card with AI control hooks and highlighting capabilities.
 * Maintains backward compatibility while adding AI interaction features.
 */

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AIControlProps, HighlightOptions, NavigationCommand } from "@/lib/ui/types";

interface EnhancedCardProps 
  extends React.ComponentProps<"div">,
    Omit<AIControlProps, 'onAIHighlight'> {
  animated?: boolean;
  highlightable?: boolean;
  aiId?: string; // Unique identifier for AI targeting
  onAIHighlight?: (target: string, options: HighlightOptions) => void;
}

const EnhancedCard = React.forwardRef<HTMLDivElement, EnhancedCardProps>(
  ({ 
    className, 
    animated = true,
    highlightable = false,
    aiControlEnabled = false,
    aiId,
    onAINavigate,
    onAIHighlight,
    onClick,
    children,
    ...props 
  }, ref) => {
    const [isHighlighted, setIsHighlighted] = React.useState(false);

    // Handle AI navigation commands
    const handleAICommand = React.useCallback((command: NavigationCommand) => {
      if (onAINavigate) {
        onAINavigate(command);
      }
    }, [onAINavigate]);

    // Handle AI highlighting
    const handleHighlight = React.useCallback((target: string, options: HighlightOptions) => {
      setIsHighlighted(true);
      if (onAIHighlight) {
        onAIHighlight(target, options);
      }

      // Auto-remove highlight if timed
      if (options.duration === 'timed' && options.timing) {
        setTimeout(() => {
          setIsHighlighted(false);
        }, options.timing);
      }
    }, [onAIHighlight]);

    // Enhanced click handler
    const handleClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
      // Call original onClick
      if (onClick) {
        onClick(event);
      }

      // Notify AI system of user interaction
      if (aiControlEnabled && onAINavigate) {
        const command: NavigationCommand = {
          action: 'navigate',
          target: aiId || event.currentTarget.id || 'card',
          metadata: {
            source: 'user',
            timestamp: Date.now(),
            sessionId: 'current',
          },
        };
        handleAICommand(command);
      }
    }, [onClick, aiControlEnabled, aiId, onAINavigate, handleAICommand]);

    // Animation variants
    const animationVariants = {
      initial: { 
        scale: 1,
        boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"
      },
      hover: { 
        scale: animated ? 1.02 : 1,
        boxShadow: animated ? "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)" : undefined,
        transition: { duration: 0.2 }
      },
      tap: { 
        scale: animated ? 0.98 : 1,
        transition: { duration: 0.1 }
      },
      highlighted: {
        scale: 1.03,
        boxShadow: "0 0 0 2px var(--primary), 0 4px 6px -1px rgb(0 0 0 / 0.1)",
        transition: { duration: 0.3 }
      },
    };

    // Add AI-specific attributes
    const aiAttributes = aiControlEnabled ? {
      'data-ai-controllable': 'true',
      'data-ai-id': aiId,
      'data-ai-type': 'card',
      'data-ai-highlightable': highlightable,
    } : {};

    // Expose highlight function to parent components
    React.useImperativeHandle(ref, () => {
      const element = ref as React.MutableRefObject<HTMLDivElement>;
      return element.current || document.createElement('div');
    });

    if (animated) {
      return (
        <motion.div
          ref={ref}
          data-slot="card"
          className={cn(
            "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
            isHighlighted && "ring-2 ring-primary ring-opacity-50",
            className
          )}
          variants={animationVariants}
          initial="initial"
          whileHover="hover"
          whileTap={onClick ? "tap" : undefined}
          animate={isHighlighted ? "highlighted" : "initial"}
          onClick={handleClick}
          {...aiAttributes}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div
        ref={ref}
        data-slot="card"
        className={cn(
          "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
          isHighlighted && "ring-2 ring-primary ring-opacity-50",
          className
        )}
        onClick={handleClick}
        {...aiAttributes}
        {...props}
      >
        {children}
      </div>
    );
  }
);

EnhancedCard.displayName = "EnhancedCard";

// Enhanced Card sub-components with AI support
const EnhancedCardHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & { aiId?: string }>(
  ({ className, aiId, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-header"
      data-ai-id={aiId}
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
);
EnhancedCardHeader.displayName = "EnhancedCardHeader";

const EnhancedCardTitle = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & { aiId?: string }>(
  ({ className, aiId, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-title"
      data-ai-id={aiId}
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
);
EnhancedCardTitle.displayName = "EnhancedCardTitle";

const EnhancedCardDescription = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & { aiId?: string }>(
  ({ className, aiId, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-description"
      data-ai-id={aiId}
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
);
EnhancedCardDescription.displayName = "EnhancedCardDescription";

const EnhancedCardAction = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & { aiId?: string }>(
  ({ className, aiId, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-action"
      data-ai-id={aiId}
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
);
EnhancedCardAction.displayName = "EnhancedCardAction";

const EnhancedCardContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & { aiId?: string }>(
  ({ className, aiId, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-content"
      data-ai-id={aiId}
      className={cn("px-6", className)}
      {...props}
    />
  )
);
EnhancedCardContent.displayName = "EnhancedCardContent";

const EnhancedCardFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & { aiId?: string }>(
  ({ className, aiId, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-footer"
      data-ai-id={aiId}
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
);
EnhancedCardFooter.displayName = "EnhancedCardFooter";

export {
  EnhancedCard,
  EnhancedCardHeader,
  EnhancedCardFooter,
  EnhancedCardTitle,
  EnhancedCardAction,
  EnhancedCardDescription,
  EnhancedCardContent,
};

export type { EnhancedCardProps };