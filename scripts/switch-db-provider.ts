/**
 * Script to switch between database providers
 * Usage: npx tsx scripts/switch-db-provider.ts [provider]
 */

import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const providers = {
  local: {
    DATABASE_PROVIDER: 'local',
    DATABASE_URL: 'postgresql://username:password@localhost:5432/portfolio_projects',
    DIRECT_URL: '',
  },
  supabase: {
    DATABASE_PROVIDER: 'supabase',
    DATABASE_URL: 'postgresql://postgres.owzszkcriblcswsnozwz:JrldO0bgkH3oTdaV@aws-0-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    DIRECT_URL: 'postgresql://postgres.owzszkcriblcswsnozwz:JrldO0bgkH3oTdaV@aws-0-us-east-2.pooler.supabase.com:5432/postgres',
  },
};

function switchProvider(provider: keyof typeof providers) {
  const envPath = join(process.cwd(), '.env.local');
  
  try {
    let envContent = readFileSync(envPath, 'utf-8');
    const config = providers[provider];
    
    // Update provider-specific variables
    Object.entries(config).forEach(([key, value]) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (envContent.match(regex)) {
        envContent = envContent.replace(regex, `${key}="${value}"`);
      } else {
        // Add if doesn't exist
        envContent += `\n${key}="${value}"`;
      }
    });
    
    writeFileSync(envPath, envContent);
    
    console.log(`✅ Switched to ${provider} database provider`);
    console.log(`📋 Configuration:`);
    console.log(`   Provider: ${config.DATABASE_PROVIDER}`);
    console.log(`   URL: ${config.DATABASE_URL.replace(/:[^:@]*@/, ':***@')}`);
    
    if (provider === 'local') {
      console.log('\n⚠️  Note: Make sure you have a local PostgreSQL server running');
      console.log('   You can start one with: docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres');
    }
    
    console.log('\n🧪 Test the connection with: npm run db:test');
    
  } catch (error) {
    console.error('❌ Failed to switch provider:', error);
    process.exit(1);
  }
}

// Get provider from command line argument
const provider = process.argv[2] as keyof typeof providers;

if (!provider || !providers[provider]) {
  console.log('Usage: npx tsx scripts/switch-db-provider.ts [provider]');
  console.log('Available providers:', Object.keys(providers).join(', '));
  process.exit(1);
}

switchProvider(provider);