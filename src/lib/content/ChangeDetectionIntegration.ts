/**
 * Change Detection Integration Service
 * 
 * Integrates change detection with project save workflow and provides
 * hooks for triggering change detection on content updates.
 */

import { prisma } from '@/lib/database/connection';
import ContentChangeDetector, { ContentChangeDetection } from './ContentChangeDetector';
import ChangeDetectionConfigService from './ChangeDetectionConfigService';
import { EventEmitter } from 'events';

export interface ChangeDetectionHookResult {
  shouldProceed: boolean;
  detection?: ContentChangeDetection;
  userPromptRequired?: boolean;
  estimatedCost?: number;
  recommendedAction?: 'skip' | 'selective' | 'full';
}

export interface ProjectSaveContext {
  projectId: string;
  oldContent?: string;
  newContent: string;
  userId?: string;
  saveMode: 'draft' | 'publish' | 'auto-save';
  skipChangeDetection?: boolean;
}

/**
 * Change Detection Integration Service
 */
export class ChangeDetectionIntegration extends EventEmitter {
  private static instance: ChangeDetectionIntegration;
  private changeDetector: ContentChangeDetector;
  private configService: ChangeDetectionConfigService;

  static getInstance(): ChangeDetectionIntegration {
    if (!ChangeDetectionIntegration.instance) {
      ChangeDetectionIntegration.instance = new ChangeDetectionIntegration();
    }
    return ChangeDetectionIntegration.instance;
  }

  constructor() {
    super();
    this.changeDetector = new ContentChangeDetector();
    this.configService = ChangeDetectionConfigService.getInstance();
  }

  /**
   * Main hook for project save workflow
   * Called before saving project content to detect changes
   */
  async onProjectSave(context: ProjectSaveContext): Promise<ChangeDetectionHookResult> {
    try {
      // Get configuration
      const config = await this.configService.getDefaultConfig();

      // Skip change detection if disabled or in draft mode with skip setting
      if (!config.enableAutoDetection || 
          context.skipChangeDetection ||
          (context.saveMode === 'draft' && config.enableAuditTrail === false)) {
        return {
          shouldProceed: true,
          userPromptRequired: false
        };
      }

      // Get previous content hash
      const previousHash = await this.getPreviousContentHash(context.projectId);

      // Detect changes
      const detection = await this.changeDetector.detectChanges(
        context.projectId,
        context.newContent,
        previousHash
      );

      // Store detection results if audit trail is enabled
      if (config.enableAuditTrail) {
        await this.changeDetector.storeChangeDetectionResults(detection);
      }

      // Emit change detection event
      this.emit('change-detected', {
        projectId: context.projectId,
        detection,
        context
      });

      // Determine if user prompt is required
      const userPromptRequired = this.shouldPromptUser(detection, config);

      // Log detection results
      console.log(`🔍 Change detection for project ${context.projectId}:`, {
        changeScope: detection.changeScope,
        affectedSections: detection.affectedSections.length,
        estimatedCost: detection.estimatedCost.toFixed(4),
        recommendedAction: detection.recommendedAction,
        userPromptRequired
      });

      return {
        shouldProceed: !userPromptRequired, // Proceed if no prompt needed
        detection,
        userPromptRequired,
        estimatedCost: detection.estimatedCost,
        recommendedAction: detection.recommendedAction
      };

    } catch (error) {
      console.error('Error in change detection hook:', error);
      
      // Emit error event
      this.emit('change-detection-error', {
        projectId: context.projectId,
        error: error instanceof Error ? error.message : 'Unknown error',
        context
      });

      // Allow save to proceed on error
      return {
        shouldProceed: true,
        userPromptRequired: false
      };
    }
  }

  /**
   * Handle user response to change detection prompt
   */
  async handleUserResponse(
    projectId: string,
    detection: ContentChangeDetection,
    userChoice: 'proceed' | 'cancel' | 'selective' | 'full'
  ): Promise<{ shouldProceed: boolean; regenerationTriggered?: boolean }> {
    try {
      switch (userChoice) {
        case 'cancel':
          this.emit('change-detection-cancelled', { projectId, detection });
          return { shouldProceed: false };

        case 'proceed':
          // Save without regeneration
          this.emit('change-detection-accepted', { 
            projectId, 
            detection, 
            action: 'save-only' 
          });
          return { shouldProceed: true };

        case 'selective':
          // Trigger selective regeneration
          this.emit('regeneration-requested', {
            projectId,
            scope: 'selective',
            affectedSections: detection.affectedSections,
            estimatedCost: detection.estimatedCost
          });
          return { 
            shouldProceed: true, 
            regenerationTriggered: true 
          };

        case 'full':
          // Trigger full regeneration
          this.emit('regeneration-requested', {
            projectId,
            scope: 'full',
            estimatedCost: detection.estimatedCost
          });
          return { 
            shouldProceed: true, 
            regenerationTriggered: true 
          };

        default:
          return { shouldProceed: true };
      }
    } catch (error) {
      console.error('Error handling user response:', error);
      return { shouldProceed: true };
    }
  }

  /**
   * Trigger change detection manually
   */
  async triggerChangeDetection(
    projectId: string,
    newContent?: string
  ): Promise<ContentChangeDetection> {
    // Get project content if not provided
    if (!newContent) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { articleContent: true }
      });

      if (!project?.articleContent?.content) {
        throw new Error('Project content not found');
      }

      newContent = project.articleContent.content;
    }

    // Get previous content hash
    const previousHash = await this.getPreviousContentHash(projectId);

    // Detect changes
    const detection = await this.changeDetector.detectChanges(
      projectId,
      newContent,
      previousHash
    );

    // Store results
    const config = await this.configService.getDefaultConfig();
    if (config.enableAuditTrail) {
      await this.changeDetector.storeChangeDetectionResults(detection);
    }

    // Emit event
    this.emit('manual-change-detection', {
      projectId,
      detection
    });

    return detection;
  }

  /**
   * Get change detection status for a project
   */
  async getChangeDetectionStatus(projectId: string): Promise<{
    hasChanges: boolean;
    lastDetection?: Date;
    pendingRegeneration: boolean;
  }> {
    try {
      // Check if there are any pending changes
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { 
          articleContent: true,
          aiIndex: true 
        }
      });

      if (!project) {
        return {
          hasChanges: false,
          pendingRegeneration: false
        };
      }

      // Compare current content hash with stored hash
      const currentContent = project.articleContent?.content || '';
      const currentHash = this.changeDetector['generateContentHash'](currentContent);
      const storedHash = project.aiIndex?.contentHash;

      const hasChanges = storedHash ? currentHash !== storedHash : true;

      return {
        hasChanges,
        lastDetection: project.aiIndex?.updatedAt,
        pendingRegeneration: hasChanges
      };

    } catch (error) {
      console.error('Error getting change detection status:', error);
      return {
        hasChanges: false,
        pendingRegeneration: false
      };
    }
  }

  /**
   * Update change detection configuration
   */
  async updateConfiguration(
    configName: string,
    updates: any
  ): Promise<void> {
    await this.configService.updateConfig(configName, updates);
    
    // Update detector configuration
    const newConfig = await this.configService.getConfig(configName);
    if (newConfig) {
      this.changeDetector.updateConfig({
        sectionChangePercent: newConfig.sectionChangePercent,
        minorChangeThreshold: newConfig.minorChangeThreshold,
        characterChangeThreshold: newConfig.characterChangeThreshold,
        headingMatchThreshold: newConfig.headingMatchThreshold,
        costPerToken: newConfig.costPerToken
      });
    }

    this.emit('configuration-updated', { configName, updates });
  }

  // Private methods

  private async getPreviousContentHash(projectId: string): Promise<string | undefined> {
    try {
      const aiIndex = await prisma.projectAIIndex.findUnique({
        where: { projectId },
        select: { contentHash: true }
      });

      return aiIndex?.contentHash || undefined;
    } catch (error) {
      console.error('Error getting previous content hash:', error);
      return undefined;
    }
  }

  private shouldPromptUser(
    detection: ContentChangeDetection,
    config: any
  ): boolean {
    // Always prompt for major changes with high cost
    if (detection.changeScope === 'major' && detection.estimatedCost > 0.10) {
      return true;
    }

    // Prompt for moderate changes if cost estimation is enabled
    if (detection.changeScope === 'moderate' && 
        config.enableCostEstimation && 
        detection.estimatedCost > 0.05) {
      return true;
    }

    // Prompt for new content
    if (detection.changeScope === 'new') {
      return true;
    }

    // Don't prompt for minor changes or no changes
    return false;
  }

  /**
   * Create project save hook for integration
   */
  createProjectSaveHook() {
    return async (context: ProjectSaveContext): Promise<ChangeDetectionHookResult> => {
      return await this.onProjectSave(context);
    };
  }

  /**
   * Get event emitter for external integrations
   */
  getEventEmitter(): EventEmitter {
    return this;
  }
}

export default ChangeDetectionIntegration;