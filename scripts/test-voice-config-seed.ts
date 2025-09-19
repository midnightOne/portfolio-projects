/**
 * Test script to verify voice configurations are properly seeded
 */

import { PrismaClient } from '@prisma/client';
import { getSerializerForProvider } from '../src/lib/voice/config-serializers';

const prisma = new PrismaClient();

async function testVoiceConfigs() {
  console.log('🧪 Testing voice configuration seeding...');

  try {
    // Check if voice configs exist in database
    const voiceConfigs = await prisma.voiceProviderConfig.findMany({
      orderBy: [{ provider: 'asc' }, { name: 'asc' }]
    });

    console.log(`Found ${voiceConfigs.length} voice configurations:`);
    
    for (const config of voiceConfigs) {
      console.log(`  - ${config.provider}/${config.name} (default: ${config.isDefault})`);
      
      try {
        // Test deserialization
        const serializer = getSerializerForProvider(config.provider as 'openai' | 'elevenlabs');
        const deserializedConfig = serializer.deserialize(config.configJson);
        
        console.log(`    ✅ Successfully deserialized ${config.provider}/${config.name}`);
        console.log(`    📝 Display Name: ${deserializedConfig.displayName}`);
        console.log(`    📄 Description: ${deserializedConfig.description}`);
        
        if (config.provider === 'openai') {
          console.log(`    🎤 Voice: ${(deserializedConfig as any).voice}`);
          console.log(`    🤖 Model: ${(deserializedConfig as any).model}`);
        }
        
      } catch (error) {
        console.log(`    ❌ Failed to deserialize ${config.provider}/${config.name}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Test getting default configs
    console.log('\n🔧 Testing default configuration retrieval...');
    
    const defaultOpenAI = await prisma.voiceProviderConfig.findFirst({
      where: { provider: 'openai', isDefault: true }
    });
    
    if (defaultOpenAI) {
      console.log(`✅ Found default OpenAI config: ${defaultOpenAI.name}`);
    } else {
      console.log('❌ No default OpenAI config found');
    }

    const defaultElevenLabs = await prisma.voiceProviderConfig.findFirst({
      where: { provider: 'elevenlabs', isDefault: true }
    });
    
    if (defaultElevenLabs) {
      console.log(`✅ Found default ElevenLabs config: ${defaultElevenLabs.name}`);
    } else {
      console.log('❌ No default ElevenLabs config found');
    }

    console.log('\n🎯 Voice configuration test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing voice configurations:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testVoiceConfigs();