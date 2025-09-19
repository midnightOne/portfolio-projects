# Voice AI System

This directory contains the client-side voice AI system components for the portfolio website, including configuration management, provider adapters, and serializers.

## Components

### ClientAIModelManager

The `ClientAIModelManager` is the central configuration management system for voice AI providers. It provides:

- **Database-backed JSON storage** for flexible provider configurations
- **Provider-specific serializers** for type-safe configuration handling
- **Multiple named configurations** per provider (e.g., "Professional", "Casual", "Technical")
- **Configuration caching** with hot-reload capabilities
- **Default provider selection** and fallback logic
- **Comprehensive validation** with helpful error messages

#### Key Features

- **Flexible Configuration**: Store multiple named configurations per provider with JSON serialization
- **Type Safety**: Provider-specific serializers ensure type-safe configuration management
- **Performance**: Built-in caching with configurable TTL and LRU eviction
- **Hot Reload**: Runtime configuration updates without application restart
- **Validation**: Comprehensive validation with provider-specific error messages
- **Singleton Pattern**: Application-wide singleton instance for consistent access

#### Usage Example

```typescript
import { getClientAIModelManager } from './ClientAIModelManager';
import { OpenAIRealtimeSerializer } from './config-serializers/OpenAIRealtimeSerializer';

// Get the singleton instance
const manager = getClientAIModelManager();

// Create and save a configuration
const serializer = new OpenAIRealtimeSerializer();
const config = serializer.getDefaultConfig();
config.displayName = 'Professional Assistant';
config.temperature = 0.7;
config.voice = 'marin';

await manager.saveProviderConfig('openai', 'Professional', config, true);

// Retrieve configurations
const defaultConfig = await manager.getProviderConfig('openai');
const specificConfig = await manager.getProviderConfig('openai', 'Professional');
const allConfigs = await manager.getAllProviderConfigs('openai');

// Validate configuration
const validation = manager.validateConfig('openai', config);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

### Configuration Serializers

Provider-specific serializers handle configuration serialization, validation, and schema generation:

#### OpenAIRealtimeSerializer

Handles OpenAI Realtime API configurations with support for:
- Model selection and parameters
- Voice configuration
- Session settings (transport, audio format, turn detection)
- Tool definitions
- Advanced settings (interruption, retries, timeouts)

#### ElevenLabsSerializer

Handles ElevenLabs Conversational AI configurations with support for:
- Agent and voice selection
- Voice synthesis settings
- Conversation configuration
- Context and personalization
- Advanced settings (timeouts, signed URL expiry)

### Database Schema

The system uses a single `VoiceProviderConfig` table for flexible storage:

```sql
CREATE TABLE "voice_provider_configs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "config_json" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "voice_provider_configs_pkey" PRIMARY KEY ("id")
);
```

### Configuration Structure

#### OpenAI Realtime Configuration

```typescript
interface OpenAIRealtimeConfig {
  provider: 'openai';
  enabled: boolean;
  displayName: string;
  description: string;
  version: string;
  
  // Model configuration
  model: 'gpt-realtime' | string;
  temperature: number;
  maxTokens: number;
  voice: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'shimmer' | 'sage' | 'verse' | 'marin' | 'cedar';
  
  // Agent configuration
  name: string;
  instructions: string;
  
  // Session configuration
  sessionConfig: {
    transport: 'websocket' | 'webrtc';
    audioFormat: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
    turnDetection: {
      type: 'server_vad' | 'none';
      threshold?: number;
      prefixPaddingMs?: number;
      silenceDurationMs?: number;
    };
  };
  
  // Tools and advanced settings
  tools: OpenAIToolConfig[];
  advanced: {
    enableInterruption: boolean;
    enableToolCalling: boolean;
    enableTranscriptLogging: boolean;
    maxRetries: number;
    connectionTimeout: number;
    reconnectDelay: number;
  };
}
```

#### ElevenLabs Configuration

```typescript
interface ElevenLabsConfig {
  provider: 'elevenlabs';
  enabled: boolean;
  displayName: string;
  description: string;
  version: string;
  
  // Agent configuration
  agentId: string;
  agentName?: string;
  
  // Voice configuration
  voiceId: string;
  voiceName?: string;
  model: string;
  
  // Voice settings
  voiceSettings: {
    stability: number;
    similarityBoost: number;
    style: number;
    useSpeakerBoost: boolean;
  };
  
  // Conversation configuration
  conversationConfig: {
    language: string;
    maxDuration: number;
    timeoutMs: number;
    enableInterruption: boolean;
  };
  
  // Context and personalization
  context: {
    systemPrompt?: string;
    firstMessage?: string;
    personalizedGreeting?: boolean;
    contextNotes?: string;
  };
  
  // Advanced configuration
  advanced: {
    enableTranscriptLogging: boolean;
    maxRetries: number;
    connectionTimeout: number;
    reconnectDelay: number;
    signedUrlExpiry: number;
  };
}
```

## API Reference

### ClientAIModelManager Methods

#### Configuration Management

- `saveProviderConfig(provider, name, config, isDefault?)` - Save provider configuration
- `getProviderConfig(provider, configName?)` - Get provider configuration by name or default
- `getAllProviderConfigs(provider)` - Get all configurations for a provider
- `deleteProviderConfig(provider, name)` - Delete provider configuration

#### Provider Management

- `getDefaultProvider()` - Get the default provider
- `setDefaultProvider(provider, configName)` - Set default provider configuration
- `getAvailableVoiceModels(provider?)` - Get available voice models

#### Validation and Utilities

- `validateConfig(provider, config)` - Validate configuration
- `reloadConfiguration()` - Hot-reload configuration from database
- `getConfigurationStats()` - Get configuration statistics

#### Lifecycle

- `destroy()` - Cleanup resources and stop auto-reload

### Serializer Methods

Each serializer implements the `VoiceConfigSerializer` interface:

- `serialize(config)` - Serialize configuration to JSON string
- `deserialize(json)` - Deserialize JSON string to typed configuration
- `validate(config)` - Validate configuration with detailed error messages
- `getDefaultConfig()` - Get default configuration for provider
- `getConfigSchema()` - Generate JSON Schema for dynamic admin UI

## Error Handling

The system provides comprehensive error handling with specific error types:

- `ClientAIModelManagerError` - General manager errors
- `ConfigSerializationError` - Serialization/deserialization errors
- `ConfigValidationError` - Configuration validation errors

All errors include detailed context including provider, configuration name, and original error information.

## Testing

The system includes comprehensive test coverage:

```bash
npm test -- src/lib/voice/__tests__/ClientAIModelManager.test.ts
```

Tests cover:
- Configuration CRUD operations
- Validation and error handling
- Caching behavior
- Default provider management
- Singleton pattern
- Database integration

## Examples

See `examples/ClientAIModelManagerExample.ts` for comprehensive usage examples including:
- Basic configuration management
- Multiple named configurations
- Validation examples
- Caching and hot-reload
- Error handling patterns

## Integration

The ClientAIModelManager integrates with:

- **Database**: PostgreSQL via Prisma ORM
- **Voice Adapters**: OpenAIRealtimeAdapter, ElevenLabsAdapter
- **Admin Interface**: Dynamic configuration UI generation
- **Context System**: Provider-specific context injection

## Performance Considerations

- **Caching**: Configurable TTL and LRU eviction for optimal performance
- **Database**: Indexed queries for efficient configuration retrieval
- **Serialization**: Optimized JSON serialization with validation caching
- **Memory**: Bounded cache size with automatic cleanup

## Security

- **Validation**: Comprehensive input validation prevents malicious configurations
- **Sanitization**: Safe JSON serialization/deserialization
- **Access Control**: Database-level access control via Prisma
- **Error Handling**: Secure error messages without sensitive information exposure