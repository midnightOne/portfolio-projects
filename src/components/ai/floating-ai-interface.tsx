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
import { Mic, MicOff, X, Sparkles, MessageCircle, Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gsap } from 'gsap';

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
  const [mounted, setMounted] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Handle mounting to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
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
  }, [mounted, onResult, onStart, continuous, language]);

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
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationState, setAnimationState] = useState<'pill' | 'expanded' | 'transitioning'>('pill');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  
  // Animation timeline refs for proper cleanup
  const edgeEffectsTimelineRef = useRef<GSAPTimeline | null>(null);
  const pulseTimelineRef = useRef<GSAPTimeline | null>(null);
  const modeTransitionTimelineRef = useRef<GSAPTimeline | null>(null);
  const positionTimelineRef = useRef<GSAPTimeline | null>(null);
  

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

  // Initial GSAP position setup
  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const initialBottom = position === 'hero' ? '30vh' : '24px';
    
    // Set initial position immediately without animation
    gsap.set(container, {
      bottom: initialBottom
    });
  }, []); // Only run once on mount

  // GSAP position animation - handles hero <-> pinned transitions
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const targetBottom = position === 'hero' ? '30vh' : '24px';
    
    // Kill any existing position timeline
    if (positionTimelineRef.current) {
      positionTimelineRef.current.kill();
      positionTimelineRef.current = null;
    }

    // Create smooth GSAP animation for position changes
    const tl = gsap.timeline();
    positionTimelineRef.current = tl;
    
    tl.to(container, {
      bottom: targetBottom,
      duration: animationDuration / 1000, // Convert to seconds (0.7s)
      ease: 'power2.out'
    });

    return () => {
      if (positionTimelineRef.current) {
        positionTimelineRef.current.kill();
        positionTimelineRef.current = null;
      }
    };
  }, [position, animationDuration]);



  // Cleanup all animations on unmount
  useEffect(() => {
    return () => {
      // Kill all GSAP timelines
      if (edgeEffectsTimelineRef.current) {
        edgeEffectsTimelineRef.current.kill();
      }
      if (pulseTimelineRef.current) {
        pulseTimelineRef.current.kill();
      }
      if (modeTransitionTimelineRef.current) {
        modeTransitionTimelineRef.current.kill();
      }
      if (positionTimelineRef.current) {
        positionTimelineRef.current.kill();
      }
    };
  }, []);

  // Stable edge effects animation with proper cleanup
  useEffect(() => {
    if (!aiPanelRef.current || hasInteracted) {
      // Clean up existing timeline
      if (edgeEffectsTimelineRef.current) {
        edgeEffectsTimelineRef.current.kill();
        edgeEffectsTimelineRef.current = null;
      }
      return;
    }

    const panel = aiPanelRef.current;
    
    // Kill any existing timeline first
    if (edgeEffectsTimelineRef.current) {
      edgeEffectsTimelineRef.current.kill();
    }
    
    // Create new timeline with stable base shadow
    const tl = gsap.timeline({ repeat: -1 });
    edgeEffectsTimelineRef.current = tl;
    
    // Set initial stable state
    gsap.set(panel, {
      boxShadow: `
        0 0 20px rgba(59, 130, 246, 0.4),
        0 0 40px rgba(59, 130, 246, 0.2),
        0 4px 20px rgba(0, 0, 0, 0.1)
      `,
      borderColor: "rgba(59, 130, 246, 0.3)"
    });
    
    // Animate through color cycles while maintaining base shadow
    tl.to(panel, {
      duration: 4,
      ease: "sine.inOut",
      boxShadow: `
        0 0 15px rgba(147, 51, 234, 0.3),
        0 0 30px rgba(147, 51, 234, 0.15),
        0 4px 20px rgba(0, 0, 0, 0.1)
      `,
      borderColor: "rgba(147, 51, 234, 0.2)"
    })
    .to(panel, {
      duration: 4,
      ease: "sine.inOut",
      boxShadow: `
        0 0 25px rgba(16, 185, 129, 0.35),
        0 0 50px rgba(16, 185, 129, 0.18),
        0 4px 20px rgba(0, 0, 0, 0.1)
      `,
      borderColor: "rgba(16, 185, 129, 0.25)"
    })
    .to(panel, {
      duration: 4,
      ease: "sine.inOut",
      boxShadow: `
        0 0 20px rgba(59, 130, 246, 0.4),
        0 0 40px rgba(59, 130, 246, 0.2),
        0 4px 20px rgba(0, 0, 0, 0.1)
      `,
      borderColor: "rgba(59, 130, 246, 0.3)"
    });
    
    return () => {
      if (edgeEffectsTimelineRef.current) {
        edgeEffectsTimelineRef.current.kill();
        edgeEffectsTimelineRef.current = null;
      }
    };
  }, [hasInteracted]);

  // Stable pulse animation with proper cleanup
  useEffect(() => {
    if (!aiPanelRef.current || hasInteracted) {
      // Clean up existing timeline
      if (pulseTimelineRef.current) {
        pulseTimelineRef.current.kill();
        pulseTimelineRef.current = null;
      }
      return;
    }

    const panel = aiPanelRef.current;
    
    // Kill any existing timeline first
    if (pulseTimelineRef.current) {
      pulseTimelineRef.current.kill();
    }
    
    // Create new timeline
    const pulseTl = gsap.timeline({ repeat: -1, delay: 3 });
    pulseTimelineRef.current = pulseTl;
    
    pulseTl.to(panel, {
      duration: 0.4,
      scale: 1.02,
      ease: "power2.out"
    })
    .to(panel, {
      duration: 0.4,
      scale: 1,
      ease: "power2.out"
    })
    .to({}, { duration: 5 }); // Wait 5 seconds before next pulse
    
    return () => {
      if (pulseTimelineRef.current) {
        pulseTimelineRef.current.kill();
        pulseTimelineRef.current = null;
      }
    };
  }, [hasInteracted]);

  // Stable mode transition animations with state management
  const expandContainer = useCallback(() => {
    if (!aiPanelRef.current || !responseRef.current || animationState === 'transitioning') {
      return;
    }

    setAnimationState('transitioning');
    
    // Kill any existing mode transition timeline
    if (modeTransitionTimelineRef.current) {
      modeTransitionTimelineRef.current.kill();
    }
    
    // Create coordinated timeline for expansion
    const tl = gsap.timeline({
      onComplete: () => {
        setAnimationState('expanded');
        modeTransitionTimelineRef.current = null;
      }
    });
    modeTransitionTimelineRef.current = tl;
    
    // Preserve existing shadow while transitioning
    const currentShadow = getComputedStyle(aiPanelRef.current).boxShadow;
    
    tl.to(aiPanelRef.current, {
      duration: 0.4,
      borderRadius: '16px',
      ease: 'power2.out',
      // Maintain shadow during transition
      boxShadow: currentShadow
    })
    .fromTo(responseRef.current, 
      { height: 0, opacity: 0 },
      { 
        height: 'auto', 
        opacity: 1, 
        duration: 0.3, 
        ease: 'power2.out' 
      }, 
      0.1 // Start slightly after border radius change
    );
  }, [animationState]);

  const contractContainer = useCallback(() => {
    if (!aiPanelRef.current || !responseRef.current || animationState === 'transitioning') {
      return;
    }

    setAnimationState('transitioning');
    
    // Kill any existing mode transition timeline
    if (modeTransitionTimelineRef.current) {
      modeTransitionTimelineRef.current.kill();
    }
    
    // Create coordinated timeline for contraction
    const tl = gsap.timeline({
      onComplete: () => {
        setAnimationState('pill');
        modeTransitionTimelineRef.current = null;
      }
    });
    modeTransitionTimelineRef.current = tl;
    
    // Preserve existing shadow while transitioning
    const currentShadow = getComputedStyle(aiPanelRef.current).boxShadow;
    
    tl.to(responseRef.current, {
      height: 0,
      opacity: 0,
      duration: 0.25,
      ease: 'power2.in'
    })
    .to(aiPanelRef.current, {
      duration: 0.4,
      borderRadius: '50px',
      ease: 'power2.out',
      // Maintain shadow during transition
      boxShadow: currentShadow
    }, 0.1); // Start after response starts hiding
  }, [animationState]);

  // Handle mode changes with stable state management
  useEffect(() => {
    // Only trigger animation if we're not already transitioning and mode actually changed
    if (animationState === 'transitioning') return;
    
    if (mode === 'expanded' && animationState !== 'expanded') {
      expandContainer();
    } else if (mode === 'pill' && animationState !== 'pill') {
      contractContainer();
    }
  }, [mode, animationState, expandContainer, contractContainer]);

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
    // Clean up intro animations when user interacts
    if (!hasInteracted) {
      if (edgeEffectsTimelineRef.current) {
        edgeEffectsTimelineRef.current.kill();
        edgeEffectsTimelineRef.current = null;
      }
      if (pulseTimelineRef.current) {
        pulseTimelineRef.current.kill();
        pulseTimelineRef.current = null;
      }
      
      // Set stable shadow for interacted state
      if (aiPanelRef.current) {
        gsap.set(aiPanelRef.current, {
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          scale: 1
        });
      }
    }
    
    if (expandOnFocus && mode === 'pill') {
      onModeChange?.('expanded');
    }
    setHasInteracted(true);
  };

  // Handle voice toggle
  const handleVoiceToggle = () => {
    // Clean up intro animations when user interacts
    if (!hasInteracted) {
      if (edgeEffectsTimelineRef.current) {
        edgeEffectsTimelineRef.current.kill();
        edgeEffectsTimelineRef.current = null;
      }
      if (pulseTimelineRef.current) {
        pulseTimelineRef.current.kill();
        pulseTimelineRef.current = null;
      }
      
      // Set stable shadow for interacted state
      if (aiPanelRef.current) {
        gsap.set(aiPanelRef.current, {
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          scale: 1
        });
      }
    }
    
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

  // Handle audio controls
  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
    if (isPlaying && !audioEnabled) {
      setIsPlaying(false);
    }
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  const closeResponse = () => {
    contractContainer();
    setIsPlaying(false);
    onModeChange?.('pill');
  };



  // Theme classes
  const themeClasses = {
    default: 'bg-background/95 backdrop-blur-md border-border shadow-lg',
    minimal: 'bg-background/90 backdrop-blur-sm border-border/50 shadow-md',
    accent: 'bg-accent/95 backdrop-blur-md border-accent-foreground shadow-xl'
  };

  // Size classes - Made wider for better usability
  const sizeClasses = {
    sm: 'max-w-lg',      // 512px (was 384px)
    md: 'max-w-2xl',     // 672px (was 448px) 
    lg: 'max-w-4xl'      // 896px (was 512px)
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
        <div
          ref={containerRef}
          className={cn(
            'fixed left-1/2 z-50',
            'w-full px-4',
            sizeClasses[size]
          )}
          style={{
            transform: 'translateX(-50%)',
            left: '50%'
            // bottom position will be set by GSAP
          }}
          role="complementary"
          aria-label={ariaLabel}
        >
          {/* Narration Display */}
          <AnimatePresence>
            {currentNarration && (
              <motion.div
                key="narration-display"
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

          {/* Main Voice Interface Container - Pill Shape with GSAP animations */}
          <div 
            ref={aiPanelRef}
            className={cn(
              'relative overflow-hidden bg-background/95 backdrop-blur-md border-2 border-border/50',
              themeClasses[theme],
              className
            )}
            style={{
              borderRadius: '50px', // Start as pill, GSAP will animate this
              outline: 'none !important',
              borderImage: 'none !important',
              // Ensure stable base shadow that GSAP can enhance
              boxShadow: hasInteracted 
                ? '0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                : '0 0 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2), 0 4px 20px rgba(0, 0, 0, 0.1)'
            }}
          >
            {/* Integrated Response Section - GSAP Animated (appears first, above input) */}
            <div ref={responseRef} style={{ height: 0, opacity: 0, overflow: 'hidden' }}>
              {currentNarration && (
                <div className="border-b border-border/50">
                  {/* Response Content - Subtitle Style */}
                  <div className="px-6 py-4 text-center">
                    <p className="text-lg text-foreground leading-relaxed font-medium">{currentNarration}</p>
                  </div>
                  
                  {/* Controls bar */}
                  <div className="bg-card/50 border-b border-border/50 px-6 py-3 flex items-center justify-between">
                    {/* Quick Action buttons */}
                    <div className="flex gap-2">
                      {effectiveQuickActions.slice(0, 3).map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action)}
                          className="bg-card border border-border px-3 py-1 rounded-lg text-xs font-medium hover:scale-105 transition-all duration-200 text-foreground hover:bg-accent/20"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>

                    {/* Audio and close controls */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={toggleAudio}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        title={audioEnabled ? 'Audio On' : 'Audio Off'}
                      >
                        {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                      </button>
                      
                      {audioEnabled && (
                        <button
                          onClick={togglePlayback}
                          className="text-xs text-primary hover:text-primary/80 transition-colors"
                          title={isPlaying ? 'Pause' : 'Play'}
                        >
                          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                      )}
                      
                      <button
                        onClick={closeResponse}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Close response"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Main Input Row - Always at bottom */}
            <div className="flex items-center gap-4 px-6 py-4">
              {/* Text Input */}
              <div className="flex-1">
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    onValueChange?.(e.target.value);
                  }}
                  onFocus={handleInputFocus}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder={isListening ? "Listening..." : placeholder}
                  className="w-full bg-transparent border-none text-lg text-foreground placeholder-muted-foreground focus:outline-none resize-none"
                  disabled={isProcessing || isListening}
                />
              </div>

              {/* Status Indicators */}
              <div className="flex items-center gap-3">
                {isProcessing && (
                  <div className="flex items-center gap-2 text-primary">
                    <div key="dot-1" className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div key="dot-2" className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div key="dot-3" className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                )}
                
                {isPlaying && (
                  <div className="flex items-center gap-2 text-purple-400">
                    <Play className="text-sm animate-pulse" />
                    <span className="text-sm">Speaking...</span>
                  </div>
                )}

                {/* Audio Control */}
                <button
                  onClick={toggleAudio}
                  className={cn(
                    'p-2 rounded-full transition-all duration-200',
                    audioEnabled ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted/10'
                  )}
                >
                  {audioEnabled ? <Volume2 className="text-sm" /> : <VolumeX className="text-sm" />}
                </button>
              </div>

              {/* Voice Input Button - Now on the right */}
              <motion.button
                onClick={handleVoiceToggle}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg',
                  isListening 
                    ? 'bg-red-500 hover:bg-red-600 scale-110' 
                    : 'bg-primary hover:bg-primary/90 hover:scale-105'
                )}
                disabled={isProcessing}
              >
                {/* Pulse rings when listening */}
                <AnimatePresence>
                  {isListening && (
                    <>
                      <motion.div
                        key="pulse-ring-1"
                        initial={{ scale: 1, opacity: 0.6 }}
                        animate={{ scale: 2.5, opacity: 0 }}
                        exit={{ scale: 1, opacity: 0 }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="absolute inset-0 bg-red-400 rounded-full"
                      />
                      <motion.div
                        key="pulse-ring-2"
                        initial={{ scale: 1, opacity: 0.4 }}
                        animate={{ scale: 2, opacity: 0 }}
                        exit={{ scale: 1, opacity: 0 }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
                        className="absolute inset-0 bg-red-500 rounded-full"
                      />
                    </>
                  )}
                </AnimatePresence>
                
                {isListening ? (
                  <MicOff className="text-white animate-pulse relative z-10" />
                ) : (
                  <Mic className="text-white relative z-10" />
                )}
              </motion.button>
            </div>
          </div>

          {/* Enticing animation hints */}
          <AnimatePresence>
            {!hasInteracted && (
              <motion.div
                key="interaction-hint"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 3, duration: 0.8 }}
                className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-center"
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="bg-primary/10 border border-primary/20 rounded-full px-3 py-1 text-xs text-primary font-medium"
                >
                  ✨ Try voice navigation
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating indicator */}
          <AnimatePresence>
            {!hasInteracted && (
              <motion.div
                key="floating-indicator"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ delay: 4, duration: 0.5 }}
                className="absolute -top-2 -right-2"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-3 h-3 bg-primary rounded-full shadow-lg shadow-primary/50"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Listening Indicator Modal */}
      {isListening && (
        <div className="fixed inset-0 bg-black/20 z-40 flex items-center justify-center">
          <div className="bg-background border border-border p-8 rounded-2xl text-center shadow-2xl">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
              <Mic className="text-white text-2xl" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Listening...</h3>
            <p className="text-muted-foreground">Speak your question or request</p>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Export default for easier imports
export default FloatingAIInterface;