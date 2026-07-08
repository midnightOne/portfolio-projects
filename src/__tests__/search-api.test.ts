/**
 * Integration tests for search API functionality.
 *
 * Search queries run through PostgreSQL full-text search as raw SQL
 * ($queryRawUnsafe with to_tsquery + ts_rank), then hydrate the matched ids
 * via findMany — the old Prisma where.OR full-text path is gone. Note the
 * route memoizes responses per query-param set, so every test uses a
 * distinct parameter combination.
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
    $queryRawUnsafe: jest.fn(),
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

const mockPrisma = prisma as unknown as {
  project: { findMany: jest.Mock; count: jest.Mock };
  $queryRawUnsafe: jest.Mock;
};

const fullProject = (overrides: Record<string, unknown> = {}) => ({
  id: '1',
  title: 'React Portfolio',
  slug: 'react-portfolio',
  description: 'A portfolio built with React',
  briefOverview: 'Modern React application',
  workDate: new Date('2024-01-01'),
  visibility: 'PUBLIC',
  viewCount: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
  tags: [{ id: '1', name: 'React', color: '#61DAFB' }],
  thumbnailImage: null,
  mediaItems: [],
  externalLinks: [],
  downloadableFiles: [],
  _count: { mediaItems: 0, downloadableFiles: 0, externalLinks: 0 },
  ...overrides,
});

/** Queue the raw search + count responses (consumed in that order). */
function mockSearchSql(rows: Array<{ id: string }>, count: number) {
  mockPrisma.$queryRawUnsafe
    .mockResolvedValueOnce(rows.map((r) => ({ ...r, search_rank: 0.5 })))
    .mockResolvedValueOnce([{ count: String(count) }]);
}

const searchSqlCall = () => mockPrisma.$queryRawUnsafe.mock.calls[0];

describe('Search API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should perform full-text search with query parameter', async () => {
    mockSearchSql([{ id: '1' }], 1);
    mockPrisma.project.findMany.mockResolvedValue([fullProject()] as any);

    const url = new URL('http://localhost:3000/api/projects?query=React&sortBy=relevance&sortOrder=desc&page=1&limit=20');
    const response = await GET(new NextRequest(url));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.items).toHaveLength(1);
    expect(data.data.items[0].title).toBe('React Portfolio');

    // Full-text search rides raw SQL with prefix-matched tsquery terms
    const [sql, ...params] = searchSqlCall();
    expect(sql).toContain('to_tsquery');
    expect(sql).toContain("visibility = 'PUBLIC'");
    expect(params).toEqual(['React:*']);

    // Matches are hydrated by id, not re-filtered by text
    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['1'] } },
      })
    );
  });

  it('should handle multi-word search queries', async () => {
    mockSearchSql([], 0);
    mockPrisma.project.findMany.mockResolvedValue([] as any);

    const url = new URL('http://localhost:3000/api/projects?query=React TypeScript&sortBy=relevance');
    const response = await GET(new NextRequest(url));

    expect(response.status).toBe(200);
    const [, ...params] = searchSqlCall();
    expect(params).toEqual(['React:* & TypeScript:*']);
  });

  it('should combine search with tag filtering', async () => {
    mockSearchSql([], 0);
    mockPrisma.project.findMany.mockResolvedValue([] as any);

    const url = new URL('http://localhost:3000/api/projects?query=portfolio&tags=React,TypeScript');
    await GET(new NextRequest(url));

    const [sql, ...params] = searchSqlCall();
    expect(sql).toContain('_ProjectTags');
    expect(params).toEqual(['portfolio:*', 'React', 'TypeScript']);
  });

  it('should handle empty search query', async () => {
    mockPrisma.project.findMany.mockResolvedValue([] as any);
    mockPrisma.project.count.mockResolvedValue(0);

    const url = new URL('http://localhost:3000/api/projects?query=&sortBy=date');
    await GET(new NextRequest(url));

    // Empty query takes the regular Prisma path — no raw SQL, no OR clause
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ visibility: 'PUBLIC' }),
      })
    );
    const whereClause = (mockPrisma.project.findMany.mock.calls[0][0] as any).where;
    expect(whereClause.OR).toBeUndefined();
  });

  it('should handle special characters in search query', async () => {
    mockSearchSql([], 0);
    mockPrisma.project.findMany.mockResolvedValue([] as any);

    const url = new URL('http://localhost:3000/api/projects?query=C%2B%2B'); // C++ encoded
    const response = await GET(new NextRequest(url));

    expect(response.status).toBe(200);
    const [, ...params] = searchSqlCall();
    expect(params).toEqual(['C++:*']);
  });

  it('should order search results by rank, not the sort parameter', async () => {
    mockSearchSql([], 0);
    mockPrisma.project.findMany.mockResolvedValue([] as any);

    const url = new URL('http://localhost:3000/api/projects?query=test&sortBy=popularity&sortOrder=desc');
    await GET(new NextRequest(url));

    const [sql] = searchSqlCall();
    expect(sql).toContain('ORDER BY search_rank DESC');
  });

  it('should handle pagination with search', async () => {
    mockSearchSql([{ id: '1' }], 25);
    mockPrisma.project.findMany.mockResolvedValue([fullProject()] as any);

    const url = new URL('http://localhost:3000/api/projects?query=test&page=2&limit=10');
    const response = await GET(new NextRequest(url));
    const data = await response.json();

    const [sql] = searchSqlCall();
    expect(sql).toContain('LIMIT 10 OFFSET 10');
    expect(data.data.totalCount).toBe(25);
    expect(data.data.hasMore).toBe(true);
  });
});

describe('Search Performance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use caching for repeated search queries', async () => {
    mockSearchSql([{ id: '1' }], 1);
    (prisma.project.findMany as jest.Mock).mockResolvedValue([fullProject({ title: 'Test Project', slug: 'test-project' })] as any);

    const url = new URL('http://localhost:3000/api/projects?query=cachedrill&sortBy=relevance');

    const response1 = await GET(new NextRequest(url));
    expect(response1.status).toBe(200);

    const response2 = await GET(new NextRequest(url));
    expect(response2.status).toBe(200);

    // Second identical request served from the route's response cache
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(2); // search + count, once
    expect(prisma.project.findMany).toHaveBeenCalledTimes(1);
  });
});
