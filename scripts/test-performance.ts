/**
 * Performance testing and optimization script
 * Run with: npx tsx scripts/test-performance.ts
 */

import { checkDatabaseConnection, runDatabasePerformanceTest } from '../src/lib/database/connection';
import { profiler } from '../src/lib/utils/performance';
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function applyPerformanceIndexes() {
  console.log('🔧 Applying performance indexes...');
  
  try {
    // Read the migration file
    const fs = require('fs');
    const path = require('path');
    
    const migrationPath = path.join(__dirname, '../prisma/migrations/003_add_performance_indexes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by lines and execute each statement
    const statements = migrationSQL
      .split(';')
      .map((stmt: string) => stmt.trim())
      .filter((stmt: string) => stmt && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement + ';');
          console.log('✅ Applied:', statement.split('\n')[0]);
        } catch (error: any) {
          if (error.message.includes('already exists')) {
            console.log('⚠️  Index already exists:', statement.split('\n')[0]);
          } else {
            console.error('❌ Error applying:', statement.split('\n')[0], error.message);
          }
        }
      }
    }
    
    console.log('✅ Performance indexes applied successfully!');
  } catch (error) {
    console.error('❌ Error applying performance indexes:', error);
  }
}

async function testDatabasePerformance() {
  console.log('\n🧪 Testing database performance...');
  
  try {
    const connectionTest = await checkDatabaseConnection();
    console.log('Database connection:', connectionTest);
    
    const performanceTest = await runDatabasePerformanceTest();
    console.log('Database performance test results:');
    console.log('- Simple query:', performanceTest.simpleQuery + 'ms');
    console.log('- Complex query:', performanceTest.complexQuery + 'ms');
    console.log('- Indexed query:', performanceTest.indexedQuery + 'ms');
    
    // Test projects API query performance
    console.log('\n🔍 Testing projects API queries...');
    
    const projectsTestStart = performance.now();
    const projects = await prisma.project.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
      },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        briefOverview: true,
        workDate: true,
        status: true,
        visibility: true,
        viewCount: true,
        createdAt: true,
        updatedAt: true,
        tags: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        thumbnailImage: {
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            altText: true,
            width: true,
            height: true
          }
        },
        _count: {
          select: {
            mediaItems: true,
            downloadableFiles: true,
            externalLinks: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const projectsTestTime = performance.now() - projectsTestStart;
    
    console.log(`- Projects API query: ${projectsTestTime.toFixed(2)}ms (${projects.length} results)`);
    
    // Test tag filtering performance
    const tagFilterStart = performance.now();
    const tagFilteredProjects = await prisma.project.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        tags: {
          some: {
            name: {
              in: ['React', 'TypeScript'],
            },
          },
        },
      },
      include: {
        tags: true,
      },
      take: 10,
    });
    const tagFilterTime = performance.now() - tagFilterStart;
    
    console.log(`- Tag filtering query: ${tagFilterTime.toFixed(2)}ms (${tagFilteredProjects.length} results)`);
    
    // Test search performance
    const searchStart = performance.now();
    const searchResults = await prisma.project.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        OR: [
          {
            title: {
              contains: 'project',
              mode: 'insensitive'
            }
          },
          {
            description: {
              contains: 'project',
              mode: 'insensitive'
            }
          }
        ]
      },
      take: 10,
    });
    const searchTime = performance.now() - searchStart;
    
    console.log(`- Search query: ${searchTime.toFixed(2)}ms (${searchResults.length} results)`);
    
  } catch (error) {
    console.error('❌ Error testing database performance:', error);
  }
}

async function testFullAPIPerformance() {
  console.log('\n🌐 Testing full API performance...');
  
  try {
    // Simulate API requests
    const apiTests = [
      { url: '/api/projects', description: 'Projects list' },
      { url: '/api/projects?sortBy=popularity', description: 'Projects by popularity' },
      { url: '/api/projects?tags=React,TypeScript', description: 'Projects with tags' },
      { url: '/api/projects?query=portfolio', description: 'Project search' },
    ];
    
    for (const test of apiTests) {
      const start = performance.now();
      
      // Simulate the API logic (without HTTP overhead)
      try {
        const url = new URL(`http://localhost:3000${test.url}`);
        const searchParams = url.searchParams;
        
        const where: any = {
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
        };
        
        if (searchParams.get('tags')) {
          where.tags = {
            some: {
              name: {
                in: searchParams.get('tags')!.split(','),
              },
            },
          };
        }
        
        if (searchParams.get('query')) {
          const query = searchParams.get('query')!;
          where.OR = [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ];
        }
        
        let orderBy: any = { createdAt: 'desc' };
        if (searchParams.get('sortBy') === 'popularity') {
          orderBy = { viewCount: 'desc' };
        }
        
        const results = await prisma.project.findMany({
          where,
          select: {
            id: true,
            title: true,
            slug: true,
            tags: { select: { name: true } },
            viewCount: true,
          },
          orderBy,
          take: 20,
        });
        
        const duration = performance.now() - start;
        console.log(`- ${test.description}: ${duration.toFixed(2)}ms (${results.length} results)`);
        
      } catch (error) {
        const duration = performance.now() - start;
        console.log(`- ${test.description}: ${duration.toFixed(2)}ms (ERROR: ${error})`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing API performance:', error);
  }
}

async function main() {
  console.log('🚀 Portfolio Performance Test Suite');
  console.log('=====================================');
  
  // Apply performance indexes first
  await applyPerformanceIndexes();
  
  // Test database performance
  await testDatabasePerformance();
  
  // Test API performance
  await testFullAPIPerformance();
  
  // Show profiler summary if any data was collected
  const metrics = profiler.getMetrics();
  if (metrics.summary) {
    console.log('\n📊 Performance Profiler Summary:');
    console.log(metrics.summary);
  }
  
  console.log('\n✅ Performance testing complete!');
  console.log('\n📝 Recommendations:');
  console.log('- Monitor slow queries (>100ms) in the console');
  console.log('- Check /api/admin/performance for real-time metrics');
  console.log('- Consider implementing response caching for frequently accessed data');
  console.log('- Use database connection pooling in production');
  
  await prisma.$disconnect();
}

main().catch(console.error); 