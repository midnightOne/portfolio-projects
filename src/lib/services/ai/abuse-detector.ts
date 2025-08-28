/**
 * Enhanced abuse detection service for AI assistant
 * Implements content analysis for spam and inappropriate queries
 */

import { blacklistManager } from './blacklist-manager';
import { AIServiceManager } from '@/lib/ai/service-manager';

export interface ContentAnalysisResult {
  isAbusive: boolean;
  confidence: number;
  reasons: string[];
  severity: 'low' | 'medium' | 'high';
  suggestedAction: 'allow' | 'warn' | 'block';
}

export interface AbuseDetectionConfig {
  enableAIAnalysis: boolean;
  spamThreshold: number;
  inappropriateThreshold: number;
  maxContentLength: number;
  enablePatternMatching: boolean;
}

export class AbuseDetector {
  private config: AbuseDetectionConfig;
  private aiService: AIServiceManager;

  // Spam patterns for basic detection
  private readonly SPAM_PATTERNS = [
    /\b(buy now|click here|limited time|act now|free money|make money fast)\b/gi,
    /\b(viagra|cialis|pharmacy|pills|medication)\b/gi,
    /\b(casino|gambling|poker|lottery|jackpot)\b/gi,
    /\b(crypto|bitcoin|investment|trading|profit)\b/gi,
    /\b(loan|credit|debt|mortgage|refinance)\b/gi,
    /\b(weight loss|diet pills|lose weight fast)\b/gi,
    /\b(work from home|make money online|easy money)\b/gi,
  ];

  // Inappropriate content patterns
  private readonly INAPPROPRIATE_PATTERNS = [
    /\b(hack|exploit|vulnerability|bypass|crack)\b/gi,
    /\b(illegal|piracy|torrent|download free)\b/gi,
    /\b(spam|bot|automated|scraping)\b/gi,
    /\b(phishing|scam|fraud|fake)\b/gi,
  ];

  // Suspicious behavior patterns
  private readonly SUSPICIOUS_PATTERNS = [
    /(.)\1{10,}/g, // Repeated characters (10+ times)
    /[A-Z]{20,}/g, // Long sequences of capital letters
    /\d{15,}/g, // Long sequences of numbers
    /[!@#$%^&*]{5,}/g, // Multiple special characters
  ];

  constructor(config?: Partial<AbuseDetectionConfig>) {
    this.config = {
      enableAIAnalysis: true,
      spamThreshold: 3,
      inappropriateThreshold: 2,
      maxContentLength: 10000,
      enablePatternMatching: true,
      ...config,
    };
    this.aiService = new AIServiceManager();
  }

  /**
   * Analyze content for abuse, spam, and inappropriate material
   */
  async analyzeContent(
    content: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
      endpoint?: string;
      sessionId?: string;
    }
  ): Promise<ContentAnalysisResult> {
    try {
      // Basic validation
      if (!content || content.trim().length === 0) {
        return this.createResult(false, 0, [], 'low', 'allow');
      }

      if (content.length > this.config.maxContentLength) {
        return this.createResult(
          true,
          0.8,
          ['Content exceeds maximum length'],
          'medium',
          'warn'
        );
      }

      const results: ContentAnalysisResult[] = [];

      // Pattern-based analysis
      if (this.config.enablePatternMatching) {
        results.push(await this.analyzePatterns(content));
      }

      // AI-based analysis (if enabled and available)
      if (this.config.enableAIAnalysis) {
        try {
          const aiResult = await this.analyzeWithAI(content);
          if (aiResult) {
            results.push(aiResult);
          }
        } catch (error) {
          console.warn('AI content analysis failed, falling back to pattern matching:', error);
        }
      }

      // Behavioral analysis
      results.push(this.analyzeBehavior(content, context));

      // Combine results
      return this.combineResults(results);
    } catch (error) {
      console.error('Content analysis failed:', error);
      // Return safe default on error
      return this.createResult(false, 0, ['Analysis failed'], 'low', 'allow');
    }
  }

  /**
   * Pattern-based content analysis
   */
  private async analyzePatterns(content: string): Promise<ContentAnalysisResult> {
    const reasons: string[] = [];
    let score = 0;

    const lowerContent = content.toLowerCase();

    // Check spam patterns
    let spamMatches = 0;
    for (const pattern of this.SPAM_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        spamMatches += matches.length;
        reasons.push(`Spam pattern detected: ${matches[0]}`);
      }
    }

    // Check inappropriate patterns
    let inappropriateMatches = 0;
    for (const pattern of this.INAPPROPRIATE_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        inappropriateMatches += matches.length;
        reasons.push(`Inappropriate content: ${matches[0]}`);
      }
    }

    // Check suspicious patterns
    let suspiciousMatches = 0;
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        suspiciousMatches += matches.length;
        reasons.push('Suspicious formatting detected');
      }
    }

    // Calculate score
    score = (spamMatches * 0.3) + (inappropriateMatches * 0.5) + (suspiciousMatches * 0.2);

    // Determine severity and action
    let severity: 'low' | 'medium' | 'high' = 'low';
    let suggestedAction: 'allow' | 'warn' | 'block' = 'allow';

    if (spamMatches >= this.config.spamThreshold || inappropriateMatches >= this.config.inappropriateThreshold) {
      severity = 'high';
      suggestedAction = 'block';
    } else if (spamMatches >= 2 || inappropriateMatches >= 1 || suspiciousMatches >= 3) {
      severity = 'medium';
      suggestedAction = 'warn';
    }

    return this.createResult(
      suggestedAction !== 'allow',
      Math.min(score / 10, 1), // Normalize to 0-1
      reasons,
      severity,
      suggestedAction
    );
  }

  /**
   * AI-based content analysis using available AI providers
   */
  private async analyzeWithAI(content: string): Promise<ContentAnalysisResult | null> {
    try {
      // Check if AI is available
      const isAvailable = await this.aiService.isAvailable();
      if (!isAvailable) {
        return null;
      }

      const prompt = `Analyze the following content for spam, inappropriate material, or abusive behavior. 
      Respond with a JSON object containing:
      - isAbusive: boolean
      - confidence: number (0-1)
      - reasons: array of strings
      - severity: "low" | "medium" | "high"

      Content to analyze:
      "${content.substring(0, 1000)}"`;

      const response = await this.aiService.processPrompt({
        prompt,
        temperature: 0.1, // Low temperature for consistent analysis
        maxTokens: 200,
      });

      if (!response.success || !response.content) {
        return null;
      }

      // Try to parse AI response
      try {
        const analysis = JSON.parse(response.content);
        
        return this.createResult(
          analysis.isAbusive || false,
          analysis.confidence || 0,
          analysis.reasons || [],
          analysis.severity || 'low',
          analysis.isAbusive ? (analysis.severity === 'high' ? 'block' : 'warn') : 'allow'
        );
      } catch (parseError) {
        console.warn('Failed to parse AI analysis response:', parseError);
        return null;
      }
    } catch (error) {
      console.error('AI content analysis error:', error);
      return null;
    }
  }

  /**
   * Behavioral analysis based on context
   */
  private analyzeBehavior(
    content: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
      endpoint?: string;
      sessionId?: string;
    }
  ): ContentAnalysisResult {
    const reasons: string[] = [];
    let score = 0;

    // Check user agent
    if (context.userAgent) {
      const suspiciousAgents = [
        /bot|crawler|spider|scraper/i,
        /curl|wget|python|java/i,
        /automated|script|tool/i,
      ];

      for (const pattern of suspiciousAgents) {
        if (pattern.test(context.userAgent)) {
          reasons.push('Suspicious user agent detected');
          score += 0.3;
          break;
        }
      }
    }

    // Check content characteristics
    const wordCount = content.split(/\s+/).length;
    const avgWordLength = content.replace(/\s/g, '').length / wordCount;

    if (wordCount < 3 && content.length > 50) {
      reasons.push('Unusual content structure');
      score += 0.2;
    }

    if (avgWordLength > 15) {
      reasons.push('Unusually long words');
      score += 0.1;
    }

    // Check for excessive repetition
    const words = content.toLowerCase().split(/\s+/);
    const wordFreq: Record<string, number> = {};
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }

    const maxFreq = Math.max(...Object.values(wordFreq));
    if (maxFreq > words.length * 0.3) {
      reasons.push('Excessive word repetition');
      score += 0.3;
    }

    const severity: 'low' | 'medium' | 'high' = score > 0.6 ? 'high' : score > 0.3 ? 'medium' : 'low';
    const suggestedAction: 'allow' | 'warn' | 'block' = 
      severity === 'high' ? 'block' : severity === 'medium' ? 'warn' : 'allow';

    return this.createResult(
      score > 0.3,
      score,
      reasons,
      severity,
      suggestedAction
    );
  }

  /**
   * Combine multiple analysis results
   */
  private combineResults(results: ContentAnalysisResult[]): ContentAnalysisResult {
    if (results.length === 0) {
      return this.createResult(false, 0, [], 'low', 'allow');
    }

    if (results.length === 1) {
      return results[0];
    }

    // Combine results with weighted average
    let totalConfidence = 0;
    let totalWeight = 0;
    const allReasons: string[] = [];
    let maxSeverity: 'low' | 'medium' | 'high' = 'low';
    let suggestedAction: 'allow' | 'warn' | 'block' = 'allow';

    for (const result of results) {
      const weight = result.isAbusive ? 1.5 : 1.0; // Give more weight to positive detections
      totalConfidence += result.confidence * weight;
      totalWeight += weight;
      allReasons.push(...result.reasons);

      // Take the highest severity
      if (result.severity === 'high' || (result.severity === 'medium' && maxSeverity === 'low')) {
        maxSeverity = result.severity;
      }

      // Take the most restrictive action
      if (result.suggestedAction === 'block' || 
          (result.suggestedAction === 'warn' && suggestedAction === 'allow')) {
        suggestedAction = result.suggestedAction;
      }
    }

    const avgConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0;
    const isAbusive = suggestedAction !== 'allow';

    return this.createResult(
      isAbusive,
      avgConfidence,
      [...new Set(allReasons)], // Remove duplicates
      maxSeverity,
      suggestedAction
    );
  }

  /**
   * Record a security violation and potentially blacklist IP
   */
  async recordViolation(
    ipAddress: string,
    analysisResult: ContentAnalysisResult,
    context: {
      endpoint?: string;
      userAgent?: string;
      content?: string;
    }
  ): Promise<{
    blacklisted: boolean;
    violationCount: number;
    shouldNotify: boolean;
  }> {
    try {
      const reason = `Content violation: ${analysisResult.reasons.join(', ')}`;
      const metadata = {
        severity: analysisResult.severity,
        confidence: analysisResult.confidence,
        endpoint: context.endpoint,
        userAgent: context.userAgent,
        contentLength: context.content?.length || 0,
        timestamp: new Date().toISOString(),
      };

      const result = await blacklistManager.recordViolation(ipAddress, reason, metadata);

      // Determine if we should notify the portfolio owner
      const shouldNotify = 
        result.blacklisted || // Always notify on blacklist
        result.violationCount === 1 || // Notify on first violation
        analysisResult.severity === 'high'; // Notify on high severity

      return {
        blacklisted: result.blacklisted,
        violationCount: result.violationCount,
        shouldNotify,
      };
    } catch (error) {
      console.error('Failed to record security violation:', error);
      return {
        blacklisted: false,
        violationCount: 0,
        shouldNotify: false,
      };
    }
  }

  /**
   * Create a standardized analysis result
   */
  private createResult(
    isAbusive: boolean,
    confidence: number,
    reasons: string[],
    severity: 'low' | 'medium' | 'high',
    suggestedAction: 'allow' | 'warn' | 'block'
  ): ContentAnalysisResult {
    return {
      isAbusive,
      confidence: Math.max(0, Math.min(1, confidence)), // Clamp to 0-1
      reasons,
      severity,
      suggestedAction,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AbuseDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): AbuseDetectionConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const abuseDetector = new AbuseDetector();