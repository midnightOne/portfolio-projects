"use client";

import React, { useState, useEffect } from 'react';
import { FloatingAIInterface } from './floating-ai-interface';
import { ConversationalAgentProvider } from '@/components/providers/conversational-agent-provider';
import { ReflinkSessionProvider } from '@/components/providers/reflink-session-wrapper';
import { useReflinkSession } from '@/components/providers/reflink-session-provider';
import { HomepageDevVoicePanel } from './HomepageDevVoicePanel';

interface AIInterfaceWrapperProps {
  /** Explicit override; when omitted the admin-configured site default is fetched. */
  defaultProvider?: 'openai' | 'google' | 'cascade';
  className?: string;
  onSettingsClick?: () => void;
  /** Dev-only fake-mic drill affordance, admin-gated server-side (owner, 2026-07-07). */
  isAdmin?: boolean;
}

export function AIInterfaceWrapper({
  defaultProvider: defaultProviderProp,
  className,
  onSettingsClick,
  isAdmin = false
}: AIInterfaceWrapperProps) {
  // Site default voice provider (admin-set, AIPublicAccessSettings). An explicit
  // prop wins; otherwise fetched once at mount with 'openai' as the fallback.
  const [defaultProvider, setDefaultProvider] = useState<'openai' | 'google' | 'cascade'>(
    defaultProviderProp ?? 'openai'
  );
  // The adapter initializes ONCE (ConversationalAgentProvider ignores later
  // defaultProvider changes), so hold rendering until the site default is known.
  const [providerResolved, setProviderResolved] = useState(!!defaultProviderProp);
  useEffect(() => {
    if (defaultProviderProp) return;
    let cancelled = false;
    fetch('/api/ai/voice-config')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.success && ['openai', 'google', 'cascade'].includes(data.defaultProvider)) {
          setDefaultProvider(data.defaultProvider);
        }
      })
      .catch(() => { /* keep fallback */ })
      .finally(() => { if (!cancelled) setProviderResolved(true); });
    return () => { cancelled = true; };
  }, [defaultProviderProp]);

  // Debug: Log wrapper creation to detect multiple instances
  useEffect(() => {
    console.log('AIInterfaceWrapper mounted with provider:', defaultProvider);
    return () => {
      console.log('AIInterfaceWrapper unmounted');
    };
  }, [defaultProvider]);
  
  // Interface state
  const [position, setPosition] = useState<'hero' | 'pinned'>('hero');
  const [mode, setMode] = useState<'pill' | 'expanded'>('pill');
  const [currentNarration, setCurrentNarration] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | undefined>(undefined);
  const [isVisible, setIsVisible] = useState(false); // Start hidden by default

  // Create audio element on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio();
      audio.preload = 'none';
      setAudioElement(audio);
      
      return () => {
        audio.pause();
        audio.src = '';
      };
    }
  }, []);

  // Handle scroll-based position changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const windowHeight = window.innerHeight;
          
          // Switch to pinned when scrolled past hero section
          if (scrollY > windowHeight * 0.5 && position === 'hero') {
            setPosition('pinned');
          } else if (scrollY <= windowHeight * 0.3 && position === 'pinned') {
            setPosition('hero');
          }
          
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [position]);

  // Handle text submission
  const handleTextSubmit = (text: string) => {
    console.log('Text submitted:', text);
    // This will be handled by the voice system when connected
    // For now, just log it
  };

  // Handle settings click
  const handleSettingsClick = () => {
    if (onSettingsClick) {
      onSettingsClick();
    } else {
      console.log('Settings clicked - no handler provided');
    }
  };

  if (!providerResolved) {
    return null; // one fetch, ~ms — the pill is invisible during session load anyway
  }

  return (
    <ReflinkSessionProvider>
      <AIInterfaceContent
        defaultProvider={defaultProvider}
        audioElement={audioElement}
        position={position}
        setPosition={setPosition}
        mode={mode}
        setMode={setMode}
        currentNarration={currentNarration}
        isVisible={isVisible}
        setIsVisible={setIsVisible}
        handleTextSubmit={handleTextSubmit}
        handleSettingsClick={handleSettingsClick}
        className={className}
        isAdmin={isAdmin}
      />
    </ReflinkSessionProvider>
  );
}

// Separate component to access reflink context
interface AIInterfaceContentProps {
  defaultProvider: 'openai' | 'google' | 'cascade';
  audioElement: HTMLAudioElement | undefined;
  position: 'hero' | 'pinned';
  setPosition: (position: 'hero' | 'pinned') => void;
  mode: 'pill' | 'expanded';
  setMode: (mode: 'pill' | 'expanded') => void;
  currentNarration: string | null;
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  handleTextSubmit: (text: string) => void;
  handleSettingsClick: () => void;
  className?: string;
  isAdmin?: boolean;
}

function AIInterfaceContent({
  defaultProvider,
  audioElement,
  position,
  setPosition,
  mode,
  setMode,
  currentNarration,
  isVisible,
  setIsVisible,
  handleTextSubmit,
  handleSettingsClick,
  className,
  isAdmin = false
}: AIInterfaceContentProps) {
  const { session, accessLevel, isLoading } = useReflinkSession();

  // The pill is visible to everyone with any access (D31): reflink holders get the
  // full feature set; anonymous visitors get the public text-chat tier. Only
  // 'no_access' (public tier disabled or settings unreadable) hides it.
  useEffect(() => {
    if (!isLoading) {
      setIsVisible(accessLevel !== 'no_access');
    }
  }, [session, accessLevel, isLoading, setIsVisible]);

  // Don't render anything while loading or if not visible
  if (isLoading || !isVisible) {
    return null;
  }

  return (
    <ConversationalAgentProvider 
      defaultProvider={defaultProvider}
      audioElement={audioElement}
    >
      <FloatingAIInterface
        position={position}
        onPositionChange={setPosition}
        mode={mode}
        onModeChange={setMode}
        currentNarration={currentNarration ?? undefined}
        placeholder="Ask me about my work..."
        onTextSubmit={handleTextSubmit}
        onSettingsClick={handleSettingsClick}
        theme="default"
        size="md"
        hideOnScroll={false}
        animationDuration={700}
        className={className}
      />
      {isAdmin && <HomepageDevVoicePanel />}
    </ConversationalAgentProvider>
  );
}

export default AIInterfaceWrapper;