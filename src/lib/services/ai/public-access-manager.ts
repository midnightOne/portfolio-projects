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
    publicAIAccess: 'disabled',
    basicAccessDailyLimit: 5,
    limitedAccessDailyLimit: 20,
    allowPublicVoice: false,
    allowPublicJobAnalysis: false,
    allowPublicAdvancedNav: false,
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
   * Load settings from database (placeholder implementation)
   */
  private async loadSettingsFromDatabase(): Promise<Partial<PublicAccessSettings>> {
    try {
      // For now, we'll use a simple approach
      // In the future, this could be stored in a dedicated settings table
      const generalSettings = await prisma.aIGeneralSettings.findFirst();
      
      if (generalSettings) {
        // Extract public access settings from general settings if they exist
        // This is a placeholder - in production we'd have a dedicated table
        return {};
      }
      
      return {};
    } catch (error) {
      console.error('Failed to load settings from database:', error);
      return {};
    }
  }

  /**
   * Save settings to database (placeholder implementation)
   */
  private async saveSettingsToDatabase(settings: Partial<PublicAccessSettings>): Promise<void> {
    try {
      // For now, this is a placeholder
      // In production, we'd save to a dedicated settings table
      console.log('Saving public access settings:', settings);
    } catch (error) {
      console.error('Failed to save settings to database:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const publicAccessManager = new PublicAccessManager();