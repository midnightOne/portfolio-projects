import { PrismaClient } from '@prisma/client';
import { AIServiceFactory } from './providers';
import { AIResponseParser, SYSTEM_PROMPT_TEMPLATE } from './response-parser';
import { EncryptionService } from '../encryption';
import { 
  AISettings, 
  AIRequest, 
  AIResponse, 
  ProjectContext, 
  ParsedChanges, 
  ProjectWithRelations,
  AIConversation,
  AIMessage
} from '@/lib/types/project';

const prisma = new PrismaClient();

/**
 * Main AI service for content editing
 */
export class AIService {
  /**
   * Get or create AI settings
   */
  static async getSettings(): Promise<AISettings> {
    let settings = await prisma.aISettings.findFirst();
    
    if (!settings) {
      settings = await prisma.aISettings.create({
        data: {
          systemPrompt: 'You are an expert content editor for portfolio projects. Help improve and edit project content while maintaining the author\'s voice and style.',
          preferredProvider: 'anthropic',
          preferredModel: 'claude-3-5-sonnet-20241022',
          temperature: 0.7,
          maxTokens: 4000,
          dailyCostLimit: 10.0,
          monthlyTokenLimit: 100000,
          conversationHistory: true,
          autoSaveInterval: 60,
          maxVersionsPerProject: 20,
          autoDeleteOldVersions: true,
          versionRetentionDays: 30
        }
      });
    }

    // Decrypt API keys if they exist
    if (settings.anthropicApiKey) {
      settings.anthropicApiKey = EncryptionService.decrypt(settings.anthropicApiKey);
    }
    if (settings.openaiApiKey) {
      settings.openaiApiKey = EncryptionService.decrypt(settings.openaiApiKey);
    }

    return settings as AISettings;
  }

  /**
   * Update AI settings
   */
  static async updateSettings(updates: Partial<AISettings>): Promise<AISettings> {
    const data: any = { ...updates };
    
    // Encrypt API keys before storing
    if (data.anthropicApiKey) {
      data.anthropicApiKey = EncryptionService.encrypt(data.anthropicApiKey);
    }
    if (data.openaiApiKey) {
      data.openaiApiKey = EncryptionService.encrypt(data.openaiApiKey);
    }

    const settings = await prisma.aISettings.upsert({
      where: { id: updates.id || 'default' },
      update: data,
      create: {
        ...data,
        systemPrompt: data.systemPrompt || 'You are an expert content editor for portfolio projects.',
        preferredProvider: data.preferredProvider || 'anthropic',
        preferredModel: data.preferredModel || 'claude-3-5-sonnet-20241022'
      }
    });

    return this.getSettings(); // Return decrypted version
  }

  /**
   * Send a chat message and get AI response
   */
  static async chat(
    projectId: string,
    message: string,
    context: ProjectContext,
    conversationId?: string
  ): Promise<{ response: AIResponse; conversation: AIConversation; parsedChanges?: ParsedChanges }> {
    const settings = await this.getSettings();
    
    // Get or create conversation
    let conversation = conversationId 
      ? await prisma.aIConversation.findUnique({
          where: { id: conversationId },
          include: { messages: true }
        })
      : null;

    if (!conversation) {
      conversation = await prisma.aIConversation.create({
        data: {
          projectId,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : '')
        },
        include: { messages: true }
      });
    }

    // Check cost limits
    await this.checkCostLimits(settings);

    // Get API key for selected provider
    const apiKey = settings.preferredProvider === 'anthropic' 
      ? settings.anthropicApiKey 
      : settings.openaiApiKey;

    if (!apiKey) {
      throw new Error(`No API key configured for ${settings.preferredProvider}`);
    }

    // Create AI provider
    const provider = AIServiceFactory.createProvider(settings.preferredProvider, apiKey);

    // Build system prompt
    const systemPrompt = `${SYSTEM_PROMPT_TEMPLATE}\n\nCustom Instructions: ${settings.systemPrompt}`;

    // Create AI request
    const request: AIRequest = {
      prompt: message,
      context,
      systemPrompt,
      model: settings.preferredModel,
      provider: settings.preferredProvider,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens
    };

    // Get AI response
    const response = await provider.chat(request);

    // Save user message
    await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
        context: context as any
      }
    });

    // Save AI response
    await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: response.content,
        model: response.metadata.model,
        tokens: response.metadata.tokens,
        context: { cost: response.metadata.cost, duration: response.metadata.duration }
      }
    });

    // Track usage
    await this.trackUsage(settings.preferredProvider, response.metadata);

    // Parse response for structured changes
    let parsedChanges: ParsedChanges | undefined;
    if (!response.error && response.content) {
      try {
        // We need the full project to parse changes properly
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            tags: true,
            mediaItems: true,
            articleContent: true,
            externalLinks: true,
            downloadableFiles: true,
            interactiveExamples: true,
            carousels: { include: { images: { include: { mediaItem: true } } } },
            thumbnailImage: true,
            metadataImage: true
          }
        });

        if (project) {
          parsedChanges = AIResponseParser.parse(response.content, project as ProjectWithRelations);
        }
      } catch (error) {
        console.error('Error parsing AI response:', error);
      }
    }

    // Update conversation last active time
    await prisma.aIConversation.update({
      where: { id: conversation.id },
      data: { lastActiveAt: new Date() }
    });

    // Reload conversation with messages
    const updatedConversation = await prisma.aIConversation.findUnique({
      where: { id: conversation.id },
      include: { messages: { orderBy: { timestamp: 'asc' } } }
    });

    return {
      response,
      conversation: updatedConversation as AIConversation,
      parsedChanges
    };
  }

  /**
   * Get conversation history for a project
   */
  static async getConversations(projectId: string): Promise<AIConversation[]> {
    const conversations = await prisma.aIConversation.findMany({
      where: { projectId },
      include: { 
        messages: { 
          orderBy: { timestamp: 'asc' },
          take: 10 // Limit messages per conversation for performance
        } 
      },
      orderBy: { lastActiveAt: 'desc' }
    });

    return conversations as AIConversation[];
  }

  /**
   * Delete a conversation
   */
  static async deleteConversation(conversationId: string): Promise<void> {
    await prisma.aIConversation.delete({
      where: { id: conversationId }
    });
  }

  /**
   * Build project context for AI
   */
  static buildProjectContext(
    project: ProjectWithRelations,
    selectedText?: { start: number; end: number; text: string }
  ): ProjectContext {
    const context: ProjectContext = {
      currentContent: project.articleContent?.content || '',
      tags: project.tags.map(t => t.name),
      externalLinks: project.externalLinks,
      mediaItems: project.mediaItems,
      metadata: {
        title: project.title,
        description: project.description || '',
        workDate: project.workDate,
        status: project.status
      }
    };

    if (selectedText) {
      // Add surrounding context for better AI understanding
      const fullContent = context.currentContent;
      const contextLength = 300;
      const start = Math.max(0, selectedText.start - contextLength);
      const end = Math.min(fullContent.length, selectedText.end + contextLength);
      
      context.selectedText = {
        ...selectedText,
        context: fullContent.substring(start, end)
      };
    }

    return context;
  }

  /**
   * Check if cost limits would be exceeded
   */
  private static async checkCostLimits(settings: AISettings): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check daily cost limit (simplified - would need proper usage tracking)
    // For now, just check if we have API keys
    const hasApiKey = settings.preferredProvider === 'anthropic' 
      ? !!settings.anthropicApiKey 
      : !!settings.openaiApiKey;

    if (!hasApiKey) {
      throw new Error(`No API key configured for ${settings.preferredProvider}`);
    }
  }

  /**
   * Track AI usage for cost monitoring
   */
  private static async trackUsage(
    provider: string,
    metadata: { model: string; tokens: number; cost: number; duration: number }
  ): Promise<void> {
    // In a real implementation, you'd store this in a usage tracking table
    console.log(`AI Usage - Provider: ${provider}, Model: ${metadata.model}, Tokens: ${metadata.tokens}, Cost: $${metadata.cost.toFixed(4)}`);
  }
}