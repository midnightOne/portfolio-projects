"use client";

import React, { useState, useEffect } from 'react';
import { FloatingAIInterface, QuickAction } from './floating-ai-interface';
import { ConversationalAgentProvider } from '@/components/providers/conversational-agent-provider';
import { ReflinkSessionProvider, useReflinkSession } from '@/components/providers/reflink-session-provider';

interface AIInterfaceWrapperProps {
  // Optional props to override defaults
  defaultProvider?: 'openai' | 'elevenlabs';
  className?: string;
  onSettingsClick?: () => void;
}

export function AIInterfaceWrapper({ 
  defaultProvider = 'openai',
  className,
  onSettingsClick 
}: AIInterfaceWrapperProps) {
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

  // Handle quick actions
  const handleQuickAction = (action: QuickAction) => {
    console.log('Quick action triggered:', action);
    
    // Set narration based on action
    if (action.command) {
      setCurrentNarration(`Processing: ${action.label}`);
      
      // Clear narration after a delay
      setTimeout(() => {
        setCurrentNarration(null);
      }, 3000);
    }
  };

  // Handle settings click
  const handleSettingsClick = () => {
    if (onSettingsClick) {
      onSettingsClick();
    } else {
      console.log('Settings clicked - no handler provided');
    }
  };

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
        handleQuickAction={handleQuickAction}
        handleSettingsClick={handleSettingsClick}
        className={className}
      />
    </ReflinkSessionProvider>
  );
}

// Separate component to access reflink context
interface AIInterfaceContentProps {
  defaultProvider: 'openai' | 'elevenlabs';
  audioElement: HTMLAudioElement | undefined;
  position: 'hero' | 'pinned';
  setPosition: (position: 'hero' | 'pinned') => void;
  mode: 'pill' | 'expanded';
  setMode: (mode: 'pill' | 'expanded') => void;
  currentNarration: string | null;
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  handleTextSubmit: (text: string) => void;
  handleQuickAction: (action: QuickAction) => void;
  handleSettingsClick: () => void;
  className?: string;
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
  handleQuickAction,
  handleSettingsClick,
  className
}: AIInterfaceContentProps) {
  const { session, accessLevel, isLoading } = useReflinkSession();

  // Show interface when reflink is valid
  useEffect(() => {
    if (!isLoading) {
      // Show interface if there's a valid reflink session
      if (session?.reflink && accessLevel !== 'no_access') {
        setIsVisible(true);
      } else {
        // Keep hidden for public access
        setIsVisible(false);
      }
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
        currentNarration={currentNarration}
        placeholder="Ask me about my work..."
        onTextSubmit={handleTextSubmit}
        onQuickAction={handleQuickAction}
        onSettingsClick={handleSettingsClick}
        showQuickActions={true}
        theme="default"
        size="md"
        hideOnScroll={false}
        animationDuration={700}
        className={className}
      />
    </ConversationalAgentProvider>
  );
}

export default AIInterfaceWrapper;