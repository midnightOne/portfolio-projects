/**
 * Project Indexing Integration Utilities
 * Integrates automatic indexing with existing project operations
 * Used by admin interfaces and project management systems
 */

import { projectIndexer } from '@/lib/services/project-indexer';
import { prisma } from '@/lib/database/connection';

/**
 * Wrapper for project save operations that triggers indexing
 */
export async function saveProjectWithIndexing(
  projectData: any,
  options: {
    skipIndexing?: boolean;
    forceReindex?: boolean;
  } = {}
): Promise<any> {
  const { skipIndexing = false, forceReindex = false } = options;

  try {
    // Save the project (this would be the existing save logic)
    const savedProject = await saveProject(projectData);

    // Trigger indexing if not skipped
    if (!skipIndexing && savedProject && savedProject.id) {
      // Clear cache if force reindex is requested
      if (forceReindex) {
        projectIndexer.clearProjectCache(savedProject.id);
      }

      // Index in background (don't wait for completion)
      indexProjectInBackground(savedProject.id);
    }

    return savedProject;
  } catch (error) {
    console.error('Error saving project with indexing:', error);
    throw error;
  }
}

/**
 * Wrapper for project update operations that triggers indexing
 */
export async function updateProjectWithIndexing(
  projectId: string,
  updateData: any,
  options: {
    skipIndexing?: boolean;
    forceReindex?: boolean;
  } = {}
): Promise<any> {
  const { skipIndexing = false, forceReindex = false } = options;

  try {
    // Update the project (this would be the existing update logic)
    const updatedProject = await updateProject(projectId, updateData);

    // Trigger indexing if not skipped
    if (!skipIndexing) {
      // Clear cache if force reindex is requested
      if (forceReindex) {
        projectIndexer.clearProjectCache(projectId);
      }

      // Index in background (don't wait for completion)
      indexProjectInBackground(projectId);
    }

    return updatedProject;
  } catch (error) {
    console.error('Error updating project with indexing:', error);
    throw error;
  }
}

/**
 * Index project in background without blocking the main operation
 */
async function indexProjectInBackground(projectId: string) {
  // Use setTimeout to ensure this runs after the current operation completes
  setTimeout(async () => {
    try {
      await projectIndexer.indexProject(projectId);
      console.log(`Successfully indexed project ${projectId}`);
    } catch (error) {
      console.error(`Failed to index project ${projectId}:`, error);
    }
  }, 100);
}

/**
 * Batch index all public projects
 */
export async function indexAllPublicProjects(options: {
  forceReindex?: boolean;
  batchSize?: number;
  onProgress?: (completed: number, total: number) => void;
} = {}) {
  const { forceReindex = false, batchSize = 5, onProgress } = options;

  try {
    // Get all public projects
    const projects = await prisma.project.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC'
      },
      select: { id: true, title: true },
      orderBy: { updatedAt: 'desc' }
    });

    if (projects.length === 0) {
      console.log('No public projects found to index');
      return { success: true, indexed: 0, errors: [] };
    }

    console.log(`Starting batch indexing of ${projects.length} projects...`);

    const errors: Array<{ projectId: string; error: string }> = [];
    let completed = 0;

    // Clear cache if force reindex is requested
    if (forceReindex) {
      projectIndexer.clearAllCache();
    }

    // Process in batches
    for (let i = 0; i < projects.length; i += batchSize) {
      const batch = projects.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (project) => {
        try {
          await projectIndexer.indexProject(project.id);
          console.log(`Indexed project: ${project.title}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed to index project ${project.title}:`, errorMessage);
          errors.push({ projectId: project.id, error: errorMessage });
        }
      });

      await Promise.all(batchPromises);
      completed += batch.length;
      
      // Report progress
      onProgress?.(completed, projects.length);
    }

    const result = {
      success: errors.length === 0,
      indexed: completed - errors.length,
      errors
    };

    console.log(`Batch indexing completed. Indexed: ${result.indexed}, Errors: ${errors.length}`);
    return result;

  } catch (error) {
    console.error('Error in batch indexing:', error);
    throw error;
  }
}

/**
 * Check if a project needs reindexing based on update time
 */
export async function checkProjectNeedsReindexing(projectId: string): Promise<boolean> {
  try {
    // Get project update time
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { updatedAt: true }
    });

    if (!project) return false;

    // Check if we have cached index
    const cacheStats = projectIndexer.getCacheStats();
    if (!cacheStats.projects.includes(projectId)) {
      return true; // Not cached, needs indexing
    }

    // Check database for last index time
    try {
      const indexRecord = await prisma.$queryRaw<Array<{ updated_at: Date }>>`
        SELECT updated_at FROM project_ai_index WHERE project_id = ${projectId}
      `;

      if (indexRecord.length === 0) {
        return true; // No index record, needs indexing
      }

      const lastIndexTime = indexRecord[0].updated_at;
      return project.updatedAt > lastIndexTime;
    } catch (dbError) {
      // If database query fails, assume needs reindexing
      console.warn('Failed to check index timestamp, assuming needs reindexing:', dbError);
      return true;
    }

  } catch (error) {
    console.error('Error checking if project needs reindexing:', error);
    return true; // Err on the side of reindexing
  }
}

/**
 * Get indexing statistics for monitoring
 */
export async function getIndexingStatistics(): Promise<{
  totalProjects: number;
  indexedProjects: number;
  cacheSize: number;
  lastIndexingActivity: Date | null;
}> {
  try {
    const [totalProjects, indexedProjects, lastActivity] = await Promise.all([
      // Total public projects
      prisma.project.count({
        where: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC'
        }
      }),
      
      // Projects with indexes
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM project_ai_index
      `,
      
      // Last indexing activity
      prisma.$queryRaw<Array<{ updated_at: Date }>>`
        SELECT updated_at FROM project_ai_index 
        ORDER BY updated_at DESC 
        LIMIT 1
      `
    ]);

    const cacheStats = projectIndexer.getCacheStats();

    return {
      totalProjects,
      indexedProjects: Number(indexedProjects[0]?.count || 0),
      cacheSize: cacheStats.size,
      lastIndexingActivity: lastActivity[0]?.updated_at || null
    };

  } catch (error) {
    console.error('Error getting indexing statistics:', error);
    return {
      totalProjects: 0,
      indexedProjects: 0,
      cacheSize: 0,
      lastIndexingActivity: null
    };
  }
}

// Placeholder functions for existing project operations
// These would be replaced with actual implementations
async function saveProject(projectData: any): Promise<any> {
  // This would be the existing project save logic
  throw new Error('saveProject function needs to be implemented');
}

async function updateProject(projectId: string, updateData: any): Promise<any> {
  // This would be the existing project update logic
  throw new Error('updateProject function needs to be implemented');
}

/**
 * Middleware function to add indexing to existing API routes
 */
export function withProjectIndexing<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  options: {
    skipIndexing?: boolean;
    forceReindex?: boolean;
    extractProjectId?: (result: any) => string | null;
  } = {}
): T {
  const { skipIndexing = false, forceReindex = false, extractProjectId } = options;

  return (async (...args: Parameters<T>) => {
    const result = await handler(...args);

    if (!skipIndexing) {
      // Try to extract project ID from result
      let projectId: string | null = null;
      
      if (extractProjectId) {
        projectId = extractProjectId(result);
      } else if (result && typeof result === 'object' && result.id) {
        projectId = result.id;
      }

      if (projectId) {
        if (forceReindex) {
          projectIndexer.clearProjectCache(projectId);
        }
        indexProjectInBackground(projectId);
      }
    }

    return result;
  }) as T;
}