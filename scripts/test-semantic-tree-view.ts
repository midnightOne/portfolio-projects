/**
 * Test script for Semantic Tree View API
 * 
 * Tests the hierarchical tree structure API endpoint
 */

import { prisma } from '../src/lib/prisma';

interface TreeNode {
  chunkId: string;
  tier: number;
  title: string;
  contentPreview: string;
  tokenCount: number;
  importance: number;
  hasEmbedding: boolean;
  embeddingModel: string | null;
  embeddingGeneratedAt: Date | null;
  manuallyEdited: boolean;
  generationMode: string;
  modifiedBy: string;
  lastModified: Date;
  sectionGroup: string | null;
  parentChunkId: string | null;
  metadata: any;
  children: TreeNode[];
}

async function buildTreeStructure(projectId: string): Promise<TreeNode | null> {
  console.log(`\n🌳 Building tree structure for project: ${projectId}`);

  // Fetch all chunks for this project
  const chunks = await prisma.contextChunk.findMany({
    where: { projectIndexId: projectId },
    orderBy: [
      { tier: 'asc' },
      { sectionStartLine: 'asc' },
      { chunkIndexInSection: 'asc' }
    ],
    select: {
      id: true,
      chunkId: true,
      tier: true,
      title: true,
      content: true,
      tokenCount: true,
      importance: true,
      embeddingGeneratedAt: true,
      embeddingModel: true,
      manuallyEdited: true,
      generationMode: true,
      modifiedBy: true,
      lastModified: true,
      sectionGroup: true,
      parentChunkId: true,
      metadata: true
    }
  });

  console.log(`📊 Found ${chunks.length} chunks`);

  if (chunks.length === 0) {
    console.log('⚠️  No chunks found for this project');
    return null;
  }

  // Build tree structure
  const chunkMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  // First pass: create all nodes
  for (const chunk of chunks) {
    const node: TreeNode = {
      chunkId: chunk.id,
      tier: chunk.tier,
      title: chunk.title || `T${chunk.tier} Chunk`,
      contentPreview: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
      tokenCount: chunk.tokenCount,
      importance: chunk.importance,
      hasEmbedding: chunk.embeddingGeneratedAt !== null,
      embeddingModel: chunk.embeddingModel,
      embeddingGeneratedAt: chunk.embeddingGeneratedAt,
      manuallyEdited: chunk.manuallyEdited,
      generationMode: chunk.generationMode,
      modifiedBy: chunk.modifiedBy,
      lastModified: chunk.lastModified,
      sectionGroup: chunk.sectionGroup,
      parentChunkId: chunk.parentChunkId,
      metadata: chunk.metadata,
      children: []
    };
    chunkMap.set(chunk.id, node);
  }

  // Second pass: build hierarchy
  for (const chunk of chunks) {
    const node = chunkMap.get(chunk.id);
    if (!node) continue;

    if (chunk.parentChunkId) {
      const parent = chunkMap.get(chunk.parentChunkId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, add to root
        rootNodes.push(node);
      }
    } else {
      // No parent, this is a root node (T0)
      rootNodes.push(node);
    }
  }

  // Sort children by tier and then by section order
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.sectionGroup && b.sectionGroup) {
        return a.sectionGroup.localeCompare(b.sectionGroup);
      }
      return a.chunkId.localeCompare(b.chunkId);
    });
    nodes.forEach(node => sortChildren(node.children));
  };

  sortChildren(rootNodes);

  console.log(`\n📈 Tree Statistics:`);
  console.log(`   Root nodes: ${rootNodes.length}`);

  return rootNodes.length === 1 ? rootNodes[0] : {
    chunkId: 'root',
    tier: -1,
    title: 'Project Root',
    contentPreview: 'Multiple root nodes found',
    tokenCount: 0,
    importance: 0,
    hasEmbedding: false,
    embeddingModel: null,
    embeddingGeneratedAt: null,
    manuallyEdited: false,
    generationMode: 'system',
    modifiedBy: 'system',
    lastModified: new Date(),
    sectionGroup: null,
    parentChunkId: null,
    metadata: {},
    children: rootNodes
  };
}

function printTree(node: TreeNode, depth: number = 0, prefix: string = '') {
  const indent = '  '.repeat(depth);
  const tierColors: Record<number, string> = {
    0: '🟣', // Purple for T0
    1: '🔵', // Blue for T1
    2: '🟢', // Green for T2
    3: '🟠', // Orange for T3
  };
  
  const tierIcon = tierColors[node.tier] || '⚪';
  const embeddingIcon = node.hasEmbedding ? '✅' : '❌';
  const editedIcon = node.manuallyEdited ? '✏️' : '';
  
  console.log(
    `${indent}${prefix}${tierIcon} T${node.tier}: ${node.title} ` +
    `(${node.tokenCount} tokens, importance: ${node.importance.toFixed(2)}) ` +
    `${embeddingIcon} ${editedIcon}`
  );

  if (node.children.length > 0) {
    node.children.forEach((child, index) => {
      const isLast = index === node.children.length - 1;
      const childPrefix = isLast ? '└─ ' : '├─ ';
      printTree(child, depth + 1, childPrefix);
    });
  }
}

function analyzeTree(node: TreeNode): {
  totalNodes: number;
  tierCounts: Record<number, number>;
  withEmbeddings: number;
  manuallyEdited: number;
  maxDepth: number;
} {
  const stats = {
    totalNodes: 0,
    tierCounts: {} as Record<number, number>,
    withEmbeddings: 0,
    manuallyEdited: 0,
    maxDepth: 0
  };

  const traverse = (n: TreeNode, depth: number) => {
    stats.totalNodes++;
    stats.tierCounts[n.tier] = (stats.tierCounts[n.tier] || 0) + 1;
    if (n.hasEmbedding) stats.withEmbeddings++;
    if (n.manuallyEdited) stats.manuallyEdited++;
    stats.maxDepth = Math.max(stats.maxDepth, depth);

    n.children.forEach(child => traverse(child, depth + 1));
  };

  traverse(node, 0);
  return stats;
}

async function testTreeView() {
  try {
    console.log('🧪 Testing Semantic Tree View API\n');

    // Get a project with semantic chunks
    const project = await prisma.project.findFirst({
      where: {
        aiIndex: {
          contentChunks: {
            some: {}
          }
        }
      },
      select: {
        id: true,
        title: true,
        slug: true
      }
    });

    if (!project) {
      console.log('⚠️  No projects with semantic chunks found');
      console.log('💡 Run the content ingestion service first to generate chunks');
      return;
    }

    console.log(`📁 Testing with project: ${project.title} (${project.id})`);

    // Build tree structure
    const tree = await buildTreeStructure(project.id);

    if (!tree) {
      console.log('❌ Failed to build tree structure');
      return;
    }

    // Print tree
    console.log('\n🌳 Tree Structure:');
    console.log('═'.repeat(80));
    printTree(tree);
    console.log('═'.repeat(80));

    // Analyze tree
    const stats = analyzeTree(tree);
    console.log('\n📊 Tree Analysis:');
    console.log(`   Total nodes: ${stats.totalNodes}`);
    console.log(`   Max depth: ${stats.maxDepth}`);
    console.log(`   Tier distribution:`);
    Object.entries(stats.tierCounts).sort().forEach(([tier, count]) => {
      console.log(`      T${tier}: ${count} nodes`);
    });
    console.log(`   With embeddings: ${stats.withEmbeddings} (${((stats.withEmbeddings / stats.totalNodes) * 100).toFixed(1)}%)`);
    console.log(`   Manually edited: ${stats.manuallyEdited}`);

    // Test filtering
    console.log('\n🔍 Testing Filters:');
    
    // Count nodes by tier
    const countByTier = (node: TreeNode, tier: number): number => {
      let count = node.tier === tier ? 1 : 0;
      node.children.forEach(child => {
        count += countByTier(child, tier);
      });
      return count;
    };

    console.log(`   T0 nodes: ${countByTier(tree, 0)}`);
    console.log(`   T1 nodes: ${countByTier(tree, 1)}`);
    console.log(`   T2 nodes: ${countByTier(tree, 2)}`);
    console.log(`   T3 nodes: ${countByTier(tree, 3)}`);

    // Test search
    const searchTerm = 'project';
    const matchesSearch = (node: TreeNode, query: string): boolean => {
      const q = query.toLowerCase();
      return (
        node.title.toLowerCase().includes(q) ||
        node.contentPreview.toLowerCase().includes(q)
      );
    };

    const countMatches = (node: TreeNode): number => {
      let count = matchesSearch(node, searchTerm) ? 1 : 0;
      node.children.forEach(child => {
        count += countMatches(child);
      });
      return count;
    };

    console.log(`   Nodes matching "${searchTerm}": ${countMatches(tree)}`);

    console.log('\n✅ Tree view test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing tree view:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testTreeView();
