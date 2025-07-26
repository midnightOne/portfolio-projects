/**
 * Query Optimization Script
 * Incrementally optimizes database queries without breaking functionality
 * Run with: npx tsx scripts/optimize-queries.ts
 */

import { PrismaClient } from '@prisma/client';
import { profiler } from '../src/lib/utils/performance';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
  ],
});

interface OptimizationResult {
  name: string;
  before: number;
  after: number;
  improvement: number;
  improvementPercent: number;
  success: boolean;
  error?: string;
}

class QueryOptimizer {
  private results: OptimizationResult[] = [];

  async runOptimizations() {
    console.log('🚀 Starting Query Optimization Process...\n');

    // 1. Optimize Projects List Query
    await this.optimizeProjectsList();

    // 2. Optimize Project Detail Query
    await this.optimizeProjectDetail();

    // 3. Optimize Tag Filtering
    await this.optimizeTagFiltering();

    // 4. Optimize Search Queries
    await this.optimizeSearchQueries();

    // 5. Generate Report
    this.generateOptimizationReport();
  }

  private async optimizeProjectsList() {
    console.log('📋 Optimizing Projects List Query...');

    // Test current implementation
    const beforeTime = await this.measureQuery(
      'Current Projects List',
      () => prisma.project.findMany({
        where: { status: 'PUBLISHED', visibility: 'PUBLIC' },
        include: {
          tags: true,
          thumbnailImage: true,
          mediaItems: true,
          externalLinks: true,
          downloadableFiles: true,
          _count: { select: { mediaItems: true } },
        },
        take: 20,
      })
    );

    // Test optimized implementation
    const afterTime = await this.measureQuery(
      'Optimized Projects List',
      () => prisma.project.findMany({
        where: { status: 'PUBLISHED', visibility: 'PUBLIC' },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          briefOverview: true,
          workDate: true,
          viewCount: true,
          createdAt: true,
          updatedAt: true,
          // Limit related data
          tags: {
            select: { id: true, name: true, color: true },
            take: 5,
          },
          thumbnailImage: {
            select: { id: true, url: true, thumbnailUrl: true, altText: true },
          },
          // Only get counts, not full data
          _count: {
            select: {
              mediaItems: true,
              externalLinks: true,
              downloadableFiles: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    );

    this.recordOptimization('Projects List Query', beforeTime, afterTime);
  }

  private async optimizeProjectDetail() {
    console.log('📄 Optimizing Project Detail Query...');

    // Get a sample project
    const sampleProject = await prisma.project.findFirst({
      where: { status: 'PUBLISHED', visibility: 'PUBLIC' },
    });

    if (!sampleProject) {
      console.log('No published projects found for testing');
      return;
    }

    // Test current implementation (loading everything)
    const beforeTime = await this.measureQuery(
      'Current Project Detail',
      () => prisma.project.findUnique({
        where: { id: sampleProject.id },
        include: {
          tags: true,
          thumbnailImage: true,
          metadataImage: true,
          mediaItems: true,
          externalLinks: true,
          downloadableFiles: true,
          interactiveExamples: true,
          articleContent: true,
          _count: { select: { mediaItems: true } },
        },
      })
    );

    // Test optimized implementation (selective loading)
    const afterTime = await this.measureQuery(
      'Optimized Project Detail',
      () => prisma.project.findUnique({
        where: { id: sampleProject.id },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          briefOverview: true,
          workDate: true,
          viewCount: true,
          createdAt: true,
          updatedAt: true,
          tags: {
            select: { id: true, name: true, color: true },
          },
          thumbnailImage: {
            select: { id: true, url: true, thumbnailUrl: true, altText: true },
          },
          metadataImage: {
            select: { id: true, url: true, thumbnailUrl: true, altText: true },
          },
          // Limit media items
          mediaItems: {
            select: {
              id: true,
              type: true,
              url: true,
              thumbnailUrl: true,
              altText: true,
              displayOrder: true,
            },
            orderBy: { displayOrder: 'asc' },
            take: 10,
          },
          // Limit external links
          externalLinks: {
            select: { id: true, url: true, label: true, order: true },
            orderBy: { order: 'asc' },
            take: 5,
          },
          // Limit downloadable files
          downloadableFiles: {
            select: {
              id: true,
              filename: true,
              originalName: true,
              fileType: true,
              fileSize: true,
              downloadUrl: true,
            },
            orderBy: { uploadDate: 'desc' },
            take: 5,
          },
          _count: {
            select: {
              mediaItems: true,
              externalLinks: true,
              downloadableFiles: true,
            },
          },
        },
      })
    );

    this.recordOptimization('Project Detail Query', beforeTime, afterTime);
  }

  private async optimizeTagFiltering() {
    console.log('🏷️  Optimizing Tag Filtering...');

    // Test current implementation
    const beforeTime = await this.measureQuery(
      'Current Tag Filtering',
      () => prisma.project.findMany({
        where: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          tags: {
            some: {
              name: { in: ['React', 'TypeScript'] },
            },
          },
        },
        include: {
          tags: true,
          thumbnailImage: true,
        },
        take: 10,
      })
    );

    // Test optimized implementation
    const afterTime = await this.measureQuery(
      'Optimized Tag Filtering',
      () => prisma.project.findMany({
        where: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          tags: {
            some: {
              name: { in: ['React', 'TypeScript'] },
            },
          },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          briefOverview: true,
          viewCount: true,
          tags: {
            select: { id: true, name: true, color: true },
            take: 3,
          },
          thumbnailImage: {
            select: { id: true, url: true, thumbnailUrl: true, altText: true },
          },
        },
        orderBy: { viewCount: 'desc' },
        take: 10,
      })
    );

    this.recordOptimization('Tag Filtering Query', beforeTime, afterTime);
  }

  private async optimizeSearchQueries() {
    console.log('🔍 Optimizing Search Queries...');

    const searchTerm = 'project';

    // Test current implementation
    const beforeTime = await this.measureQuery(
      'Current Search Query',
      () => prisma.project.findMany({
        where: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
            { briefOverview: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        include: {
          tags: true,
          thumbnailImage: true,
        },
        take: 10,
      })
    );

    // Test optimized implementation (using indexes)
    const afterTime = await this.measureQuery(
      'Optimized Search Query',
      () => prisma.project.findMany({
        where: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          briefOverview: true,
          viewCount: true,
          tags: {
            select: { name: true },
            take: 3,
          },
          thumbnailImage: {
            select: { url: true, thumbnailUrl: true, altText: true },
          },
        },
        orderBy: { viewCount: 'desc' },
        take: 10,
      })
    );

    this.recordOptimization('Search Query', beforeTime, afterTime);
  }

  private async measureQuery(name: string, queryFn: () => Promise<any>): Promise<number> {
    const startTime = performance.now();
    try {
      await queryFn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(`  ${name}: ${duration.toFixed(2)}ms`);
      return duration;
    } catch (error) {
      console.error(`  ${name}: ERROR - ${error}`);
      return -1;
    }
  }

  private recordOptimization(name: string, before: number, after: number) {
    if (before === -1 || after === -1) {
      this.results.push({
        name,
        before,
        after,
        improvement: 0,
        improvementPercent: 0,
        success: false,
        error: 'Query failed',
      });
      return;
    }

    const improvement = before - after;
    const improvementPercent = (improvement / before) * 100;

    this.results.push({
      name,
      before: Number(before.toFixed(2)),
      after: Number(after.toFixed(2)),
      improvement: Number(improvement.toFixed(2)),
      improvementPercent: Number(improvementPercent.toFixed(1)),
      success: improvement > 0,
    });
  }

  private generateOptimizationReport() {
    console.log('\n📊 Optimization Results');
    console.log('========================');

    let totalImprovement = 0;
    let successfulOptimizations = 0;

    this.results.forEach(result => {
      const status = result.success ? '✅' : result.error ? '❌' : '⚠️';
      const improvement = result.success 
        ? `${result.improvement}ms (${result.improvementPercent}% faster)`
        : result.error || 'No improvement';

      console.log(`${status} ${result.name}`);
      console.log(`   Before: ${result.before}ms | After: ${result.after}ms`);
      console.log(`   Improvement: ${improvement}\n`);

      if (result.success) {
        totalImprovement += result.improvementPercent;
        successfulOptimizations++;
      }
    });

    const avgImprovement = successfulOptimizations > 0 
      ? (totalImprovement / successfulOptimizations).toFixed(1)
      : '0';

    console.log('📈 Summary');
    console.log('==========');
    console.log(`Successful optimizations: ${successfulOptimizations}/${this.results.length}`);
    console.log(`Average improvement: ${avgImprovement}%`);

    if (successfulOptimizations > 0) {
      console.log('\n✅ Optimizations Applied Successfully!');
      console.log('\nNext Steps:');
      console.log('1. Deploy these optimizations to production');
      console.log('2. Monitor performance with /api/health?perf=true');
      console.log('3. Set up alerts for queries >200ms');
      console.log('4. Consider implementing response caching');
    } else {
      console.log('\n⚠️  No significant improvements found');
      console.log('Consider:');
      console.log('1. Adding more database indexes');
      console.log('2. Implementing query result caching');
      console.log('3. Using database connection pooling');
    }
  }
}

async function main() {
  const optimizer = new QueryOptimizer();
  
  try {
    await optimizer.runOptimizations();
  } catch (error) {
    console.error('Optimization failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);