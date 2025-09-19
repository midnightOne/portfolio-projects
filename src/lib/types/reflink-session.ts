/**
 * Types for reflink session management
 */

export type AccessLevel = 'no_access' | 'basic' | 'limited' | 'premium';
export type AIFeature = 'chat_interface' | 'voice_ai' | 'job_analysis' | 'advanced_navigation' | 'file_upload';

export interface ReflinkInfo {
  id: string;
  code: string;
  name?: string;
  description?: string;
  rateLimitTier: string;
  dailyLimit: number;
  expiresAt?: Date;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Enhanced reflink features
  recipientName?: string;
  recipientEmail?: string;
  customContext?: string;
  tokenLimit?: number;
  tokensUsed: number;
  spendLimit?: number;
  spendUsed: number;
  enableVoiceAI: boolean;
  enableJobAnalysis: boolean;
  enableAdvancedNavigation: boolean;
  lastUsedAt?: Date;
}

export interface ReflinkSession {
  reflink: ReflinkInfo;
  accessLevel: AccessLevel;
  personalizedContext: PersonalizedContext;
  budgetStatus: BudgetStatus;
  sessionStartTime: Date;
}

export interface PersonalizedContext {
  recipientName?: string;
  customNotes?: string;
  conversationStarters?: string[];
  emphasizedTopics?: string[];
}

export interface BudgetStatus {
  tokensRemaining?: number;
  spendRemaining: number;
  isExhausted: boolean;
  estimatedRequestsRemaining: number;
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

export interface ReflinkValidationResult {
  valid: boolean;
  reflink?: ReflinkInfo;
  budgetStatus?: BudgetStatus;
  reason?: 'not_found' | 'expired' | 'budget_exhausted' | 'inactive';
  welcomeMessage?: string;
}