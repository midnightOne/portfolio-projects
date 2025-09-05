# Voice Configuration Serializers

This module provides provider-specific configuration serialization and validation for voice AI systems. Each provider has its own serializer that handles type-safe serialization/deserialization, validation, JSON Schema generation, and default configuration management.

## Features

- **Type-Safe Serialization**: Convert configurations to/from JSON with full type safety
- **Comprehensive Validation**: Validate configurations with helpful error messages
- **JSON Schema Generation**: Generate schemas for dynamic admin UI creation
- **Default Configurations**: Get sensible defaults for each provider
- **Error Handling**: Detailed error reporting with field-specific messages

## Supported Providers

### OpenAI Realtime API
- Model configuration (GPT-4 Realtime models)
- Voice selection (alloy, echo, fable, onyx, nova, shimmer)
- Session configuration (WebRTC/WebSocket transport, audio formats)
- Turn detection and voice activity detection settings
- Tool calling configuration
- Advanced settings (interruption, retry logic, timeouts)

### ElevenLabs Conversational AI
- Agent and voice configuration
- Voice synthesis settings (stability, similarity boost, style)
- Conversation behavior (language, duration, interruption)
- Context and personalization settings
- Advanced connection settings

## Basic Usage

```typescript
import { 
  getSerializerForProvider,
  OpenAIRealtimeSerializer,
  ElevenLabsSerializer 
} from '@/lib/voice/config-serializers';

// Get serializer for a provider
const serializer = getSerializerForProvider('openai');

// Create default configuration
const config = serializer.getDefaultConfig();

// Customize configuration
config.displayName = 'My Custom Assistant';
config.temperature = 0.8;

// Validate configuration
const validation = serializer.validate(config);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}

// Serialize to JSON for database storage
const json = serializer.serialize(config);

// Deserialize from JSON
const loadedConfig = serializer.deserialize(json);
```

## Configuration Structure

### OpenAI Realtime Configuration

```typescript
interface OpenAIRealtimeConfig {
  provider: 'openai';
  enabled: boolean;
  displayName: string;
  description: string;
  version: string;
  
  // Model settings
  model: string;
  temperature: number;
  maxTokens: number;
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  
  // Agent settings
  instructions: string;
  name: string;
  
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
    outputGuardrails?: {
      debounceTextLength?: number;
      maxResponseLength?: number;
    };
  };
  
  // Tool configuration
  tools: OpenAIToolConfig[];
  
  // Advanced settings
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

### ElevenLabs Configuration

```typescript
interface ElevenLabsConfig {
  provider: 'elevenlabs';
  enabled: boolean;
  displayName: string;
  description: string;
  version: string;
  
  // Agent settings
  agentId: string;
  agentName?: string;
  
  // Voice settings
  voiceId: string;
  voiceName?: string;
  model: string;
  voiceSettings: {
    stability: number;
    similarityBoost: number;
    style: number;
    useSpeakerBoost: boolean;
  };
  
  // Conversation settings
  conversationConfig: {
    language: string;
    maxDuration: number;
    timeoutMs: number;
    enableInterruption: boolean;
    turnDetection?: {
      type: 'server_vad';
      threshold?: number;
      prefixPaddingMs?: number;
      silenceDurationMs?: number;
    };
  };
  
  // Context and personalization
  context: {
    systemPrompt?: string;
    firstMessage?: string;
    personalizedGreeting?: boolean;
    contextNotes?: string;
  };
  
  // Advanced settings
  advanced: {
    enableTranscriptLogging: boolean;
    maxRetries: number;
    connectionTimeout: number;
    reconnectDelay: number;
    signedUrlExpiry: number;
  };
}
```

## Validation

The serializers provide comprehensive validation with helpful error messages:

```typescript
const validation = serializer.validate(config);

if (!validation.valid) {
  validation.errors.forEach(error => {
    console.error(`${error.field}: ${error.message} (${error.code})`);
  });
}

if (validation.warnings) {
  validation.warnings.forEach(warning => {
    console.warn(`${warning.field}: ${warning.message}`);
    if (warning.suggestion) {
      console.warn(`Suggestion: ${warning.suggestion}`);
    }
  });
}
```

## JSON Schema Generation

Generate JSON schemas for dynamic admin UI creation:

```typescript
const schema = serializer.getConfigSchema();

// Use schema to generate forms, validation, etc.
console.log(schema.title);
console.log(schema.description);
console.log(schema.properties);
console.log(schema.required);
```

## Error Handling

The serializers throw specific error types for different failure modes:

```typescript
import { ConfigValidationError, ConfigSerializationError } from '@/lib/voice/config-serializers';

try {
  const json = serializer.serialize(config);
} catch (error) {
  if (error instanceof ConfigValidationError) {
    console.error('Validation failed:', error.errors);
  } else if (error instanceof ConfigSerializationError) {
    console.error('Serialization failed:', error.message);
  }
}
```

## Configuration Presets

The module includes predefined configuration presets for common use cases:

```typescript
import { configurationPresets } from '@/lib/voice/config-serializers/examples';

// Get professional OpenAI configuration
const professionalConfig = configurationPresets.openai.professional();

// Get casual ElevenLabs configuration
const casualConfig = configurationPresets.elevenlabs.casual();

// Get technical expert configuration
const technicalConfig = configurationPresets.openai.technical();
```

## Integration with ClientAIModelManager

These serializers are designed to work with the ClientAIModelManager for database storage:

```typescript
// In ClientAIModelManager
const serializer = getSerializerForProvider(provider);
const configJson = serializer.serialize(config);

// Store in database
await this.saveProviderConfig(provider, name, configJson, isDefault);

// Load from database
const loadedJson = await this.loadProviderConfig(provider, name);
const config = serializer.deserialize(loadedJson);
```

## Testing

The serializers include comprehensive tests covering:
- Default configuration creation
- Serialization/deserialization round-trips
- Validation of valid and invalid configurations
- JSON schema generation
- Error handling
- Factory function behavior

Run tests with:
```bash
npm test -- --testPathPattern="serializers.test.ts"
```

## Migration Support

The serializers support configuration migration between versions:

```typescript
import { migrateConfiguration } from '@/lib/voice/config-serializers/examples';

// Migrate old configuration to new format
const migratedJson = migrateConfiguration(oldConfigJson, 'openai');
```

This ensures backward compatibility when configuration schemas evolve.