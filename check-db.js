/**
 * Check database connection and tables
 */

const { PrismaClient } = require('./src/generated/prisma');

async function checkDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking database connection...');
    
    // Test basic connection
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✓ Database connection successful');
    
    // Check if tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    console.log('\nExisting tables:');
    if (tables.length === 0) {
      console.log('No tables found in the database');
    } else {
      tables.forEach(table => {
        console.log(`- ${table.table_name}`);
      });
    }
    
    // Try to create tables if they don't exist
    if (tables.length === 0) {
      console.log('\nAttempting to create tables...');
      
      // Force migration
      const { execSync } = require('child_process');
      try {
        execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
        console.log('✓ Database reset and migrated successfully');
      } catch (error) {
        console.error('Migration failed:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();