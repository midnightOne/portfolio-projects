import { StructuredAIResponse, ParsedChanges, ProjectWithRelations } from '@/lib/types/project';

/**
 * System prompt template for structured JSON responses
 */
export const SYSTEM_PROMPT_TEMPLATE = `
You are an expert content editor for portfolio projects. Respond ONLY with valid JSON in this exact format:

{
  "reasoning": "Brief explanation of your analysis and changes",
  "changes": {
    "articleContent": "Full replacement content (only if replacing entire article)",
    "partialUpdate": {
      "start": 123,
      "end": 456,
      "content": "replacement text",
      "reasoning": "why this specific change",
      "preserveFormatting": true
    },
    "metadata": {
      "title": "new title",
      "description": "new description",
      "briefOverview": "new overview",
      "tags": {
        "add": ["new-tag"],
        "remove": ["old-tag"],
        "reasoning": "why these tag changes"
      },
      "externalLinks": {
        "add": [{"label": "New Link", "url": "https://example.com", "description": "Link description"}],
        "remove": ["https://old-link.com"],
        "reasoning": "why these link changes"
      }
    },
    "media": {
      "suggestions": [
        {
          "type": "add",
          "suggestion": "Add a screenshot showing the user interface",
          "placement": "inline",
          "reasoning": "Visual would help explain the concept"
        }
      ],
      "reasoning": "media change explanation"
    }
  },
  "confidence": 0.95,
  "warnings": ["any concerns about the changes"],
  "modelUsed": "model-name",
  "tokensUsed": 0
}

Use the custom system prompt from settings for style and tone preferences.
Only include fields in "changes" that you are actually modifying.
For partial updates, provide exact character positions for the replacement.
`;

/**
 * AI response parser for structured content updates
 */
export class AIResponseParser {
  /**
   * Parse AI response into structured changes
   */
  static parse(response: string, originalProject: ProjectWithRelations): ParsedChanges {
    try {
      // Try to parse as JSON first
      const structured = JSON.parse(response) as StructuredAIResponse;
      return this.parseStructured(structured, originalProject);
    } catch {
      // Fallback to text parsing with regex patterns
      return this.parseTextResponse(response, originalProject);
    }
  }

  /**
   * Parse structured JSON response
   */
  private static parseStructured(
    response: StructuredAIResponse, 
    original: ProjectWithRelations
  ): ParsedChanges {
    const changes: ParsedChanges = {
      tagsToAdd: [],
      tagsToRemove: [],
      mediaSuggestions: [],
      confidence: response.confidence || 0.5,
      warnings: response.warnings || []
    };

    // Handle article content changes
    if (response.changes.articleContent) {
      changes.articleContent = response.changes.articleContent;
    }

    // Handle partial updates
    if (response.changes.partialUpdate) {
      changes.partialUpdate = response.changes.partialUpdate;
    }

    // Handle metadata changes
    if (response.changes.metadata) {
      changes.metadataChanges = {
        title: response.changes.metadata.title,
        description: response.changes.metadata.description,
        briefOverview: response.changes.metadata.briefOverview
      };

      // Handle tag changes
      if (response.changes.metadata.tags) {
        changes.tagsToAdd = response.changes.metadata.tags.add || [];
        changes.tagsToRemove = response.changes.metadata.tags.remove || [];
      }

      // Handle external link changes
      if (response.changes.metadata.externalLinks) {
        changes.metadataChanges.externalLinks = {
          add: response.changes.metadata.externalLinks.add || [],
          remove: response.changes.metadata.externalLinks.remove || []
        };
      }
    }

    // Handle media suggestions
    if (response.changes.media?.suggestions) {
      changes.mediaSuggestions = response.changes.media.suggestions;
    }

    return changes;
  }

  /**
   * Fallback text parsing for non-JSON responses
   */
  private static parseTextResponse(
    response: string, 
    original: ProjectWithRelations
  ): ParsedChanges {
    const changes: ParsedChanges = {
      tagsToAdd: [],
      tagsToRemove: [],
      mediaSuggestions: [],
      confidence: 0.3, // Lower confidence for text parsing
      warnings: ['Response was not in expected JSON format']
    };

    // Try to extract content between markers
    const contentMatch = response.match(/```(?:markdown|md)?\s*([\s\S]*?)\s*```/);
    if (contentMatch) {
      changes.articleContent = contentMatch[1].trim();
    }

    // Try to extract tag suggestions
    const tagAddMatch = response.match(/(?:add|suggest) tags?:?\s*([^\n]+)/i);
    if (tagAddMatch) {
      changes.tagsToAdd = tagAddMatch[1]
        .split(/[,;]/)
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    }

    const tagRemoveMatch = response.match(/remove tags?:?\s*([^\n]+)/i);
    if (tagRemoveMatch) {
      changes.tagsToRemove = tagRemoveMatch[1]
        .split(/[,;]/)
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    }

    return changes;
  }

  /**
   * Validate parsed changes against original project
   */
  static validateChanges(changes: ParsedChanges, original: ProjectWithRelations): string[] {
    const warnings: string[] = [];

    // Validate partial update positions
    if (changes.partialUpdate) {
      const contentLength = original.articleContent?.content?.length || 0;
      if (changes.partialUpdate.start < 0 || changes.partialUpdate.start > contentLength) {
        warnings.push('Partial update start position is out of bounds');
      }
      if (changes.partialUpdate.end < changes.partialUpdate.start || changes.partialUpdate.end > contentLength) {
        warnings.push('Partial update end position is invalid');
      }
    }

    // Validate tag changes
    const existingTags = original.tags.map(t => t.name);
    const invalidRemoves = changes.tagsToRemove.filter(tag => !existingTags.includes(tag));
    if (invalidRemoves.length > 0) {
      warnings.push(`Cannot remove non-existent tags: ${invalidRemoves.join(', ')}`);
    }

    const duplicateAdds = changes.tagsToAdd.filter(tag => existingTags.includes(tag));
    if (duplicateAdds.length > 0) {
      warnings.push(`Tags already exist: ${duplicateAdds.join(', ')}`);
    }

    return warnings;
  }

  /**
   * Apply parsed changes to project
   */
  static applyChanges(
    changes: ParsedChanges, 
    original: ProjectWithRelations
  ): Partial<ProjectWithRelations> {
    const updated: Partial<ProjectWithRelations> = {};

    // Apply metadata changes
    if (changes.metadataChanges) {
      if (changes.metadataChanges.title) {
        updated.title = changes.metadataChanges.title;
      }
      if (changes.metadataChanges.description) {
        updated.description = changes.metadataChanges.description;
      }
      if (changes.metadataChanges.briefOverview) {
        updated.briefOverview = changes.metadataChanges.briefOverview;
      }
    }

    // Apply content changes
    if (changes.articleContent && original.articleContent) {
      updated.articleContent = {
        ...original.articleContent,
        content: changes.articleContent
      };
    } else if (changes.partialUpdate && original.articleContent) {
      const originalContent = original.articleContent.content;
      const newContent = 
        originalContent.substring(0, changes.partialUpdate.start) +
        changes.partialUpdate.content +
        originalContent.substring(changes.partialUpdate.end);
      
      updated.articleContent = {
        ...original.articleContent,
        content: newContent
      };
    }

    return updated;
  }
}