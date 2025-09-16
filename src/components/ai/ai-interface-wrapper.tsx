"use client";

import React, { useState, useEffect } from 'react';
import { FloatingAIInterface, QuickAction } from './floating-ai-interface';
import { ConversationalAgentProvider } from '@/components/providers/conversational-agent-provider';
import { ReflinkSessionProvider } from '@/components/providers/reflink-session-provider';

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
    </ReflinkSessionProvider>
  );
}

export default AIInterfaceWrapper;