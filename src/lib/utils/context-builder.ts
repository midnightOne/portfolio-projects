import { ProjectWithRelations, ProjectContext, TextSelection } from '@/lib/types/project';

/**
 * Utility for building AI context from project data
 */
export class ProjectContextBuilder {
  /**
   * Build comprehensive context for AI from project data
   */
  static buildContext(
    project: ProjectWithRelations,
    selectedText?: TextSelection
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
   * Build context summary for display
   */
  static buildContextSummary(context: ProjectContext): string {
    const parts = [];
    
    parts.push(`Title: ${context.metadata.title}`);
    
    if (context.metadata.description) {
      parts.push(`Description: ${context.metadata.description}`);
    }
    
    if (context.tags.length > 0) {
      parts.push(`Tags: ${context.tags.join(', ')}`);
    }
    
    if (context.currentContent) {
      const contentPreview = context.currentContent.substring(0, 200);
      parts.push(`Content: ${contentPreview}${context.currentContent.length > 200 ? '...' : ''}`);
    }
    
    if (context.selectedText) {
      parts.push(`Selected: "${context.selectedText.text}"`);
    }
    
    return parts.join('\n\n');
  }

  /**
   * Estimate context size in tokens (rough approximation)
   */
  static estimateContextTokens(context: ProjectContext): number {
    const text = JSON.stringify(context);
    return Math.ceil(text.length / 4); // Rough estimation: ~4 characters per token
  }

  /**
   * Truncate context if it's too large
   */
  static truncateContext(context: ProjectContext, maxTokens: number = 2000): ProjectContext {
    const estimatedTokens = this.estimateContextTokens(context);
    
    if (estimatedTokens <= maxTokens) {
      return context;
    }

    // Truncate content while preserving important parts
    const truncatedContext = { ...context };
    
    // Keep selected text if it exists
    if (context.selectedText) {
      // Reduce surrounding context
      const maxContextLength = 200;
      if (context.selectedText.context.length > maxContextLength) {
        truncatedContext.selectedText = {
          ...context.selectedText,
          context: context.selectedText.context.substring(0, maxContextLength) + '...'
        };
      }
    }
    
    // Truncate main content
    const maxContentLength = 1000;
    if (context.currentContent.length > maxContentLength) {
      truncatedContext.currentContent = context.currentContent.substring(0, maxContentLength) + '...';
    }
    
    // Limit media items
    if (context.mediaItems.length > 5) {
      truncatedContext.mediaItems = context.mediaItems.slice(0, 5);
    }
    
    return truncatedContext;
  }
}