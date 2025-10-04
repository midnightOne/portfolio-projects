/**
 * Summary Generation Service
 * 
 * Configurable AI summary generation with anti-hallucination measures,
 * model selection, and quality tracking for T1/T2 generation.
 */

import OpenAI from 'openai';
import { getBudgetAwareAI } from './BudgetAwareAIOperations';

export interface SummaryGenerationConfig {
  id: string;
  name: string;
  
  // Model selection
  model: string;
  temperature: number;
  
  // Configurable prompts
  t1SystemPrompt: string;
  t2SystemPrompt: string;
  
  // Length constraints
  t1MaxLength: number;
  t2MaxLength: number;
  
  // Quality controls
  preventHallucination: boolean;
  preserveKeywords: boolean;
  requireFactualAccuracy: boolean;
  
  // Metadata
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SummaryGenerationOptions {
  content: string;
  type: 'T1' | 'T2';
  projectId?: string;
  sectionTitle?: string;
  configId?: string;
  metadata?: Record<string, any>;
}

export interface SummaryGenerationResult {
  summary: string;
  tokensUsed: number;
  cost: number;
  confidenceScore: number;
  qualityMetrics: {
    factualAccuracy: number;
    keywordPreservation: number;
    lengthCompliance: boolean;
    hallucinationRisk: 'low' | 'medium' | 'high';
  };
  configUsed: string;
  modelUsed: string;
}

export interface SummaryGenerationLog {
  id: string;
  configId: string;
  chunkId?: string;
  projectId?: string;
  
  // Input
  originalContent: string;
  promptUsed: string;
  modelUsed: string;
  
  // Output
  generatedSummary: string;
  tokensUsed: number;
  cost: number;
  
  // Quality metrics
  confidenceScore: number;
  manualReviewFlag: boolean;
  qualityRating?: number;
  
  // Metadata
  generatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

export class SummaryGenerationService {
  private budgetAwareAI = getBudgetAwareAI();
  
  // Default configurations
  private readonly DEFAULT_CONFIGS: Record<string, Omit<SummaryGenerationConfig, 'id' | 'createdAt' | 'updatedAt'>> = {
    'default-balanced': {
      name: 'Balanced Quality',
      model: 'gpt-4o-mini',
      temperature: 0.3,
      t1SystemPrompt: `You are a technical writer creating concise project summaries. 

CRITICAL INSTRUCTIONS:
- Base your summary ONLY on the provided content
- Do NOT add information not present in the source
- Use factual, technical language
- Preserve key technical terms and project names exactly
- Focus on: main purpose, key technologies, primary outcomes

Create a 1-2 sentence summary (50-100 words) that captures the essence of this project.`,
      
      t2SystemPrompt: `You are a technical writer creating section summaries.

CRITICAL INSTRUCTIONS:
- Base your summary ONLY on the provided section content
- Do NOT add information not present in the source
- Preserve technical terms, names, and specific details exactly
- Focus on: key points, implementation details, specific outcomes
- Maintain the technical depth of the original

Create a concise summary (100-200 words) of this section's main points and technical details.`,
      
      t1MaxLength: 100,
      t2MaxLength: 200,
      preventHallucination: true,
      preserveKeywords: true,
      requireFactualAccuracy: true,
      isDefault: true
    },
    
    'high-quality': {
      name: 'High Quality (GPT-4o)',
      model: 'gpt-4o',
      temperature: 0.2,
      t1SystemPrompt: `You are an expert technical writer with deep understanding of software development.

ANTI-HALLUCINATION PROTOCOL:
- ONLY use information explicitly stated in the provided content
- If uncertain about any detail, omit it rather than guess
- Preserve all technical terms, project names, and specific metrics exactly
- Cross-reference claims against the source content

Create a precise, factual project summary (50-100 words) focusing on verified technical achievements and measurable outcomes.`,
      
      t2SystemPrompt: `You are an expert technical writer creating detailed section summaries.

ANTI-HALLUCINATION PROTOCOL:
- ONLY use information explicitly stated in the section content
- Preserve all technical specifications, implementation details, and metrics exactly
- If a detail is unclear, describe what is actually stated rather than interpreting
- Maintain technical accuracy over readability

Create a comprehensive summary (150-300 words) that preserves all technical details and specific implementation information.`,
      
      t1MaxLength: 100,
      t2MaxLength: 300,
      preventHallucination: true,
      preserveKeywords: true,
      requireFactualAccuracy: true,
      isDefault: false
    },
    
    'cost-optimized': {
      name: 'Cost Optimized',
      model: 'gpt-4o-mini',
      temperature: 0.4,
      t1SystemPrompt: `Create a brief project summary based only on the provided content. Focus on main purpose and key technologies. 50-80 words.`,
      t2SystemPrompt: `Summarize this section's key points and technical details. Stay factual and preserve important terms. 100-150 words.`,
      t1MaxLength: 80,
      t2MaxLength: 150,
      preventHallucination: true,
      preserveKeywords: true,
      requireFactualAccuracy: false,
      isDefault: false
    }
  };

  /**
   * Generate summary with quality controls and anti-hallucination measures
   */
  async generateSummary(options: SummaryGenerationOptions): Promise<SummaryGenerationResult> {
    const config = this.getConfig(options.configId);
    const systemPrompt = options.type === 'T1' ? config.t1SystemPrompt : config.t2SystemPrompt;
    const maxLength = options.type === 'T1' ? config.t1MaxLength : config.t2MaxLength;

    // Enhance prompt with anti-hallucination measures if enabled
    const enhancedPrompt = config.preventHallucination 
      ? this.enhancePromptForFactualAccuracy(systemPrompt, options)
      : systemPrompt;

    // Generate summary using budget-aware AI operations
    const result = await this.budgetAwareAI.generateSummary({
      content: options.content,
      systemPrompt: enhancedPrompt,
      model: config.model,
      maxTokens: Math.ceil(maxLength * 1.3), // Allow some buffer for token estimation
      temperature: config.temperature,
      projectId: options.projectId,
      metadata: {
        summaryType: options.type,
        configId: config.id,
        sectionTitle: options.sectionTitle,
        ...options.metadata
      }
    });

    // Analyze quality metrics
    const qualityMetrics = this.analyzeQuality(
      result.summary,
      options.content,
      config,
      maxLength
    );

    // Calculate confidence score
    const confidenceScore = this.calculateConfidenceScore(qualityMetrics, config);

    // Log generation for quality tracking
    await this.logGeneration({
      configId: config.id,
      projectId: options.projectId,
      originalContent: options.content,
      promptUsed: enhancedPrompt,
      modelUsed: config.model,
      generatedSummary: result.summary,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      confidenceScore,
      manualReviewFlag: qualityMetrics.hallucinationRisk === 'high' || confidenceScore < 0.7,
      generatedAt: new Date()
    });

    return {
      summary: result.summary,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      confidenceScore,
      qualityMetrics,
      configUsed: config.name,
      modelUsed: config.model
    };
  }

  /**
   * Test summary generation with custom prompt
   */
  async testGeneration(params: {
    content: string;
    prompt: string;
    model: string;
    maxLength: number;
  }): Promise<{
    summary: string;
    tokensUsed: number;
    cost: number;
    confidenceScore: number;
  }> {
    const result = await this.budgetAwareAI.generateSummary({
      content: params.content,
      systemPrompt: params.prompt,
      model: params.model,
      maxTokens: Math.ceil(params.maxLength * 1.3),
      temperature: 0.3,
      metadata: { testGeneration: true }
    });

    // Basic quality analysis for test
    const qualityMetrics = this.analyzeQuality(
      result.summary,
      params.content,
      this.getConfig('default-balanced'),
      params.maxLength
    );

    const confidenceScore = this.calculateConfidenceScore(qualityMetrics, this.getConfig('default-balanced'));

    return {
      summary: result.summary,
      tokensUsed: result.tokensUsed,
      cost: result.cost,
      confidenceScore
    };
  }

  /**
   * Get configuration by ID or default
   */
  private getConfig(configId?: string): SummaryGenerationConfig {
    const configKey = configId || 'default-balanced';
    const baseConfig = this.DEFAULT_CONFIGS[configKey] || this.DEFAULT_CONFIGS['default-balanced'];
    
    return {
      id: configKey,
      ...baseConfig,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Enhance prompt with anti-hallucination measures
   */
  private enhancePromptForFactualAccuracy(
    basePrompt: string, 
    options: SummaryGenerationOptions
  ): string {
    let enhancedPrompt = basePrompt;

    // Add content verification instructions
    enhancedPrompt += `\n\nVERIFICATION CHECKLIST:
- Every fact in your summary must be verifiable in the source content
- If you cannot find explicit support for a statement, do not include it
- Preserve exact technical terms, project names, and metrics from the source
- When in doubt, be more conservative and factual rather than creative`;

    // Add section-specific context for T2 summaries
    if (options.type === 'T2' && options.sectionTitle) {
      enhancedPrompt += `\n\nSECTION CONTEXT: You are summarizing the "${options.sectionTitle}" section.`;
    }

    // Add keyword preservation instruction
    const keyTerms = this.extractKeyTerms(options.content);
    if (keyTerms.length > 0) {
      enhancedPrompt += `\n\nKEY TERMS TO PRESERVE: ${keyTerms.join(', ')}`;
    }

    return enhancedPrompt;
  }

  /**
   * Extract key technical terms from content
   */
  private extractKeyTerms(content: string): string[] {
    const terms = new Set<string>();
    
    // Technical patterns
    const patterns = [
      /\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b/g, // PascalCase (React, TypeScript, etc.)
      /\b[a-z]+(?:-[a-z]+)+\b/g,          // kebab-case (next-js, etc.)
      /\b[a-z]+(?:\.[a-z]+)+\b/g,         // dot notation (node.js, etc.)
      /\b\d+(?:\.\d+)*\b/g,               // Version numbers
      /\b[A-Z]{2,}\b/g                    // Acronyms (API, UI, etc.)
    ];

    patterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      matches.forEach(match => {
        if (match.length > 2 && match.length < 20) {
          terms.add(match);
        }
      });
    });

    return Array.from(terms).slice(0, 10); // Limit to top 10 terms
  }

  /**
   * Analyze summary quality
   */
  private analyzeQuality(
    summary: string,
    originalContent: string,
    config: SummaryGenerationConfig,
    maxLength: number
  ): SummaryGenerationResult['qualityMetrics'] {
    // Length compliance
    const wordCount = summary.split(/\s+/).length;
    const lengthCompliance = wordCount <= maxLength;

    // Keyword preservation (basic check)
    const keyTerms = this.extractKeyTerms(originalContent);
    const preservedTerms = keyTerms.filter(term => 
      summary.toLowerCase().includes(term.toLowerCase())
    );
    const keywordPreservation = keyTerms.length > 0 
      ? preservedTerms.length / keyTerms.length 
      : 1.0;

    // Factual accuracy (heuristic based on content overlap)
    const factualAccuracy = this.calculateContentOverlap(summary, originalContent);

    // Hallucination risk assessment
    const hallucinationRisk = this.assessHallucinationRisk(
      summary, 
      originalContent, 
      keywordPreservation,
      factualAccuracy
    );

    return {
      factualAccuracy,
      keywordPreservation,
      lengthCompliance,
      hallucinationRisk
    };
  }

  /**
   * Calculate content overlap between summary and original
   */
  private calculateContentOverlap(summary: string, original: string): number {
    const summaryWords = new Set(
      summary.toLowerCase().split(/\s+/).filter(word => word.length > 3)
    );
    const originalWords = new Set(
      original.toLowerCase().split(/\s+/).filter(word => word.length > 3)
    );

    const intersection = new Set([...summaryWords].filter(word => originalWords.has(word)));
    return summaryWords.size > 0 ? intersection.size / summaryWords.size : 0;
  }

  /**
   * Assess hallucination risk
   */
  private assessHallucinationRisk(
    summary: string,
    original: string,
    keywordPreservation: number,
    factualAccuracy: number
  ): 'low' | 'medium' | 'high' {
    // High risk indicators
    if (factualAccuracy < 0.3 || keywordPreservation < 0.5) {
      return 'high';
    }

    // Medium risk indicators
    if (factualAccuracy < 0.6 || keywordPreservation < 0.7) {
      return 'medium';
    }

    // Additional checks for suspicious patterns
    const suspiciousPatterns = [
      /\b(?:obviously|clearly|definitely|certainly)\b/gi,
      /\b(?:always|never|all|none|every|any)\b/gi,
      /\b(?:best|worst|most|least)\b/gi
    ];

    const suspiciousCount = suspiciousPatterns.reduce((count, pattern) => {
      return count + (summary.match(pattern) || []).length;
    }, 0);

    if (suspiciousCount > 2) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(
    qualityMetrics: SummaryGenerationResult['qualityMetrics'],
    config: SummaryGenerationConfig
  ): number {
    let score = 0.5; // Base score

    // Factual accuracy weight: 40%
    score += qualityMetrics.factualAccuracy * 0.4;

    // Keyword preservation weight: 30%
    score += qualityMetrics.keywordPreservation * 0.3;

    // Length compliance weight: 20%
    score += qualityMetrics.lengthCompliance ? 0.2 : 0;

    // Hallucination risk penalty: -10% to -30%
    switch (qualityMetrics.hallucinationRisk) {
      case 'low': score += 0.1; break;
      case 'medium': score -= 0.1; break;
      case 'high': score -= 0.3; break;
    }

    // Model quality bonus
    if (config.model.includes('gpt-4o')) {
      score += 0.05;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Log generation for quality tracking
   */
  private async logGeneration(log: Omit<SummaryGenerationLog, 'id'>): Promise<void> {
    try {
      // In a full implementation, this would save to database
      // For now, just log to console for debugging
      console.log('[SummaryGeneration] Quality log:', {
        configId: log.configId,
        projectId: log.projectId,
        model: log.modelUsed,
        tokensUsed: log.tokensUsed,
        cost: log.cost.toFixed(4),
        confidence: log.confidenceScore.toFixed(3),
        reviewFlag: log.manualReviewFlag,
        timestamp: log.generatedAt.toISOString()
      });
    } catch (error) {
      console.error('Failed to log summary generation:', error);
    }
  }

  /**
   * Get available configurations
   */
  getAvailableConfigs(): SummaryGenerationConfig[] {
    return Object.entries(this.DEFAULT_CONFIGS).map(([id, config]) => ({
      id,
      ...config,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }
}

// Export singleton instance
let summaryGenerationService: SummaryGenerationService | null = null;

export function getSummaryGenerationService(): SummaryGenerationService {
  if (!summaryGenerationService) {
    summaryGenerationService = new SummaryGenerationService();
  }
  return summaryGenerationService;
}