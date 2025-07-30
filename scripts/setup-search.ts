/**
 * Setup full-text search functionality
 * Runs the search vector migration and updates existing data
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function setupSearch() {
  try {
    console.log('🔍 Setting up full-text search...');
    
    // Execute each command separately to avoid prepared statement issues
    
    // 1. Add search vector column
    console.log('📝 Adding search_vector column...');
    await prisma.$executeRaw`
      DO $$ 
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'projects' AND column_name = 'search_vector'
          ) THEN
              ALTER TABLE projects ADD COLUMN search_vector tsvector;
          END IF;
      END $$;
    `;
    
    // 2. Create search vector update function
    console.log('🔧 Creating search vector update function...');
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION update_projects_search_vector()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.search_vector := 
          setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW."briefOverview", '')), 'C');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    // 3. Create trigger
    console.log('⚡ Creating search vector trigger...');
    await prisma.$executeRaw`DROP TRIGGER IF EXISTS projects_search_vector_update ON projects`;
    await prisma.$executeRaw`
      CREATE TRIGGER projects_search_vector_update
        BEFORE INSERT OR UPDATE ON projects
        FOR EACH ROW EXECUTE FUNCTION update_projects_search_vector()
    `;
    
    // 4. Create search index
    console.log('📊 Creating search index...');
    await prisma.$executeRaw`DROP INDEX IF EXISTS projects_search_vector_idx`;
    await prisma.$executeRaw`CREATE INDEX projects_search_vector_idx ON projects USING GIN(search_vector)`;
    
    // 5. Update existing records
    console.log('🔄 Updating existing records...');
    await prisma.$executeRaw`
      UPDATE projects SET search_vector = 
        setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE("briefOverview", '')), 'C')
      WHERE search_vector IS NULL
    `;
    
    // 6. Create additional indexes for fallback search
    console.log('📈 Creating fallback search indexes...');
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS projects_title_search_idx ON projects USING GIN(to_tsvector('english', title))`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS projects_description_search_idx ON projects USING GIN(to_tsvector('english', description))`;
    
    console.log('✅ Search vector migration completed');
    
    // Verify the setup by testing a search
    const testResult = await prisma.$queryRaw`
      SELECT id, title, search_vector IS NOT NULL as has_search_vector
      FROM projects 
      WHERE status = 'PUBLISHED' 
      LIMIT 3
    `;
    
    console.log('🧪 Test results:', testResult);
    
    // Test full-text search functionality
    const searchTest = await prisma.$queryRaw`
      SELECT id, title, ts_rank(search_vector, to_tsquery('english', 'project:*')) as rank
      FROM projects 
      WHERE search_vector @@ to_tsquery('english', 'project:*')
      AND status = 'PUBLISHED'
      ORDER BY rank DESC
      LIMIT 3
    `;
    
    console.log('🔍 Search test results:', searchTest);
    console.log('✅ Full-text search setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up search:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  setupSearch().catch(console.error);
}

export { setupSearch };