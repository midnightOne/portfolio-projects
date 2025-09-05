/**
 * Examples demonstrating how to use Voice Configuration Serializers
 * 
 * This file shows practical usage patterns for the configuration serializers
 * including creating, validating, and managing voice AI configurations.
 */

import { 
  getSerializerForProvider,
  OpenAIRealtimeSerializer,
  ElevenLabsSerializer,
  type OpenAIRealtimeConfig,
  type ElevenLabsConfig,
  ConfigValidationError,
  ConfigSerializationError
} from './index';

// Example 1: Creating and using OpenAI Realtime configuration
export function createOpenAIConfig(): OpenAIRealtimeConfig {
  const serializer = new OpenAIRealtimeSerializer();
  
  // Start with default configuration
  const config = serializer.getDefaultConfig();
  
  // Customize for specific use case
  config.displayName = 'Professional Portfolio Assistant';
  config.description = 'High-quality voice assistant for professional portfolio interactions';
  config.temperature = 0.8;
  config.voice = 'nova';
  config.instructions = 'You are a professional portfolio assistant. Speak clearly and confidently about the portfolio owner\'s experience and projects. Be engaging but maintain professionalism.';
  
  // Configure session settings for optimal performance
  config.sessionConfig.transport = 'webrtc';
  config.sessionConfig.turnDetection.threshold = 0.6;
  config.sessionConfig.outputGuardrails = {
    debounceTextLength: 150,
    maxResponseLength: 1500
  };
  
  return config;
}

// Example 2: Creating and using ElevenLabs configuration
export function createElevenLabsConfig(): ElevenLabsConfig {
  const serializer = new ElevenLabsSerializer();
  
  // Start with default configuration
  const config = serializer.getDefaultConfig();
  
  // Customize for specific use case
  config.displayName = 'Natural Voice Assistant';
  config.description = 'Natural-sounding voice assistant using ElevenLabs technology';
  config.agentId = 'portfolio-assistant-v1';
  config.voiceId = 'professional-voice-001';
  config.model = 'eleven_turbo_v2_5';
  
  // Fine-tune voice settings
  config.voiceSettings = {
    stability: 0.7,
    similarityBoost: 0.9,
    style: 0.2,
    useSpeakerBoost: true
  };
  
  // Configure conversation behavior
  config.conversationConfig = {
    language: 'en-US',
    maxDuration: 2400, // 40 minutes
    timeoutMs: 8000,
    enableInterruption: true,
    turnDetection: {
      type: 'server_vad',
      threshold: 0.4,
      prefixPaddingMs: 250,
      silenceDurationMs: 600
    }
  };
  
  // Set context and personalization
  config.context = {
    systemPrompt: 'You are a knowledgeable and friendly portfolio assistant. Help visitors understand the portfolio owner\'s background, skills, and projects. Be conversational but informative.',
    firstMessage: 'Hi there! I\'m here to help you explore this portfolio. What would you like to know about?',
    personalizedGreeting: true,
    contextNotes: 'Focus on technical expertise and project outcomes'
  };
  
  return config;
}

// Example 3: Configuration validation and error handling
export function validateAndSerializeConfig(provider: 'openai' | 'elevenlabs', config: any): string {
  try {
    const serializer = getSerializerForProvider(provider);
    
    // Validate configuration
    const validation = serializer.validate(config);
    
    if (!validation.valid) {
      console.error('Configuration validation failed:');
      validation.errors.forEach(error => {
        console.error(`- ${error.field}: ${error.message} (${error.code})`);
      });
      throw new ConfigValidationError(
        `Configuration validation failed for ${provider}`,
        provider,
        validation.errors
      );
    }
    
    // Show warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
      console.warn('Configuration warnings:');
      validation.warnings.forEach(warning => {
        console.warn(`- ${warning.field}: ${warning.message}`);
        if (warning.suggestion) {
          console.warn(`  Suggestion: ${warning.suggestion}`);
        }
      });
    }
    
    // Serialize to JSON
    return serializer.serialize(config);
    
  } catch (error) {
    if (error instanceof ConfigValidationError || error instanceof ConfigSerializationError) {
      throw error;
    }
    throw new Error(`Unexpected error validating ${provider} configuration: ${error}`);
  }
}

// Example 4: Loading and deserializing configuration from JSON
export function loadConfigFromJson(provider: 'openai' | 'elevenlabs', json: string): OpenAIRealtimeConfig | ElevenLabsConfig {
  try {
    const serializer = getSerializerForProvider(provider);
    return serializer.deserialize(json);
  } catch (error) {
    if (error instanceof ConfigSerializationError) {
      console.error(`Failed to load ${provider} configuration:`, error.message);
      throw error;
    }
    throw new Error(`Unexpected error loading ${provider} configuration: ${error}`);
  }
}

// Example 5: Configuration comparison and migration
export function migrateConfiguration(oldJson: string, provider: 'openai' | 'elevenlabs'): string {
  const serializer = getSerializerForProvider(provider);
  
  try {
    // Try to load old configuration
    const oldConfig = serializer.deserialize(oldJson);
    
    // Get current default configuration
    const defaultConfig = serializer.getDefaultConfig();
    
    // Merge old settings with new defaults (preserving user customizations)
    const migratedConfig = {
      ...defaultConfig,
      ...oldConfig,
      // Ensure version is updated
      version: defaultConfig.version,
      // Preserve user customizations for key fields
      displayName: oldConfig.displayName || defaultConfig.displayName,
      description: oldConfig.description || defaultConfig.description,
      enabled: oldConfig.enabled !== undefined ? oldConfig.enabled : defaultConfig.enabled
    };
    
    // Validate migrated configuration
    const validation = serializer.validate(migratedConfig);
    if (!validation.valid) {
      console.warn('Migration resulted in invalid configuration, using defaults');
      return serializer.serialize(defaultConfig);
    }
    
    return serializer.serialize(migratedConfig);
    
  } catch (error) {
    console.warn('Failed to migrate configuration, using defaults:', error);
    return serializer.serialize(serializer.getDefaultConfig());
  }
}

// Example 6: Dynamic schema generation for admin UI
export function generateAdminFormSchema(provider: 'openai' | 'elevenlabs') {
  const serializer = getSerializerForProvider(provider);
  const schema = serializer.getConfigSchema();
  
  // Transform JSON Schema into a format suitable for dynamic form generation
  const formFields = Object.entries(schema.properties).map(([key, property]) => ({
    name: key,
    label: property.title,
    description: property.description,
    type: property.type,
    required: schema.required.includes(key),
    default: property.default,
    options: property.enum,
    min: property.minimum,
    max: property.maximum,
    pattern: property.pattern,
    format: property.format,
    // Handle nested objects
    properties: property.properties ? Object.entries(property.properties).map(([nestedKey, nestedProperty]) => ({
      name: nestedKey,
      label: nestedProperty.title,
      description: nestedProperty.description,
      type: nestedProperty.type,
      default: nestedProperty.default,
      options: nestedProperty.enum,
      min: nestedProperty.minimum,
      max: nestedProperty.maximum
    })) : undefined
  }));
  
  return {
    title: schema.title,
    description: schema.description,
    fields: formFields
  };
}

// Example 7: Configuration presets for different use cases
export const configurationPresets = {
  openai: {
    professional: (): OpenAIRealtimeConfig => {
      const config = createOpenAIConfig();
      config.displayName = 'Professional Assistant';
      config.temperature = 0.6;
      config.voice = 'nova';
      config.instructions = 'You are a professional portfolio assistant. Maintain a formal, business-appropriate tone while being helpful and informative.';
      return config;
    },
    
    casual: (): OpenAIRealtimeConfig => {
      const config = createOpenAIConfig();
      config.displayName = 'Friendly Assistant';
      config.temperature = 0.8;
      config.voice = 'alloy';
      config.instructions = 'You are a friendly and approachable portfolio assistant. Be conversational and engaging while helping visitors learn about the portfolio.';
      return config;
    },
    
    technical: (): OpenAIRealtimeConfig => {
      const config = createOpenAIConfig();
      config.displayName = 'Technical Expert';
      config.temperature = 0.7;
      config.voice = 'echo';
      config.instructions = 'You are a technical portfolio assistant with deep knowledge of software development. Provide detailed technical explanations and insights.';
      config.maxTokens = 6000; // Allow longer technical explanations
      return config;
    }
  },
  
  elevenlabs: {
    professional: (): ElevenLabsConfig => {
      const config = createElevenLabsConfig();
      config.displayName = 'Professional Voice';
      config.voiceSettings.stability = 0.8;
      config.voiceSettings.style = 0.1;
      config.context.systemPrompt = 'You are a professional portfolio assistant. Speak with confidence and authority while maintaining warmth and approachability.';
      return config;
    },
    
    casual: (): ElevenLabsConfig => {
      const config = createElevenLabsConfig();
      config.displayName = 'Conversational Voice';
      config.voiceSettings.stability = 0.6;
      config.voiceSettings.style = 0.3;
      config.context.systemPrompt = 'You are a friendly and casual portfolio assistant. Be conversational, enthusiastic, and engaging in your responses.';
      return config;
    },
    
    multilingual: (): ElevenLabsConfig => {
      const config = createElevenLabsConfig();
      config.displayName = 'Multilingual Assistant';
      config.conversationConfig.language = 'auto'; // Auto-detect language
      config.voiceSettings.stability = 0.7;
      config.context.systemPrompt = 'You are a multilingual portfolio assistant. Adapt your language and cultural context to match the visitor\'s preferences.';
      return config;
    }
  }
};

// Example usage:
// const openaiConfig = configurationPresets.openai.professional();
// const elevenLabsConfig = configurationPresets.elevenlabs.casual();
// const serializedConfig = validateAndSerializeConfig('openai', openaiConfig);