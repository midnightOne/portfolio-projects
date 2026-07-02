> **Status:** current (supporting reference — ui-system — component reference). Predates the 2026-07-02 spec rewrite; where this conflicts with code or the owning spec's requirements/design, those win.
> **Last verified against code:** carried over 2026-07-02 (e2d75b4) without line-by-line reverification.

# UI System - Detailed Component Specifications

## Overview

This document provides detailed specifications for all UI components in the enhanced system, including their props, behavior, styling, and integration patterns with the AI navigation system.

## Enhanced Base Components

### 1. Enhanced Button Component

#### Interface Definition
```typescript
interface EnhancedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  // Base shadcn/ui props
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
  
  // AI Control Enhancement
  aiControllable?: boolean;
  aiId?: string; // Unique identifier for AI targeting
  onAIInteraction?: (command: NavigationCommand) => void;
  aiMetadata?: Record<string, any>;
  
  // Animation Enhancement
  animationType?: 'scale' | 'slide' | 'fade' | 'bounce' | 'none';
  animationDuration?: number; // milliseconds, default: 200
  disableHoverAnimation?: boolean;
  
  // Highlighting Enhancement
  highlightable?: boolean;
  highlightType?: 'spotlight' | 'outline' | 'color' | 'glow';
  isHighlighted?: boolean;
  highlightOptions?: HighlightOptions;
  
  // Theme Coordination
  themeAware?: boolean;
  themeVariant?: 'primary' | 'accent' | 'muted';
  
  // Loading State
  loading?: boolean;
  loadingText?: string;
  
  // Icon Support
  icon?: React.ComponentType<{ className?: string }>;
  iconPosition?: 'left' | 'right';
}

interface HighlightOptions {
  type: 'spotlight' | 'outline' | 'color' | 'glow';
  duration: 'persistent' | 'timed';
  timing?: number; // For timed highlights (ms)
  intensity: 'subtle' | 'medium' | 'strong';
  color?: string; // Custom highlight color
}

interface NavigationCommand {
  action: 'click' | 'hover' | 'focus' | 'highlight';
  target: string;
  metadata?: Record<string, any>;
}
```

#### Implementation Specification
```typescript
// src/components/ui/enhanced-button.tsx
import { forwardRef } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAnimation } from '@/hooks/use-animation';
import { useHighlight } from '@/hooks/use-highlight';
import { useAIControl } from '@/hooks/use-ai-control';

export const EnhancedButton = forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  ({
    className,
    variant = 'default',
    size = 'default',
    aiControllable = false,
    aiId,
    onAIInteraction,
    animationType = 'scale',
    animationDuration = 200,
    highlightable = false,
    highlightType = 'spotlight',
    isHighlighted = false,
    loading = false,
    loadingText,
    icon: Icon,
    iconPosition = 'left',
    children,
    onClick,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    ...props
  }, ref) => {
    // Animation hook
    const { animate, isAnimating } = useAnimation();
    
    // Highlighting hook
    const { highlight, removeHighlight, highlightClasses } = useHighlight({
      type: highlightType,
      enabled: highlightable,
      isActive: isHighlighted
    });
    
    // AI control hook
    const { registerAIElement, handleAICommand } = useAIControl({
      enabled: aiControllable,
      id: aiId,
      onCommand: onAIInteraction
    });

    // Event handlers
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (loading || isAnimating) return;
      
      // Trigger click animation
      if (animationType !== 'none') {
        animate(e.currentTarget, {
          type: 'click',
          duration: animationDuration
        });
      }
      
      // AI command handling
      if (aiControllable && onAIInteraction) {
        onAIInteraction({
          action: 'click',
          target: aiId || 'button',
          metadata: { variant, size }
        });
      }
      
      onClick?.(e);
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (animationType === 'scale' && !loading) {
        animate(e.currentTarget, {
          type: 'hover-enter',
          duration: animationDuration
        });
      }
      onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (animationType === 'scale' && !loading) {
        animate(e.currentTarget, {
          type: 'hover-leave',
          duration: animationDuration
        });
      }
      onMouseLeave?.(e);
    };

    // Register with AI system
    useEffect(() => {
      if (aiControllable && ref?.current) {
        registerAIElement(ref.current, {
          id: aiId,
          type: 'button',
          actions: ['click', 'highlight', 'focus']
        });
      }
    }, [aiControllable, aiId, registerAIElement]);

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(
          // Base classes
          'transition-all duration-200 ease-out',
          
          // Animation classes
          animationType === 'scale' && 'hover:scale-105 active:scale-95',
          animationType === 'bounce' && 'hover:animate-bounce-subtle',
          
          // Highlighting classes
          highlightClasses,
          
          // Loading state
          loading && 'opacity-70 cursor-not-allowed',
          
          // AI controllable indicator (dev mode)
          aiControllable && process.env.NODE_ENV === 'development' && 'ring-1 ring-blue-300',
          
          className
        )}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
            {loadingText || 'Loading...'}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {Icon && iconPosition === 'left' && <Icon className="h-4 w-4" />}
            {children}
            {Icon && iconPosition === 'right' && <Icon className="h-4 w-4" />}
          </div>
        )}
      </Button>
    );
  }
);

EnhancedButton.displayName = 'EnhancedButton';
```

### 2. Enhanced Modal Component

#### Interface Definition
```typescript
interface EnhancedModalProps {
  // Base modal props
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  
  // Animation Enhancement
  entranceAnimation?: 'fade' | 'slide' | 'scale' | 'coordinated';
  exitAnimation?: 'fade' | 'slide' | 'scale' | 'coordinated';
  animationDuration?: number; // default: 700ms for coordinated
  
  // AI Control Enhancement
  aiControllable?: boolean;
  aiId?: string;
  onAIOpen?: (data?: any) => void;
  onAIClose?: () => void;
  
  // Backdrop Enhancement
  backdropBlur?: boolean;
  backdropDim?: number; // 0-1 opacity, default: 0.5
  backdropClickToClose?: boolean;
  
  // Coordinated Animation
  coordinateWithElement?: string; // CSS selector for element to coordinate with
  coordinationDelay?: number; // delay before modal animation starts
  
  // Size and positioning
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  position?: 'center' | 'top' | 'bottom';
  
  // Styling
  className?: string;
  overlayClassName?: string;
  contentClassName?: string;
  
  // Behavior
  closeOnEscape?: boolean;
  preventScroll?: boolean;
  focusTrap?: boolean;
}
```

#### Implementation Specification
```typescript
// src/components/ui/enhanced-modal.tsx
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnimation } from '@/hooks/use-animation';
import { useAIControl } from '@/hooks/use-ai-control';
import { useFocusTrap } from '@/hooks/use-focus-trap';

export function EnhancedModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  entranceAnimation = 'coordinated',
  exitAnimation = 'coordinated',
  animationDuration = 700,
  aiControllable = false,
  aiId,
  onAIOpen,
  onAIClose,
  backdropBlur = true,
  backdropDim = 0.5,
  backdropClickToClose = true,
  coordinateWithElement,
  coordinationDelay = 0,
  size = 'lg',
  position = 'center',
  className,
  overlayClassName,
  contentClassName,
  closeOnEscape = true,
  preventScroll = true,
  focusTrap = true
}: EnhancedModalProps) {
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { animate } = useAnimation();
  const { registerAIElement } = useAIControl({
    enabled: aiControllable,
    id: aiId
  });

  // Focus trap
  useFocusTrap(modalRef, isOpen && focusTrap);

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll prevention
  useEffect(() => {
    if (!preventScroll) return;
    
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, preventScroll]);

  // Escape key handler
  useEffect(() => {
    if (!closeOnEscape) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  // AI registration
  useEffect(() => {
    if (aiControllable && modalRef.current) {
      registerAIElement(modalRef.current, {
        id: aiId,
        type: 'modal',
        actions: ['open', 'close', 'highlight']
      });
    }
  }, [aiControllable, aiId, registerAIElement]);

  // Coordinated animation with element
  const handleCoordinatedAnimation = async () => {
    if (!coordinateWithElement) return;
    
    const targetElement = document.querySelector(coordinateWithElement);
    if (targetElement) {
      // Animate target element first
      await animate(targetElement, {
        type: 'modal-coordinate',
        duration: animationDuration * 0.6 // 60% of modal animation
      });
      
      // Small delay before modal animation
      if (coordinationDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, coordinationDelay));
      }
    }
  };

  // Animation variants
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: backdropDim,
      transition: { duration: animationDuration / 1000 }
    },
    exit: { 
      opacity: 0,
      transition: { duration: animationDuration / 1000 }
    }
  };

  const modalVariants = {
    fade: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      exit: { opacity: 0 }
    },
    scale: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.8 }
    },
    slide: {
      hidden: { opacity: 0, y: 50 },
      visible: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 50 }
    },
    coordinated: {
      hidden: { opacity: 0, scale: 0.8, y: 20 },
      visible: { 
        opacity: 1, 
        scale: 1, 
        y: 0,
        transition: {
          duration: animationDuration / 1000,
          ease: [0.25, 0.46, 0.45, 0.94] // smooth easing
        }
      },
      exit: { 
        opacity: 0, 
        scale: 0.8, 
        y: 20,
        transition: {
          duration: animationDuration / 1000 * 0.8 // Faster exit
        }
      }
    }
  };

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-7xl'
  };

  const positionClasses = {
    center: 'items-center justify-center',
    top: 'items-start justify-center pt-16',
    bottom: 'items-end justify-center pb-16'
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence mode="wait" onExitComplete={() => onAIClose?.()}>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'fixed inset-0 bg-black',
              backdropBlur && 'backdrop-blur-sm',
              overlayClassName
            )}
            onClick={backdropClickToClose ? onClose : undefined}
          />
          
          {/* Modal Container */}
          <div className={cn(
            'fixed inset-0 flex',
            positionClasses[position]
          )}>
            <motion.div
              ref={modalRef}
              variants={modalVariants[entranceAnimation]}
              initial="hidden"
              animate="visible"
              exit="exit"
              onAnimationStart={handleCoordinatedAnimation}
              className={cn(
                'relative bg-background border rounded-lg shadow-lg',
                'max-h-[90vh] overflow-hidden',
                sizeClasses[size],
                'mx-4 my-4',
                contentClassName
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {(title || description) && (
                <div className="px-6 py-4 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      {title && (
                        <h2 className="text-lg font-semibold">{title}</h2>
                      )}
                      {description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-accent rounded-md transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              
              {/* Content */}
              <div className={cn('p-6', className)}>
                {children}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
```

### 3. Enhanced Card Component

#### Interface Definition
```typescript
interface EnhancedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  // Base styling
  variant?: 'default' | 'outlined' | 'elevated' | 'flat';
  size?: 'sm' | 'md' | 'lg';
  
  // Highlighting Enhancement
  highlightable?: boolean;
  highlightOptions?: HighlightOptions;
  isHighlighted?: boolean;
  onHighlight?: (highlighted: boolean) => void;
  
  // Hover Enhancement
  hoverEffect?: 'lift' | 'glow' | 'scale' | 'border' | 'none';
  hoverDuration?: number;
  disableHover?: boolean;
  
  // AI Control Enhancement
  aiControllable?: boolean;
  aiId?: string;
  aiMetadata?: Record<string, any>;
  onAIInteraction?: (command: NavigationCommand) => void;
  
  // Theme Enhancement
  themeVariant?: 'default' | 'accent' | 'muted' | 'primary';
  
  // Interactive Enhancement
  clickable?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  
  // Content slots
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}
```

## AI-Specific Components

### 4. Floating AI Interface Component

#### Interface Definition
```typescript
interface FloatingAIInterfaceProps {
  // Position Management
  position: 'hero' | 'pinned';
  onPositionChange?: (position: 'hero' | 'pinned') => void;
  autoPin?: boolean; // Auto-pin after first interaction
  
  // Mode Management
  mode: 'pill' | 'expanded';
  onModeChange?: (mode: 'pill' | 'expanded') => void;
  expandOnFocus?: boolean;
  
  // Content
  currentNarration?: string;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  
  // Interaction Handlers
  onTextSubmit?: (text: string) => void;
  onVoiceStart?: () => void;
  onVoiceEnd?: (transcript: string) => void;
  onSettingsClick?: () => void;
  onClear?: () => void;
  
  // State
  isListening?: boolean;
  isProcessing?: boolean;
  isTyping?: boolean; // AI is typing response
  
  // Voice Features
  voiceEnabled?: boolean;
  voiceLanguage?: string;
  voiceAutoStart?: boolean;
  
  // Quick Actions
  showQuickActions?: boolean;
  quickActions?: QuickAction[];
  onQuickAction?: (action: QuickAction) => void;
  
  // Styling
  theme?: 'default' | 'minimal' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  
  // Behavior
  hideOnScroll?: boolean;
  persistPosition?: boolean;
  animationDuration?: number;
  
  // Accessibility
  ariaLabel?: string;
  announceNarration?: boolean;
}

interface QuickAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  command?: string;
}
```

#### Implementation Specification
```typescript
// src/components/ai/floating-ai-interface.tsx
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Settings, Send, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceRecognition } from '@/hooks/use-voice-recognition';
import { useAnimation } from '@/hooks/use-animation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function FloatingAIInterface({
  position,
  onPositionChange,
  autoPin = true,
  mode,
  onModeChange,
  expandOnFocus = true,
  currentNarration,
  placeholder = "Ask me about my work...",
  value = "",
  onValueChange,
  onTextSubmit,
  onVoiceStart,
  onVoiceEnd,
  onSettingsClick,
  onClear,
  isListening = false,
  isProcessing = false,
  isTyping = false,
  voiceEnabled = true,
  showQuickActions = true,
  quickActions = [],
  onQuickAction,
  theme = 'default',
  size = 'md',
  className,
  hideOnScroll = false,
  animationDuration = 700,
  ariaLabel = "AI Assistant Interface",
  announceNarration = true
}: FloatingAIInterfaceProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isVisible, setIsVisible] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { animate } = useAnimation();
  const {
    startListening,
    stopListening,
    isSupported: voiceSupported
  } = useVoiceRecognition({
    onResult: (transcript) => {
      setInputValue(transcript);
      onVoiceEnd?.(transcript);
    },
    onStart: onVoiceStart,
    continuous: false
  });

  // Handle scroll hiding
  useEffect(() => {
    if (!hideOnScroll) return;
    
    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      setIsVisible(false);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setIsVisible(true), 1000);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [hideOnScroll]);

  // Auto-pin after first interaction
  useEffect(() => {
    if (autoPin && hasInteracted && position === 'hero') {
      onPositionChange?.('pinned');
    }
  }, [autoPin, hasInteracted, position, onPositionChange]);

  // Sync input value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isProcessing) {
      onTextSubmit?.(inputValue.trim());
      setInputValue('');
      setHasInteracted(true);
      
      if (expandOnFocus && mode === 'expanded') {
        onModeChange?.('pill');
      }
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    if (expandOnFocus && mode === 'pill') {
      onModeChange?.('expanded');
    }
    setHasInteracted(true);
  };

  // Handle voice toggle
  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
    setHasInteracted(true);
  };

  // Handle quick action
  const handleQuickAction = (action: QuickAction) => {
    onQuickAction?.(action);
    if (action.command) {
      setInputValue(action.command);
    }
    setHasInteracted(true);
  };

  // Position animation variants
  const positionVariants = {
    hero: {
      bottom: '30vh',
      scale: 1,
      transition: {
        duration: animationDuration / 1000,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    },
    pinned: {
      bottom: '24px',
      scale: 1,
      transition: {
        duration: animationDuration / 1000,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  // Mode animation variants
  const modeVariants = {
    pill: {
      height: 'auto',
      transition: {
        duration: 0.3,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    },
    expanded: {
      height: 'auto',
      transition: {
        duration: 0.3,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  // Visibility variants
  const visibilityVariants = {
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 }
    },
    hidden: {
      opacity: 0,
      y: 20,
      transition: { duration: 0.3 }
    }
  };

  // Theme classes
  const themeClasses = {
    default: 'bg-background border-border shadow-lg',
    minimal: 'bg-background/95 backdrop-blur-md border-border/50 shadow-md',
    accent: 'bg-accent border-accent-foreground shadow-xl'
  };

  // Size classes
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg'
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={containerRef}
          variants={positionVariants}
          animate={position}
          className={cn(
            'fixed left-1/2 transform -translate-x-1/2 z-50',
            'w-full px-4',
            sizeClasses[size]
          )}
          role="complementary"
          aria-label={ariaLabel}
        >
          {/* Narration Display */}
          <AnimatePresence>
            {currentNarration && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mb-3 text-center"
              >
                <div className="inline-block px-4 py-2 bg-muted rounded-full text-sm text-muted-foreground">
                  <Sparkles className="inline h-3 w-3 mr-2" />
                  {currentNarration}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Interface */}
          <motion.div
            variants={modeVariants}
            animate={mode}
            className={cn(
              'rounded-full border overflow-hidden',
              themeClasses[theme],
              mode === 'expanded' && 'rounded-lg',
              className
            )}
          >
            {/* Pill Mode */}
            {mode === 'pill' && (
              <form onSubmit={handleSubmit} className="flex items-center p-2">
                {/* Voice Button */}
                {voiceEnabled && voiceSupported && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleVoiceToggle}
                    className={cn(
                      'rounded-full p-2 h-8 w-8',
                      isListening && 'bg-red-500 text-white animate-pulse'
                    )}
                  >
                    {isListening ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                )}

                {/* Input */}
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    onValueChange?.(e.target.value);
                  }}
                  onFocus={handleInputFocus}
                  placeholder={placeholder}
                  className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                  disabled={isProcessing}
                />

                {/* Settings Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onSettingsClick}
                  className="rounded-full p-2 h-8 w-8"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </form>
            )}

            {/* Expanded Mode */}
            {mode === 'expanded' && (
              <div className="p-4 space-y-4">
                {/* Input Area */}
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => {
                        setInputValue(e.target.value);
                        onValueChange?.(e.target.value);
                      }}
                      placeholder={placeholder}
                      className="flex-1"
                      disabled={isProcessing}
                      multiline
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Voice Button */}
                      {voiceEnabled && voiceSupported && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleVoiceToggle}
                          className={cn(
                            isListening && 'bg-red-500 text-white animate-pulse'
                          )}
                        >
                          {isListening ? (
                            <MicOff className="h-4 w-4" />
                          ) : (
                            <Mic className="h-4 w-4" />
                          )}
                          {isListening ? 'Stop' : 'Voice'}
                        </Button>
                      )}

                      {/* Clear Button */}
                      {inputValue && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setInputValue('');
                            onClear?.();
                          }}
                        >
                          <X className="h-4 w-4" />
                          Clear
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Settings */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onSettingsClick}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>

                      {/* Send */}
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!inputValue.trim() || isProcessing}
                      >
                        <Send className="h-4 w-4" />
                        Send
                      </Button>
                    </div>
                  </div>
                </form>

                {/* Quick Actions */}
                {showQuickActions && quickActions.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground font-medium">
                      Quick Actions:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {quickActions.map((action) => (
                        <Button
                          key={action.id}
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickAction(action)}
                          className="text-xs"
                        >
                          {action.icon && <action.icon className="h-3 w-3 mr-1" />}
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Processing Indicator */}
                {(isProcessing || isTyping) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                    {isTyping ? 'AI is typing...' : 'Processing...'}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### 5. Navigation Overlay Component

#### Interface Definition
```typescript
interface NavigationOverlayProps {
  // Active highlights
  activeHighlights: Record<string, HighlightOptions>;
  onHighlightRemove?: (targetId: string) => void;
  
  // User interaction handling
  onUserInteraction?: (action: UserAction) => void;
  blockInteractions?: boolean;
  
  // Animation state
  isAnimating?: boolean;
  animationProgress?: number;
  
  // Overlay behavior
  showOverlay?: boolean;
  overlayOpacity?: number;
  
  // Accessibility
  announceHighlights?: boolean;
  
  // Styling
  className?: string;
}

interface UserAction {
  type: 'click' | 'scroll' | 'key' | 'focus';
  target?: string;
  data?: any;
  timestamp: number;
}
```

## Hook Specifications

### 6. Animation Hook

```typescript
interface UseAnimationOptions {
  defaultDuration?: number;
  defaultEasing?: string;
  respectReducedMotion?: boolean;
}

interface AnimationResult {
  animate: (target: Element, options: AnimationOptions) => Promise<void>;
  isAnimating: boolean;
  queue: AnimationCommand[];
  clearQueue: () => void;
  pauseQueue: () => void;
  resumeQueue: () => void;
}

function useAnimation(options?: UseAnimationOptions): AnimationResult;
```

### 7. Highlight Hook

```typescript
interface UseHighlightOptions {
  type?: HighlightOptions['type'];
  enabled?: boolean;
  isActive?: boolean;
  onHighlight?: (active: boolean) => void;
}

interface HighlightResult {
  highlight: (options?: Partial<HighlightOptions>) => void;
  removeHighlight: () => void;
  isHighlighted: boolean;
  highlightClasses: string;
}

function useHighlight(options?: UseHighlightOptions): HighlightResult;
```

### 8. AI Control Hook

```typescript
interface UseAIControlOptions {
  enabled?: boolean;
  id?: string;
  onCommand?: (command: NavigationCommand) => void;
}

interface AIControlResult {
  registerAIElement: (element: Element, config: AIElementConfig) => void;
  unregisterAIElement: (element: Element) => void;
  handleAICommand: (command: NavigationCommand) => void;
  isAIControlled: boolean;
}

function useAIControl(options?: UseAIControlOptions): AIControlResult;
```

## Integration Patterns

### 9. Theme Integration

```typescript
// Theme-aware component pattern
function useThemeAwareStyles(variant?: string) {
  const { theme } = useTheme();
  
  return useMemo(() => {
    const baseStyles = getBaseStyles(variant);
    const themeStyles = getThemeStyles(theme, variant);
    return mergeStyles(baseStyles, themeStyles);
  }, [theme, variant]);
}
```

### 10. Animation Coordination

```typescript
// Animation coordination pattern
function useCoordinatedAnimation(targetSelector?: string) {
  const { animate } = useAnimation();
  
  const coordinateAnimation = useCallback(async (
    primaryAnimation: AnimationOptions,
    secondaryAnimation?: AnimationOptions
  ) => {
    const promises: Promise<void>[] = [];
    
    // Primary animation
    promises.push(animate(primaryElement, primaryAnimation));
    
    // Secondary animation (coordinated)
    if (targetSelector && secondaryAnimation) {
      const targetElement = document.querySelector(targetSelector);
      if (targetElement) {
        promises.push(animate(targetElement, secondaryAnimation));
      }
    }
    
    await Promise.all(promises);
  }, [animate, targetSelector]);
  
  return { coordinateAnimation };
}
```

This comprehensive component specification provides the detailed implementation guidelines for all enhanced UI components, ensuring consistent behavior, styling, and AI integration across the entire system.