#!/usr/bin/env node

/**
 * Post-reset setup script
 * Run this after `npx prisma migrate reset --force` to restore essential configurations
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 Running post-reset setup...');

try {
  // Change to the project directory
  process.chdir(path.join(__dirname, '..'));
  
  console.log('📍 Current directory:', process.cwd());
  
  // Run the homepage config seeding
  console.log('🌱 Seeding homepage configuration...');
  execSync('npm run db:seed-homepage', { stdio: 'inherit' });
  
  // Run the main database seeding if it exists
  try {
    console.log('🌱 Running main database seed...');
    execSync('npm run db:seed', { stdio: 'inherit' });
  } catch (seedError) {
    console.log('ℹ️ Main seed script not available or failed, continuing...');
  }
  
  console.log('✅ Post-reset setup completed successfully!');
  console.log('');
  console.log('🎉 Your database is now ready with:');
  console.log('   - Default homepage configuration');
  console.log('   - Wave background configuration');
  console.log('   - All essential settings');
  console.log('');
  console.log('💡 You can now start the development server with: npm run dev');

} catch (error) {
  console.error('❌ Post-reset setup failed:', error.message);
  console.log('');
  console.log('🔧 Manual recovery steps:');
  console.log('   1. Run: npm run db:seed-homepage');
  console.log('   2. Run: npm run db:seed (if available)');
  console.log('   3. Start dev server: npm run dev');
  process.exit(1);
}