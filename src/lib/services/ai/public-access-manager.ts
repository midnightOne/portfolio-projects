/**
 * Public access control manager for AI assistant
 * Handles public AI access settings and feature availability
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type AccessLevel = 'no_access' | 'basic' | 'limited' | 'premium';
export type AIFeature = 'chat_interface' | 'voice_ai' | 'job_analysis' | 'advanced_navigation' | 'file_upload';

export interface PublicAccessSettings {
  publicAIAccess: 'disabled' | 'basic_only' | 'limited_features';
  basicAccessDailyLimit: number;
  limitedAccessDailyLimit: number;
  
  // Feature-specific controls
  allowPublicVoice: boolean;
  allowPublicJobAnalysis: boolean;
  allowPublicAdvancedNav: boolean;
  
  // Messaging customization
  disabledMessage: string;
  basicAccessMessage: string;
  limitedAccessMessage: string;
  upgradePromptMessage: string;
}

export interface FeatureAvailability {
  chatInterface: boolean;
  voiceAI: boolean;
  jobAnalysis: boolean;
  advancedNavigation: boolean;
  fileUpload: boolean;
  dailyLimit: number;
}

export interface AccessMessage {
  title: string;
  description: string;
  actionText?: string;
  actionUrl?: string;
}

export interface UpgradeMessage {
  feature: string;
  message: string;
  contactInfo: string;
}

export class PublicAccessManager {
  private static readonly DEFAULT_SETTINGS: PublicAccessSettings = {
    publicAIAccess: 'disabled', // Enable limited features for testing
    basicAccessDailyLimit: 5,
    limitedAccessDailyLimit: 20,
    allowPublicVoice: false, // Enable voice AI for testing
    allowPublicJobAnalysis: false,
    allowPublicAdvancedNav: false, // Enable advanced navigation for testing
    disabledMessage: 'AI assistant is available by invitation only. Contact me for access.',
    basicAccessMessage: 'You have basic AI access with limited daily usage.',
    limitedAccessMessage: 'You have limited AI access. Some premium features require an invitation.',
    upgradePromptMessage: 'Contact me for enhanced AI features and higher usage limits.',
  };

  /**
   * Get current public access settings
   */
  async getPublicAccessSettings(): Promise<PublicAccessSettings> {
    try {
      // For now, we'll store settings in a simple JSON config
      // In a production system, this would be in the database
      const settings = await this.loadSettingsFromDatabase();
      return { ...PublicAccessManager.DEFAULT_SETTINGS, ...settings };
    } catch (error) {
      console.error('Failed to get public access settings:', error);
      return PublicAccessManager.DEFAULT_SETTINGS;
    }
  }

  /**
   * Update public access settings
   */
  async updatePublicAccessSettings(settings: Partial<PublicAccessSettings>): Promise<void> {
    try {
      await this.saveSettingsToDatabase(settings);
    } catch (error) {
      console.error('Failed to update public access settings:', error);
      throw new Error('Failed to update public access settings');
    }
  }

  /**
   * Determine access level based on reflink status
   */
  determineAccessLevel(hasReflink: boolean, reflinkValid: boolean): AccessLevel {
    if (hasReflink && reflinkValid) {
      return 'premium';
    }

    // For public users, check settings
    // This will be implemented when we have the settings loaded
    return 'no_access'; // Default for now
  }

  /**
   * Determine access level for public users based on settings
   */
  async determinePublicAccessLevel(): Promise<AccessLevel> {
    const settings = await this.getPublicAccessSettings();
    
    switch (settings.publicAIAccess) {
      case 'disabled':
        return 'no_access';
      case 'basic_only':
        return 'basic';
      case 'limited_features':
        return 'limited';
      default:
        return 'no_access';
    }
  }

  /**
   * Get feature availability for access level
   */
  async getFeatureAvailability(accessLevel: AccessLevel): Promise<FeatureAvailability> {
    const settings = await this.getPublicAccessSettings();

    switch (accessLevel) {
      case 'no_access':
        return {
          chatInterface: false,
          voiceAI: false,
          jobAnalysis: false,
          advancedNavigation: false,
          fileUpload: false,
          dailyLimit: 0,
        };

      case 'basic':
        return {
          chatInterface: true,
          voiceAI: false,
          jobAnalysis: false,
          advancedNavigation: false,
          fileUpload: false,
          dailyLimit: settings.basicAccessDailyLimit,
        };

      case 'limited':
        return {
          chatInterface: true,
          voiceAI: settings.allowPublicVoice,
          jobAnalysis: settings.allowPublicJobAnalysis,
          advancedNavigation: settings.allowPublicAdvancedNav,
          fileUpload: settings.allowPublicJobAnalysis, // Tied to job analysis
          dailyLimit: settings.limitedAccessDailyLimit,
        };

      case 'premium':
        return {
          chatInterface: true,
          voiceAI: true,
          jobAnalysis: true,
          advancedNavigation: true,
          fileUpload: true,
          dailyLimit: -1, // Unlimited (budget-based)
        };

      default:
        return this.getFeatureAvailability('no_access');
    }
  }

  /**
   * Get access level message
   */
  async getAccessLevelMessage(accessLevel: AccessLevel): Promise<AccessMessage> {
    const settings = await this.getPublicAccessSettings();

    switch (accessLevel) {
      case 'no_access':
        return {
          title: 'AI Assistant Unavailable',
          description: settings.disabledMessage,
          actionText: 'Contact for Access',
          actionUrl: '/contact',
        };

      case 'basic':
        return {
          title: 'Basic AI Access',
          description: settings.basicAccessMessage,
          actionText: 'Upgrade Access',
          actionUrl: '/contact',
        };

      case 'limited':
        return {
          title: 'Limited AI Access',
          description: settings.limitedAccessMessage,
          actionText: 'Get Full Access',
          actionUrl: '/contact',
        };

      case 'premium':
        return {
          title: 'Premium AI Access',
          description: 'You have full access to all AI features.',
        };

      default:
        return this.getAccessLevelMessage('no_access');
    }
  }

  /**
   * Get upgrade message for requested feature
   */
  async getUpgradeMessage(requestedFeature: AIFeature): Promise<UpgradeMessage> {
    const settings = await this.getPublicAccessSettings();
    
    const featureNames: Record<AIFeature, string> = {
      chat_interface: 'AI Chat',
      voice_ai: 'Voice AI',
      job_analysis: 'Job Analysis',
      advanced_navigation: 'Advanced Navigation',
      file_upload: 'File Upload',
    };

    return {
      feature: featureNames[requestedFeature],
      message: `${featureNames[requestedFeature]} requires an invitation code. ${settings.upgradePromptMessage}`,
      contactInfo: 'Contact me for enhanced AI features and higher usage limits.',
    };
  }

  /**
   * Check if feature is available for access level
   */
  async isFeatureAvailable(accessLevel: AccessLevel, feature: AIFeature): Promise<boolean> {
    const availability = await this.getFeatureAvailability(accessLevel);
    
    switch (feature) {
      case 'chat_interface':
        return availability.chatInterface;
      case 'voice_ai':
        return availability.voiceAI;
      case 'job_analysis':
        return availability.jobAnalysis;
      case 'advanced_navigation':
        return availability.advancedNavigation;
      case 'file_upload':
        return availability.fileUpload;
      default:
        return false;
    }
  }

  /**
   * Load settings from the DB-backed AIPublicAccessSettings row (D31 — replaces the
   * old JSON-config placeholder). `text_chat` maps to the legacy 'basic_only' shape
   * this manager's consumers understand: chat only, no voice/job-analysis/uploads.
   */
  private async loadSettingsFromDatabase(): Promise<Partial<PublicAccessSettings>> {
    const row = await prisma.aIPublicAccessSettings.findUnique({ where: { id: 'public' } });
    if (!row) {
      // Fail closed: without the settings row the public tier stays disabled.
      console.error('AIPublicAccessSettings row missing — public AI disabled (run the seed)');
      return { publicAIAccess: 'disabled' };
    }
    return {
      publicAIAccess: row.publicTier === 'text_chat' ? 'basic_only' : 'disabled',
      basicAccessDailyLimit: row.messagesPerDay,
    };
  }

  /**
   * Save settings to the AIPublicAccessSettings row. Only the fields this legacy
   * interface knows about are persisted; the Access & Spend panel edits the row
   * directly via /api/admin/ai/public-access-settings.
   */
  private async saveSettingsToDatabase(settings: Partial<PublicAccessSettings>): Promise<void> {
    const data: Record<string, unknown> = {};
    if (settings.publicAIAccess !== undefined) {
      data.publicTier = settings.publicAIAccess === 'disabled' ? 'disabled' : 'text_chat';
    }
    if (typeof settings.basicAccessDailyLimit === 'number') {
      data.messagesPerDay = settings.basicAccessDailyLimit;
    }
    if (Object.keys(data).length === 0) return;
    await prisma.aIPublicAccessSettings.update({ where: { id: 'public' }, data });
  }
}

// Export singleton instance
export const publicAccessManager = new PublicAccessManager();