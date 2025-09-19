/**
 * Project Indexing API Integration Tests
 * Tests the API endpoints for project indexing
 */

import { NextRequest } from 'next/server';
import { GET as indexHandler } from '@/app/api/projects/[slug]/index/route';
import { POST as batchHandler } from '@/app/api/projects/index/batch/route';
import { GET as searchHandler } from '@/app/api/projects/search/ai-context/route';
import { prisma } from '@/lib/database/connection';

// Mock Prisma
jest.mock('@/lib/database/connection', () => ({
  prisma: {
    project: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Project Indexing API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/projects/[slug]/index', () => {
    it('should return project index for valid slug', async () => {
      const mockProject = {
        id: 'test-project-1',
        title: 'Test Project',
        slug: 'test-project',
        updatedAt: new Date(),
        articleContent: {
          jsonContent: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Test content with React and TypeScript.' }]
              }
            ]
          }
        },
        mediaItems: [],
        carousels: [],
        interactiveExamples: [],
        downloadableFiles: [],
        externalLinks: [],
        tags: [{ name: 'react' }]
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/projects/test-project/index');
      const response = await indexHandler(request, { params: { slug: 'test-project' } });
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.projectId).toBe('test-project-1');
      expect(data.data.slug).toBe('test-project');
      expect(data.data.keywords).toContain('react');
    });

    it('should return 404 for non-existent project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/projects/non-existent/index');
      const response = await indexHandler(request, { params: { slug: 'non-existent' } });
      
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('should include sections when requested', async () => {
      const mockProject = {
        id: 'test-project-2',
        title: 'Test Project with Sections',
        slug: 'test-project-sections',
        updatedAt: new Date(),
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
                content: [{ type: 'text', text: 'This is the introduction section.' }]
              }
            ]
          }
        },
        mediaItems: [],
        carousels: [],
        interactiveExamples: [],
        downloadableFiles: [],
        externalLinks: [],
        tags: []
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/projects/test-project-sections/index?includeSections=true');
      const response = await indexHandler(request, { params: { slug: 'test-project-sections' } });
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.sections).toBeDefined();
      expect(data.data.sections.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/projects/index/batch', () => {
    it('should batch index multiple projects', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          slug: 'project-1',
          title: 'Project 1',
          updatedAt: new Date(),
          articleContent: null,
          mediaItems: [],
          carousels: [],
          interactiveExamples: [],
          downloadableFiles: [],
          externalLinks: [],
          tags: []
        },
        {
          id: 'project-2',
          slug: 'project-2',
          title: 'Project 2',
          updatedAt: new Date(),
          articleContent: null,
          mediaItems: [],
          carousels: [],
          interactiveExamples: [],
          downloadableFiles: [],
          externalLinks: [],
          tags: []
        }
      ];

      mockPrisma.project.findMany.mockResolvedValue(mockProjects);
      mockPrisma.project.findUnique
        .mockResolvedValueOnce(mockProjects[0])
        .mockResolvedValueOnce(mockProjects[1]);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/projects/index/batch', {
        method: 'POST',
        body: JSON.stringify({
          projectSlugs: ['project-1', 'project-2']
        })
      });

      const response = await batchHandler(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.results).toHaveLength(2);
      expect(data.data.statistics.successfulIndexes).toBe(2);
      expect(data.data.statistics.failedIndexes).toBe(0);
    });

    it('should handle validation errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/projects/index/batch', {
        method: 'POST',
        body: JSON.stringify({}) // Empty request
      });

      const response = await batchHandler(request);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should limit batch size', async () => {
      const largeProjectList = Array.from({ length: 25 }, (_, i) => `project-${i}`);

      const request = new NextRequest('http://localhost:3000/api/projects/index/batch', {
        method: 'POST',
        body: JSON.stringify({
          projectIds: largeProjectList
        })
      });

      const response = await batchHandler(request);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('Batch size too large');
    });
  });

  describe('GET /api/projects/search/ai-context', () => {
    it('should search project content', async () => {
      const mockProjects = [
        {
          id: 'search-project-1',
          title: 'React Project',
          updatedAt: new Date(),
          articleContent: {
            jsonContent: {
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'This project uses React and TypeScript for modern web development.' }]
                }
              ]
            }
          },
          mediaItems: [],
          carousels: [],
          interactiveExamples: [],
          downloadableFiles: [],
          externalLinks: [],
          tags: [{ name: 'react' }, { name: 'typescript' }]
        }
      ];

      mockPrisma.project.findMany.mockResolvedValue(mockProjects);
      mockPrisma.project.findUnique.mockResolvedValue(mockProjects[0]);
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/projects/search/ai-context?query=React TypeScript&limit=5');
      const response = await searchHandler(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.query).toBe('React TypeScript');
      expect(data.data.results).toBeDefined();
      expect(data.data.searchTime).toBeGreaterThan(0);
    });

    it('should validate query length', async () => {
      const request = new NextRequest('http://localhost:3000/api/projects/search/ai-context?query=a');
      const response = await searchHandler(request);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle empty results', async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/projects/search/ai-context?query=nonexistent');
      const response = await searchHandler(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.results).toHaveLength(0);
      expect(data.data.totalResults).toBe(0);
    });
  });
});