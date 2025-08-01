import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AIRequest, AIResponse, AIModel, AIProvider, ProjectContext } from '@/lib/types/project';

/**
 * AI service provider interface
 */
export interface AIServiceProvider {
  name: 'anthropic' | 'openai';
  chat(request: AIRequest): Promise<AIResponse>;
  validateApiKey(apiKey: string): Promise<boolean>;
  getModels(): Promise<AIModel[]>;
  estimateTokens(text: string): number;
  calculateCost(tokens: number, model: string): number;
}

/**
 * Available AI models configuration
 */
export const AI_MODELS = {
  anthropic: [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      maxTokens: 200000,
      costPer1kTokens: 0.015,
      capabilities: ['json-mode', 'long-context', 'complex-reasoning']
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      maxTokens: 200000,
      costPer1kTokens: 0.0025,
      capabilities: ['json-mode', 'fast-response']
    }
  ],
  openai: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      maxTokens: 128000,
      costPer1kTokens: 0.03,
      capabilities: ['json-mode', 'function-calling', 'vision']
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      maxTokens: 128000,
      costPer1kTokens: 0.0015,
      capabilities: ['json-mode', 'fast-response']
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      maxTokens: 16000,
      costPer1kTokens: 0.002,
      capabilities: ['json-mode']
    }
  ]
};

/**
 * Anthropic provider implementation
 */
export class AnthropicProvider implements AIServiceProvider {
  readonly name = 'anthropic' as const;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey: apiKey,
    });
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      const message = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens || 4000,
        temperature: request.temperature || 0.7,
        system: request.systemPrompt || 'You are a helpful assistant.',
        messages: [
          { role: 'user', content: this.buildPrompt(request) }
        ]
      });

      const duration = Date.now() - startTime;
      const tokens = message.usage?.input_tokens + message.usage?.output_tokens || 0;
      const cost = this.calculateCost(tokens, request.model);

      return {
        content: message.content[0]?.type === 'text' ? message.content[0].text : '',
        metadata: {
          model: request.model,
          tokens,
          cost,
          duration
        }
      };
    } catch (error: unknown) {
      return {
        content: '',
        error: this.handleError(error),
        metadata: {
          model: request.model,
          tokens: 0,
          cost: 0,
          duration: Date.now() - startTime
        }
      };
    }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }]
      });
      return true;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<AIModel[]> {
    return AI_MODELS.anthropic;
  }

  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  calculateCost(tokens: number, model: string): number {
    const modelConfig = AI_MODELS.anthropic.find(m => m.id === model);
    if (!modelConfig) return 0;
    return (tokens / 1000) * modelConfig.costPer1kTokens;
  }

  private buildPrompt(request: AIRequest): string {
    const context = this.formatContext(request.context);
    return `${request.prompt}\n\n**Context:**\n${context}`;
  }

  private formatContext(context: ProjectContext): string {
    return JSON.stringify({
      title: context.metadata?.title,
      description: context.metadata?.description,
      tags: context.tags,
      currentContent: context.currentContent.substring(0, 2000) + '...',
      selectedText: context.selectedText
    }, null, 2);
  }

  private handleError(error: unknown): string {
    const errorObj = error as Record<string, unknown>;
    if (errorObj.status === 429) {
      return 'Rate limit exceeded. Please try again later.';
    }
    if (errorObj.status === 401) {
      return 'Invalid API key for Anthropic. Please check your settings.';
    }
    return `AI service error: ${errorObj.message || 'Unknown error'}`;
  }
}

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider implements AIServiceProvider {
  readonly name = 'openai' as const;
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey: apiKey,
    });
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      const completion = await this.client.chat.completions.create({
        model: request.model,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 4000,
        messages: [
          { role: 'system', content: request.systemPrompt || 'You are a helpful assistant.' },
          { role: 'user', content: this.buildPrompt(request) }
        ]
      });

      const duration = Date.now() - startTime;
      const tokens = completion.usage?.total_tokens || 0;
      const cost = this.calculateCost(tokens, request.model);

      return {
        content: completion.choices[0]?.message?.content || '',
        metadata: {
          model: request.model,
          tokens,
          cost,
          duration
        }
      };
    } catch (error: unknown) {
      return {
        content: '',
        error: this.handleError(error),
        metadata: {
          model: request.model,
          tokens: 0,
          cost: 0,
          duration: Date.now() - startTime
        }
      };
    }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const client = new OpenAI({ apiKey });
      await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'test' }]
      });
      return true;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<AIModel[]> {
    return AI_MODELS.openai;
  }

  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  calculateCost(tokens: number, model: string): number {
    const modelConfig = AI_MODELS.openai.find(m => m.id === model);
    if (!modelConfig) return 0;
    return (tokens / 1000) * modelConfig.costPer1kTokens;
  }

  private buildPrompt(request: AIRequest): string {
    const context = this.formatContext(request.context);
    return `${request.prompt}\n\n**Context:**\n${context}`;
  }

  private formatContext(context: ProjectContext): string {
    return JSON.stringify({
      title: context.metadata?.title,
      description: context.metadata?.description,
      tags: context.tags,
      currentContent: context.currentContent.substring(0, 2000) + '...',
      selectedText: context.selectedText
    }, null, 2);
  }

  private handleError(error: unknown): string {
    const errorObj = error as Record<string, unknown>;
    if (errorObj.status === 429) {
      return 'Rate limit exceeded. Please try again later.';
    }
    if (errorObj.status === 401) {
      return 'Invalid API key for OpenAI. Please check your settings.';
    }
    return `AI service error: ${errorObj.message || 'Unknown error'}`;
  }
}

/**
 * AI service factory
 */
export class AIServiceFactory {
  static createProvider(provider: 'anthropic' | 'openai', apiKey: string): AIServiceProvider {
    switch (provider) {
      case 'anthropic':
        return new AnthropicProvider(apiKey);
      case 'openai':
        return new OpenAIProvider(apiKey);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  static getAvailableProviders(): AIProvider[] {
    return [
      {
        name: 'anthropic',
        models: AI_MODELS.anthropic,
        isConfigured: false,
        rateLimit: {
          requestsPerMinute: 60,
          tokensPerMinute: 40000
        }
      },
      {
        name: 'openai',
        models: AI_MODELS.openai,
        isConfigured: false,
        rateLimit: {
          requestsPerMinute: 60,
          tokensPerMinute: 40000
        }
      }
    ];
  }
}