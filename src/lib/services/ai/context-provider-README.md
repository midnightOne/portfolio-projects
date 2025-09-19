# Context Provider Integration System

## Overview

The Context Provider Integration system provides secure context injection and management for AI agents in the Client-Side AI Assistant. It integrates with the existing Context Provider system to handle reflink-based access control, dynamic context loading, and ephemeral token generation for voice AI providers.

## Architecture

### Core Components

1. **ContextProvider** - Main service for context injection with access control
2. **ContextInjector** - Service for system prompt injection and token generation
3. **API Endpoints** - RESTful endpoints for dynamic context loading

### Key Features

- **Secure Context Injection** - Server-side context filtering based on access levels
- **Reflink-Based Access Control** - Premium features controlled by reflink validation
- **Dynamic Context Loading** - On-demand context retrieval for voice agents
- **Ephemeral Token Generation** - Secure tokens for voice AI providers with injected context
- **Distributed Caching** - 15-minute TTL caching for performance optimization
- **Access Level Filtering** - Different context depth based on user permissions

## Access Levels

### No Access
- Hidden AI interface
- No context provided
- All features disabled

### Basic Access
- Text-only chat interface
- Limited context (≤2000 tokens)
- No hidden context
- Basic navigation only
- Strict rate limits (5/day)

### Limited Access
- Text + basic voice features
- Standard context (≤3000 tokens)
- No hidden context
- Standard navigation
- Moderate rate limits (20/day)

### Premium Access (Reflink)
- Full interface with all features
- Comprehensive context (full token limit)
- Hidden context included
- Advanced navigation
- Budget-based limits

## API Endpoints

### POST /api/ai/context/inject
Handles secure context injection with access control and filtering.

**Request:**
```json
{
  "sessionId": "string",
  "query": "string",
  "reflinkCode": "string (optional)",
  "options": {
    "maxTokens": "number (optional)",
    "includeProjects": "boolean (optional)",
    "includeAbout": "boolean (optional)",
    "includeResume": "boolean (optional)",
    "contextDepth": "minimal|standard|comprehensive (optional)"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "context": {
      "publicContext": "string",
      "contextSources": "array",
      "relevantContent": "array",
      "accessLevel": "string",
      "tokenCount": "number"
    },
    "sessionId": "string",
    "query": "string",
    "accessLevel": "string",
    "capabilities": {
      "voiceAI": "boolean",
      "jobAnalysis": "boolean",
      "advancedNavigation": "boolean"
    },
    "welcomeMessage": "string (optional)",
    "processingTime": "number"
  }
}
```

### POST /api/ai/voice/session-init
Generates ephemeral tokens with server-injected context for voice AI providers.

**Request:**
```json
{
  "sessionId": "string",
  "provider": "openai|elevenlabs",
  "reflinkCode": "string (optional)",
  "query": "string (optional)",
  "contextConfig": {
    "maxTokens": "number (optional)",
    "includeProjects": "boolean (optional)",
    "includeAbout": "boolean (optional)",
    "includeResume": "boolean (optional)",
    "contextDepth": "minimal|standard|comprehensive (optional)"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ephemeralToken": "string",
    "publicContext": "string",
    "welcomeMessage": "string",
    "accessLevel": "string",
    "capabilities": {
      "voiceAI": "boolean",
      "jobAnalysis": "boolean",
      "advancedNavigation": "boolean"
    },
    "budgetStatus": {
      "tokensRemaining": "number (optional)",
      "spendRemaining": "number",
      "isExhausted": "boolean",
      "estimatedRequestsRemaining": "number"
    },
    "provider": "string",
    "sessionId": "string",
    "processingTime": "number",
    "expiresAt": "string (ISO date)"
  }
}
```

### POST /api/ai/context/load
Provides on-demand context loading for voice agents with access control.

**Request:**
```json
{
  "sessionId": "string",
  "contextType": "project|profile|general|navigation",
  "query": "string",
  "reflinkCode": "string (optional)",
  "projectId": "string (optional)",
  "options": {
    "maxTokens": "number (optional)",
    "includeDetails": "boolean (optional)",
    "format": "summary|detailed|conversational (optional)"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contextType": "string",
    "contextData": "object (varies by type)",
    "accessLevel": "string",
    "capabilities": {
      "voiceAI": "boolean",
      "jobAnalysis": "boolean",
      "advancedNavigation": "boolean"
    },
    "sessionId": "string",
    "processingTime": "number",
    "tokenCount": "number"
  }
}
```

## Usage Examples

### Basic Context Injection
```typescript
import { contextInjector } from '@/lib/services/ai';

// Inject system prompt for text-based AI
const systemPrompt = await contextInjector.injectSystemPrompt(
  'session-123',
  'Tell me about React projects'
);

console.log(systemPrompt.systemPrompt);
console.log(systemPrompt.capabilities);
```

### Voice Session Initialization
```typescript
import { contextInjector } from '@/lib/services/ai';

// Generate ephemeral token for voice provider
const tokenResult = await contextInjector.generateEphemeralToken({
  sessionId: 'session-123',
  provider: 'openai',
  reflinkCode: 'premium-reflink-code',
  query: 'General conversation'
});

if (tokenResult.success) {
  // Use ephemeralToken to initialize voice AI provider
  console.log(tokenResult.ephemeralToken);
  console.log(tokenResult.welcomeMessage);
}
```

### Dynamic Context Loading
```typescript
import { contextInjector } from '@/lib/services/ai';

// Load project-specific context
const context = await contextInjector.loadFilteredContext(
  'session-123',
  'React projects with TypeScript',
  'premium-reflink-code',
  { maxTokens: 3000, includeProjects: true }
);

console.log(context.publicContext);
console.log(context.relevantContent);
```

## Security Features

### Access Control
- **Reflink Validation** - Server-side validation of reflink codes
- **Budget Checking** - Automatic budget exhaustion detection
- **Context Filtering** - Access-level based context filtering
- **Hidden Context** - Server-only context not visible to clients

### Rate Limiting Integration
- **Per-Reflink Tracking** - Usage tracking per reflink
- **Cost Attribution** - LLM and voice costs tracked separately
- **Budget Enforcement** - Automatic feature disabling on budget exhaustion

### Caching Security
- **Session Isolation** - Cache keys include session identifiers
- **TTL Enforcement** - 15-minute cache expiration
- **Access Level Separation** - Different cache entries for different access levels

## Error Handling

### Graceful Degradation
- **Invalid Reflinks** - Fall back to basic access level
- **Context Loading Failures** - Return minimal context instead of errors
- **Provider Errors** - Return appropriate error messages without exposing internals

### Error Types
- `VALIDATION_ERROR` - Invalid request parameters
- `ACCESS_DENIED` - Insufficient permissions or invalid reflink
- `FEATURE_DISABLED` - Feature not enabled for access level
- `TOKEN_GENERATION_FAILED` - Ephemeral token generation failed
- `CONTEXT_LOAD_FAILED` - Context loading failed

## Performance Optimization

### Caching Strategy
- **Context Caching** - 15-minute TTL for context results
- **Reflink Caching** - Validation results cached per session
- **Token Estimation** - Efficient token counting for context sizing

### Resource Management
- **Token Limits** - Configurable token limits per access level
- **Content Prioritization** - Relevance-based content selection
- **Progressive Loading** - Load additional context on-demand

## Integration Points

### Existing Systems
- **Context Manager** - Uses existing context building logic
- **Reflink Manager** - Integrates with reflink validation and tracking
- **Project Indexer** - Leverages project indexing for content search
- **Content Source Manager** - Uses flexible content source system

### Voice AI Providers
- **OpenAI Realtime** - Ephemeral token generation with context injection
- **ElevenLabs Conversational AI** - Secure token-based authentication
- **Future Providers** - Extensible architecture for additional providers

## Testing

### Unit Tests
- Context injection with different access levels
- Reflink validation and filtering
- Error handling and graceful degradation
- Cache management and performance

### Integration Tests
- API endpoint validation
- End-to-end context flow
- Voice provider token generation
- Access control enforcement

## Monitoring and Analytics

### Usage Tracking
- Context injection requests per access level
- Token generation success/failure rates
- Cache hit/miss ratios
- Processing time metrics

### Cost Tracking
- Context loading costs per reflink
- Token usage attribution
- Budget consumption monitoring
- Provider-specific cost breakdown

## Future Enhancements

### Planned Features
- **Context Templates** - Pre-configured context templates for different use cases
- **Dynamic Context Sources** - Runtime addition of new content sources
- **Advanced Filtering** - More granular context filtering options
- **Context Analytics** - Detailed analytics on context usage and effectiveness

### Scalability Improvements
- **Distributed Caching** - Redis-based distributed caching
- **Context Streaming** - Streaming context delivery for large contexts
- **Async Processing** - Background context preparation
- **Load Balancing** - Multiple context provider instances