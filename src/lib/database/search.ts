/**
 * Full-text search utilities for projects
 */

import { prisma } from './connection';
import { Prisma } from '@prisma/client';

export interface SearchOptions {
  query?: string;
  tags?: string[];
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  visibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  sortBy?: 'relevance' | 'date' | 'title' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  projects: any[];
  totalCount: number;
  hasMore: boolean;
  page: number;
  limit: number;
}

/**
 * Search projects with full-text search and filtering
 */
export async function searchProjects(options: SearchOptions = {}): Promise<SearchResult> {
  const {
    query,
    tags = [],
    status = 'PUBLISHED',
    visibility = 'PUBLIC',
    sortBy = 'relevance',
    sortOrder = 'desc',
    page = 1,
    limit = 20,
  } = options;

  const offset = (page - 1) * limit;

  // Build where clause
  const whereClause: Prisma.ProjectWhereInput = {
    status,
    visibility,
  };

  // Add tag filtering
  if (tags.length > 0) {
    whereClause.tags = {
      some: {
        name: {
          in: tags,
        },
      },
    };
  }

  // Add full-text search
  if (query && query.trim()) {
    const searchQuery = query.trim().replace(/[^\w\s]/g, '').split(/\s+/).join(' & ');
    whereClause.OR = [
      {
        title: {
          contains: query,
          mode: 'insensitive',
        },
      },
      {
        description: {
          contains: query,
          mode: 'insensitive',
        },
      },
      {
        briefOverview: {
          contains: query,
          mode: 'insensitive',
        },
      },
    ];
  }

  // Build order by clause
  let orderBy: Prisma.ProjectOrderByWithRelationInput[] = [];

  switch (sortBy) {
    case 'relevance':
      if (query && query.trim()) {
        // For relevance, we'll use a combination of factors
        orderBy = [
          { viewCount: 'desc' },
          { createdAt: 'desc' },
        ];
      } else {
        orderBy = [{ createdAt: 'desc' }];
      }
      break;
    case 'date':
      orderBy = [{ workDate: sortOrder === 'desc' ? 'desc' : 'asc' }];
      break;
    case 'title':
      orderBy = [{ title: sortOrder === 'desc' ? 'desc' : 'asc' }];
      break;
    case 'popularity':
      orderBy = [{ viewCount: sortOrder === 'desc' ? 'desc' : 'asc' }];
      break;
  }

  // Execute search query
  const [projects, totalCount] = await Promise.all([
    prisma.project.findMany({
      where: whereClause,
      orderBy,
      skip: offset,
      take: limit,
      include: {
        tags: true,
        thumbnailImage: true,
        _count: {
          select: {
            mediaItems: true,
            downloadableFiles: true,
            externalLinks: true,
          },
        },
      },
    }),
    prisma.project.count({
      where: whereClause,
    }),
  ]);

  return {
    projects,
    totalCount,
    hasMore: offset + projects.length < totalCount,
    page,
    limit,
  };
}

/**
 * Get search suggestions based on partial query
 */
export async function getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const projects = await prisma.project.findMany({
    where: {
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      OR: [
        {
          title: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: query,
            mode: 'insensitive',
          },
        },
      ],
    },
    select: {
      title: true,
    },
    take: limit,
  });

  return projects.map(p => p.title);
}

/**
 * Get popular search terms (based on project titles and tags)
 */
export async function getPopularSearchTerms(limit: number = 10): Promise<string[]> {
  const [popularTags, popularProjects] = await Promise.all([
    prisma.tag.findMany({
      select: {
        name: true,
        _count: {
          select: {
            projects: true,
          },
        },
      },
      orderBy: {
        projects: {
          _count: 'desc',
        },
      },
      take: limit / 2,
    }),
    prisma.project.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
      },
      select: {
        title: true,
      },
      orderBy: {
        viewCount: 'desc',
      },
      take: limit / 2,
    }),
  ]);

  const terms = [
    ...popularTags.map(tag => tag.name),
    ...popularProjects.map(project => project.title),
  ];

  return terms.slice(0, limit);
}

/**
 * Update search vector for a specific project
 */
export async function updateProjectSearchVector(projectId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE projects 
    SET search_vector = 
      setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
      setweight(to_tsvector('english', COALESCE("briefOverview", '')), 'C')
    WHERE id = ${projectId}
  `;
}

/**
 * Rebuild all search vectors (maintenance function)
 */
export async function rebuildSearchVectors(): Promise<number> {
  const result = await prisma.$executeRaw`
    UPDATE projects 
    SET search_vector = 
      setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
      setweight(to_tsvector('english', COALESCE("briefOverview", '')), 'C')
    WHERE search_vector IS NULL OR search_vector = ''
  `;

  return Number(result);
}