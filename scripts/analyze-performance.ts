/**
 * Performance Analysis Script
 * Analyzes current query performance and identifies optimization opportunities
 * Run with: npx tsx scripts/analyze-performance.ts
 */

import { PrismaClient } from '@prisma/client';
import { checkDatabaseConnection, runDatabasePerformanceTest } from '../src/lib/database/connection';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

interface QueryAnalysis {
  query: string;
  duration: number;
  frequency: number;
  avgDuration: number;
  maxDuration: number;
  optimization: string[];
}

class PerformanceAnalyzer {
  private queryLog: Array<{ query: string; duration: number; timestamp: Date }> = [];

  constructor() {
    // Listen to Prisma query events
    prisma.$on('query', (e: any) => {
      this.queryLog.push({
        query: e.query,
        duration: e.duration,
        timestamp: new Date(),
      });
    });
  }

  async runAnalysis() {
    console.log('🔍 Starting Performance Analysis...\n');

    // 1. Database Connection Analysis
    await this.analyzeDatabaseConnection();

    // 2. Query Pattern Analysis
    await this.analyzeQueryPatterns();

    // 3. Index Usage Analysis
    await this.analyzeIndexUsage();

    // 4. API Endpoint Performance
    await this.analyzeAPIPerformance();

    // 5. Generate Recommendations
    this.generateRecommendations();
  }

  private async analyzeDatabaseConnection() {
    console.log('📊 Database Connection Analysis');
    console.log('================================');

    const connectionTest = await checkDatabaseConnection();
    console.log(`Connection Status: ${connectionTest.connected ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`Provider: ${connectionTest.provider}`);
    console.log(`Response Time: ${connectionTest.responseTime}ms`);

    if (connectionTest.error) {
      console.log(`Error: ${connectionTest.error}`);
    }

    // Run performance test
    if (connectionTest.connected) {
      const perfTest = await runDatabasePerformanceTest();
      console.log('\nDatabase Performance Test:');
      console.log(`- Simple Query: ${perfTest.simpleQuery}ms`);
      console.log(`- Complex Query: ${perfTest.complexQuery}ms`);
      console.log(`- Indexed Query: ${perfTest.indexedQuery}ms`);

      // Analyze results
      if (perfTest.simpleQuery > 50) {
        console.log('⚠️  Simple queries are slower than expected (>50ms)');
      }
      if (perfTest.complexQuery > 200) {
        console.log('⚠️  Complex queries are slower than expected (>200ms)');
      }
      if (perfTest.indexedQuery > 100) {
        console.log('⚠️  Indexed queries are slower than expected (>100ms)');
      }
    }

    console.log('\n');
  }

  private async analyzeQueryPatterns() {
    console.log('🔍 Query Pattern Analysis');
    console.log('==========================');

    // Test common query patterns
    const testQueries = [
      {
        name: 'Projects List (Basic)',
        query: () => prisma.project.findMany({
          where: { visibility: 'PUBLIC' },
          take: 20,
        }),
      },
      {
        name: 'Projects List (With Relations)',
        query: () => prisma.project.findMany({
          where: { visibility: 'PUBLIC' },
          include: {
            tags: true,
            thumbnailImage: true,
            _count: { select: { mediaItems: true } },
          },
          take: 20,
        }),
      },
      {
        name: 'Projects with Tag Filter',
        query: () => prisma.project.findMany({
          where: {
            
            visibility: 'PUBLIC',
            tags: { some: { name: { in: ['React', 'TypeScript'] } } },
          },
          include: { tags: true },
          take: 10,
        }),
      },
      {
        name: 'Project Search',
        query: () => prisma.project.findMany({
          where: {
            
            visibility: 'PUBLIC',
            OR: [
              { title: { contains: 'project', mode: 'insensitive' } },
              { description: { contains: 'project', mode: 'insensitive' } },
            ],
          },
          take: 10,
        }),
      },
      {
        name: 'Single Project Detail',
        query: async () => {
          const project = await prisma.project.findFirst({
            where: { visibility: 'PUBLIC' },
          });
          if (!project) return null;
          
          return prisma.project.findUnique({
            where: { id: project.id },
            include: {
              tags: true,
              thumbnailImage: true,
              metadataImage: true,
              mediaItems: { take: 10 },
              externalLinks: { take: 5 },
              downloadableFiles: { take: 5 },
              _count: { select: { mediaItems: true } },
            },
          });
        },
      },
    ];

    for (const test of testQueries) {
      const startTime = performance.now();
      try {
        const result = await test.query();
        const duration = performance.now() - startTime;
        const resultCount = Array.isArray(result) ? result.length : result ? 1 : 0;
        
        console.log(`${test.name}: ${duration.toFixed(2)}ms (${resultCount} results)`);
        
        if (duration > 200) {
          console.log(`  ⚠️  Slow query detected (>${duration.toFixed(2)}ms)`);
        }
      } catch (error) {
        console.log(`${test.name}: ERROR - ${error}`);
      }
    }

    console.log('\n');
  }

  private async analyzeIndexUsage() {
    console.log('📈 Index Usage Analysis');
    console.log('=======================');

    try {
      // Check if performance indexes exist
      const indexQueries = [
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'projects' AND indexname LIKE '%performance%' OR indexname LIKE '%idx_%'`,
        `SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE tablename IN ('projects', 'media_items', 'tags', '_ProjectToTag') ORDER BY tablename, indexname`,
      ];

      for (const query of indexQueries) {
        try {
          const result = await prisma.$queryRawUnsafe(query);
          if (Array.isArray(result) && result.length > 0) {
            console.log(`Found ${result.length} indexes:`);
            result.forEach((index: any) => {
              console.log(`  - ${index.indexname} on ${index.tablename || 'projects'}`);
            });
          }
        } catch (error) {
          console.log('Could not query index information (may require admin privileges)');
        }
      }

      // Test query plan analysis (if available)
      try {
        const explainQuery = `
          EXPLAIN (ANALYZE, BUFFERS) 
          SELECT p.id, p.title, p.slug 
          FROM projects p 
          WHERE p.visibility = 'PUBLIC' 
          ORDER BY p."viewCount" DESC 
          LIMIT 10
        `;
        
        const queryPlan = await prisma.$queryRawUnsafe(explainQuery);
        console.log('\nQuery Plan Analysis:');
        if (Array.isArray(queryPlan)) {
          queryPlan.forEach((row: any) => {
            console.log(`  ${row['QUERY PLAN']}`);
          });
        }
      } catch (error) {
        console.log('Query plan analysis not available');
      }

    } catch (error) {
      console.log('Index analysis failed:', error);
    }

    console.log('\n');
  }

  private async analyzeAPIPerformance() {
    console.log('🌐 API Performance Simulation');
    console.log('==============================');

    // Simulate API calls to measure end-to-end performance
    const apiTests = [
      {
        name: 'GET /api/projects (default)',
        simulate: () => this.simulateProjectsAPI(),
      },
      {
        name: 'GET /api/projects?sortBy=popularity',
        simulate: () => this.simulateProjectsAPI({ sortBy: 'popularity' }),
      },
      {
        name: 'GET /api/projects?tags=React,TypeScript',
        simulate: () => this.simulateProjectsAPI({ tags: ['React', 'TypeScript'] }),
      },
      {
        name: 'GET /api/projects?query=portfolio',
        simulate: () => this.simulateProjectsAPI({ query: 'portfolio' }),
      },
      {
        name: 'GET /api/projects/[slug]',
        simulate: () => this.simulateProjectDetailAPI(),
      },
    ];

    for (const test of apiTests) {
      const startTime = performance.now();
      try {
        const result = await test.simulate();
        const duration = performance.now() - startTime;
        
        console.log(`${test.name}: ${duration.toFixed(2)}ms`);
        
        if (duration > 500) {
          console.log(`  🚨 Very slow API response (>${duration.toFixed(2)}ms)`);
        } else if (duration > 200) {
          console.log(`  ⚠️  Slow API response (>${duration.toFixed(2)}ms)`);
        } else if (duration < 100) {
          console.log(`  ✅ Fast API response`);
        }
      } catch (error) {
        console.log(`${test.name}: ERROR - ${error}`);
      }
    }

    console.log('\n');
  }

  private async simulateProjectsAPI(params?: {
    sortBy?: string;
    tags?: string[];
    query?: string;
  }) {
    const where: any = {
      
      visibility: 'PUBLIC',
    };

    if (params?.tags) {
      where.tags = {
        some: { name: { in: params.tags } },
      };
    }

    if (params?.query) {
      where.OR = [
        { title: { contains: params.query, mode: 'insensitive' } },
        { description: { contains: params.query, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    if (params?.sortBy === 'popularity') {
      orderBy = { viewCount: 'desc' };
    }

    const [projects, totalCount] = await Promise.all([
      prisma.project.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          briefOverview: true,
          workDate: true,
          viewCount: true,
          tags: { select: { id: true, name: true, color: true } },
          thumbnailImage: {
            select: { id: true, url: true, thumbnailUrl: true, altText: true },
          },
          _count: { select: { mediaItems: true } },
        },
        orderBy,
        take: 20,
      }),
      prisma.project.count({ where }),
    ]);

    return { projects, totalCount };
  }

  private async simulateProjectDetailAPI() {
    // Get a random published project
    const project = await prisma.project.findFirst({
      where: { visibility: 'PUBLIC' },
    });

    if (!project) return null;

    const [projectDetail, relatedProjects] = await Promise.all([
      prisma.project.findUnique({
        where: { id: project.id },
        include: {
          tags: true,
          thumbnailImage: true,
          metadataImage: true,
          mediaItems: { take: 10, orderBy: { displayOrder: 'asc' } },
          externalLinks: { take: 5, orderBy: { order: 'asc' } },
          downloadableFiles: { take: 5, orderBy: { uploadDate: 'desc' } },
          _count: { select: { mediaItems: true } },
        },
      }),
      prisma.project.findMany({
        where: {
          
          visibility: 'PUBLIC',
          id: { not: project.id },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          briefOverview: true,
          tags: { select: { name: true } },
        },
        take: 5,
      }),
    ]);

    return { project: projectDetail, relatedProjects };
  }

  private generateRecommendations() {
    console.log('💡 Performance Recommendations');
    console.log('===============================');

    const recommendations = [
      {
        category: 'Database Optimization',
        items: [
          'Ensure performance indexes are applied (run: npx tsx scripts/test-performance.ts)',
          'Monitor slow queries (>100ms) in development logs',
          'Consider connection pooling for production (pgbouncer)',
          'Use selective field selection instead of full includes',
        ],
      },
      {
        category: 'Query Optimization',
        items: [
          'Limit related data fetching (use take: N for relationships)',
          'Use _count for counting instead of loading full relations',
          'Implement pagination for large datasets',
          'Cache frequently accessed data (projects list, tags)',
        ],
      },
      {
        category: 'API Performance',
        items: [
          'Implement response caching for GET endpoints',
          'Use parallel queries (Promise.all) where possible',
          'Add request/response compression',
          'Monitor API response times with profiler',
        ],
      },
      {
        category: 'Monitoring',
        items: [
          'Set up performance monitoring dashboard (/admin/performance)',
          'Track Core Web Vitals in production',
          'Monitor database connection health',
          'Set up alerts for slow queries (>500ms)',
        ],
      },
    ];

    recommendations.forEach(section => {
      console.log(`\n${section.category}:`);
      section.items.forEach(item => {
        console.log(`  • ${item}`);
      });
    });

    console.log('\n✅ Analysis Complete!');
    console.log('\nNext Steps:');
    console.log('1. Review slow queries identified above');
    console.log('2. Apply performance indexes if not already done');
    console.log('3. Implement caching for frequently accessed endpoints');
    console.log('4. Monitor performance in production with /api/health?perf=true');
  }
}

async function main() {
  const analyzer = new PerformanceAnalyzer();
  
  try {
    await analyzer.runAnalysis();
  } catch (error) {
    console.error('Analysis failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);