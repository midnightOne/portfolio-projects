/**
 * AI Service Manager - Core service for managing AI providers and operations
 */

import { PrismaClient } from '@prisma/client';
import { ProviderFactory } from './provider-factory';
import {
  AIProvider,
  AIProviderType,
  AIProviderStatus,
  ConnectionTestResult,
  ProviderChatRequest,
  ProviderChatResponse
} from './types';
import { AIErrorHandler, AIError, AIErrorType } from './error-handler';

const prisma = new PrismaClient();

export interface AIModelConfig {
  provider: AIProviderType;
  models: string[];
  defaultModel?: string;
}

export interface ModelValidationResult {
  valid: string[];
  invalid: string[];
  warnings: string[];
}

export interface AIContentEditRequest {
  model: string;
  operation: 'rewrite' | 'improve' | 'expand' | 'summarize' | 'make_professional' | 'make_casual';
  content: string;
  selectedText?: {
    text: string;
    start: number;
    end: number;
  };
  context: {
    projectTitle: string;
    projectDescription: string;
    existingTags: string[];
    fullContent: string;
  };
  systemPrompt?: string;
  temperature?: number;
}

export interface AIContentEditResponse {
  success: boolean;
  changes: {
    // Full content replacement
    fullContent?: string;

    // Partial text replacement
    partialUpdate?: {
      start: number;
      end: number;
      newText: string;
      reasoning: string;
    };

    // Metadata suggestions
    suggestedTags?: {
      add: string[];
      remove: string[];
      reasoning: string;
    };

    // Other metadata
    suggestedTitle?: string;
    suggestedDescription?: string;
  };
  reasoning: string;
  confidence: number;
  warnings: string[];
  model: string;
  tokensUsed: number;
  cost: number;
}

export interface AITagSuggestionRequest {
  model: string;
  projectTitle: string;
  projectDescription: string;
  articleContent: string;
  existingTags: string[];
  maxSuggestions?: number;
}

export interface AITagSuggestionResponse {
  success: boolean;
  suggestions: {
    add: Array<{
      tag: string;
      confidence: number;
      reasoning: string;
    }>;
    remove: Array<{
      tag: string;
      reasoning: string;
    }>;
  };
  reasoning: string;
  model: string;
  tokensUsed: number;
  cost: number;
}

export interface AICustomPromptRequest {
  model: string;
  prompt: string;
  content: string;
  selectedText?: {
    text: string;
    start: number;
    end: number;
  };
  context: {
    projectTitle: string;
    projectDescription: string;
    existingTags: string[];
    fullContent: string;
  };
  systemPrompt?: string;
  temperature?: number;
}

export interface AICustomPromptResponse {
  success: boolean;
  changes: {
    // Full content replacement
    fullContent?: string;

    // Partial text replacement
    partialUpdate?: {
      start: number;
      end: number;
      newText: string;
      reasoning: string;
    };

    // Metadata suggestions
    suggestedTags?: {
      add: string[];
      remove: string[];
      reasoning: string;
    };

    // Other metadata
    suggestedTitle?: string;
    suggestedDescription?: string;
  };
  reasoning: string;
  confidence: number;
  warnings: string[];
  userFeedback?: string;
  model: string;
  tokensUsed: number;
  cost: number;
}

export class AIServiceManager {
  private providers: Map<AIProviderType, AIProvider> = new Map();
  private modelConfigs: Map<AIProviderType, string[]> = new Map();

  constructor() {
    this.initializeProviders();
    // Note: Model configurations are initialized on-demand in API routes
    // to avoid Prisma client issues on the client side
  }

  /**
   * Initialize providers based on available environment variables
   */
  private initializeProviders(): void {
    const availableProviders = ProviderFactory.createAvailableProviders();
    this.providers = availableProviders;
  }

  /**
   * Get status of all available providers with connection information
   */
  async getAvailableProviders(): Promise<AIProviderStatus[]> {
    const statuses: AIProviderStatus[] = [];

    // Check all possible provider types, not just configured ones
    const allProviderTypes: AIProviderType[] = ['openai', 'anthropic'];

    for (const providerType of allProviderTypes) {
      const provider = this.providers.get(providerType);
      const models = this.modelConfigs.get(providerType) || [];

      if (!provider) {
        // Provider not configured (no API key)
        statuses.push({
          name: providerType,
          configured: false,
          connected: false,
          error: `${providerType.toUpperCase()}_API_KEY environment variable not set`,
          models: [],
          lastTested: new Date()
        });
        continue;
      }

      try {
        const testResult = await this.testConnection(providerType);
        statuses.push({
          name: providerType,
          configured: true,
          connected: testResult.success,
          error: testResult.success ? undefined : testResult.message,
          models,
          lastTested: new Date()
        });
      } catch (error) {
        statuses.push({
          name: providerType,
          configured: true,
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          models,
          lastTested: new Date()
        });
      }
    }

    return statuses;
  }

  /**
   * Test connection to a specific provider
   */
  async testConnection(providerType: AIProviderType): Promise<ConnectionTestResult> {
    const provider = this.providers.get(providerType);

    if (!provider) {
      const aiError = AIErrorHandler.parseError(
        new Error(`Missing ${providerType.toUpperCase()}_API_KEY environment variable`),
        { provider: providerType, operation: 'testConnection' }
      );

      return {
        success: false,
        message: aiError.message,
        error: {
          code: aiError.type,
          details: aiError.details,
          actionable: aiError.actionable
        }
      };
    }

    try {
      const isConnected = await provider.testConnection();

      if (isConnected) {
        const models = await provider.listModels();
        return {
          success: true,
          message: `Connected successfully - ${models.length} models available`,
          availableModels: models
        };
      } else {
        const aiError = AIErrorHandler.parseError(
          new Error('Provider connection test returned false'),
          { provider: providerType, operation: 'testConnection' }
        );

        return {
          success: false,
          message: aiError.message,
          error: {
            code: aiError.type,
            details: aiError.details,
            actionable: aiError.actionable
          }
        };
      }
    } catch (error: any) {
      const aiError = AIErrorHandler.parseError(error, {
        provider: providerType,
        operation: 'testConnection'
      });

      AIErrorHandler.logError(aiError);

      return {
        success: false,
        message: aiError.message,
        error: {
          code: aiError.type,
          details: aiError.details,
          actionable: aiError.actionable
        }
      };
    }
  }



  /**
   * Get configured models from database
   */
  async getConfiguredModels(): Promise<AIModelConfig[]> {
    try {
      const configs = await prisma.aIModelConfig.findMany();

      const modelConfigs: AIModelConfig[] = configs.map(config => {
        const models = config.models ? config.models.split(',').map(m => m.trim()).filter(Boolean) : [];
        this.modelConfigs.set(config.provider as AIProviderType, models);

        return {
          provider: config.provider as AIProviderType,
          models,
          defaultModel: models[0] // First model as default
        };
      });

      return modelConfigs;
    } catch (error) {
      console.error('Failed to get configured models:', error);
      return [];
    }
  }

  /**
   * Validate model IDs against provider APIs
   */
  async validateModels(providerType: AIProviderType, models: string[]): Promise<ModelValidationResult> {
    const provider = this.providers.get(providerType);

    if (!provider) {
      const aiError = AIErrorHandler.parseError(
        new Error(`${providerType} provider not configured`),
        { provider: providerType, operation: 'validateModels' }
      );

      return {
        valid: [],
        invalid: models,
        warnings: [aiError.message, ...aiError.suggestions]
      };
    }

    try {
      const availableModels = await provider.listModels();
      const valid: string[] = [];
      const invalid: string[] = [];
      const warnings: string[] = [];

      for (const model of models) {
        if (availableModels.includes(model)) {
          valid.push(model);
        } else {
          invalid.push(model);
          warnings.push(`Model '${model}' not found in ${providerType} API - it may be a new model not yet listed`);
        }
      }

      return { valid, invalid, warnings };
    } catch (error) {
      const aiError = AIErrorHandler.parseError(error, {
        provider: providerType,
        operation: 'validateModels'
      });

      AIErrorHandler.logError(aiError);

      return {
        valid: [],
        invalid: models,
        warnings: [aiError.message, ...aiError.suggestions]
      };
    }
  }

  /**
   * Save model configuration to database
   */
  async saveModelConfiguration(providerType: AIProviderType, models: string[]): Promise<void> {
    try {
      const modelsString = models.join(',');

      await prisma.aIModelConfig.upsert({
        where: { provider: providerType },
        update: { models: modelsString },
        create: { provider: providerType, models: modelsString }
      });

      // Update in-memory cache
      this.modelConfigs.set(providerType, models);
    } catch (error) {
      console.error(`Failed to save model configuration for ${providerType}:`, error);
      throw new Error(`Failed to save model configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all available models across all configured providers
   */
  async getAllAvailableModels(): Promise<{ provider: AIProviderType; model: string }[]> {
    const allModels: { provider: AIProviderType; model: string }[] = [];

    for (const [providerType, provider] of this.providers) {
      try {
        const models = await provider.listModels();
        models.forEach(model => {
          allModels.push({ provider: providerType, model });
        });
      } catch (error) {
        console.warn(`Failed to get models for ${providerType}:`, error);
      }
    }

    return allModels;
  }

  /**
   * Initialize model configurations from database on startup
   */
  async initializeModelConfigurations(): Promise<void> {
    try {
      await this.getConfiguredModels();
      console.log('Model configurations initialized');
    } catch (error) {
      console.error('Failed to initialize model configurations:', error);
    }
  }

  /**
   * Get models for a specific provider
   */
  getProviderModels(providerType: AIProviderType): string[] {
    return this.modelConfigs.get(providerType) || [];
  }

  /**
   * Check if a model is configured for any provider
   */
  isModelConfigured(model: string): boolean {
    for (const models of this.modelConfigs.values()) {
      if (models.includes(model)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the provider for a specific model
   */
  getProviderForModel(model: string): AIProviderType | null {
    for (const [provider, models] of this.modelConfigs.entries()) {
      if (models.includes(model)) {
        return provider;
      }
    }
    return null;
  }

  /**
   * Get all configured models in a format suitable for dropdowns
   */
  async getModelsForDropdown(): Promise<Array<{ provider: AIProviderType; model: string; available: boolean }>> {
    const dropdownModels: Array<{ provider: AIProviderType; model: string; available: boolean }> = [];

    for (const [providerType, models] of this.modelConfigs.entries()) {
      const provider = this.providers.get(providerType);
      const isProviderAvailable = !!provider;

      models.forEach(model => {
        dropdownModels.push({
          provider: providerType,
          model,
          available: isProviderAvailable
        });
      });
    }

    // Sort by provider, then by model name
    return dropdownModels.sort((a, b) => {
      if (a.provider !== b.provider) {
        return a.provider.localeCompare(b.provider);
      }
      return a.model.localeCompare(b.model);
    });
  }

  /**
   * Edit content using AI
   */
  async editContent(request: AIContentEditRequest): Promise<AIContentEditResponse> {
    const provider = this.getProviderForModel(request.model);

    if (!provider) {
      const aiError = AIErrorHandler.parseError(
        new Error(`Model ${request.model} is not configured`),
        { model: request.model, operation: 'editContent' }
      );

      AIErrorHandler.logError(aiError);

      return {
        success: false,
        changes: {},
        reasoning: aiError.message,
        confidence: 0,
        warnings: aiError.suggestions,
        model: request.model,
        tokensUsed: 0,
        cost: 0
      };
    }

    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      const aiError = AIErrorHandler.parseError(
        new Error(`Provider ${provider} is not available`),
        { provider, model: request.model, operation: 'editContent' }
      );

      AIErrorHandler.logError(aiError);

      return {
        success: false,
        changes: {},
        reasoning: aiError.message,
        confidence: 0,
        warnings: aiError.suggestions,
        model: request.model,
        tokensUsed: 0,
        cost: 0
      };
    }

    try {
      // Build the prompt based on the operation
      const prompt = this.buildContentEditPrompt(request);

      const chatRequest: ProviderChatRequest = {
        model: request.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        systemPrompt: request.systemPrompt || this.getDefaultSystemPrompt(),
        temperature: request.temperature ?? 0.7,
        maxTokens: 4000
      };

      const response = await providerInstance.chat(chatRequest);

      // Parse the structured response
      const parsedResponse = this.parseCustomPromptResponse(response.content, request);

      return {
        success: true,
        changes: parsedResponse.changes,
        reasoning: parsedResponse.reasoning,
        confidence: parsedResponse.confidence,
        warnings: parsedResponse.warnings,
        model: request.model,
        tokensUsed: response.tokensUsed,
        cost: response.cost
      };
    } catch (error) {
      const aiError = AIErrorHandler.parseError(error, {
        provider,
        model: request.model,
        operation: 'processCustomPrompt'
      });

      AIErrorHandler.logError(aiError);

      return {
        success: false,
        changes: {},
        reasoning: aiError.message,
        confidence: 0,
        warnings: aiError.suggestions,
        model: request.model,
        tokensUsed: 0,
        cost: 0
      };
    }
  }

  /**
   * Suggest tags for project content
   */
  async suggestTags(request: AITagSuggestionRequest): Promise<AITagSuggestionResponse> {
    const provider = this.getProviderForModel(request.model);

    if (!provider) {
      const aiError = AIErrorHandler.parseError(
        new Error(`Model ${request.model} is not configured`),
        { model: request.model, operation: 'suggestTags' }
      );

      AIErrorHandler.logError(aiError);

      return {
        success: false,
        suggestions: { add: [], remove: [] },
        reasoning: aiError.message,
        model: request.model,
        tokensUsed: 0,
        cost: 0
      };
    }

    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      const aiError = AIErrorHandler.parseError(
        new Error(`Provider ${provider} is not available`),
        { provider, model: request.model, operation: 'suggestTags' }
      );

      AIErrorHandler.logError(aiError);

      return {
        success: false,
        suggestions: { add: [], remove: [] },
        reasoning: aiError.message,
        model: request.model,
        tokensUsed: 0,
        cost: 0
      };
    }

    try {
      const prompt = this.buildTagSuggestionPrompt(request);

      const chatRequest: ProviderChatRequest = {
        model: request.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        systemPrompt: 'You are an expert at analyzing project content and suggesting relevant technology and skill tags. Provide structured JSON responses.',
        temperature: 0.3, // Lower temperature for more consistent tag suggestions
        maxTokens: 2000
      };

      const response = await providerInstance.chat(chatRequest);

      // Parse the tag suggestions
      const parsedResponse = this.parseTagSuggestionResponse(response.content);

      return {
        success: true,
        suggestions: parsedResponse.suggestions,
        reasoning: parsedResponse.reasoning,
        model: request.model,
        tokensUsed: response.tokensUsed,
        cost: response.cost
      };
    } catch (error) {
      const aiError = AIErrorHandler.parseError(error, {
        provider,
        model: request.model,
        operation: 'suggestTags'
      });

      AIErrorHandler.logError(aiError);

      return {
        success: false,
        suggestions: { add: [], remove: [] },
        reasoning: aiError.message,
        model: request.model,
        tokensUsed: 0,
        cost: 0
      };
    }
  }

  /**
   * Improve content using AI
   */
  async improveContent(request: AIContentEditRequest): Promise<AIContentEditResponse> {
    // Use the same editContent method but with 'improve' operation
    return this.editContent({ ...request, operation: 'improve' });
  }

  /**
   * Process custom prompt using AI (Claude Artifacts-style)
   * Single-prompt processing without maintaining chat history
   */
  async processCustomPrompt(request: AICustomPromptRequest): Promise<AICustomPromptResponse> {
    const provider = this.getProviderForModel(request.model);

    if (!provider) {
      const aiError = AIErrorHandler.parseError(
        new Error(`Model ${request.model} is not configured`),
        { model: request.model, operation: 'processCustomPrompt' }
      );

      AIErrorHandler.logError(aiError);

      return {
        success: false,
        changes: {},
        reasoning: aiError.message,
        confidence: 0,
        warnings: aiError.suggestions,
        model: request.model,
        tokensUsed: 0,
        cost: 0
      };
    }

    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      const aiError = AIErrorHandler.parseError(
        new Error(`Provider ${provider} is not available`),
        { provider, model: request.model, operation: 'processCustomPrompt' }
      );

      AIErrorHandler.logError(aiError);

      return {
        success: false,
        changes: {},
        reasoning: aiError.message,
        confidence: 0,
        warnings: aiError.suggestions,
        model: request.model,
        tokensUsed: 0,
        cost: 0
      };
    }

    try {
      // Build the prompt for custom processing
      const prompt = this.buildCustomPrompt(request);

      const chatRequest: ProviderChatRequest = {
        model: request.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        systemPrompt: request.systemPrompt || this.getCustomPromptSystemPrompt(),
        temperature: request.temperature ?? 0.7,
        maxTokens: 4000
      };

      const response = await providerInstance.chat(chatRequest);

      // Parse the structured response
      const parsedResponse = this.parseCustomPromptResponse(response.content, request);

      return {
        success: true,
        changes: parsedResponse.changes,
        reasoning: parsedResponse.reasoning,
        confidence: parsedResponse.confidence,
        warnings: parsedResponse.warnings,
        userFeedback: parsedResponse.userFeedback,
        model: request.model,
        tokensUsed: response.tokensUsed || 0,
        cost: response.cost || 0
      };
    } catch (error) {
      const aiError = AIErrorHandler.parseError(error, {
        provider,
        model: request.model,
        operation: 'processCustomPrompt'
      });

      AIErrorHandler.logError(aiError);

      return {
        success: false,
        changes: {},
        reasoning: aiError.message,
        confidence: 0,
        warnings: aiError.suggestions,
        model: request.model,
        tokensUsed: 0,
        cost: 0
      };
    }
  }

  /**
   * Build prompt for content editing operations
   */
  private buildContentEditPrompt(request: AIContentEditRequest): string {
    const { operation, content, selectedText, context } = request;

    let prompt = `Project: ${context.projectTitle}\n`;
    if (context.projectDescription) {
      prompt += `Description: ${context.projectDescription}\n`;
    }
    prompt += `Existing tags: ${context.existingTags.join(', ')}\n\n`;

    const targetText = selectedText ? selectedText.text : content;

    switch (operation) {
      case 'rewrite':
        prompt += `Please rewrite the following text to improve clarity and flow while maintaining the original meaning:\n\n"${targetText}"\n\n`;
        break;
      case 'improve':
        prompt += `Please improve the following text by enhancing clarity, fixing grammar, and making it more engaging:\n\n"${targetText}"\n\n`;
        break;
      case 'expand':
        prompt += `Please expand the following text with more detail and context, keeping it relevant to the project:\n\n"${targetText}"\n\n`;
        break;
      case 'summarize':
        prompt += `Please summarize the following text, keeping the key points concise:\n\n"${targetText}"\n\n`;
        break;
      case 'make_professional':
        prompt += `Please rewrite the following text in a more professional tone:\n\n"${targetText}"\n\n`;
        break;
      case 'make_casual':
        prompt += `Please rewrite the following text in a more casual, friendly tone:\n\n"${targetText}"\n\n`;
        break;
    }

    prompt += `Please respond with a JSON object containing:
{
  "newText": "the improved text",
  "reasoning": "explanation of changes made",
  "confidence": 0.8,
  "warnings": ["any warnings or notes"],
  "suggestedTags": {
    "add": ["new tag suggestions based on content"],
    "remove": ["tags that might not fit"],
    "reasoning": "explanation for tag suggestions"
  }
}`;

    return prompt;
  }

  /**
   * Build prompt for tag suggestions
   */
  private buildTagSuggestionPrompt(request: AITagSuggestionRequest): string {
    let prompt = `Analyze this project and suggest relevant tags:\n\n`;
    prompt += `Title: ${request.projectTitle}\n`;
    if (request.projectDescription) {
      prompt += `Description: ${request.projectDescription}\n`;
    }
    prompt += `Content: ${request.articleContent.substring(0, 2000)}...\n\n`;
    prompt += `Current tags: ${request.existingTags.join(', ')}\n\n`;

    prompt += `Please suggest up to ${request.maxSuggestions || 5} new tags and identify any current tags that might not fit. `;
    prompt += `Focus on technology stacks, programming languages, frameworks, tools, and relevant skills.\n\n`;

    prompt += `Respond with JSON:
{
  "suggestions": {
    "add": [
      {
        "tag": "suggested-tag",
        "confidence": 0.9,
        "reasoning": "why this tag fits"
      }
    ],
    "remove": [
      {
        "tag": "existing-tag",
        "reasoning": "why this tag might not fit"
      }
    ]
  },
  "reasoning": "overall analysis of the project's technology focus"
}`;

    return prompt;
  }

  /**
   * Parse content edit response from AI
   */
  private parseContentEditResponse(response: string, request: AIContentEditRequest): {
    changes: AIContentEditResponse['changes'];
    reasoning: string;
    confidence: number;
    warnings: string[];
  } {
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to parse as JSON
      const parsed = JSON.parse(cleanResponse);

      const changes: AIContentEditResponse['changes'] = {};

      if (parsed.newText) {
        if (request.selectedText) {
          // Partial update for selected text
          changes.partialUpdate = {
            start: request.selectedText.start,
            end: request.selectedText.end,
            newText: parsed.newText,
            reasoning: parsed.reasoning || 'AI-generated improvement'
          };
        } else {
          // Full content replacement when no text is selected
          changes.fullContent = parsed.newText;
        }
      }

      if (parsed.suggestedTags) {
        changes.suggestedTags = {
          add: parsed.suggestedTags.add || [],
          remove: parsed.suggestedTags.remove || [],
          reasoning: parsed.suggestedTags.reasoning || 'AI-generated tag suggestions'
        };
      }

      return {
        changes,
        reasoning: parsed.reasoning || 'Content improved by AI',
        confidence: parsed.confidence || 0.8,
        warnings: parsed.warnings || []
      };
    } catch (error) {
      // Fallback to text parsing if JSON parsing fails
      return {
        changes: {
          fullContent: response
        },
        reasoning: 'AI response could not be parsed as structured data',
        confidence: 0.6,
        warnings: ['Response format was not structured - using raw text']
      };
    }
  }

  /**
   * Parse tag suggestion response from AI
   */
  private parseTagSuggestionResponse(response: string): {
    suggestions: AITagSuggestionResponse['suggestions'];
    reasoning: string;
  } {
    try {
      const parsed = JSON.parse(response);

      return {
        suggestions: {
          add: parsed.suggestions?.add || [],
          remove: parsed.suggestions?.remove || []
        },
        reasoning: parsed.reasoning || 'AI-generated tag analysis'
      };
    } catch (error) {
      // Fallback parsing
      return {
        suggestions: { add: [], remove: [] },
        reasoning: 'Could not parse tag suggestions from AI response'
      };
    }
  }

  /**
   * Parse custom prompt response from AI
   */
  private parseCustomPromptResponse(response: string, request: AICustomPromptRequest): {
    changes: AICustomPromptResponse['changes'];
    reasoning: string;
    confidence: number;
    warnings: string[];
    userFeedback?: string;
  } {
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to parse as JSON
      const parsed = JSON.parse(cleanResponse);
      
      const changes: AICustomPromptResponse['changes'] = {};
      
      // Handle different types of changes
      if (parsed.changes) {
        if (parsed.changes.fullContent) {
          changes.fullContent = parsed.changes.fullContent;
        }
        
        if (parsed.changes.partialUpdate) {
          changes.partialUpdate = {
            start: parsed.changes.partialUpdate.start || (request.selectedText?.start ?? 0),
            end: parsed.changes.partialUpdate.end || (request.selectedText?.end ?? request.content.length),
            newText: parsed.changes.partialUpdate.newText || '',
            reasoning: parsed.changes.partialUpdate.reasoning || 'AI-generated improvement'
          };
        }
        
        if (parsed.changes.suggestedTags) {
          changes.suggestedTags = {
            add: parsed.changes.suggestedTags.add || [],
            remove: parsed.changes.suggestedTags.remove || [],
            reasoning: parsed.changes.suggestedTags.reasoning || 'AI-generated tag suggestions'
          };
        }
        
        if (parsed.changes.suggestedTitle) {
          changes.suggestedTitle = parsed.changes.suggestedTitle;
        }
        
        if (parsed.changes.suggestedDescription) {
          changes.suggestedDescription = parsed.changes.suggestedDescription;
        }
      }
      
      return {
        changes,
        reasoning: parsed.reasoning || 'Content processed by AI',
        confidence: parsed.confidence || 0.8,
        warnings: parsed.warnings || [],
        userFeedback: parsed.userFeedback
      };
    } catch (error) {
      // Fallback to text parsing if JSON parsing fails
      return {
        changes: {
          fullContent: response
        },
        reasoning: 'AI response could not be parsed as structured data - using raw text',
        confidence: 0.6,
        warnings: ['Response format was not structured - using raw text'],
        userFeedback: 'The AI response was not in the expected format. You may need to manually review and apply changes.'
      };
    }
  }

  /**
   * Get default system prompt for content editing
   */
  private getDefaultSystemPrompt(): string {
    return 'You are an expert content editor for portfolio projects. Help improve and edit project content while maintaining the author\'s voice and style. Always provide structured JSON responses when requested.';
  }

  /**
   * Get system prompt for custom prompt processing
   */
  private getCustomPromptSystemPrompt(): string {
    return `You are an expert content editor and writing assistant for portfolio projects. You help developers improve their project documentation, articles, and content.

When processing user prompts:
1. Understand the user's intent and apply it to the provided content
2. Maintain the author's voice and technical accuracy
3. Provide helpful feedback and suggestions
4. Always respond with structured JSON format

Your responses should be professional, helpful, and focused on improving the content quality while respecting the user's specific requests.`;
  }

  /**
   * Build prompt for custom prompt processing
   */
  private buildCustomPrompt(request: AICustomPromptRequest): string {
    const { prompt, content, selectedText, context } = request;

    let builtPrompt = `Project Context:
Title: ${context.projectTitle}
Description: ${context.projectDescription || 'No description provided'}
Existing Tags: ${context.existingTags.join(', ') || 'None'}

`;

    if (selectedText) {
      builtPrompt += `Selected Text to Process:
"${selectedText.text}"

Full Article Context:
${context.fullContent.substring(0, 1000)}${context.fullContent.length > 1000 ? '...' : ''}

`;
    } else {
      builtPrompt += `Content to Process:
${content}

`;
    }

    builtPrompt += `User Request:
${prompt}

Please process the ${selectedText ? 'selected text' : 'content'} according to the user's request. Respond with a JSON object containing:

{
  "success": true,
  "changes": {
    "fullContent": "complete new content (if replacing entire content)",
    "partialUpdate": {
      "start": ${selectedText?.start || 0},
      "end": ${selectedText?.end || content.length},
      "newText": "replacement text for selected portion",
      "reasoning": "explanation of changes made"
    },
    "suggestedTags": {
      "add": ["new tag suggestions based on content changes"],
      "remove": ["tags that might not fit after changes"],
      "reasoning": "explanation for tag suggestions"
    },
    "suggestedTitle": "improved title if relevant",
    "suggestedDescription": "improved description if relevant"
  },
  "reasoning": "detailed explanation of what you did and why",
  "confidence": 0.9,
  "warnings": ["any important notes or limitations"],
  "userFeedback": "helpful feedback or suggestions for the user (optional)"
}

Important:
- Only include the fields in "changes" that are actually being modified
- If processing selected text, use "partialUpdate", otherwise use "fullContent"
- Provide clear reasoning for all changes
- Include helpful user feedback when appropriate
- Set confidence based on how well you could fulfill the request`;

    return builtPrompt;
  }

  
}