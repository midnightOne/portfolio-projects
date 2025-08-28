/**
 * Public access management service
 * Handles public AI access settings and feature availability
 */

import { AccessLevel, AIFeature } from './reflink-session-manager';

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
  private defaultSettings: PublicAccessSettings = {
    publicAIAccess: 'disabled',
    basicAccessDailyLimit: 5,
    limitedAccessDailyLimit: 20,
    allowPublicVoice: false,
    allowPublicJobAnalysis: false,
    allowPublicAdvancedNav: false,
    disabledMessage: 'AI assistant is available by invitation only. Contact me for access.',
    basicAccessMessage: 'You have basic AI assistant access with limited daily usage.',
    limitedAccessMessage: 'You have limited AI assistant access. Some premium features require an invitation.',
    upgradePromptMessage: 'This feature requires premium access. Contact me for an invitation code.',
  };

  /**
   * Get public access settings (would normally come from database)
   */
  async getPublicAccessSettings(): Promise<PublicAccessSettings> {
    // In a real implementation, this would fetch from database
    // For now, return default settings
    return this.defaultSettings;
  }

  /**
   * Update public access settings
   */
  async updatePublicAccessSettings(settings: PublicAccessSettings): Promise<void> {
    // In a real implementation, this would save to database
    this.defaultSettings = { ...settings };
  }

  /**
   * Determine access level based on reflink status
   */
  determineAccessLevel(hasReflink: boolean, reflinkValid: boolean): AccessLevel {
    if (hasReflink && reflinkValid) {
      return 'premium';
    }

    const settings = this.defaultSettings;
    
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
          fileUpload: settings.allowPublicJobAnalysis,
          dailyLimit: settings.limitedAccessDailyLimit,
        };

      case 'premium':
        return {
          chatInterface: true,
          voiceAI: true,
          jobAnalysis: true,
          advancedNavigation: true,
          fileUpload: true,
          dailyLimit: -1, // Unlimited (subject to reflink budget)
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
        };

      case 'limited':
        return {
          title: 'Limited AI Access',
          description: settings.limitedAccessMessage,
          actionText: 'Get Premium Access',
          actionUrl: '/contact',
        };

      case 'premium':
        return {
          title: 'Premium AI Access',
          description: 'You have full access to all AI assistant features.',
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

    const featureNames = {
      chat_interface: 'Chat Interface',
      voice_ai: 'Voice AI',
      job_analysis: 'Job Analysis',
      advanced_navigation: 'Advanced Navigation',
      file_upload: 'File Upload',
    };

    return {
      feature: featureNames[requestedFeature] || 'Feature',
      message: settings.upgradePromptMessage,
      contactInfo: 'Contact me for an invitation code to unlock premium features.',
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
}

// Export singleton instance
export const publicAccessManager = new PublicAccessManager();