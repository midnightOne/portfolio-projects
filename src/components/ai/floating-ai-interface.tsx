/**
 * Floating AI Interface Component - Task 8.1 Implementation
 * 
 * Pill-shaped floating interface with REAL voice integration, reflink-based access control,
 * and GSAP animations. Integrates with ConversationalAgentProvider for actual voice AI.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Sparkles, MessageCircle, Volume2, VolumeX, Play, Pause, Settings, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gsap } from 'gsap';
import { useConversationalAgent } from '@/components/providers/conversational-agent-provider';
import { useReflinkSession } from '@/components/providers/reflink-session-provider';

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
  onSettingsClick?: () => void;
  onClear?: () => void;
  
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

// Real voice integration replaces the old useVoiceRecognition hook

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
  onSettingsClick,
  onClear,
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
  // Real voice integration and reflink access control
  const { 
    accessLevel, 
    isFeatureEnabled, 
    welcomeMessage, 
    accessMessage, 
    personalizedContext,
    budgetStatus 
  } = useReflinkSession();
  
  const {
    isInitialized,
    activeProvider,
    availableProviders,
    switchProvider,
    connect,
    disconnect,
    isConnected,
    startAudioInput,
    stopAudioInput,
    mute,
    unmute,
    isMuted,
    setVolume,
    volume,
    sendMessage,
    interrupt,
    transcript,
    clearTranscript,
    availableTools,
    lastError,
    clearErrors,
    state
  } = useConversationalAgent();

  // Local state
  const [inputValue, setInputValue] = useState(value);
  const [isVisible, setIsVisible] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationState, setAnimationState] = useState<'pill' | 'expanded' | 'transitioning'>('pill');
  const [showAccessMessage, setShowAccessMessage] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  
  // Animation timeline refs for proper cleanup
  const edgeEffectsTimelineRef = useRef<GSAPTimeline | null>(null);
  const pulseTimelineRef = useRef<GSAPTimeline | null>(null);
  const modeTransitionTimelineRef = useRef<GSAPTimeline | null>(null);
  const positionTimelineRef = useRef<GSAPTimeline | null>(null);
  

  // Voice state derived from real voice system
  const isListening = state.audioState.isRecording;
  const isProcessing = false; // Could be derived from conversation metadata
  const voiceSupported = isInitialized && isFeatureEnabled('voice_ai');
  const isTyping = false; // Could be derived from transcript events

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

  // Handle form submission with real voice system
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isProcessing) {
      try {
        // Check access level for text input
        if (!isFeatureEnabled('chat_interface')) {
          setShowAccessMessage(true);
          return;
        }

        // Send message through voice system if connected, otherwise use callback
        if (isConnected) {
          await sendMessage(inputValue.trim());
        } else {
          onTextSubmit?.(inputValue.trim());
        }
        
        setInputValue('');
        setHasInteracted(true);
        
        if (expandOnFocus && mode === 'expanded') {
          onModeChange?.('pill');
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        // Could show error message to user
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

  // Access control effects
  useEffect(() => {
    // Show access message if user doesn't have voice AI access
    if (accessMessage && !isFeatureEnabled('voice_ai')) {
      setShowAccessMessage(true);
    }
  }, [accessMessage, isFeatureEnabled]);

  // Initialize voice connection when feature is available
  useEffect(() => {
    if (isInitialized && isFeatureEnabled('voice_ai') && !isConnected) {
      connect().catch(error => {
        console.error('Failed to connect to voice AI:', error);
      });
    }
  }, [isInitialized, isFeatureEnabled, isConnected, connect]);

  // Generate conversation ID for admin monitoring
  useEffect(() => {
    if (isConnected && !conversationId) {
      const id = `conversation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setConversationId(id);
      console.log('Conversation ID for admin monitoring:', id);
    }
  }, [isConnected, conversationId]);

  // Handle voice toggle with real voice system - continuous WebRTC connection
  const handleVoiceToggle = async () => {
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
    
    // Check access level
    if (!isFeatureEnabled('voice_ai')) {
      setShowAccessMessage(true);
      return;
    }

    try {
      // Ensure connection is established first
      if (!isConnected) {
        await connect();
      }
      
      // Toggle microphone for continuous WebRTC connection
      if (isListening) {
        // Mute microphone but keep connection active
        await stopAudioInput();
      } else {
        // Unmute microphone for continuous listening
        await startAudioInput();
      }
    } catch (error) {
      console.error('Voice toggle error:', error);
      // Could show error message to user
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

  // Generate quick actions based on access level and personalized context
  const generateQuickActions = (): QuickAction[] => {
    if (quickActions.length > 0) return quickActions;

    const actions: QuickAction[] = [
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
      }
    ];

    // Add personalized actions for premium users
    if (personalizedContext?.conversationStarters) {
      personalizedContext.conversationStarters.slice(0, 2).forEach((starter, index) => {
        actions.push({
          id: `personalized-${index}`,
          label: starter.length > 30 ? starter.substring(0, 30) + '...' : starter,
          icon: Sparkles,
          command: starter
        });
      });
    }

    // Add job analysis for premium users
    if (isFeatureEnabled('job_analysis')) {
      actions.push({
        id: 'job-analysis',
        label: 'Analyze a job posting',
        icon: MessageCircle,
        command: 'I can analyze job postings for you - just paste the job description'
      });
    }

    // Add contact info
    actions.push({
      id: 'contact-info',
      label: 'How can I contact you?',
      icon: MessageCircle,
      command: 'How can I get in touch with you?'
    });

    return actions.slice(0, 4); // Limit to 4 actions
  };

  const effectiveQuickActions = generateQuickActions();

  // Don't render if access level is 'no_access'
  if (accessLevel === 'no_access') {
    return null;
  }

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
          {/* Access Message Modal */}
          <AnimatePresence>
            {showAccessMessage && accessMessage && (
              <motion.div
                key="access-message"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
                onClick={() => setShowAccessMessage(false)}
              >
                <motion.div
                  className="bg-background border border-border rounded-lg p-6 max-w-md mx-4 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-2">{accessMessage.title}</h3>
                      <p className="text-muted-foreground text-sm mb-4">{accessMessage.description}</p>
                      <div className="flex gap-2">
                        {accessMessage.actionText && accessMessage.actionUrl && (
                          <a
                            href={accessMessage.actionUrl}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                          >
                            {accessMessage.actionText}
                          </a>
                        )}
                        <button
                          onClick={() => setShowAccessMessage(false)}
                          className="bg-muted text-muted-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-muted/80 transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Welcome Message for Premium Users */}
          <AnimatePresence>
            {welcomeMessage && personalizedContext?.recipientName && !hasInteracted && (
              <motion.div
                key="welcome-message"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mb-3 text-center"
              >
                <div className="inline-block px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-full text-sm text-primary border border-primary/20">
                  <Sparkles className="inline h-3 w-3 mr-2" />
                  {welcomeMessage}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
                      {/* Budget status for premium users */}
                      {budgetStatus && !budgetStatus.isExhausted && (
                        <div className="text-xs text-muted-foreground">
                          ${budgetStatus.spendRemaining.toFixed(2)} left
                        </div>
                      )}
                      
                      {/* Conversation ID for admin monitoring */}
                      {conversationId && (
                        <div className="text-xs text-muted-foreground font-mono">
                          ID: {conversationId.split('_')[1]}
                        </div>
                      )}

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
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                )}
                
                {isPlaying && (
                  <div className="flex items-center gap-2 text-purple-400">
                    <Play className="text-sm animate-pulse" />
                    <span className="text-sm">Speaking...</span>
                  </div>
                )}
                
                {/* Subtle listening indicator - no modal needed for WebRTC */}
                {isListening && voiceSupported && (
                  <div className="flex items-center gap-2 text-green-500">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs">Listening</span>
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

              {/* Settings Button */}
              {onSettingsClick && (
                <button
                  onClick={onSettingsClick}
                  className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-all duration-200"
                  title="Settings"
                >
                  <Settings className="text-sm" />
                </button>
              )}

              {/* Provider Indicator (for premium users) */}
              {isFeatureEnabled('voice_ai') && activeProvider && (
                <div className="text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded-full">
                  {activeProvider === 'openai' ? 'GPT' : 'EL'}
                </div>
              )}

              {/* Voice Input Button - Now on the right */}
              <motion.button
                onClick={handleVoiceToggle}
                whileHover={{ scale: voiceSupported ? 1.05 : 1 }}
                whileTap={{ scale: voiceSupported ? 0.95 : 1 }}
                className={cn(
                  'relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg',
                  !voiceSupported 
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : isListening 
                      ? 'bg-red-500 hover:bg-red-600 scale-110' 
                      : 'bg-primary hover:bg-primary/90 hover:scale-105'
                )}
                disabled={isProcessing || !voiceSupported}
                title={
                  !voiceSupported 
                    ? 'Voice AI not available for your access level'
                    : isListening 
                      ? 'Mute microphone' 
                      : isConnected 
                        ? 'Unmute microphone'
                        : 'Connect and enable voice'
                }
              >
                {/* Connection status indicator */}
                {voiceSupported && !isConnected && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
                )}
                
                {/* Connected and listening indicator */}
                {voiceSupported && isConnected && isListening && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                )}
                
                {/* Error indicator */}
                {lastError && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
                )}

                {/* Pulse rings when listening */}
                <AnimatePresence>
                  {isListening && voiceSupported && (
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
                  <MicOff className={cn("animate-pulse relative z-10", voiceSupported ? "text-white" : "text-muted-foreground")} />
                ) : (
                  <Mic className={cn("relative z-10", voiceSupported ? "text-white" : "text-muted-foreground")} />
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

      {/* Continuous WebRTC connection - no modal needed */}
    </AnimatePresence>
  );
}

// Export default for easier imports
export default FloatingAIInterface;