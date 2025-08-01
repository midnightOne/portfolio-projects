/**
 * Test suite for AI-assisted content editing functionality
 */

import { AIResponseParser } from '@/lib/services/ai/response-parser';
import { ProjectContextBuilder } from '@/lib/utils/context-builder';
import { EncryptionService } from '@/lib/services/encryption';
import { ProjectWithRelations } from '@/lib/types/project';
import { describe, it } from '@jest/globals';

// Mock project data for testing
const mockProject: ProjectWithRelations = {
  id: 'test-project-id',
  title: 'Test Project',
  slug: 'test-project',
  description: 'A test project for AI functionality',
  briefOverview: 'Brief overview of the test project',
  workDate: new Date('2024-01-01'),
  status: 'PUBLISHED',
  visibility: 'PUBLIC',
  viewCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  thumbnailImageId: undefined,
  metadataImageId: undefined,
  tags: [
    { id: '1', name: 'AI', color: '#3B82F6', createdAt: new Date() },
    { id: '2', name: 'Testing', color: '#10B981', createdAt: new Date() }
  ],
  thumbnailImage: null,
  metadataImage: null,
  mediaItems: [],
  articleContent: {
    id: 'article-1',
    projectId: 'test-project-id',
    content: 'This is the main article content for testing AI functionality.',
    createdAt: new Date(),
    updatedAt: new Date(),
    embeddedMedia: []
  },
  interactiveExamples: [],
  externalLinks: [
    {
      id: 'link-1',
      projectId: 'test-project-id',
      label: 'GitHub',
      url: 'https://github.com/test/project',
      icon: 'github',
      description: 'Source code',
      order: 0,
      createdAt: new Date()
    }
  ],
  downloadableFiles: [],
  carousels: [],
  analytics: []
};

describe('AI Functionality Tests', () => {
  describe('EncryptionService', () => {
    it('should encrypt and decrypt API keys correctly', () => {
      const originalKey = 'sk-test-api-key-12345';
      const encrypted = EncryptionService.encrypt(originalKey);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(originalKey);
      expect(encrypted).not.toBe(originalKey);
      expect(EncryptionService.isEncrypted(encrypted)).toBe(true);
      expect(EncryptionService.isEncrypted(originalKey)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(EncryptionService.encrypt('')).toBe('');
      expect(EncryptionService.decrypt('')).toBe('');
    });
  });

  describe('ProjectContextBuilder', () => {
    it('should build comprehensive context from project data', () => {
      const context = ProjectContextBuilder.buildContext(mockProject);
      
      expect(context.metadata.title).toBe('Test Project');
      expect(context.metadata.description).toBe('A test project for AI functionality');
      expect(context.tags).toEqual(['AI', 'Testing']);
      expect(context.currentContent).toBe('This is the main article content for testing AI functionality.');
      expect(context.externalLinks).toHaveLength(1);
      expect(context.mediaItems).toHaveLength(0);
    });

    it('should include selected text context when provided', () => {
      const selectedText = {
        start: 10,
        end: 20,
        text: 'main article',
        context: 'This is the main article content'
      };
      
      const context = ProjectContextBuilder.buildContext(mockProject, selectedText);
      
      expect(context.selectedText).toBeDefined();
      expect(context.selectedText?.text).toBe('main article');
      expect(context.selectedText?.start).toBe(10);
      expect(context.selectedText?.end).toBe(20);
    });

    it('should estimate context tokens', () => {
      const context = ProjectContextBuilder.buildContext(mockProject);
      const tokens = ProjectContextBuilder.estimateContextTokens(context);
      
      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    it('should truncate large context', () => {
      const largeProject = {
        ...mockProject,
        articleContent: {
          ...mockProject.articleContent!,
          content: 'A'.repeat(5000) // Very long content
        }
      };
      
      const context = ProjectContextBuilder.buildContext(largeProject);
      const truncated = ProjectContextBuilder.truncateContext(context, 500);
      
      expect(truncated.currentContent.length).toBeLessThan(context.currentContent.length);
      expect(truncated.currentContent).toContain('...');
    });
  });

  describe('AIResponseParser', () => {
    it('should parse structured JSON responses', () => {
      const jsonResponse = JSON.stringify({
        reasoning: 'Improved the title for better clarity',
        changes: {
          metadata: {
            title: 'Enhanced Test Project',
            tags: {
              add: ['Enhanced'],
              remove: ['Testing'],
              reasoning: 'Better tag alignment'
            }
          }
        },
        confidence: 0.9,
        warnings: [],
        modelUsed: 'claude-3-5-sonnet',
        tokensUsed: 150
      });

      const parsed = AIResponseParser.parse(jsonResponse, mockProject);
      
      expect(parsed.metadataChanges?.title).toBe('Enhanced Test Project');
      expect(parsed.tagsToAdd).toEqual(['Enhanced']);
      expect(parsed.tagsToRemove).toEqual(['Testing']);
      expect(parsed.confidence).toBe(0.9);
      expect(parsed.warnings).toHaveLength(0);
    });

    it('should handle partial content updates', () => {
      const jsonResponse = JSON.stringify({
        reasoning: 'Fixed grammar in selected text',
        changes: {
          partialUpdate: {
            start: 10,
            end: 20,
            content: 'improved article',
            reasoning: 'Better word choice',
            preserveFormatting: true
          }
        },
        confidence: 0.95,
        warnings: [],
        modelUsed: 'claude-3-5-sonnet',
        tokensUsed: 100
      });

      const parsed = AIResponseParser.parse(jsonResponse, mockProject);
      
      expect(parsed.partialUpdate).toBeDefined();
      expect(parsed.partialUpdate?.start).toBe(10);
      expect(parsed.partialUpdate?.end).toBe(20);
      expect(parsed.partialUpdate?.content).toBe('improved article');
      expect(parsed.confidence).toBe(0.95);
    });

    it('should fallback to text parsing for non-JSON responses', () => {
      const textResponse = `
        Here's an improved version:
        
        \`\`\`markdown
        # Enhanced Test Project
        
        This is much better content for the test project.
        \`\`\`
        
        I suggest tags: AI, Machine Learning
        Remove tags: Testing
      `;

      const parsed = AIResponseParser.parse(textResponse, mockProject);
      
      expect(parsed.articleContent).toContain('Enhanced Test Project');
      expect(parsed.tagsToAdd).toContain('AI');
      expect(parsed.tagsToAdd).toContain('Machine Learning');
      expect(parsed.tagsToRemove).toContain('Testing');
      expect(parsed.confidence).toBeLessThan(0.5); // Lower confidence for text parsing
    });

    it('should validate changes against original project', () => {
      const changes = {
        tagsToAdd: ['AI'], // Already exists
        tagsToRemove: ['NonExistent'], // Doesn't exist
        partialUpdate: {
          start: -1, // Invalid position
          end: 1000, // Out of bounds
          content: 'test',
          reasoning: 'test',
          preserveFormatting: true
        },
        mediaSuggestions: [],
        confidence: 0.8,
        warnings: []
      };

      const warnings = AIResponseParser.validateChanges(changes, mockProject);
      
      expect(warnings).toContain('Partial update start position is out of bounds');
      expect(warnings).toContain('Partial update end position is invalid');
      expect(warnings).toContain('Cannot remove non-existent tags: NonExistent');
      expect(warnings).toContain('Tags already exist: AI');
    });

    it('should apply changes to project correctly', () => {
      const changes = {
        metadataChanges: {
          title: 'New Title',
          description: 'New Description'
        },
        articleContent: 'New article content',
        tagsToAdd: [],
        tagsToRemove: [],
        mediaSuggestions: [],
        confidence: 0.9,
        warnings: []
      };

      const updated = AIResponseParser.applyChanges(changes, mockProject);
      
      expect(updated.title).toBe('New Title');
      expect(updated.description).toBe('New Description');
      expect(updated.articleContent?.content).toBe('New article content');
    });
  });
});

// Integration test helper
export const testAIIntegration = {
  mockProject,
  
  // Helper to create test conversations
  createTestConversation: (projectId: string, messages: any[] = []) => ({
    id: 'test-conversation-id',
    projectId,
    title: 'Test Conversation',
    createdAt: new Date(),
    lastActiveAt: new Date(),
    messages
  }),
  
  // Helper to create test AI responses
  createTestAIResponse: (content: string, model: string = 'claude-3-5-sonnet') => ({
    content,
    metadata: {
      model,
      tokens: 100,
      cost: 0.001,
      duration: 1000
    }
  })
};