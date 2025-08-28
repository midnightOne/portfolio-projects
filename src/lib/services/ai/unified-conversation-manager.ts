/**
 * Unified Conversation Manager
 * Mode-agnostic conversation pipeline that processes text, voice, and hybrid inputs identically
 * Maintains single conversation thread with consistent state management across all modes
 */

import { AIServiceManager, type AIContentEditRequest, type AIContentEditResponse } from '@/lib/ai/service-manager';
import { contextManager, type ContextSource, type ContextBuildOptions } from './context-manager';
import { type ChatMessage, type ProviderChatRequest, type ProviderChatResponse } from '@/lib/ai/types';

// Core conversation types
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  inputMode: 'text' | 'voice' | 'hybrid';
  metadata?: {
    tokensUsed?: number;
    cost?: number;
    model?: string;
    processingTime?: number;
    voiceData?: {
      duration?: number;
      audioUrl?: string;
      transcription?: string;
    };
    contextUsed?: string[];
    navigationCommands?: NavigationCommand[];
  };
}

export interface NavigationCommand {
  type: 'navigate' | 'highlight' | 'scroll' | 'modal';
  target: string;
  parameters: Record<string, any>;
  timing: 'immediate' | 'delayed' | 'synchronized';
  duration?: number;
}

export interface ConversationState {
  id: string;
  sessionId: string;
  messages: ConversationMessage[];
  currentContext: string;
  contextSources: ContextSource[];
  activeMode: 'text' | 'voice' | 'hybrid';
  isProcessing: boolean;
  lastActivity: Date;
  metadata: {
    totalTokensUsed: number;
    totalCost: number;
    messageCount: number;
    averageResponseTime: number;
    reflinkId?: string;
    userPreferences?: {
      tone: 'technical' | 'casual' | 'professional';
      responseLength: 'concise' | 'detailed' | 'comprehensive';
      includeNavigation: boolean;
    };
  };
}

export interface ConversationInput {
  content: string;
  mode: 'text' | 'voice' | 'hybrid';
  sessionId: string;
  metadata?: {
    voiceData?: {
      audioBlob?: Blob;
      duration?: number;
      transcription?: string;
    };
    contextHints?: string[];
    userPreferences?: {
      tone?: 'technical' | 'casual' | 'professional';
      responseLength?: 'concise' | 'detailed' | 'comprehensive';
      includeNavigation?: boolean;
    };
  };
}

export interface ConversationResponse {
  message: ConversationMessage;
  navigationCommands: NavigationCommand[];
  contextUpdates: string[];
  voiceResponse?: {
    audioUrl: string;
    duration: number;
    text: string;
  };
  suggestions: string[];
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

export interface ConversationOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  includeContext?: boolean;
  contextOptions?: ContextBuildOptions;
  enableNavigation?: boolean;
  enableVoiceResponse?: boolean;
  systemPrompt?: string;
}

/**
 * Unified Conversation Manager
 * Handles all conversation modes through a single, consistent pipeline
 */
export class UnifiedConversationManager {
  private static instance: UnifiedConversationManager;
  private aiService: AIServiceManager;
  private conversations = new Map<string, ConversationState>();
  private readonly DEFAULT_MODEL = 'gpt-4o';
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.aiService = new AIServiceManager();
    this.initializeAIService();
    this.startSessionCleanup();
  }

  /**
   * Initialize AI service with model configurations
   */
  private async initializeAIService(): Promise<void> {
    try {
      await this.aiService.initializeModelConfigurations();
    } catch (error) {
      console.error('Failed to initialize AI service model configurations:', error);
    }
  }

  static getInstance(): UnifiedConversationManager {
    if (!UnifiedConversationManager.instance) {
      UnifiedConversationManager.instance = new UnifiedConversationManager();
    }
    return UnifiedConversationManager.instance;
  }

  /**
   * Process conversation input regardless of mode (text, voice, or hybrid)
   * This is the main entry point for all conversation interactions
   */
  async processInput(
    input: ConversationInput,
    options: ConversationOptions = {}
  ): Promise<ConversationResponse> {
    const startTime = Date.now();

    try {
      // Get or create conversation state
      const conversation = await this.getOrCreateConversation(input.sessionId);
      
      // Update conversation mode and activity
      conversation.activeMode = input.mode;
      conversation.lastActivity = new Date();
      conversation.isProcessing = true;

      // Create user message
      const userMessage: ConversationMessage = {
        id: this.generateMessageId(),
        role: 'user',
        content: input.content,
        timestamp: new Date(),
        inputMode: input.mode,
        metadata: {
          voiceData: input.metadata?.voiceData
        }
      };

      // Add user message to conversation
      conversation.messages.push(userMessage);

      // Build context if enabled
      let contextString = '';
      if (options.includeContext !== false) {
        const contextResult = await contextManager.buildContextWithCaching(
          input.sessionId,
          conversation.contextSources,
          input.content,
          options.contextOptions
        );
        contextString = contextResult.context;
        conversation.currentContext = contextString;
      }

      // Prepare AI request
      const aiRequest = await this.prepareAIRequest(
        conversation,
        contextString,
        options,
        input.metadata?.userPreferences
      );

      // Get AI response
      const aiResponse = await this.getAIResponse(aiRequest, options.model || this.DEFAULT_MODEL);

      // Parse navigation commands from response
      const navigationCommands = this.parseNavigationCommands(aiResponse.content);

      // Create assistant message
      const assistantMessage: ConversationMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: this.cleanResponseContent(aiResponse.content),
        timestamp: new Date(),
        inputMode: input.mode, // Preserve the input mode for consistency
        metadata: {
          tokensUsed: aiResponse.tokensUsed,
          cost: aiResponse.cost,
          model: aiResponse.model,
          processingTime: Date.now() - startTime,
          contextUsed: contextString ? [input.sessionId] : [],
          navigationCommands
        }
      };

      // Add assistant message to conversation
      conversation.messages.push(assistantMessage);

      // Update conversation metadata
      this.updateConversationMetadata(conversation, aiResponse, Date.now() - startTime);

      // Generate voice response if needed
      let voiceResponse: ConversationResponse['voiceResponse'];
      if (options.enableVoiceResponse && (input.mode === 'voice' || input.mode === 'hybrid')) {
        voiceResponse = await this.generateVoiceResponse(assistantMessage.content);
      }

      // Generate suggestions for follow-up
      const suggestions = this.generateSuggestions(conversation, input.content);

      // Mark processing as complete
      conversation.isProcessing = false;

      // Save conversation state
      await this.saveConversationState(conversation);

      return {
        message: assistantMessage,
        navigationCommands,
        contextUpdates: contextString ? [contextString] : [],
        voiceResponse,
        suggestions
      };

    } catch (error) {
      // Mark processing as complete even on error
      const conversation = this.conversations.get(input.sessionId);
      if (conversation) {
        conversation.isProcessing = false;
      }

      console.error('Error processing conversation input:', error);
      
      return {
        message: {
          id: this.generateMessageId(),
          role: 'assistant',
          content: 'I apologize, but I encountered an error processing your request. Please try again.',
          timestamp: new Date(),
          inputMode: input.mode,
          metadata: {
            processingTime: Date.now() - startTime
          }
        },
        navigationCommands: [],
        contextUpdates: [],
        suggestions: ['Try rephrasing your question', 'Ask about my projects', 'Tell me about your background'],
        error: {
          code: 'PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          recoverable: true
        }
      };
    }
  }

  /**
   * Get conversation state for a session
   */
  async getConversationState(sessionId: string): Promise<ConversationState | null> {
    const conversation = this.conversations.get(sessionId);
    
    if (!conversation) {
      return null;
    }

    // Check if conversation has expired
    if (Date.now() - conversation.lastActivity.getTime() > this.SESSION_TIMEOUT) {
      this.conversations.delete(sessionId);
      return null;
    }

    return conversation;
  }

  /**
   * Update conversation mode (allows seamless switching between text/voice/hybrid)
   */
  async updateConversationMode(sessionId: string, mode: 'text' | 'voice' | 'hybrid'): Promise<void> {
    const conversation = this.conversations.get(sessionId);
    if (conversation) {
      conversation.activeMode = mode;
      conversation.lastActivity = new Date();
      await this.saveConversationState(conversation);
    }
  }

  /**
   * Clear conversation history while preserving session
   */
  async clearConversationHistory(sessionId: string): Promise<void> {
    const conversation = this.conversations.get(sessionId);
    if (conversation) {
      conversation.messages = [];
      conversation.metadata.messageCount = 0;
      conversation.metadata.totalTokensUsed = 0;
      conversation.metadata.totalCost = 0;
      conversation.lastActivity = new Date();
      await this.saveConversationState(conversation);
    }
  }

  /**
   * Get conversation history in a format suitable for display
   */
  async getConversationHistory(sessionId: string): Promise<ConversationMessage[]> {
    const conversation = await this.getConversationState(sessionId);
    return conversation?.messages || [];
  }

  /**
   * Check if conversation is currently processing
   */
  isProcessing(sessionId: string): boolean {
    const conversation = this.conversations.get(sessionId);
    return conversation?.isProcessing || false;
  }

  /**
   * Get or create conversation state for a session
   */
  private async getOrCreateConversation(sessionId: string): Promise<ConversationState> {
    let conversation = this.conversations.get(sessionId);

    if (!conversation) {
      // Initialize context sources
      const contextSources = await this.initializeContextSources();

      conversation = {
        id: this.generateConversationId(),
        sessionId,
        messages: [],
        currentContext: '',
        contextSources,
        activeMode: 'text',
        isProcessing: false,
        lastActivity: new Date(),
        metadata: {
          totalTokensUsed: 0,
          totalCost: 0,
          messageCount: 0,
          averageResponseTime: 0
        }
      };

      this.conversations.set(sessionId, conversation);
    }

    return conversation;
  }

  /**
   * Initialize context sources for conversation
   */
  private async initializeContextSources(): Promise<ContextSource[]> {
    try {
      // Get available context sources from content source manager
      const response = await fetch('/api/admin/ai/content-sources');
      if (response.ok) {
        const data = await response.json();
        return data.sources || [];
      }
    } catch (error) {
      console.warn('Failed to load context sources:', error);
    }

    // Fallback to default sources
    return [
      {
        id: 'projects',
        type: 'project',
        title: 'Projects',
        enabled: true,
        summary: 'Portfolio projects and technical work',
        lastUpdated: new Date(),
        priority: 0.9
      },
      {
        id: 'about',
        type: 'about',
        title: 'About',
        enabled: true,
        summary: 'Personal background and bio',
        lastUpdated: new Date(),
        priority: 0.8
      }
    ];
  }

  /**
   * Prepare AI request with conversation history and context
   */
  private async prepareAIRequest(
    conversation: ConversationState,
    context: string,
    options: ConversationOptions,
    userPreferences?: {
      tone?: 'technical' | 'casual' | 'professional';
      responseLength?: 'concise' | 'detailed' | 'comprehensive';
      includeNavigation?: boolean;
    }
  ): Promise<ProviderChatRequest> {
    const messages: ChatMessage[] = [];

    // Add system prompt
    const systemPrompt = this.buildSystemPrompt(context, options.systemPrompt, userPreferences);
    messages.push({
      role: 'system',
      content: systemPrompt
    });

    // Add conversation history (last 10 messages to manage token usage)
    const recentMessages = conversation.messages.slice(-10);
    for (const msg of recentMessages) {
      messages.push({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      });
    }

    return {
      model: options.model || this.DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 2000
    };
  }

  /**
   * Build system prompt with context and preferences
   */
  private buildSystemPrompt(
    context: string,
    customSystemPrompt?: string,
    userPreferences?: {
      tone?: 'technical' | 'casual' | 'professional';
      responseLength?: 'concise' | 'detailed' | 'comprehensive';
      includeNavigation?: boolean;
    }
  ): string {
    let prompt = customSystemPrompt || `You are an AI assistant for a portfolio website. You help visitors learn about the portfolio owner's background, projects, and expertise. You are helpful, knowledgeable, and professional.`;

    // Add tone preferences
    if (userPreferences?.tone) {
      switch (userPreferences.tone) {
        case 'technical':
          prompt += ' Use technical language and provide detailed technical explanations.';
          break;
        case 'casual':
          prompt += ' Use a friendly, casual tone and explain things in simple terms.';
          break;
        case 'professional':
          prompt += ' Maintain a professional tone and provide comprehensive information.';
          break;
      }
    }

    // Add response length preferences
    if (userPreferences?.responseLength) {
      switch (userPreferences.responseLength) {
        case 'concise':
          prompt += ' Keep responses brief and to the point.';
          break;
        case 'detailed':
          prompt += ' Provide detailed explanations with examples.';
          break;
        case 'comprehensive':
          prompt += ' Give thorough, comprehensive responses covering all relevant aspects.';
          break;
      }
    }

    // Add navigation instructions
    if (userPreferences?.includeNavigation !== false) {
      prompt += '\n\nWhen relevant, you can suggest navigation to specific projects or sections using commands like [NavigateTo:ProjectID&sectionId]. These will be parsed and executed by the UI system.';
    }

    // Add context if available
    if (context) {
      prompt += '\n\nHere is the current context about the portfolio:\n\n' + context;
    }

    return prompt;
  }

  /**
   * Get AI response using the AI service manager
   */
  private async getAIResponse(request: ProviderChatRequest, model: string): Promise<ProviderChatResponse> {
    // Ensure AI service is initialized
    await this.aiService.initializeModelConfigurations();
    
    // Use the AI service manager's chat functionality
    const provider = this.aiService.getProviderForModel(model);
    if (!provider) {
      throw new Error(`Model ${model} is not configured. Available models: ${this.aiService.getProviderModels('openai').concat(this.aiService.getProviderModels('anthropic')).join(', ')}`);
    }

    // Get the provider instance and make the request
    const providerInstance = (this.aiService as any).providers.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} is not available`);
    }

    return await providerInstance.chat(request);
  }

  /**
   * Parse navigation commands from AI response
   */
  private parseNavigationCommands(content: string): NavigationCommand[] {
    const commands: NavigationCommand[] = [];
    const navigationRegex = /\[NavigateTo:([^\]]+)\]/g;
    let match;

    while ((match = navigationRegex.exec(content)) !== null) {
      const commandStr = match[1];
      const [target, ...paramParts] = commandStr.split('&');
      
      const parameters: Record<string, any> = {};
      paramParts.forEach(part => {
        const [key, value] = part.split('=');
        if (key && value) {
          parameters[key] = value;
        }
      });

      commands.push({
        type: 'navigate',
        target,
        parameters,
        timing: 'immediate'
      });
    }

    return commands;
  }

  /**
   * Clean response content by removing navigation commands
   */
  private cleanResponseContent(content: string): string {
    return content.replace(/\[NavigateTo:[^\]]+\]/g, '').trim();
  }

  /**
   * Update conversation metadata
   */
  private updateConversationMetadata(
    conversation: ConversationState,
    aiResponse: ProviderChatResponse,
    processingTime: number
  ): void {
    conversation.metadata.totalTokensUsed += aiResponse.tokensUsed || 0;
    conversation.metadata.totalCost += aiResponse.cost || 0;
    conversation.metadata.messageCount += 1;
    
    // Update average response time
    const currentAvg = conversation.metadata.averageResponseTime;
    const count = conversation.metadata.messageCount;
    conversation.metadata.averageResponseTime = ((currentAvg * (count - 1)) + processingTime) / count;
  }

  /**
   * Generate voice response (placeholder for voice integration)
   */
  private async generateVoiceResponse(text: string): Promise<ConversationResponse['voiceResponse']> {
    // Placeholder for ElevenLabs integration
    // This would be implemented when voice features are added
    return undefined;
  }

  /**
   * Generate conversation suggestions
   */
  private generateSuggestions(conversation: ConversationState, lastInput: string): string[] {
    const suggestions = [
      'Tell me about your projects',
      'What technologies do you work with?',
      'Show me your experience',
      'What makes you unique?'
    ];

    // Add context-specific suggestions based on conversation history
    const hasAskedAboutProjects = conversation.messages.some(m => 
      m.content.toLowerCase().includes('project')
    );
    
    if (!hasAskedAboutProjects) {
      suggestions.unshift('Show me your best projects');
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Save conversation state (placeholder for persistence)
   */
  private async saveConversationState(conversation: ConversationState): Promise<void> {
    // In a full implementation, this would save to database
    // For now, we keep it in memory
    this.conversations.set(conversation.sessionId, conversation);
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique conversation ID
   */
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start session cleanup timer
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [sessionId, conversation] of this.conversations.entries()) {
        if (now - conversation.lastActivity.getTime() > this.SESSION_TIMEOUT) {
          this.conversations.delete(sessionId);
        }
      }
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }
}

// Export singleton instance
export const unifiedConversationManager = UnifiedConversationManager.getInstance();