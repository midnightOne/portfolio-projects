/**
 * Project Indexer Tests
 * Tests the ProjectIndexer service functionality
 */

import { ProjectIndexer } from '@/lib/services/project-indexer';
import { prisma } from '@/lib/database/connection';

// Mock Prisma
jest.mock('@/lib/database/connection', () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('ProjectIndexer', () => {
  let indexer: ProjectIndexer;

  beforeEach(() => {
    indexer = ProjectIndexer.getInstance();
    indexer.clearAllCache();
    jest.clearAllMocks();
  });

  describe('indexProject', () => {
    it('should index a project with basic content', async () => {
      // Mock project data
      const mockProject = {
        id: 'test-project-1',
        title: 'Test Project',
        description: 'A test project for indexing',
        briefOverview: 'This is a brief overview',
        articleContent: {
          jsonContent: {
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: 'Introduction' }]
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'This is a test paragraph with React and TypeScript.' }]
              }
            ]
          }
        },
        mediaItems: [
          {
            id: 'media-1',
            type: 'IMAGE',
            url: 'https://example.com/image.jpg',
            altText: 'Test image',
            description: 'A test image'
          }
        ],
        carousels: [],
        interactiveExamples: [],
        downloadableFiles: [],
        externalLinks: [],
        tags: [
          { name: 'react' },
          { name: 'typescript' }
        ],
        updatedAt: new Date()
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await indexer.indexProject('test-project-1');

      expect(result).toBeDefined();
      expect(result.projectId).toBe('test-project-1');
      expect(result.keywords).toContain('react');
      expect(result.keywords).toContain('typescript');
      expect(result.technologies).toContain('react');
      expect(result.technologies).toContain('typescript');
      expect(result.sections).toHaveLength(2); // heading + paragraph
      expect(result.mediaContext).toHaveLength(1);
    });

    it('should handle projects without content', async () => {
      const mockProject = {
        id: 'test-project-2',
        title: 'Empty Project',
        description: null,
        briefOverview: null,
        articleContent: null,
        mediaItems: [],
        carousels: [],
        interactiveExamples: [],
        downloadableFiles: [],
        externalLinks: [],
        tags: [],
        updatedAt: new Date()
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await indexer.indexProject('test-project-2');

      expect(result).toBeDefined();
      expect(result.projectId).toBe('test-project-2');
      expect(result.sections).toHaveLength(0);
      expect(result.mediaContext).toHaveLength(0);
      expect(result.keywords.length).toBeGreaterThanOrEqual(1); // At least the title words
    });

    it('should cache results', async () => {
      const mockProject = {
        id: 'test-project-3',
        title: 'Cached Project',
        description: 'Test caching',
        briefOverview: null,
        articleContent: null,
        mediaItems: [],
        carousels: [],
        interactiveExamples: [],
        downloadableFiles: [],
        externalLinks: [],
        tags: [],
        updatedAt: new Date()
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      // First call
      const result1 = await indexer.indexProject('test-project-3');
      
      // Second call should use cache
      const result2 = await indexer.indexProject('test-project-3');

      expect(mockPrisma.project.findUnique).toHaveBeenCalledTimes(1);
      expect(result1.contentHash).toBe(result2.contentHash);
    });

    it('should throw error for non-existent project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(indexer.indexProject('non-existent')).rejects.toThrow('Project not found');
    });
  });

  describe('getProjectSummary', () => {
    it('should return project summary', async () => {
      const mockProject = {
        id: 'test-project-4',
        title: 'Summary Test',
        description: 'Test description',
        briefOverview: 'Brief overview',
        articleContent: {
          jsonContent: {
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: 'Main Section' }]
              }
            ]
          }
        },
        mediaItems: [],
        carousels: [],
        interactiveExamples: [],
        downloadableFiles: [],
        externalLinks: [],
        tags: [{ name: 'test' }],
        updatedAt: new Date()
      };

      const mockProjectSelect = {
        id: 'test-project-4',
        title: 'Summary Test',
        briefOverview: 'Brief overview',
        description: 'Test description',
        tags: [{ name: 'test' }]
      };

      mockPrisma.project.findUnique
        .mockResolvedValueOnce(mockProject)
        .mockResolvedValueOnce(mockProjectSelect);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const summary = await indexer.getProjectSummary('test-project-4');

      expect(summary).toBeDefined();
      expect(summary?.title).toBe('Summary Test');
      expect(summary?.briefSummary).toBe('Brief overview');
      expect(summary?.contentStructure.totalSections).toBe(1);
    });
  });

  describe('searchRelevantContent', () => {
    it('should search and return relevant sections', async () => {
      const mockProject = {
        id: 'search-project-1',
        title: 'React TypeScript Project',
        description: 'A project using React and TypeScript',
        briefOverview: 'Modern web development',
        articleContent: {
          jsonContent: {
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: 'React Components' }]
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'This section covers React component development with TypeScript.' }]
              }
            ]
          }
        },
        mediaItems: [],
        carousels: [],
        interactiveExamples: [],
        downloadableFiles: [],
        externalLinks: [],
        tags: [{ name: 'react' }, { name: 'typescript' }],
        updatedAt: new Date()
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const results = await indexer.searchRelevantContent(['search-project-1'], 'React TypeScript', 5);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Should find sections related to React and TypeScript
      const hasRelevantContent = results.some(section => 
        section.title.toLowerCase().includes('react') ||
        section.content.toLowerCase().includes('react') ||
        section.keywords.some(keyword => keyword.includes('react'))
      );
      
      expect(hasRelevantContent).toBe(true);
    });
  });

  describe('cache management', () => {
    it('should clear project cache', async () => {
      const mockProject = {
        id: 'cache-test-1',
        title: 'Cache Test',
        description: 'Test',
        briefOverview: null,
        articleContent: null,
        mediaItems: [],
        carousels: [],
        interactiveExamples: [],
        downloadableFiles: [],
        externalLinks: [],
        tags: [],
        updatedAt: new Date()
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      // Index project
      await indexer.indexProject('cache-test-1');
      
      let stats = indexer.getCacheStats();
      expect(stats.projects).toContain('cache-test-1');

      // Clear cache
      indexer.clearProjectCache('cache-test-1');
      
      stats = indexer.getCacheStats();
      expect(stats.projects).not.toContain('cache-test-1');
    });

    it('should clear all cache', async () => {
      const mockProject = {
        id: 'cache-test-2',
        title: 'Cache Test 2',
        description: 'Test',
        briefOverview: null,
        articleContent: null,
        mediaItems: [],
        carousels: [],
        interactiveExamples: [],
        downloadableFiles: [],
        externalLinks: [],
        tags: [],
        updatedAt: new Date()
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      // Index project
      await indexer.indexProject('cache-test-2');
      
      let stats = indexer.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      // Clear all cache
      indexer.clearAllCache();
      
      stats = indexer.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });
});