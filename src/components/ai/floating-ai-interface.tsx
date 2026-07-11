/**
 * Floating AI Interface Component - Task 8.1 Implementation
 * 
 * Pill-shaped floating interface with REAL voice integration, reflink-based access control,
 * and GSAP animations. Integrates with ConversationalAgentProvider for actual voice AI.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Sparkles, MessageCircle, Volume2, VolumeX, Play, Pause, Settings, AlertCircle, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gsap } from 'gsap';
import { useConversationalAgent } from '@/components/providers/conversational-agent-provider';
import { useReflinkSession } from '@/components/providers/reflink-session-provider';
import { readContinuityMarker, writeContinuityMarker, clearContinuityMarker } from '@/lib/ai/continuity-marker';
import type { ConnectOptions } from '@/lib/voice/IConversationalAgentAdapter';
import { Switch } from '@/components/ui/switch';
import { EngineChipsRow, EngineTopicLabel } from './engine-chips';
import { JobDescriptionModal } from './job-description-modal';
import { getAutoNav, setAutoNav, subscribeAutoNav } from '@/lib/ai/autonav';
import type { EngineChip, EngineUx } from '@/lib/ai/engine/types';

// Types for the floating AI interface
// (The legacy QuickAction placeholder surface was removed with conversation-engine
//  Block G1 — engine chips own the suggestion rail now; owner 2026-07-10.)

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

  // Styling
  theme?: 'default' | 'minimal' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  
  // Behavior
  hideOnScroll?: boolean;
  persistPosition?: boolean;
  animationDuration?: number;
  isVisible?: boolean; // External visibility control
  
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
    session,
    accessLevel, 
    isFeatureEnabled, 
    welcomeMessage, 
    accessMessage, 
    personalizedContext,
    budgetStatus 
  } = useReflinkSession();
  
  const {
    isInitialized,
    availableProviders,
    switchProvider,
    connect,
    disconnect,
    getConversationSessionId,
    isConnected,
    audioInputMode,
    startAudioInput,
    stopAudioInput,
    mute,
    unmute,
    isMuted,
    setVolume,
    volume,
    sendMessage,
    sendChipTap,
    publishContext,
    engineUx: directiveUx,
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
  const [isVisible, setIsVisible] = useState(true); // Will be updated based on reflink status
  const [hasInteracted, setHasInteracted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationState, setAnimationState] = useState<'pill' | 'expanded' | 'transitioning'>('pill');
  const [showAccessMessage, setShowAccessMessage] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  // Microphone permission flow: 'ask' = offer enable-mic vs stay-text-only;
  // 'denied' = browser blocked the mic, conversation continues text-only with retry
  const [micPrompt, setMicPrompt] = useState<null | 'ask' | 'denied'>(null);
  const [micBusy, setMicBusy] = useState(false);

  // Returning-visitor resume (Block I3, Req 17.1/21.1). 'auto' = same-device
  // continuity marker matched → the next session silently resumes ("as if
  // after a brief disruption"); 'confirm' = same reflink from a new device/
  // browser → explicit choice with a safe one-line summary, never a silent
  // transcript exposure (a forwarded reflink URL must not leak the previous
  // holder's conversation). The marker is a UX selector only — the reflink
  // stays the sole access control (P32).
  const [resumeOffer, setResumeOffer] = useState<null | {
    sessionId: string;
    summaryLine: string | null;
    mode: 'auto' | 'confirm';
  }>(null);
  const pendingResumeRef = useRef<string | null>(null);
  const resumeCheckedRef = useRef(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Public text tier (D31): anonymous visitors chat via /api/ai/chat (gateway-fronted,
  // default-cheap reasoning model) — the realtime voice session never opens for them.
  const isPublicTextTier = accessLevel === 'basic' || accessLevel === 'limited';
  const [publicMessages, setPublicMessages] = useState<Array<{ id: string; type: 'user_speech' | 'ai_response'; content: string }>>([]);
  const [publicBusy, setPublicBusy] = useState(false);

  // G1 (Req 13.1/13.3): visitor surface. Three sources, one precedence rule —
  // whatever arrived LAST wins because each is a full replace-on-transition
  // snapshot: mount fetch (start node, so chips draw first contact) → /chat
  // response envelope (text tier) → applied engine directives (adapter tiers).
  const [envelopeUx, setEnvelopeUx] = useState<EngineUx | null>(null);
  const [chipsBusy, setChipsBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/engine/ux')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.ux) setEnvelopeUx(data.ux as EngineUx);
      })
      .catch(() => { /* surfaces stay hidden (Req 2.7) */ });
    return () => { cancelled = true; };
  }, []);
  const effectiveUx: EngineUx | null = directiveUx ?? envelopeUx;

  // G2 (Req 13.8, P36): the auto-navigation consent toggle — default OFF for
  // every new visitor. The store fans flips (tap here, set_auto_navigation
  // tool from spoken requests) to the adapter's floating block + turn
  // evidence; this state just renders the visible control.
  const [autoNavOn, setAutoNavOn] = useState(false);
  useEffect(() => {
    setAutoNavOn(getAutoNav());
    return subscribeAutoNav((enabled) => setAutoNavOn(enabled));
  }, []);

  // Minimal chat log: the conversational turns (user text/speech + AI replies).
  // Tool calls/results and system messages are kept out of the visitor view.
  const agentChatMessages = transcript.filter(
    (t) => t.type === 'user_speech' || t.type === 'ai_response'
  );
  const chatMessages = isPublicTextTier ? publicMessages : agentChatMessages;

  // Auto-scroll the transcript to the latest message
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatMessages.length]);
  
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

  // ---- Returning-visitor resume (Block I3) ----

  /**
   * Every pill-initiated connect goes through here: when a resume is pending
   * (same-device auto-match or explicit "Continue"), the session opens with
   * resumeFromSessionId — the one D49 resume code path, third trigger. A
   * connect with nothing pending is a fresh conversation, which also clears
   * any unanswered confirm offer (typing first = implicit "start fresh";
   * resuming without the explicit choice would silently expose a prior
   * conversation, Req 21.1).
   */
  const connectWithContinuity = async (options: ConnectOptions) => {
    const resumeId = pendingResumeRef.current;
    pendingResumeRef.current = null;
    setResumeOffer(null);
    await connect(resumeId ? { ...options, resumeFromSessionId: resumeId } : options);
  };

  // Look up the reflink's latest conversation once per page load (server-side
  // the reflink is validated again — the marker never authorizes anything, P32).
  useEffect(() => {
    const code = session?.reflink?.code;
    if (resumeCheckedRef.current || !code || accessLevel !== 'premium' || isConnected) return;
    resumeCheckedRef.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/ai/conversation/latest?reflink=${encodeURIComponent(code)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.resumable || typeof data.sessionId !== 'string') return;
        const marker = readContinuityMarker(code);
        if (marker === data.sessionId) {
          pendingResumeRef.current = data.sessionId;
          setResumeOffer({ sessionId: data.sessionId, summaryLine: data.summaryLine ?? null, mode: 'auto' });
        } else {
          setResumeOffer({ sessionId: data.sessionId, summaryLine: data.summaryLine ?? null, mode: 'confirm' });
        }
      } catch {
        /* resume is best-effort — a failed lookup just means a fresh conversation */
      }
    })();
  }, [session, accessLevel, isConnected]);

  // Same-device continuity marker: once the conversation has a real user turn,
  // remember its logical session id on this device (idempotent per session).
  useEffect(() => {
    const code = session?.reflink?.code;
    if (!code || !isConnected) return;
    if (!transcript.some((t) => t.type === 'user_speech')) return;
    const sid = getConversationSessionId();
    if (sid) writeContinuityMarker(code, sid);
  }, [transcript, isConnected, session, getConversationSessionId]);

  /** Explicit "Continue where you left off" — opens a text-only resumed session immediately. */
  const acceptResume = async () => {
    if (!resumeOffer) return;
    pendingResumeRef.current = resumeOffer.sessionId;
    setHasInteracted(true);
    try {
      if (!isConnected) {
        await connectWithContinuity({ audioInput: false });
      }
      if (mode !== 'expanded') {
        onModeChange?.('expanded');
      }
    } catch (error) {
      console.error('Resume connect failed (visitor can start fresh):', error);
    }
  };

  /** "Start fresh" — always offered (Req 21.1); drops this device's marker too. */
  const declineResume = () => {
    const code = session?.reflink?.code;
    if (code) clearContinuityMarker(code);
    pendingResumeRef.current = null;
    setResumeOffer(null);
  };

  // Public tier: send through the gateway-fronted text endpoint
  const sendPublicMessage = async (text: string, opts?: { chipId?: string }) => {
    const { sendPublicChatMessage } = await import('@/lib/ai/public-chat-client');
    const userMsg = { id: `pub_u_${Date.now()}`, type: 'user_speech' as const, content: text };
    const history = publicMessages.map((m) => ({
      role: m.type === 'user_speech' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }));
    setPublicMessages((prev) => [...prev, userMsg]);
    setPublicBusy(true);
    try {
      // G2: the consent-toggle state rides every public turn (policy line + prefs persistence)
      const result = await sendPublicChatMessage(text, history, { ...opts, autoNav: getAutoNav() });
      let reply: string;
      if (result.ok === true) {
        reply = result.reply;
        // G1: chips/label ride the /chat envelope on the text tier
        if (result.engineUx) setEnvelopeUx(result.engineUx);
      } else {
        reply = result.error;
      }
      setPublicMessages((prev) => [...prev, { id: `pub_a_${Date.now()}`, type: 'ai_response', content: reply }]);
    } finally {
      setPublicBusy(false);
    }
  };

  /**
   * G1 (Req 13.1, P22): a chip tap sends its text as a NORMAL visitor turn —
   * it appears in the transcript as the visitor's own words — while the chip
   * id rides the turn evidence so `chip` edges fire deterministically.
   */
  const handleChipTap = async (chip: EngineChip) => {
    const text = chip.sendText ?? chip.label;
    if (chipsBusy || publicBusy) return;
    setChipsBusy(true);
    setHasInteracted(true);
    try {
      if (mode !== 'expanded') onModeChange?.('expanded');
      if (isPublicTextTier) {
        await sendPublicMessage(text, { chipId: chip.id });
      } else {
        if (!isConnected) {
          await connectWithContinuity({ audioInput: false });
        }
        await sendChipTap({ id: chip.id, text });
      }
      onTextSubmit?.(text);
    } catch (error) {
      console.error('Chip tap failed:', error);
    } finally {
      setChipsBusy(false);
    }
  };

  // Handle form submission with real voice system
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isProcessing && !publicBusy) {
      try {
        // Check access level for text input
        if (!isFeatureEnabled('chat_interface')) {
          setShowAccessMessage(true);
          return;
        }

        const text = inputValue.trim();

        if (isPublicTextTier) {
          // Anonymous text tier never opens a realtime session (D31)
          setInputValue('');
          setHasInteracted(true);
          if (mode !== 'expanded') {
            onModeChange?.('expanded');
          }
          await sendPublicMessage(text);
          onTextSubmit?.(text);
          return;
        }

        // Typing while disconnected starts a text-only session (no mic permission needed);
        // a pending returning-visitor resume rides this connect (Block I3)
        if (!isConnected) {
          console.log('Not connected - establishing text-only session for typed message...');
          await connectWithContinuity({ audioInput: false });
        }
        await sendMessage(text);
        onTextSubmit?.(text);

        setInputValue('');
        setHasInteracted(true);

        // Stay expanded so the transcript (and the incoming reply) stays visible.
        // Previously the pill collapsed right after sending, hiding the answer.
        if (mode !== 'expanded') {
          onModeChange?.('expanded');
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

  // Set initial visibility and behavior based on access level
  useEffect(() => {
    // Always show interface for users with access (no_access is handled by early return)
    // Premium users get enhanced visibility and welcome message
    if (accessLevel === 'premium' && session?.reflink) {
      setIsVisible(true);
      console.log('AI interface visible for premium reflink user:', session.reflink.recipientName);
    } else if (accessLevel === 'limited' || accessLevel === 'basic') {
      setIsVisible(true);
      console.log('AI interface visible for', accessLevel, 'user');
    }
  }, [accessLevel, session]);

  // Don't auto-connect - only connect when user clicks microphone button
  // This prevents multiple simultaneous connections and gives user control

  // Generate conversation ID for admin monitoring
  useEffect(() => {
    if (isConnected && !conversationId) {
      const id = `conversation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setConversationId(id);
      console.log('Conversation ID for admin monitoring:', id);
    }
  }, [isConnected, conversationId]);

  // Handle voice toggle with real voice system - connect only when user clicks
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
      if (isListening) {
        // Stop listening (mute microphone)
        console.log('Stopping voice input...');
        await stopAudioInput();
      } else {
        // Starting voice requires mic permission — route through the permission flow
        // instead of letting getUserMedia fail deep inside the adapter.
        const permission = await queryMicPermission();

        if (permission === 'granted') {
          await startVoice();
        } else if (permission === 'denied') {
          // Browser has the mic blocked: keep/put the conversation in text-only and offer retry
          setMicPrompt('denied');
          if (!isConnected) {
            await connectWithContinuity({ audioInput: false });
          }
        } else {
          // 'prompt' — let the user choose before triggering the native permission dialog
          setMicPrompt('ask');
        }
      }
    } catch (error) {
      console.error('Voice toggle error:', error);
      // Could show error message to user
    }

    setHasInteracted(true);
  };

  /**
   * Best-effort microphone permission state. Some browsers don't support
   * querying the 'microphone' permission — treat those as 'prompt'.
   */
  const queryMicPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return status.state as 'granted' | 'denied' | 'prompt';
    } catch {
      return 'prompt';
    }
  };

  /** Connect with microphone (or upgrade a text-only session) and start listening. */
  const startVoice = async () => {
    setMicBusy(true);
    try {
      if (!isConnected) {
        console.log('Not connected, establishing voice connection first...');
        await connectWithContinuity({ audioInput: true });
      }
      // If the session is text-only, startAudioInput performs the mic upgrade (reconnect)
      console.log('Starting audio input...');
      await startAudioInput();
      setMicPrompt(null);
    } catch (error) {
      console.error('Voice start failed:', error);
      // Mic denied at the native prompt (or unavailable): fall back to text-only
      setMicPrompt('denied');
      if (!isConnected) {
        try {
          await connectWithContinuity({ audioInput: false });
        } catch (fallbackError) {
          console.error('Text-only fallback connection failed:', fallbackError);
        }
      }
    } finally {
      setMicBusy(false);
    }
  };

  /** User chose to continue without a microphone. */
  const stayTextOnly = async () => {
    setMicPrompt(null);
    if (!isConnected) {
      try {
        await connectWithContinuity({ audioInput: false });
      } catch (error) {
        console.error('Text-only connection failed:', error);
      }
    }
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

          {/* Job-description intake modal (Req 13.4, G3): opened by the
              job_description_form client tool; delivery-menu choices speak
              through the conversation as visitor turns. */}
          <JobDescriptionModal
            reflinkId={session?.reflink?.id}
            onVisitorTurn={(text) => {
              void (async () => {
                try {
                  if (!isConnected) await connectWithContinuity({ audioInput: false });
                  await sendMessage(text);
                } catch (err) {
                  console.error('JD delivery-choice send failed:', err);
                }
              })();
            }}
            onAssistantContext={(text) => publishContext('jd_analysis', text)}
          />

          {/* Engine chips (Req 13.1, G1): float aesthetically above the input
              section — they animate outwards from it on entry and never move
              once shown. Owner-authored per node; hidden when no graph steers. */}
          {effectiveUx && effectiveUx.chips.length > 0 && (
            <div className="mb-2">
              <EngineChipsRow ux={effectiveUx} onChipTap={handleChipTap} disabled={chipsBusy || publicBusy} />
            </div>
          )}

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
                  <div className="bg-card/50 border-b border-border/50 px-6 py-3 flex items-center justify-end">
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
            
            {/* Minimal chat transcript — visible whenever there are conversational turns */}
            {chatMessages.length > 0 && (
              <div
                className="mx-4 mt-3 mb-1 max-h-64 overflow-y-auto flex flex-col gap-2 px-2"
                data-testid="chat-transcript"
              >
                {chatMessages.map((msg) => {
                  const isUser = msg.type === 'user_speech';
                  return (
                    <div
                      key={msg.id}
                      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
                      data-testid={isUser ? 'chat-msg-user' : 'chat-msg-ai'}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                          isUser
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted text-foreground rounded-bl-sm'
                        )}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={transcriptEndRef} />
              </div>
            )}

            {/* Returning-visitor resume (Block I3): confirm on a new device
                (explicit choice + safe summary, Req 21.1), subtle notice on a
                same-device auto-resume. Gone after any conversation starts. */}
            {resumeOffer && !isConnected && chatMessages.length === 0 && (
              resumeOffer.mode === 'confirm' ? (
                <div
                  className="mx-6 mb-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
                  data-testid="resume-prompt"
                >
                  <p className="text-foreground mb-1">Continue where you left off?</p>
                  {resumeOffer.summaryLine && (
                    <p className="text-muted-foreground text-xs mb-2 italic" data-testid="resume-summary">
                      {resumeOffer.summaryLine}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={acceptResume}
                      className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      data-testid="resume-continue"
                    >
                      Continue
                    </button>
                    <button
                      onClick={declineResume}
                      className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted/50 transition-colors"
                      data-testid="resume-start-fresh"
                    >
                      Start fresh
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="mx-6 mb-2 px-4 py-2 text-xs text-muted-foreground"
                  data-testid="resume-auto-notice"
                >
                  <Sparkles className="inline h-3 w-3 mr-1 text-primary" />
                  Welcome back — your last conversation will pick up where it left off.
                  <button
                    onClick={declineResume}
                    className="ml-2 underline hover:text-foreground transition-colors"
                    data-testid="resume-auto-start-fresh"
                  >
                    Start fresh instead
                  </button>
                </div>
              )
            )}

            {/* Microphone permission prompt (voice requested without mic access) */}
            {micPrompt && (
              <div
                className="mx-6 mb-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
                data-testid="mic-permission-prompt"
              >
                {micPrompt === 'ask' ? (
                  <>
                    <p className="text-foreground mb-2">
                      Voice chat needs access to your microphone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={startVoice}
                        disabled={micBusy}
                        className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        data-testid="mic-prompt-enable"
                      >
                        {micBusy ? 'Requesting…' : 'Enable microphone'}
                      </button>
                      <button
                        onClick={stayTextOnly}
                        className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted/50 transition-colors"
                        data-testid="mic-prompt-text-only"
                      >
                        Stay text-only
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-foreground mb-2">
                      Your browser has blocked microphone access — continuing in text-only mode.
                      Allow the microphone in your browser&apos;s site settings to use voice.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={startVoice}
                        disabled={micBusy}
                        className="px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                        data-testid="mic-prompt-retry"
                      >
                        {micBusy ? 'Checking…' : 'Retry microphone'}
                      </button>
                      <button
                        onClick={() => setMicPrompt(null)}
                        className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="mic-prompt-dismiss"
                      >
                        Dismiss
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Topic indicator (Req 13.3): small grayish line above the input
                field; hidden when the active node declares none. */}
            <div className="px-6 pt-2 -mb-2 min-h-0">
              <EngineTopicLabel label={effectiveUx?.topicLabel ?? null} />
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
                  disabled={isProcessing}
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

                {/* Auto-navigation consent toggle (Req 13.8, G2; owner 2026-07-11:
                    a proper iOS-style switch): OFF (default) = the agent asks
                    before taking you anywhere; ON = it may navigate freely. The
                    agent can flip it too, but only via the set_auto_navigation
                    tool after you agree — the state shown is always the real one. */}
                <div
                  className="flex items-center gap-1.5"
                  title={
                    autoNavOn
                      ? 'Auto-navigation ON — the assistant may move around the site for you. Click to make it ask first.'
                      : 'Auto-navigation OFF — the assistant asks before taking you anywhere. Click to let it navigate freely.'
                  }
                >
                  <Navigation
                    size={13}
                    className={cn('transition-colors', autoNavOn ? 'text-primary' : 'text-muted-foreground')}
                  />
                  <Switch
                    checked={autoNavOn}
                    onCheckedChange={(v) => setAutoNav(v, 'tap')}
                    aria-label="Auto-navigation"
                    data-testid="autonav-toggle"
                  />
                </div>
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

              {/* Provider indicator removed (owner 2026-07-11): the provider is
                  operator information, not visitor information — it lives on the
                  admin fake-mic homepage panel, which is also the only client-
                  side switch. */}

              {/* Text-only session indicator */}
              {isConnected && audioInputMode === 'text-only' && (
                <div
                  className="text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded-full"
                  title="Connected without microphone — type to chat, or use the mic button to enable voice"
                  data-testid="text-only-indicator"
                >
                  Text-only
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
                        ? audioInputMode === 'text-only'
                          ? 'Enable voice (requires microphone)'
                          : 'Unmute microphone'
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