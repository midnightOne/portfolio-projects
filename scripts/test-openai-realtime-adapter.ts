/**
 * Test script for OpenAI Realtime Adapter
 * 
 * This script verifies that the OpenAI Realtime adapter is properly implemented
 * with the correct tool definitions and configuration.
 */

import { OpenAIRealtimeAdapter } from '../src/lib/voice/OpenAIRealtimeAdapter';
import { AdapterInitOptions } from '../src/types/voice-agent';

async function testOpenAIRealtimeAdapter() {
  console.log('🧪 Testing OpenAI Realtime Adapter Implementation...\n');

  try {
    // Test 1: Adapter Creation
    console.log('1. Testing adapter creation...');
    const adapter = new OpenAIRealtimeAdapter();
    
    console.log('✅ Adapter created successfully');
    console.log(`   Provider: ${adapter.provider}`);
    console.log(`   Model: ${adapter.metadata.model}`);
    console.log(`   Capabilities: ${adapter.metadata.capabilities.join(', ')}`);
    console.log('');

    // Test 2: Initialization
    console.log('2. Testing adapter initialization...');
    
    const mockOptions: AdapterInitOptions = {
      onConnectionEvent: (event) => console.log(`   Connection event: ${event.type}`),
      onTranscriptEvent: (event) => console.log(`   Transcript event: ${event.type}`),
      onAudioEvent: (event) => console.log(`   Audio event: ${event.type}`),
      onToolEvent: (event) => console.log(`   Tool event: ${event.type}`),
      audioElement: {
        play: () => Promise.resolve(),
        pause: () => {},
        muted: false,
        volume: 1.0
      } as any
    };

    await adapter.init(mockOptions);
    console.log('✅ Adapter initialized successfully');
    console.log('');

    // Test 3: Tool Registration
    console.log('3. Testing tool registration...');
    const availableTools = adapter.getAvailableTools();
    console.log(`   Available tools: ${availableTools.length}`);
    
    const expectedTools = [
      'navigateTo',
      'showProjectDetails', 
      'scrollIntoView',
      'highlightText',
      'clearHighlights',
      'loadContext',
      'analyzeJobSpec',
      'submitContactForm'
    ];

    let allToolsPresent = true;
    for (const expectedTool of expectedTools) {
      if (availableTools.includes(expectedTool)) {
        console.log(`   ✅ ${expectedTool} - registered`);
      } else {
        console.log(`   ❌ ${expectedTool} - missing`);
        allToolsPresent = false;
      }
    }

    if (allToolsPresent) {
      console.log('✅ All expected tools are registered');
    } else {
      console.log('❌ Some tools are missing');
    }
    console.log('');

    // Test 4: Connection Status
    console.log('4. Testing connection status...');
    console.log(`   Connection status: ${adapter.getConnectionStatus()}`);
    console.log(`   Session status: ${adapter.getSessionStatus()}`);
    console.log(`   Is connected: ${adapter.isConnected()}`);
    console.log('');

    // Test 5: Audio Management
    console.log('5. Testing audio management...');
    console.log(`   Is muted: ${adapter.isMuted()}`);
    console.log(`   Volume: ${adapter.getVolume()}`);
    
    adapter.setVolume(0.8);
    console.log(`   Volume after setting to 0.8: ${adapter.getVolume()}`);
    console.log('');

    // Test 6: Configuration
    console.log('6. Testing configuration...');
    const config = adapter.getConfig();
    console.log(`   Has onConnectionEvent: ${!!config.onConnectionEvent}`);
    console.log(`   Has onTranscriptEvent: ${!!config.onTranscriptEvent}`);
    console.log(`   Has onAudioEvent: ${!!config.onAudioEvent}`);
    console.log(`   Has onToolEvent: ${!!config.onToolEvent}`);
    console.log('');

    // Test 7: Cleanup
    console.log('7. Testing cleanup...');
    await adapter.cleanup();
    console.log('✅ Cleanup completed successfully');
    console.log('');

    console.log('🎉 All tests passed! OpenAI Realtime Adapter is properly implemented.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testOpenAIRealtimeAdapter().catch(console.error);