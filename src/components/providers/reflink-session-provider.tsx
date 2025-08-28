"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  AccessLevel, 
  AIFeature, 
  ReflinkSession,
  PersonalizedContext,
  BudgetStatus,
  FeatureAvailability,
  AccessMessage,
  UpgradeMessage
} from '@/lib/types/reflink-session';

interface ReflinkSessionContextType {
  // Session state
  isLoading: boolean;
  session: ReflinkSession | null;
  accessLevel: AccessLevel;
  
  // Feature availability
  featureAvailability: FeatureAvailability | null;
  isFeatureEnabled: (feature: AIFeature) => boolean;
  
  // Messages and context
  welcomeMessage: string | null;
  accessMessage: AccessMessage | null;
  personalizedContext: PersonalizedContext | null;
  budgetStatus: BudgetStatus | null;
  
  // Actions
  refreshSession: () => Promise<void>;
  getUpgradeMessage: (feature: AIFeature) => Promise<UpgradeMessage>;
  
  // Budget monitoring
  checkBudgetStatus: () => Promise<BudgetStatus | null>;
  onBudgetExhausted: (callback: () => void) => void;
}

const ReflinkSessionContext = createContext<ReflinkSessionContextType | undefined>(undefined);

interface ReflinkSessionProviderProps {
  children: ReactNode;
}

export function ReflinkSessionProvider({ children }: ReflinkSessionProviderProps) {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<ReflinkSession | null>(null);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('no_access');
  const [featureAvailability, setFeatureAvailability] = useState<FeatureAvailability | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState<AccessMessage | null>(null);
  const [personalizedContext, setPersonalizedContext] = useState<PersonalizedContext | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [budgetExhaustedCallbacks, setBudgetExhaustedCallbacks] = useState<(() => void)[]>([]);

  // Initialize session on mount and when URL changes
  useEffect(() => {
    // Only initialize on client side to avoid SSR issues
    if (typeof window !== 'undefined') {
      initializeSession();
    }
  }, [searchParams]);

  // Periodic budget checking for premium users
  useEffect(() => {
    if (session?.reflink && accessLevel === 'premium') {
      const interval = setInterval(() => {
        checkBudgetStatus();
      }, 30000); // Check every 30 seconds

      return () => clearInterval(interval);
    }
  }, [session, accessLevel]);

  /**
   * Initialize reflink session
   */
  const initializeSession = async () => {
    setIsLoading(true);
    
    try {
      // Check for reflink in URL - handle both SSR and client-side
      const reflinkCode = typeof window !== 'undefined' ? 
        new URLSearchParams(window.location.search).get('ref') : 
        searchParams?.get('ref');
      
      if (reflinkCode) {
        await initializeReflinkSession(reflinkCode);
      } else {
        await initializePublicSession();
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
      await initializePublicSession();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Initialize session with reflink
   */
  const initializeReflinkSession = async (reflinkCode: string) => {
    try {
      // Store reflink in session storage for persistence
      sessionStorage.setItem('ai_reflink_code', reflinkCode);
      
      const response = await fetch('/api/ai/reflink/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: reflinkCode }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate reflink');
      }

      const validation = await response.json();

      if (validation.valid && validation.reflink) {
        const reflinkSession: ReflinkSession = {
          reflink: validation.reflink,
          accessLevel: 'premium',
          personalizedContext: {
            recipientName: validation.reflink.recipientName,
            customNotes: validation.reflink.customContext,
            conversationStarters: generateConversationStarters(validation.reflink),
            emphasizedTopics: extractEmphasizedTopics(validation.reflink.customContext),
          },
          budgetStatus: validation.budgetStatus,
          sessionStartTime: new Date(),
        };

        setSession(reflinkSession);
        setAccessLevel('premium');
        setPersonalizedContext(reflinkSession.personalizedContext);
        setBudgetStatus(validation.budgetStatus);
        setWelcomeMessage(validation.welcomeMessage || generateWelcomeMessage(validation.reflink));
        
        // Get feature availability for premium access
        await loadFeatureAvailability('premium');
        
        // Store session in sessionStorage for persistence
        sessionStorage.setItem('ai_reflink_session', JSON.stringify(reflinkSession));
      } else {
        // Invalid reflink - show appropriate message and fall back to public access
        await handleInvalidReflink(validation.reason);
      }
    } catch (error) {
      console.error('Failed to initialize reflink session:', error);
      await initializePublicSession();
    }
  };

  /**
   * Initialize public session (no reflink)
   */
  const initializePublicSession = async () => {
    try {
      // Clear any stored reflink data
      sessionStorage.removeItem('ai_reflink_code');
      sessionStorage.removeItem('ai_reflink_session');
      
      // Check for existing session in sessionStorage
      const storedSession = sessionStorage.getItem('ai_public_session');
      if (storedSession) {
        try {
          const parsedSession = JSON.parse(storedSession);
          setAccessLevel(parsedSession.accessLevel || 'no_access');
          await loadFeatureAvailability(parsedSession.accessLevel || 'no_access');
          return;
        } catch (error) {
          console.error('Failed to parse stored session:', error);
        }
      }

      // Get public access level from server
      const response = await fetch('/api/ai/public-access');
      if (!response.ok) {
        throw new Error('Failed to get public access settings');
      }

      const { accessLevel: publicAccessLevel, accessMessage: message } = await response.json();
      
      setAccessLevel(publicAccessLevel);
      setAccessMessage(message);
      await loadFeatureAvailability(publicAccessLevel);
      
      // Store public session
      const publicSession = {
        accessLevel: publicAccessLevel,
        sessionStartTime: new Date(),
      };
      sessionStorage.setItem('ai_public_session', JSON.stringify(publicSession));
      
    } catch (error) {
      console.error('Failed to initialize public session:', error);
      // Fallback to no access
      setAccessLevel('no_access');
      setAccessMessage({
        title: 'AI Assistant Unavailable',
        description: 'AI assistant is currently unavailable. Please try again later.',
      });
    }
  };

  /**
   * Handle invalid reflink
   */
  const handleInvalidReflink = async (reason?: string) => {
    let message: AccessMessage;
    
    switch (reason) {
      case 'expired':
        message = {
          title: 'Invitation Expired',
          description: 'Your AI assistant invitation has expired. Contact me to get a new one.',
          actionText: 'Contact for New Invitation',
          actionUrl: '/contact',
        };
        break;
      case 'budget_exhausted':
        message = {
          title: 'Budget Exhausted',
          description: 'Your AI assistant budget has been exhausted. Contact me for renewal.',
          actionText: 'Contact for Renewal',
          actionUrl: '/contact',
        };
        break;
      case 'inactive':
        message = {
          title: 'Invitation Inactive',
          description: 'Your AI assistant invitation is inactive. Contact me for assistance.',
          actionText: 'Contact for Help',
          actionUrl: '/contact',
        };
        break;
      default:
        message = {
          title: 'Invalid Invitation',
          description: 'The invitation code is not valid. Contact me to get a new one.',
          actionText: 'Contact for Invitation',
          actionUrl: '/contact',
        };
    }
    
    setAccessMessage(message);
    await initializePublicSession();
  };

  /**
   * Load feature availability for access level
   */
  const loadFeatureAvailability = async (level: AccessLevel) => {
    try {
      const response = await fetch(`/api/ai/feature-availability?accessLevel=${level}`);
      if (response.ok) {
        const availability = await response.json();
        setFeatureAvailability(availability);
      }
    } catch (error) {
      console.error('Failed to load feature availability:', error);
    }
  };

  /**
   * Check if feature is enabled
   */
  const isFeatureEnabled = (feature: AIFeature): boolean => {
    if (!featureAvailability) return false;
    
    switch (feature) {
      case 'chat_interface':
        return featureAvailability.chatInterface;
      case 'voice_ai':
        return featureAvailability.voiceAI;
      case 'job_analysis':
        return featureAvailability.jobAnalysis;
      case 'advanced_navigation':
        return featureAvailability.advancedNavigation;
      case 'file_upload':
        return featureAvailability.fileUpload;
      default:
        return false;
    }
  };

  /**
   * Refresh session
   */
  const refreshSession = async () => {
    await initializeSession();
  };

  /**
   * Get upgrade message for feature
   */
  const getUpgradeMessage = async (feature: AIFeature): Promise<UpgradeMessage> => {
    try {
      const response = await fetch('/api/ai/upgrade-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature }),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to get upgrade message:', error);
    }

    // Fallback message
    return {
      feature: feature.replace('_', ' '),
      message: 'This feature requires an invitation code. Contact me for access.',
      contactInfo: 'Contact me for enhanced AI features.',
    };
  };

  /**
   * Check budget status
   */
  const checkBudgetStatus = async (): Promise<BudgetStatus | null> => {
    if (!session?.reflink) return null;

    try {
      const response = await fetch(`/api/ai/reflink/budget-status?reflinkId=${session.reflink.id}`);
      if (response.ok) {
        const status = await response.json();
        setBudgetStatus(status);
        
        // Check if budget is exhausted and trigger callbacks
        if (status.isExhausted && !budgetStatus?.isExhausted) {
          budgetExhaustedCallbacks.forEach(callback => callback());
          
          // Update access level and show budget exhausted message
          setAccessLevel('no_access');
          setAccessMessage({
            title: 'Budget Exhausted',
            description: 'Your AI assistant budget has been exhausted. Contact me for renewal.',
            actionText: 'Contact for Renewal',
            actionUrl: '/contact',
          });
          
          // Clear welcome message and update feature availability
          setWelcomeMessage(null);
          await loadFeatureAvailability('no_access');
          
          console.log('Budget exhausted - access revoked');
        }
        
        return status;
      }
    } catch (error) {
      console.error('Failed to check budget status:', error);
    }

    return null;
  };

  /**
   * Register callback for budget exhausted
   */
  const onBudgetExhausted = (callback: () => void) => {
    setBudgetExhaustedCallbacks(prev => [...prev, callback]);
  };

  const contextValue: ReflinkSessionContextType = {
    isLoading,
    session,
    accessLevel,
    featureAvailability,
    isFeatureEnabled,
    welcomeMessage,
    accessMessage,
    personalizedContext,
    budgetStatus,
    refreshSession,
    getUpgradeMessage,
    checkBudgetStatus,
    onBudgetExhausted,
  };

  return (
    <ReflinkSessionContext.Provider value={contextValue}>
      {children}
    </ReflinkSessionContext.Provider>
  );
}

/**
 * Hook to use reflink session context
 */
export function useReflinkSession() {
  const context = useContext(ReflinkSessionContext);
  if (context === undefined) {
    throw new Error('useReflinkSession must be used within a ReflinkSessionProvider');
  }
  return context;
}

/**
 * Generate conversation starters based on reflink
 */
function generateConversationStarters(reflink: any): string[] {
  const starters = [
    "Tell me about your background and experience",
    "What projects are you most proud of?",
    "How can I help you today?",
  ];

  if (reflink.enableJobAnalysis) {
    starters.push("I can analyze job postings for you - just paste the job description");
  }

  if (reflink.enableVoiceAI) {
    starters.push("You can also talk to me using voice - just click the microphone");
  }

  if (reflink.customContext) {
    const context = reflink.customContext.toLowerCase();
    if (context.includes('job') || context.includes('position') || context.includes('role')) {
      starters.push("I see you're interested in job opportunities - let's discuss how my experience aligns");
    }
    if (context.includes('project') || context.includes('work')) {
      starters.push("Would you like to explore specific projects that might interest you?");
    }
  }

  return starters;
}

/**
 * Extract emphasized topics from custom context
 */
function extractEmphasizedTopics(customContext?: string): string[] {
  if (!customContext) return [];

  const topics: string[] = [];
  const context = customContext.toLowerCase();

  const topicKeywords = [
    'ai', 'machine learning', 'react', 'typescript', 'node.js', 'python',
    'frontend', 'backend', 'fullstack', 'web development', 'mobile',
    'cloud', 'aws', 'docker', 'kubernetes', 'microservices'
  ];

  topicKeywords.forEach(keyword => {
    if (context.includes(keyword)) {
      topics.push(keyword);
    }
  });

  return topics;
}

/**
 * Generate welcome message
 */
function generateWelcomeMessage(reflink: any): string {
  const name = reflink.recipientName || 'there';
  const context = reflink.customContext ? ` ${reflink.customContext}` : '';
  
  return `Hello ${name}! You have special access to enhanced AI features.${context}`;
}