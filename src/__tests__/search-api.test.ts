/**
 * Integration tests for search API functionality
 * Tests the full-text search implementation in the API
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/projects/route';

// Mock the database connection
jest.mock('@/lib/database/connection', () => ({
  prisma: {
    project: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock the performance utilities
jest.mock('@/lib/utils/performance', () => ({
  withPerformanceTracking: (handler: any) => handler,
  profileQuery: (queryFn: any) => queryFn(),
}));

// Mock API utilities
jest.mock('@/lib/utils/api-utils', () => ({
  handleApiError: jest.fn(),
  addCorsHeaders: (response: any) => response,
}));

import { prisma } from '@/lib/database/connection';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Search API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should perform full-text search with query parameter', async () => {
    const mockProjects = [
      {
        id: '1',
        title: 'React Portfolio',
        slug: 'react-portfolio',
        description: 'A portfolio built with React',
        briefOverview: 'Modern React application',
        workDate: new Date('2024-01-01'),
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        viewCount: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [{ id: '1', name: 'React', color: '#61DAFB' }],
        thumbnailImage: null,
        mediaItems: [],
        externalLinks: [],
        downloadableFiles: [],
        _count: { mediaItems: 0, downloadableFiles: 0, externalLinks: 0 }
      }
    ];

    mockPrisma.project.findMany.mockResolvedValue(mockProjects as any);
    mockPrisma.project.count.mockResolvedValue(1);

    const url = new URL('http://localhost:3000/api/projects?query=React&sortBy=relevance&sortOrder=desc&page=1&limit=20');
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.items).toHaveLength(1);
    expect(data.data.items[0].title).toBe('React Portfolio');

    // Verify the search query was constructed correctly
    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          OR: expect.arrayContaining([
            expect.objectContaining({
              searchVector: { search: 'React:*' }
            }),
            expect.objectContaining({
              title: { contains: 'React', mode: 'insensitive' }
            }),
            expect.objectContaining({
              description: { contains: 'React', mode: 'insensitive' }
            }),
            expect.objectContaining({
              briefOverview: { contains: 'React', mode: 'insensitive' }
            }),
            expect.objectContaining({
              tags: {
                some: {
                  name: { contains: 'React', mode: 'insensitive' }
                }
              }
            })
          ])
        })
      })
    );
  });

  it('should handle multi-word search queries', async () => {
    const mockProjects = [];
    mockPrisma.project.findMany.mockResolvedValue(mockProjects as any);
    mockPrisma.project.count.mockResolvedValue(0);

    const url = new URL('http://localhost:3000/api/projects?query=React TypeScript&sortBy=relevance');
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify multi-word search query processing
    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              searchVector: { search: 'React:* & TypeScript:*' }
            })
          ])
        })
      })
    );
  });

  it('should combine search with tag filtering', async () => {
    const mockProjects = [];
    mockPrisma.project.findMany.mockResolvedValue(mockProjects as any);
    mockPrisma.project.count.mockResolvedValue(0);

    const url = new URL('http://localhost:3000/api/projects?query=portfolio&tags=React,TypeScript');
    const request = new NextRequest(url);

    const response = await GET(request);

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          OR: expect.arrayContaining([
            expect.objectContaining({
              searchVector: { search: 'portfolio:*' }
            })
          ]),
          tags: {
            some: {
              name: {
                in: ['React', 'TypeScript']
              }
            }
          }
        })
      })
    );
  });

  it('should handle empty search query', async () => {
    const mockProjects = [];
    mockPrisma.project.findMany.mockResolvedValue(mockProjects as any);
    mockPrisma.project.count.mockResolvedValue(0);

    const url = new URL('http://localhost:3000/api/projects?query=&sortBy=date');
    const request = new NextRequest(url);

    const response = await GET(request);

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          visibility: 'PUBLIC'
        })
      })
    );

    // Should not have OR clause for empty search
    const whereClause = mockPrisma.project.findMany.mock.calls[0][0].where;
    expect(whereClause.OR).toBeUndefined();
  });

  it('should handle special characters in search query', async () => {
    const mockProjects = [];
    mockPrisma.project.findMany.mockResolvedValue(mockProjects as any);
    mockPrisma.project.count.mockResolvedValue(0);

    const url = new URL('http://localhost:3000/api/projects?query=C%2B%2B'); // C++ encoded
    const request = new NextRequest(url);

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              title: { contains: 'C++', mode: 'insensitive' }
            })
          ])
        })
      })
    );
  });

  it('should apply correct sorting for search results', async () => {
    const mockProjects = [];
    mockPrisma.project.findMany.mockResolvedValue(mockProjects as any);
    mockPrisma.project.count.mockResolvedValue(0);

    const url = new URL('http://localhost:3000/api/projects?query=test&sortBy=popularity&sortOrder=desc');
    const request = new NextRequest(url);

    const response = await GET(request);

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { viewCount: 'desc' }
      })
    );
  });

  it('should handle pagination with search', async () => {
    const mockProjects = [];
    mockPrisma.project.findMany.mockResolvedValue(mockProjects as any);
    mockPrisma.project.count.mockResolvedValue(25);

    const url = new URL('http://localhost:3000/api/projects?query=test&page=2&limit=10');
    const request = new NextRequest(url);

    const response = await GET(request);
    const data = await response.json();

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10, // (page 2 - 1) * limit 10
        take: 10
      })
    );

    expect(data.data.totalCount).toBe(25);
    expect(data.data.hasMore).toBe(true);
  });
});

describe('Search Performance', () => {
  it('should use caching for repeated search queries', async () => {
    const mockProjects = [
      {
        id: '1',
        title: 'Test Project',
        slug: 'test-project',
        description: 'Test description',
        briefOverview: 'Test overview',
        workDate: new Date(),
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        viewCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        thumbnailImage: null,
        mediaItems: [],
        externalLinks: [],
        downloadableFiles: [],
        _count: { mediaItems: 0, downloadableFiles: 0, externalLinks: 0 }
      }
    ];

    mockPrisma.project.findMany.mockResolvedValue(mockProjects as any);
    mockPrisma.project.count.mockResolvedValue(1);

    const url = new URL('http://localhost:3000/api/projects?query=test&sortBy=relevance');
    const request1 = new NextRequest(url);
    const request2 = new NextRequest(url);

    // First request
    const response1 = await GET(request1);
    expect(response1.status).toBe(200);

    // Second identical request should use cache
    const response2 = await GET(request2);
    expect(response2.status).toBe(200);

    // Database should only be called once due to caching
    expect(mockPrisma.project.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.project.count).toHaveBeenCalledTimes(1);
  });
});