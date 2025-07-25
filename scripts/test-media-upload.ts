#!/usr/bin/env tsx
/**
 * Test script for media upload system
 * Tests provider configuration, validation, and basic functionality
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local first (highest priority)
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
// Load .env as fallback
dotenv.config({ path: resolve(process.cwd(), '.env') });

import { 
  validateMediaProviderConfig, 
  getCurrentProviderName, 
  getAvailableProviders,
  getProviderRequirements,
  validateFile,
  getValidationForMediaType,
  detectMediaType,
  formatFileSize
} from '../src/lib/media';

async function testMediaConfiguration() {
  console.log('🧪 Testing Media Upload Configuration\n');

  // Test 1: Provider Configuration
  console.log('1. Provider Configuration:');
  
  try {
    const currentProvider = getCurrentProviderName();
    console.log(`   Current Provider: ${currentProvider}`);
    
    const availableProviders = getAvailableProviders();
    console.log(`   Available Providers: ${availableProviders.join(', ')}`);
    
    const validation = validateMediaProviderConfig();
    console.log(`   Configuration Valid: ${validation.valid}`);
    
    if (!validation.valid) {
      console.log(`   Errors: ${validation.errors.join(', ')}`);
      
      // Show requirements for current provider
      const requirements = getProviderRequirements(currentProvider);
      console.log(`   Required Variables: ${requirements.required.join(', ')}`);
      console.log(`   Optional Variables: ${requirements.optional.join(', ')}`);
    }
  } catch (error) {
    console.log(`   ❌ Configuration Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log();

  // Test 2: File Validation
  console.log('2. File Validation Tests:');

  // Mock file objects for testing
  const testFiles = [
    { name: 'test.jpg', type: 'image/jpeg', size: 1024 * 1024 }, // 1MB image
    { name: 'large-video.mp4', type: 'video/mp4', size: 150 * 1024 * 1024 }, // 150MB video (too large)
    { name: 'document.pdf', type: 'application/pdf', size: 500 * 1024 }, // 500KB PDF
    { name: 'script.js', type: 'text/javascript', size: 1024 }, // Dangerous file
  ];

  testFiles.forEach((fileData, index) => {
    const file = new File([''], fileData.name, { type: fileData.type });
    Object.defineProperty(file, 'size', { value: fileData.size });

    const mediaType = detectMediaType(file);
    const validation = getValidationForMediaType(mediaType);
    const result = validateFile(file, validation);

    console.log(`   File ${index + 1}: ${fileData.name} (${formatFileSize(fileData.size)})`);
    console.log(`     Media Type: ${mediaType}`);
    console.log(`     Valid: ${result.valid ? '✅' : '❌'}`);
    
    if (!result.valid && result.error) {
      console.log(`     Error: ${result.error}`);
    }
    
    if (result.warnings) {
      console.log(`     Warnings: ${result.warnings.join(', ')}`);
    }
    
    console.log();
  });

  // Test 3: Provider Requirements
  console.log('3. Provider Requirements:');
  
  const providers = getAvailableProviders();
  providers.forEach(provider => {
    const requirements = getProviderRequirements(provider);
    console.log(`   ${provider.toUpperCase()}:`);
    console.log(`     Required: ${requirements.required.join(', ')}`);
    console.log(`     Optional: ${requirements.optional.join(', ')}`);
  });

  console.log();

  // Test 4: Environment Check
  console.log('4. Environment Variables Check:');
  
  const envVars = [
    'MEDIA_PROVIDER',
    // Cloudinary
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY', 
    'CLOUDINARY_API_SECRET',
    'CLOUDINARY_FOLDER',
    // AWS S3
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_S3_BUCKET',
    'AWS_CLOUDFRONT_URL',
    // Vercel Blob
    'BLOB_READ_WRITE_TOKEN',
    // Supabase Storage
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_STORAGE_BUCKET',
    // GitHub + jsDelivr
    'GITHUB_TOKEN',
    'GITHUB_OWNER',
    'GITHUB_REPO',
    'GITHUB_BRANCH'
  ];

  envVars.forEach(varName => {
    const value = process.env[varName];
    const status = value ? '✅ Set' : '⬜ Not Set';
    const displayValue = value ? (value.length > 20 ? value.substring(0, 20) + '...' : value) : '';
    console.log(`   ${varName}: ${status} ${displayValue}`);
  });

  console.log('\n🎉 Media Upload System Test Complete!');
  console.log('\nNext Steps:');
  console.log('1. Set up your preferred media provider credentials');
  console.log('2. Test actual file upload via API endpoint');
  console.log('3. Implement admin UI for file uploads');
}

// Run the test
testMediaConfiguration().catch(console.error); 