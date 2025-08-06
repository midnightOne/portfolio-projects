/**
 * Content AI Function - Example system function for advanced content operations
 */

import { AIFunction, AIFunctionRequest, AIFunctionResponse, AIFunctionSchema } from '../types';

export interface ContentParameters {
  operation: 'generate_project_description' | 'create_blog_post' | 'optimize_seo' | 'translate_content';
  input: {
    projectId?: string;
    title?: string;
    technologies?: string[];
    features?: string[];
    targetAudience?: string;
    tone?: 'professional' | 'casual' | 'technical' | 'creative';
    length?: 'short' | 'medium' | 'long';
    language?: string;
    existingContent?: string;
  };
  options: {
    includeSEO?: boolean;
    includeCallToAction?: boolean;
    generateTags?: boolean;
    model?: string;
    temperature?: number;
  };
}

export interface ContentResult {
  operationId: string;
  operation: string;
  success: boolean;
  content: {
    title?: string;
    description?: string;
    body?: string;
    summary?: string;
    tags?: string[];
    seoMetadata?: {
      metaTitle: string;
      metaDescription: string;
      keywords: string[];
      structuredData?: any;
    };
    callToAction?: string;
  };
  metadata: {
    wordCount: number;
    readabilityScore: number;
    seoScore: number;
    originalLanguage?: string;
    targetLanguage?: string;
  };
  suggestions: Array<{
    type: 'improvement' | 'alternative' | 'enhancement';
    description: string;
    impact: 'high' | 'medium' | 'low';
  }>;
}

export class ContentFunction implements AIFunction {
  schema: AIFunctionSchema = {
    name: 'generate_content',
    description: 'Generate, optimize, or translate content using AI',
    parameters: [
      {
        name: 'operation',
        type: 'string',
        description: 'Type of content operation to perform',
        required: true,
        enum: ['generate_project_description', 'create_blog_post', 'optimize_seo', 'translate_content']
      },
      {
        name: 'input',
        type: 'object',
        description: 'Input data for content generation',
        required: true
      },
      {
        name: 'options',
        type: 'object',
        description: 'Content generation options',
        required: false,
        default: { includeSEO: true, includeCallToAction: true }
      }
    ],
    category: 'content',
    permissions: ['admin', 'content_editor'],
    version: '1.0.0'
  };

  async execute(request: AIFunctionRequest): Promise<AIFunctionResponse> {
    const parameters = request.parameters as ContentParameters;
    
    try {
      const operationId = `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Perform content operation based on type
      const result = await this.performContentOperation(operationId, parameters, request);

      return {
        success: true,
        result,
        metadata: {
          executionTime: Date.now() - request.context.timestamp.getTime(),
          tokensUsed: this.estimateTokensUsed(parameters),
          cost: this.estimateCost(parameters)
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CONTENT_GENERATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error
        },
        metadata: {
          executionTime: Date.now() - request.context.timestamp.getTime()
        }
      };
    }
  }

  async validate(parameters: Record<string, any>): Promise<boolean> {
    const params = parameters as ContentParameters;
    
    // Validate operation type
    if (!params.operation || !['generate_project_description', 'create_blog_post', 'optimize_seo', 'translate_content'].includes(params.operation)) {
      return false;
    }

    // Validate input object
    if (!params.input || typeof params.input !== 'object') {
      return false;
    }

    // Operation-specific validation
    switch (params.operation) {
      case 'generate_project_description':
        return !!(params.input.title || params.input.projectId);
      
      case 'create_blog_post':
        return !!(params.input.title && params.input.targetAudience);
      
      case 'optimize_seo':
        return !!(params.input.existingContent);
      
      case 'translate_content':
        return !!(params.input.existingContent && params.input.language);
      
      default:
        return false;
    }
  }

  async authorize(context: any): Promise<boolean> {
    // Check if user has admin or content_editor permissions
    return context.userId && (
      context.permissions?.includes('admin') || 
      context.permissions?.includes('content_editor')
    );
  }

  private async performContentOperation(
    operationId: string,
    parameters: ContentParameters,
    request: AIFunctionRequest
  ): Promise<ContentResult> {
    
    switch (parameters.operation) {
      case 'generate_project_description':
        return this.generateProjectDescription(operationId, parameters);
      
      case 'create_blog_post':
        return this.createBlogPost(operationId, parameters);
      
      case 'optimize_seo':
        return this.optimizeSEO(operationId, parameters);
      
      case 'translate_content':
        return this.translateContent(operationId, parameters);
      
      default:
        throw new Error(`Unknown content operation: ${parameters.operation}`);
    }
  }

  private async generateProjectDescription(
    operationId: string,
    parameters: ContentParameters
  ): Promise<ContentResult> {
    // Simulate project description generation
    const { input, options } = parameters;
    
    const generatedContent = {
      title: input.title || 'Innovative Web Application',
      description: this.generateDescription(input),
      tags: options.generateTags ? this.generateTags(input) : undefined,
      seoMetadata: options.includeSEO ? this.generateSEOMetadata(input) : undefined,
      callToAction: options.includeCallToAction ? this.generateCallToAction(input) : undefined
    };

    return {
      operationId,
      operation: 'generate_project_description',
      success: true,
      content: generatedContent,
      metadata: {
        wordCount: this.countWords(generatedContent.description || ''),
        readabilityScore: 8.2,
        seoScore: 7.8
      },
      suggestions: [
        {
          type: 'enhancement',
          description: 'Consider adding more technical details about the implementation',
          impact: 'medium'
        },
        {
          type: 'improvement',
          description: 'Include specific metrics or results achieved',
          impact: 'high'
        }
      ]
    };
  }

  private async createBlogPost(
    operationId: string,
    parameters: ContentParameters
  ): Promise<ContentResult> {
    // Simulate blog post creation
    const { input, options } = parameters;
    
    const blogContent = {
      title: input.title || 'Exploring Modern Web Development',
      body: this.generateBlogContent(input),
      summary: 'A comprehensive guide to modern web development practices and technologies.',
      tags: options.generateTags ? ['web-development', 'programming', 'tutorial'] : undefined,
      seoMetadata: options.includeSEO ? this.generateSEOMetadata(input) : undefined,
      callToAction: options.includeCallToAction ? 'Ready to start your next project? Get in touch!' : undefined
    };

    return {
      operationId,
      operation: 'create_blog_post',
      success: true,
      content: blogContent,
      metadata: {
        wordCount: this.countWords(blogContent.body || ''),
        readabilityScore: 7.9,
        seoScore: 8.1
      },
      suggestions: [
        {
          type: 'enhancement',
          description: 'Add code examples to illustrate key concepts',
          impact: 'high'
        },
        {
          type: 'improvement',
          description: 'Include relevant images or diagrams',
          impact: 'medium'
        }
      ]
    };
  }

  private async optimizeSEO(
    operationId: string,
    parameters: ContentParameters
  ): Promise<ContentResult> {
    // Simulate SEO optimization
    const { input } = parameters;
    
    const optimizedContent = {
      title: this.optimizeTitle(input.existingContent || ''),
      description: this.optimizeDescription(input.existingContent || ''),
      seoMetadata: this.generateSEOMetadata(input),
      tags: this.extractAndOptimizeTags(input.existingContent || '')
    };

    return {
      operationId,
      operation: 'optimize_seo',
      success: true,
      content: optimizedContent,
      metadata: {
        wordCount: this.countWords(input.existingContent || ''),
        readabilityScore: 8.0,
        seoScore: 9.2
      },
      suggestions: [
        {
          type: 'improvement',
          description: 'Add internal links to related content',
          impact: 'medium'
        },
        {
          type: 'enhancement',
          description: 'Include structured data markup',
          impact: 'high'
        }
      ]
    };
  }

  private async translateContent(
    operationId: string,
    parameters: ContentParameters
  ): Promise<ContentResult> {
    // Simulate content translation
    const { input } = parameters;
    
    const translatedContent = {
      title: `Translated: ${input.title || 'Content'}`,
      description: `Translated content to ${input.language}`,
      body: input.existingContent ? `[Translated to ${input.language}] ${input.existingContent}` : undefined
    };

    return {
      operationId,
      operation: 'translate_content',
      success: true,
      content: translatedContent,
      metadata: {
        wordCount: this.countWords(translatedContent.body || ''),
        readabilityScore: 7.5,
        seoScore: 7.0,
        originalLanguage: 'en',
        targetLanguage: input.language || 'es'
      },
      suggestions: [
        {
          type: 'improvement',
          description: 'Review cultural context and localize examples',
          impact: 'high'
        },
        {
          type: 'enhancement',
          description: 'Adapt SEO keywords for target language',
          impact: 'medium'
        }
      ]
    };
  }

  // Helper methods for content generation
  private generateDescription(input: ContentParameters['input']): string {
    const technologies = input.technologies?.join(', ') || 'modern web technologies';
    const features = input.features?.join(', ') || 'innovative features';
    
    return `A comprehensive ${input.tone || 'professional'} application built with ${technologies}. This project showcases ${features} and demonstrates expertise in full-stack development. The application provides an intuitive user experience while maintaining high performance and scalability standards.`;
  }

  private generateTags(input: ContentParameters['input']): string[] {
    const baseTags = ['web-development', 'full-stack'];
    const techTags = input.technologies?.map(tech => tech.toLowerCase().replace(/\s+/g, '-')) || [];
    return [...baseTags, ...techTags].slice(0, 8);
  }

  private generateSEOMetadata(input: ContentParameters['input']) {
    return {
      metaTitle: `${input.title || 'Project'} - Professional Web Development`,
      metaDescription: `Explore this innovative ${input.title || 'project'} built with ${input.technologies?.join(', ') || 'modern technologies'}. Professional web development showcase.`,
      keywords: ['web development', 'portfolio', ...(input.technologies || [])].slice(0, 10)
    };
  }

  private generateCallToAction(input: ContentParameters['input']): string {
    const actions = [
      'View the live demo and explore the features',
      'Check out the source code on GitHub',
      'Get in touch to discuss similar projects',
      'Learn more about the technologies used'
    ];
    
    return actions[Math.floor(Math.random() * actions.length)];
  }

  private generateBlogContent(input: ContentParameters['input']): string {
    return `# ${input.title}

In today's rapidly evolving web development landscape, staying current with the latest technologies and best practices is crucial for building successful applications.

## Introduction

This comprehensive guide explores the key concepts and practical applications that every developer should understand when working with ${input.technologies?.join(', ') || 'modern web technologies'}.

## Key Concepts

Understanding the fundamentals is essential for building robust, scalable applications that meet user needs and business requirements.

## Best Practices

Following industry best practices ensures code quality, maintainability, and team collaboration effectiveness.

## Conclusion

By implementing these strategies and staying updated with emerging trends, developers can create exceptional user experiences and drive project success.`;
  }

  private optimizeTitle(content: string): string {
    // Simple title optimization simulation
    return content.split('\n')[0]?.replace(/^#+\s*/, '') || 'Optimized Title';
  }

  private optimizeDescription(content: string): string {
    // Simple description optimization simulation
    const sentences = content.split('.').slice(0, 3);
    return sentences.join('.') + '.';
  }

  private extractAndOptimizeTags(content: string): string[] {
    // Simple tag extraction simulation
    const words = content.toLowerCase().match(/\b\w+\b/g) || [];
    const commonTech = ['react', 'typescript', 'nextjs', 'nodejs', 'javascript', 'css', 'html'];
    return words.filter(word => commonTech.includes(word)).slice(0, 6);
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private estimateTokensUsed(parameters: ContentParameters): number {
    const baseTokens = {
      'generate_project_description': 1500,
      'create_blog_post': 3000,
      'optimize_seo': 1000,
      'translate_content': 2000
    };

    const lengthMultiplier = parameters.input.length === 'long' ? 2 : 
                           parameters.input.length === 'medium' ? 1.5 : 1;

    return Math.floor((baseTokens[parameters.operation] || 1500) * lengthMultiplier);
  }

  private estimateCost(parameters: ContentParameters): number {
    const tokensUsed = this.estimateTokensUsed(parameters);
    return (tokensUsed / 1000) * 0.002; // Rough cost estimation
  }
}