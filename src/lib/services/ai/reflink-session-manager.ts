/**
 * Reflink session management service
 * Handles reflink detection, validation, and session management
 */

import { reflinkManager } from './reflink-manager';
import {
  ReflinkValidationResult,
  BudgetStatus,
  ReflinkInfo,
} from '@/lib/types/rate-limiting';
import { PersonalizedContext } from '@/lib/types/reflink-session';

export type AccessLevel = 'no_access' | 'basic' | 'limited' | 'premium';
export type AIFeature = 'chat_interface' | 'voice_ai' | 'job_analysis' | 'advanced_navigation' | 'file_upload';

export interface ReflinkSession {
  reflink: ReflinkInfo;
  accessLevel: AccessLevel;
  personalizedContext: PersonalizedContext;
  budgetStatus: BudgetStatus;
  sessionStartTime: Date;
}

export class ReflinkSessionManager {
  /**
   * Detect reflink code from URL
   */
  detectReflinkFromURL(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('ref');
    } catch {
      return null;
    }
  }

  /**
   * Initialize reflink session
   */
  async initializeReflinkSession(reflinkCode: string): Promise<ReflinkSession | null> {
    try {
      const validation = await reflinkManager.validateReflinkWithBudget(reflinkCode);
      
      if (!validation.valid || !validation.reflink) {
        return null;
      }

      const personalizedContext: PersonalizedContext = {
        recipientName: validation.reflink.recipientName,
        customNotes: validation.reflink.customContext,
        conversationStarters: this.generateConversationStarters(validation.reflink),
        emphasizedTopics: this.extractEmphasizedTopics(validation.reflink.customContext),
      };

      return {
        reflink: validation.reflink,
        accessLevel: 'premium',
        personalizedContext,
        budgetStatus: validation.budgetStatus!,
        sessionStartTime: new Date(),
      };
    } catch (error) {
      console.error('Failed to initialize reflink session:', error);
      return null;
    }
  }

  /**
   * Check if a feature is enabled for the reflink
   */
  isFeatureEnabled(reflink: ReflinkInfo, feature: AIFeature): boolean {
    switch (feature) {
      case 'chat_interface':
        return true; // Always enabled for valid reflinks
      case 'voice_ai':
        return reflink.enableVoiceAI;
      case 'job_analysis':
        return reflink.enableJobAnalysis;
      case 'advanced_navigation':
        return reflink.enableAdvancedNavigation;
      case 'file_upload':
        return reflink.enableJobAnalysis; // File upload tied to job analysis
      default:
        return false;
    }
  }

  /**
   * Get personalized welcome message
   */
  getWelcomeMessage(reflink: ReflinkInfo): string {
    const name = reflink.recipientName || 'there';
    const context = reflink.customContext ? ` ${reflink.customContext}` : '';
    
    return `Hello ${name}! You have special access to enhanced AI features.`; //removed ${context} as it is private
  }

  /**
   * Check budget status and return appropriate message
   */
  getBudgetStatusMessage(budgetStatus: BudgetStatus): string | null {
    if (budgetStatus.isExhausted) {
      return "Your AI assistant budget has been exhausted. Please contact me for renewal.";
    }
    
    if (budgetStatus.spendRemaining < 5) {
      return `You have $${budgetStatus.spendRemaining.toFixed(2)} remaining in your AI assistant budget.`;
    }
    
    return null;
  }

  /**
   * Generate conversation starters based on reflink context
   */
  private generateConversationStarters(reflink: ReflinkInfo): string[] {
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
      // Add context-specific starters based on keywords
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
  private extractEmphasizedTopics(customContext?: string): string[] {
    if (!customContext) return [];

    const topics: string[] = [];
    const context = customContext.toLowerCase();

    // Extract common topics
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
}

// Export singleton instance
export const reflinkSessionManager = new ReflinkSessionManager();