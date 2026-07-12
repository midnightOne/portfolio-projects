/**
 * Floating AI Interface — the AI pill (ui-system task 3, owner vision
 * 2026-07-10/11; tab-dock revision 2026-07-12).
 *
 * Presentation-layer redesign of the original Task 8.1 pill: the silhouette
 * the classic capsule with a "tab" dock morph (PillShell), the chat history lives
 * in a right sidebar (TranscriptSidebar), the page breathes from its edges
 * while the agent speaks (AmbientSpeechGlow), and every AI surface sits on
 * the dedicated AI z-layer above modals (task 3.7). Conversation-engine
 * contracts (Req 13 surfaces, chips, resume, mic flow, JD form) are
 * unchanged — this file still wires the same providers and handlers.
 *
 * Layout states (one GSAP timeline, ai-visual-config tunables):
 *  - hero:    floating pill above the hero section (position 'hero')
 *  - docked:  "tab" merged with the bottom screen edge — the outer bottom
 *             corners flip to external fillets (position 'pinned')
 *  - sidebar: pill relocated to the transcript sidebar's foot (mode 'expanded'
 *             on desktop; on phones the history is a full-screen overlay and
 *             the pill keeps the bottom edge)
 */

'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Sparkles, Volume2, VolumeX, Settings, AlertCircle, Navigation, MessagesSquare, PhoneOff } from 'lucide-react';
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
import { PillShell } from './pill-shell';
import { TranscriptSidebar } from './transcript-sidebar';
import { AmbientSpeechGlow } from './ambient-speech-glow';
import { useAIVisualConfig } from '@/lib/ui/ai-visual-config-context';
import type { AgentVisualState } from '@/lib/ui/ai-visual-config';

export interface FloatingAIInterfaceProps {
  // Position Management
  position: 'hero' | 'pinned';
  onPositionChange?: (position: 'hero' | 'pinned') => void;
  autoPin?: boolean; // Auto-pin after first interaction

  // Mode Management ('expanded' = transcript sidebar open)
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

  // Styling (legacy knobs — visual truth lives in ai-visual-config, task 3.8)
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
  className,
  hideOnScroll = false,
  ariaLabel = "AI Assistant Interface",
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
    connect,
    disconnect,
    getConversationSessionId,
    isConnected,
    audioInputMode,
    startAudioInput,
    stopAudioInput,
    sendMessage,
    sendChipTap,
    publishContext,
    engineUx: directiveUx,
    transcript,
    lastError,
    state
  } = useConversationalAgent();

  const visualConfig = useAIVisualConfig();

  // Local state
  const [inputValue, setInputValue] = useState(value);
  const [isVisible, setIsVisible] = useState(true); // Will be updated based on reflink status
  const [hasInteracted, setHasInteracted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showAccessMessage, setShowAccessMessage] = useState(false);
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
  const agentChatMessages = transcript
    .filter((t) => t.type === 'user_speech' || t.type === 'ai_response')
    .map((t) => ({
      id: t.id,
      type: t.type as 'user_speech' | 'ai_response',
      content: t.content,
    }));
  const chatMessages = isPublicTextTier ? publicMessages : agentChatMessages;

  // Voice state derived from real voice system
  const isListening = state.audioState.isRecording;
  // Agent audio output active — the SPEAKING signal for the ambient surfaces
  // (task 3.6): provider flips it on speech_start/speech_end audio events.
  const isSpeaking = state.audioState.isPlaying;
  const isProcessing = false; // Could be derived from conversation metadata
  const voiceSupported = isInitialized && isFeatureEnabled('voice_ai');

  const agentVisualState: AgentVisualState = isSpeaking
    ? 'speaking'
    : isListening
      ? 'listening'
      : publicBusy || chipsBusy
        ? 'thinking'
        : 'idle';

  // ---- Responsive layout state (task 3.3) ----
  const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const compact = viewport.w < visualConfig.dimensions.phoneBreakpoint;
  const sidebarOverlay = viewport.w < visualConfig.sidebar.overlayBreakpoint;
  const dims = compact ? visualConfig.dimensions.phone : visualConfig.dimensions.desktop;
  const sidebarOpen = mode === 'expanded';

  // ---- Dock morph + layout timeline (tasks 3.1/3.4) ----
  // The shell reads dockProgress every frame; GSAP tweens it together with
  // the container geometry so the corner flip and the drop into place are
  // one movement.
  const dockProgressRef = useRef({ p: 0 });
  const getDockProgress = useCallback(() => dockProgressRef.current.p, []);
  const layoutTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const lastLayoutKeyRef = useRef<string>('');

  // useLayoutEffect: the very first geometry set must land before paint —
  // the container has no CSS position fallback (GSAP owns left/bottom/width).
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { morph, sidebar } = visualConfig;
    const pillWidth = Math.min(dims.maxWidth + 2 * dims.bleedX, viewport.w - (compact ? 4 : 16));

    // Target geometry per layout state.
    let target: { left: number; bottom: number; width: number; dock: number };
    if (sidebarOpen && !sidebarOverlay) {
      const width = Math.min(pillWidth, sidebar.width - 8);
      target = {
        left: viewport.w - sidebar.width + (sidebar.width - width) / 2,
        bottom: 12,
        width,
        dock: 0,
      };
    } else if (position === 'pinned' && !sidebarOpen) {
      target = { left: (viewport.w - pillWidth) / 2, bottom: 0, width: pillWidth, dock: 1 };
    } else if (sidebarOpen && sidebarOverlay) {
      target = { left: (viewport.w - pillWidth) / 2, bottom: dims.floatingBottom, width: pillWidth, dock: 0 };
    } else {
      target = {
        left: (viewport.w - pillWidth) / 2,
        bottom: (viewport.h * dims.heroBottomVh) / 100,
        width: pillWidth,
        dock: 0,
      };
    }

    layoutTimelineRef.current?.kill();
    const layoutKey = `${position}|${sidebarOpen}|${compact}|${sidebarOverlay}`;
    const resizeOnly = layoutKey === lastLayoutKeyRef.current;
    const firstLayout = lastLayoutKeyRef.current === '';
    lastLayoutKeyRef.current = layoutKey;

    if (firstLayout || resizeOnly) {
      // Initial mount or viewport resize: settle instantly, no morph.
      gsap.set(container, { left: target.left, bottom: target.bottom, width: target.width });
      dockProgressRef.current.p = target.dock;
      return;
    }

    const docking = target.dock !== dockProgressRef.current.p;
    const duration = docking
      ? target.dock === 1 ? morph.dockDuration : morph.undockDuration
      : morph.pillRelocateDuration;
    const ease = docking
      ? target.dock === 1 ? morph.dockEase : morph.undockEase
      : morph.pillRelocateEase;

    const tl = gsap.timeline();
    layoutTimelineRef.current = tl;
    tl.to(container, { left: target.left, bottom: target.bottom, width: target.width, duration, ease }, 0)
      .to(dockProgressRef.current, { p: target.dock, duration, ease }, 0);

    return () => {
      tl.kill();
    };
  }, [position, sidebarOpen, compact, sidebarOverlay, viewport, dims, visualConfig]);

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
          await connectWithContinuity({ audioInput: false });
        }
        await sendMessage(text);
        onTextSubmit?.(text);

        setInputValue('');
        setHasInteracted(true);

        // Open the sidebar so the transcript (and the incoming reply) is visible.
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
    if (expandOnFocus && mode === 'pill' && chatMessages.length > 0) {
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
    if (accessLevel !== 'no_access') {
      setIsVisible(true);
    }
  }, [accessLevel, session]);

  // Handle voice toggle with real voice system - connect only when user clicks
  const handleVoiceToggle = async () => {
    // Check access level
    if (!isFeatureEnabled('voice_ai')) {
      setShowAccessMessage(true);
      return;
    }

    try {
      if (isListening) {
        // Stop listening (mute microphone)
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
        await connectWithContinuity({ audioInput: true });
      }
      // If the session is text-only, startAudioInput performs the mic upgrade (reconnect)
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

  /** Hang up: end the live session (the transcript stays readable in the sidebar). */
  const handleHangUp = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Hang up failed:', error);
    }
  };

  // Handle audio controls
  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
  };

  const toggleSidebar = () => {
    onModeChange?.(mode === 'expanded' ? 'pill' : 'expanded');
    setHasInteracted(true);
  };

  // Sidebar reserves room for the relocated pill at its foot.
  const pillDockHeight = useMemo(
    () => dims.height + 2 * dims.bleedTop + 24,
    [dims.height, dims.bleedTop]
  );

  // Don't render if access level is 'no_access'
  if (accessLevel === 'no_access') {
    return null;
  }

  return (
    <>
      {/* The page breathes while the agent speaks (task 3.6) */}
      <AmbientSpeechGlow speaking={isSpeaking && audioEnabled} />

      {/* Transcript sidebar (task 3.4) — an AI surface above modals */}
      <TranscriptSidebar
        open={sidebarOpen}
        onClose={() => onModeChange?.('pill')}
        messages={chatMessages}
        compact={sidebarOverlay}
        pillDockHeight={pillDockHeight}
      />

      {/* Job-description intake modal (Req 13.4, G3): opened by the
          job_description_form client tool; delivery-menu choices speak
          through the conversation as visitor turns. Sibling of the pill so
          its fixed overlay is viewport-scoped, on the AI overlay layer. */}
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

      {/* Access Message Modal (AI overlay layer) */}
      <AnimatePresence>
        {showAccessMessage && accessMessage && (
          <motion.div
            key="access-message"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center"
            style={{ zIndex: visualConfig.zLayers.aiOverlay }}
            onClick={() => setShowAccessMessage(false)}
            data-ai-surface="true"
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

      <AnimatePresence>
        {isVisible && (
          <div
            ref={containerRef}
            className={cn('fixed', className)}
            // transition: none — the container's geometry (left/bottom/width)
            // is GSAP-owned; a stray CSS transition would chase every write.
            style={{ zIndex: visualConfig.zLayers.aiPill, transition: 'none' }}
            role="complementary"
            aria-label={ariaLabel}
            data-ai-surface="true"
            data-testid="ai-pill-root"
          >
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

            {/* Engine chips (Req 13.1, G1): float aesthetically above the input
                section — they animate outwards from it on entry and never move
                once shown. Owner-authored per node; hidden when no graph steers. */}
            {effectiveUx && effectiveUx.chips.length > 0 && (
              <div className="mb-2">
                <EngineChipsRow ux={effectiveUx} onChipTap={handleChipTap} disabled={chipsBusy || publicBusy} />
              </div>
            )}

            {/* The pill (tasks 3.1/3.6): capsule afloat, tab foot when docked */}
            <PillShell
              agentState={agentVisualState}
              getDockProgress={getDockProgress}
              compact={compact}
            >
              {/* Returning-visitor resume (Block I3): confirm on a new device
                  (explicit choice + safe summary, Req 21.1), subtle notice on a
                  same-device auto-resume. Gone after any conversation starts. */}
              {resumeOffer && !isConnected && chatMessages.length === 0 && (
                resumeOffer.mode === 'confirm' ? (
                  <div
                    className="mx-4 mt-1 mb-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
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
                    className="mx-4 mt-1 mb-2 px-4 py-2 text-xs text-muted-foreground"
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
                  className="mx-4 mt-1 mb-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
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
              <div className={cn('pt-1 -mb-1 min-h-0', compact ? 'px-4' : 'px-5')}>
                <EngineTopicLabel label={effectiveUx?.topicLabel ?? null} />
              </div>

              {/* Main Input Row */}
              <div className={cn('flex items-center', compact ? 'gap-2 px-3 py-2.5' : 'gap-3 px-5 py-3.5')}>
                {/* Text Input */}
                <div className="flex-1 min-w-0">
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
                    className={cn(
                      'w-full bg-transparent border-none text-foreground placeholder-muted-foreground focus:outline-none resize-none',
                      compact ? 'text-base' : 'text-lg'
                    )}
                    disabled={isProcessing}
                  />
                </div>

                {/* Status Indicators */}
                <div className={cn('flex items-center', compact ? 'gap-1.5' : 'gap-2.5')}>
                  {(publicBusy || chipsBusy) && (
                    <div className="flex items-center gap-1.5 text-primary" data-testid="thinking-indicator">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  )}

                  {isSpeaking && (
                    <div className="flex items-center gap-1.5 text-primary" data-testid="speaking-indicator">
                      <Volume2 size={13} className="animate-pulse" />
                      {!compact && <span className="text-xs">Speaking</span>}
                    </div>
                  )}

                  {/* Subtle listening indicator - no modal needed for WebRTC */}
                  {isListening && voiceSupported && (
                    <div className="flex items-center gap-1.5 text-green-500">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      {!compact && <span className="text-xs">Listening</span>}
                    </div>
                  )}

                  {/* Audio Control */}
                  <button
                    onClick={toggleAudio}
                    className={cn(
                      'p-2 rounded-full transition-all duration-200',
                      audioEnabled ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted/10'
                    )}
                    title={audioEnabled ? 'Sound on' : 'Sound off'}
                  >
                    {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
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

                  {/* Settings Button */}
                  {onSettingsClick && !compact && (
                    <button
                      onClick={onSettingsClick}
                      className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-all duration-200"
                      title="Settings"
                    >
                      <Settings size={16} />
                    </button>
                  )}

                  {/* History affordance (task 3.4): the recognizable speech-boxes icon */}
                  <button
                    onClick={toggleSidebar}
                    className={cn(
                      'relative p-2 rounded-full transition-all duration-200',
                      sidebarOpen
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/10'
                    )}
                    title={sidebarOpen ? 'Close conversation history' : 'Show conversation history'}
                    aria-label={sidebarOpen ? 'Close conversation history' : 'Show conversation history'}
                    aria-expanded={sidebarOpen}
                    data-testid="history-toggle"
                  >
                    <MessagesSquare size={16} />
                    {chatMessages.length > 0 && !sidebarOpen && (
                      <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-primary rounded-full" />
                    )}
                  </button>

                  {/* Hang-up (task 3.4): visible while a live session is open */}
                  {isConnected && (
                    <button
                      onClick={handleHangUp}
                      className="p-2 rounded-full text-red-500 hover:bg-red-500/10 transition-all duration-200"
                      title="End conversation session"
                      aria-label="End conversation session"
                      data-testid="hang-up"
                    >
                      <PhoneOff size={16} />
                    </button>
                  )}
                </div>

                {/* Text-only session indicator */}
                {isConnected && audioInputMode === 'text-only' && !compact && (
                  <div
                    className="text-xs text-muted-foreground bg-muted/20 px-2 py-1 rounded-full"
                    title="Connected without microphone — type to chat, or use the mic button to enable voice"
                    data-testid="text-only-indicator"
                  >
                    Text-only
                  </div>
                )}

                {/* Voice Input Button */}
                <motion.button
                  onClick={handleVoiceToggle}
                  whileHover={{ scale: voiceSupported ? 1.05 : 1 }}
                  whileTap={{ scale: voiceSupported ? 0.95 : 1 }}
                  className={cn(
                    'relative rounded-full flex items-center justify-center transition-colors duration-300 shadow-lg flex-shrink-0',
                    compact ? 'w-10 h-10' : 'w-12 h-12',
                    !voiceSupported
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : isListening
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-primary hover:bg-primary/90'
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

              {/* Budget status for premium users */}
              {budgetStatus && !budgetStatus.isExhausted && !compact && (
                <div className="px-5 pb-1.5 -mt-1 text-right text-[10px] text-muted-foreground/70">
                  ${budgetStatus.spendRemaining.toFixed(2)} left
                </div>
              )}
            </PillShell>

            {/* Enticing animation hints */}
            <AnimatePresence>
              {!hasInteracted && (
                <motion.div
                  key="interaction-hint"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: 3, duration: 0.8 }}
                  className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center"
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
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// Export default for easier imports
export default FloatingAIInterface;
