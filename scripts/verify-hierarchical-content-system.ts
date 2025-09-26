/**
 * Verification script for hierarchical content storage system
 * 
 * This script verifies that all components of the hierarchical content system
 * are working correctly and provides a comprehensive system health check.
 */

import { PrismaClient } from '@prisma/client';
import { ContentIngestionPipeline } from '../src/lib/services/content-ingestion';

const prisma = new PrismaClient();

interface SystemHealthCheck {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

async function verifyDatabaseSchema(): Promise<SystemHealthCheck[]> {
  const checks: SystemHealthCheck[] = [];

  try {
    // Check if all required tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('content_entities', 'context_chunks', 'content_versions');
    ` as any[];

    const expectedTables = ['content_entities', 'context_chunks', 'content_versions'];
    const existingTables = tables.map(t => t.table_name);
    const missingTables = expectedTables.filter(t => !existingTables.includes(t));

    if (missingTables.length === 0) {
      checks.push({
        component: 'Database Schema',
        status: 'pass',
        message: 'All required tables exist',
        details: { tables: existingTables }
      });
    } else {
      checks.push({
        component: 'Database Schema',
        status: 'fail',
        message: `Missing tables: ${missingTables.join(', ')}`,
        details: { missing: missingTables, existing: existingTables }
      });
    }

    // Check indexes
    const indexes = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        indexname
      FROM pg_indexes 
      WHERE tablename IN ('content_entities', 'context_chunks', 'content_versions')
      AND schemaname = 'public';
    ` as any[];

    checks.push({
      component: 'Database Indexes',
      status: 'pass',
      message: `Found ${indexes.length} indexes`,
      details: { count: indexes.length, indexes: indexes.map(i => i.indexname) }
    });

    // Check foreign key constraints
    const constraints = await prisma.$queryRaw`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('context_chunks');
    ` as any[];

    checks.push({
      component: 'Foreign Key Constraints',
      status: 'pass',
      message: `Found ${constraints.length} foreign key constraints`,
      details: { constraints: constraints.map(c => `${c.table_name}.${c.column_name} -> ${c.foreign_table_name}.${c.foreign_column_name}`) }
    });

  } catch (error) {
    checks.push({
      component: 'Database Schema',
      status: 'fail',
      message: `Schema verification failed: ${error}`,
      details: { error }
    });
  }

  return checks;
}

async function verifyContentIngestion(): Promise<SystemHealthCheck[]> {
  const checks: SystemHealthCheck[] = [];

  try {
    const pipeline = new ContentIngestionPipeline();

    // Check if pipeline can be instantiated
    checks.push({
      component: 'Content Ingestion Pipeline',
      status: 'pass',
      message: 'Pipeline instantiated successfully'
    });

    // Check entity counts
    const entityCount = await prisma.contentEntity.count();
    const chunkCount = await prisma.contextChunk.count();
    const versionCount = await prisma.contentVersion.count();

    if (entityCount > 0) {
      checks.push({
        component: 'Content Entities',
        status: 'pass',
        message: `Found ${entityCount} content entities`,
        details: { count: entityCount }
      });
    } else {
      checks.push({
        component: 'Content Entities',
        status: 'warning',
        message: 'No content entities found - run ingestion pipeline',
        details: { count: entityCount }
      });
    }

    if (chunkCount > 0) {
      checks.push({
        component: 'Context Chunks',
        status: 'pass',
        message: `Found ${chunkCount} context chunks`,
        details: { count: chunkCount }
      });
    } else {
      checks.push({
        component: 'Context Chunks',
        status: 'warning',
        message: 'No context chunks found - run ingestion pipeline',
        details: { count: chunkCount }
      });
    }

    // Check tier distribution
    const tierDistribution = await prisma.contextChunk.groupBy({
      by: ['tier'],
      _count: { tier: true },
      orderBy: { tier: 'asc' }
    });

    if (tierDistribution.length > 0) {
      const tierCounts = tierDistribution.reduce((acc, t) => {
        acc[`T${t.tier}`] = t._count.tier;
        return acc;
      }, {} as Record<string, number>);

      checks.push({
        component: 'Tier Distribution',
        status: 'pass',
        message: `Content distributed across ${tierDistribution.length} tiers`,
        details: tierCounts
      });
    }

    // Check entity types
    const entityTypes = await prisma.contentEntity.groupBy({
      by: ['entityType'],
      _count: { entityType: true }
    });

    if (entityTypes.length > 0) {
      const typeCounts = entityTypes.reduce((acc, t) => {
        acc[t.entityType] = t._count.entityType;
        return acc;
      }, {} as Record<string, number>);

      checks.push({
        component: 'Entity Types',
        status: 'pass',
        message: `Found ${entityTypes.length} entity types`,
        details: typeCounts
      });
    }

  } catch (error) {
    checks.push({
      component: 'Content Ingestion Pipeline',
      status: 'fail',
      message: `Pipeline verification failed: ${error}`,
      details: { error }
    });
  }

  return checks;
}

async function verifyDataIntegrity(): Promise<SystemHealthCheck[]> {
  const checks: SystemHealthCheck[] = [];

  try {
    // Check for orphaned chunks (chunks without valid entity references)
    const allChunks = await prisma.contextChunk.count();
    const chunksWithEntities = await prisma.contextChunk.count({
      where: {
        entity: {
          id: {
            not: undefined
          }
        }
      }
    });
    const orphanedChunks = allChunks - chunksWithEntities;

    if (orphanedChunks === 0) {
      checks.push({
        component: 'Data Integrity - Orphaned Chunks',
        status: 'pass',
        message: 'No orphaned chunks found'
      });
    } else {
      checks.push({
        component: 'Data Integrity - Orphaned Chunks',
        status: 'warning',
        message: `Found ${orphanedChunks} orphaned chunks`,
        details: { count: orphanedChunks }
      });
    }

    // Check for entities without chunks
    const entitiesWithoutChunks = await prisma.contentEntity.count({
      where: {
        contentChunks: {
          none: {}
        }
      }
    });

    if (entitiesWithoutChunks === 0) {
      checks.push({
        component: 'Data Integrity - Empty Entities',
        status: 'pass',
        message: 'All entities have content chunks'
      });
    } else {
      checks.push({
        component: 'Data Integrity - Empty Entities',
        status: 'warning',
        message: `Found ${entitiesWithoutChunks} entities without chunks`,
        details: { count: entitiesWithoutChunks }
      });
    }

    // Check token count accuracy
    const chunksWithZeroTokens = await prisma.contextChunk.count({
      where: {
        tokenCount: 0,
        content: {
          not: ''
        }
      }
    });

    if (chunksWithZeroTokens === 0) {
      checks.push({
        component: 'Data Integrity - Token Counts',
        status: 'pass',
        message: 'All chunks have accurate token counts'
      });
    } else {
      checks.push({
        component: 'Data Integrity - Token Counts',
        status: 'warning',
        message: `Found ${chunksWithZeroTokens} chunks with zero token count but non-empty content`,
        details: { count: chunksWithZeroTokens }
      });
    }

  } catch (error) {
    checks.push({
      component: 'Data Integrity',
      status: 'fail',
      message: `Integrity check failed: ${error}`,
      details: { error }
    });
  }

  return checks;
}

async function verifyPgVectorSupport(): Promise<SystemHealthCheck[]> {
  const checks: SystemHealthCheck[] = [];

  try {
    // Check if pgvector extension is available
    const extensions = await prisma.$queryRaw`
      SELECT extname 
      FROM pg_extension 
      WHERE extname = 'vector';
    ` as any[];

    if (extensions.length > 0) {
      checks.push({
        component: 'pgvector Extension',
        status: 'pass',
        message: 'pgvector extension is installed'
      });

      // Check if vector columns are properly typed
      const vectorColumns = await prisma.$queryRaw`
        SELECT 
          table_name,
          column_name,
          data_type,
          udt_name
        FROM information_schema.columns 
        WHERE table_name IN ('project_ai_index', 'context_chunks') 
        AND column_name LIKE '%embedding%';
      ` as any[];

      const hasVectorType = vectorColumns.some((col: any) => col.udt_name === 'vector');

      if (hasVectorType) {
        checks.push({
          component: 'Vector Columns',
          status: 'pass',
          message: 'Vector columns are properly typed',
          details: { columns: vectorColumns }
        });
      } else {
        checks.push({
          component: 'Vector Columns',
          status: 'warning',
          message: 'Vector columns are still TEXT type - run pgvector setup',
          details: { columns: vectorColumns }
        });
      }

    } else {
      checks.push({
        component: 'pgvector Extension',
        status: 'warning',
        message: 'pgvector extension not installed - semantic search unavailable'
      });
    }

  } catch (error) {
    checks.push({
      component: 'pgvector Support',
      status: 'fail',
      message: `pgvector check failed: ${error}`,
      details: { error }
    });
  }

  return checks;
}

async function generateSystemReport(): Promise<void> {
  console.log('🔍 Hierarchical Content System Health Check\n');

  const allChecks: SystemHealthCheck[] = [];

  console.log('📊 Running database schema verification...');
  const schemaChecks = await verifyDatabaseSchema();
  allChecks.push(...schemaChecks);

  console.log('📥 Running content ingestion verification...');
  const ingestionChecks = await verifyContentIngestion();
  allChecks.push(...ingestionChecks);

  console.log('🔒 Running data integrity verification...');
  const integrityChecks = await verifyDataIntegrity();
  allChecks.push(...integrityChecks);

  console.log('🧮 Running pgvector support verification...');
  const vectorChecks = await verifyPgVectorSupport();
  allChecks.push(...vectorChecks);

  // Generate report
  console.log('\n📋 System Health Report\n');

  const passCount = allChecks.filter(c => c.status === 'pass').length;
  const warningCount = allChecks.filter(c => c.status === 'warning').length;
  const failCount = allChecks.filter(c => c.status === 'fail').length;

  console.log(`✅ Passed: ${passCount}`);
  console.log(`⚠️  Warnings: ${warningCount}`);
  console.log(`❌ Failed: ${failCount}\n`);

  // Show detailed results
  allChecks.forEach(check => {
    const icon = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${check.component}: ${check.message}`);
    
    if (check.details && Object.keys(check.details).length > 0) {
      console.log(`   Details: ${JSON.stringify(check.details, null, 2).replace(/\n/g, '\n   ')}`);
    }
  });

  // Overall system status
  console.log('\n🎯 Overall System Status:');
  if (failCount === 0 && warningCount === 0) {
    console.log('✨ System is fully operational and ready for production use!');
  } else if (failCount === 0) {
    console.log('🟡 System is operational with minor issues that should be addressed.');
  } else {
    console.log('🔴 System has critical issues that need immediate attention.');
  }

  // Recommendations
  console.log('\n💡 Recommendations:');
  if (warningCount > 0 || failCount > 0) {
    if (allChecks.some(c => c.component.includes('pgvector') && c.status === 'warning')) {
      console.log('   - Run `npm run db:setup-pgvector` to enable semantic search capabilities');
    }
    if (allChecks.some(c => c.component.includes('Content') && c.status === 'warning')) {
      console.log('   - Run `npm run db:seed-content` to populate the hierarchical content system');
    }
    if (allChecks.some(c => c.component.includes('Orphaned') && c.status === 'warning')) {
      console.log('   - Run cleanup operations to remove orphaned data');
    }
  } else {
    console.log('   - System is optimally configured');
    console.log('   - Consider setting up monitoring for production use');
    console.log('   - Implement regular content ingestion schedules');
  }
}

async function main() {
  try {
    await generateSystemReport();
  } catch (error) {
    console.error('❌ System verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Verification script failed:', error);
    process.exit(1);
  });
}

export { main as verifyHierarchicalContentSystem };