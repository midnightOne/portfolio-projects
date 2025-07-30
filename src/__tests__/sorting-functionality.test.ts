/**
 * Tests for sorting functionality in the projects API
 */

// Mock Next.js server components
Object.defineProperty(globalThis, 'Request', {
  value: class MockRequest {
    constructor(public url: string, public init?: RequestInit) {}
  },
});

Object.defineProperty(globalThis, 'Response', {
  value: class MockResponse {
    constructor(public body?: any, public init?: ResponseInit) {}
    static json(data: any) {
      return new MockResponse(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },
});

// Mock the database connection
jest.mock('@/lib/database/connection', () => ({
  prisma: {
    project: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  },
}));

// Mock performance utilities
jest.mock('@/lib/utils/performance', () => ({
  withPerformanceTracking: (fn: any) => fn,
  profileQuery: (fn: any) => fn(),
}));

// Mock API utilities
jest.mock('@/lib/utils/api-utils', () => ({
  handleApiError: jest.fn(),
  addCorsHeaders: (response: any) => response,
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/projects/route';

import { prisma } from '@/lib/database/connection';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Projects API Sorting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock responses
    mockPrisma.project.findMany.mockResolvedValue([]);
    mockPrisma.project.count.mockResolvedValue(0);
  });

  const createMockRequest = (searchParams: Record<string, string>) => {
    const url = new URL('http://localhost:3000/api/projects');
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    
    return new NextRequest(url);
  };

  it('sorts by date correctly', async () => {
    const request = createMockRequest({
      sortBy: 'date',
      sortOrder: 'desc',
    });

    await GET(request);

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { workDate: 'desc' },
          { createdAt: 'desc' }
        ],
      })
    );
  });

  it('sorts by title correctly', async () => {
    const request = createMockRequest({
      sortBy: 'title',
      sortOrder: 'asc',
    });

    await GET(request);

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { title: 'asc' },
      })
    );
  });

  it('sorts by popularity correctly', async () => {
    const request = createMockRequest({
      sortBy: 'popularity',
      sortOrder: 'desc',
    });

    await GET(request);

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { viewCount: 'desc' },
          { createdAt: 'desc' }
        ],
      })
    );
  });

  it('defaults to relevance sorting', async () => {
    const request = createMockRequest({});

    await GET(request);

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('handles invalid sort options by defaulting to relevance', async () => {
    const request = createMockRequest({
      sortBy: 'invalid',
      sortOrder: 'desc',
    });

    await GET(request);

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('respects sort order parameter', async () => {
    const request = createMockRequest({
      sortBy: 'title',
      sortOrder: 'asc',
    });

    await GET(request);

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { title: 'asc' },
      })
    );
  });

  it('defaults sort order to desc when not specified', async () => {
    const request = createMockRequest({
      sortBy: 'date',
    });

    await GET(request);

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { workDate: 'desc' },
          { createdAt: 'desc' }
        ],
      })
    );
  });

  it('combines sorting with filtering', async () => {
    const request = createMockRequest({
      sortBy: 'popularity',
      sortOrder: 'desc',
      tags: 'React,TypeScript',
    });

    await GET(request);

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tags: {
            some: {
              name: {
                in: ['React', 'TypeScript'],
              },
            },
          },
        }),
        orderBy: [
          { viewCount: 'desc' },
          { createdAt: 'desc' }
        ],
      })
    );
  });

  it('combines sorting with search', async () => {
    const request = createMockRequest({
      sortBy: 'title',
      sortOrder: 'asc',
      query: 'test project',
    });

    // Mock full-text search response
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: '1', search_rank: 0.5 }]) // search results
      .mockResolvedValueOnce([{ count: '1' }]); // count results

    await GET(request);

    // For search queries, the API uses raw SQL with search ranking
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY search_rank DESC'),
      'test:* & project:*'
    );
  });

  it('handles pagination with sorting', async () => {
    const request = createMockRequest({
      sortBy: 'date',
      sortOrder: 'desc',
      page: '2',
      limit: '10',
    });

    await GET(request);

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { workDate: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: 10, // (page 2 - 1) * limit 10
        take: 10,
      })
    );
  });
});