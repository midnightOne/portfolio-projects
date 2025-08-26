/**
 * Floating AI Interface Component - UI System Task 6
 * 
 * Pill-shaped floating interface with dynamic positioning, GSAP animations,
 * and subtitle-style narration display. Supports both pill and expanded modes
 * with voice input, text input, and settings.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Settings, Send, X, Sparkles, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAnimation } from '@/lib/ui/animation';

// Types for the floating AI interface
export interface QuickAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  command?: string;
}

export interface FloatingAIInterfaceProps {
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

// Voice recognition hook (simplified implementation)
function useVoiceRecognition({
  onResult,
  onStart,
  continuous = false,
  language = 'en-US'
}: {
  onResult?: (transcript: string) => void;
  onStart?: () => void;
  continuous?: boolean;
  language?: string;
}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSupported(true);
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = continuous;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = language;

        recognitionRef.current.onstart = () => {
          setIsListening(true);
          onStart?.();
        };

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          onResult?.(transcript);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };
      }
    }
  }, [onResult, onStart, continuous, language]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  return {
    isSupported,
    isListening,
    startListening,
    stopListening
  };
}

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
    
    window.addEventListener('scroll', handleScroll, { passive: true });
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

  // Position animation variants for GSAP coordination
  const positionVariants = {
    hero: {
      bottom: '30vh',
      scale: 1,
      transition: {
        duration: animationDuration / 1000,
        ease: 'easeOut'
      }
    },
    pinned: {
      bottom: '24px',
      scale: 1,
      transition: {
        duration: animationDuration / 1000,
        ease: 'easeOut'
      }
    }
  };

  // Mode animation variants
  const modeVariants = {
    pill: {
      height: 'auto',
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    },
    expanded: {
      height: 'auto',
      transition: {
        duration: 0.3,
        ease: 'easeOut'
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
    default: 'bg-background/95 backdrop-blur-md border-border shadow-lg',
    minimal: 'bg-background/90 backdrop-blur-sm border-border/50 shadow-md',
    accent: 'bg-accent/95 backdrop-blur-md border-accent-foreground shadow-xl'
  };

  // Size classes
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg'
  };

  // Default quick actions if none provided
  const defaultQuickActions: QuickAction[] = [
    {
      id: 'show-projects',
      label: 'Show me your projects',
      icon: MessageCircle,
      command: 'Show me your best projects'
    },
    {
      id: 'about-skills',
      label: 'Tell me about your skills',
      icon: Sparkles,
      command: 'Tell me about your skills and experience'
    },
    {
      id: 'contact-info',
      label: 'How can I contact you?',
      icon: MessageCircle,
      command: 'How can I get in touch with you?'
    }
  ];

  const effectiveQuickActions = quickActions.length > 0 ? quickActions : defaultQuickActions;

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
                <div className="inline-block px-4 py-2 bg-muted/90 backdrop-blur-sm rounded-full text-sm text-muted-foreground border border-border/50">
                  <Sparkles className="inline h-3 w-3 mr-2 text-primary" />
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
              'rounded-full border overflow-hidden transition-all duration-300',
              themeClasses[theme],
              mode === 'expanded' && 'rounded-lg',
              className
            )}
          >
            {/* Pill Mode */}
            {mode === 'pill' && (
              <form onSubmit={handleSubmit} className="flex items-center p-2 gap-2">
                {/* Voice Button */}
                {voiceEnabled && voiceSupported && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleVoiceToggle}
                    className={cn(
                      'rounded-full p-2 h-8 w-8 flex-shrink-0',
                      isListening && 'bg-red-500 text-white animate-pulse'
                    )}
                    disabled={isProcessing}
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
                  className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                  disabled={isProcessing}
                />

                {/* Processing indicator */}
                {isProcessing && (
                  <div className="flex-shrink-0">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  </div>
                )}

                {/* Settings Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onSettingsClick}
                  className="rounded-full p-2 h-8 w-8 flex-shrink-0"
                  disabled={isProcessing}
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
                            'transition-colors',
                            isListening && 'bg-red-500 text-white animate-pulse'
                          )}
                          disabled={isProcessing}
                        >
                          {isListening ? (
                            <MicOff className="h-4 w-4 mr-1" />
                          ) : (
                            <Mic className="h-4 w-4 mr-1" />
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
                          disabled={isProcessing}
                        >
                          <X className="h-4 w-4 mr-1" />
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
                        disabled={isProcessing}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>

                      {/* Send */}
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!inputValue.trim() || isProcessing}
                      >
                        {isProcessing ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        {isProcessing ? 'Processing...' : 'Send'}
                      </Button>
                    </div>
                  </div>
                </form>

                {/* Quick Actions */}
                {showQuickActions && effectiveQuickActions.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground font-medium">
                      Quick Actions:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {effectiveQuickActions.map((action) => (
                        <Button
                          key={action.id}
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickAction(action)}
                          className="text-xs h-8"
                          disabled={isProcessing}
                        >
                          {action.icon && <action.icon className="h-3 w-3 mr-1" />}
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Typing Indicator */}
                {isTyping && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    AI is thinking...
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

// Export default for easier imports
export default FloatingAIInterface;