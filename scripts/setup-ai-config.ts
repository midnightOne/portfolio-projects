/**
 * Setup script to initialize AI configuration
 */

import { initializeAIConfiguration, validateAIConfiguration } from '../src/lib/ai/database-setup';

async function main() {
  console.log('Setting up AI configuration...');
  
  try {
    // Initialize the configuration
    await initializeAIConfiguration();
    
    // Validate the setup
    const isValid = await validateAIConfiguration();
    
    if (isValid) {
      console.log('✅ AI configuration setup completed successfully');
    } else {
      console.error('❌ AI configuration validation failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to setup AI configuration:', error);
    process.exit(1);
  }
}

main();