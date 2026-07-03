# Client-Side AI Assistant - Implementation Plan

## CRITICAL IMPLEMENTATION STANDARDS

**🚨 PRODUCTION IMPLEMENTATION REQUIRED - NO MOCKS ALLOWED 🚨**

This spec requires REAL implementation of voice AI functionality. The following standards MUST be followed:

### Voice AI Implementation Requirements

**✅ REQUIRED - Real Implementation:**
- Install and use actual `@openai/agents-realtime` SDK
- Request real microphone access with `navigator.mediaDevices.getUserMedia()`
- Establish real WebRTC connections to OpenAI Realtime API
- Stream actual audio data to AI providers
- Play real AI voice responses through speakers
- Collect real conversation transcripts from AI models

**❌ FORBIDDEN - Mock Implementation:**
- NO mock voice providers or simulated connections
- NO browser TTS instead of real AI voice responses
- NO "test" buttons that show fake responses
- NO console logs saying "mock", "simulation", or "fake"
- NO setTimeout() to simulate API calls

### Technical Verification Standards

Every voice-related task MUST pass these verification checks:

1. **Browser Integration**: Microphone permission request appears in browser
2. **Network Activity**: Real API calls visible in browser Network tab to OpenAI/ElevenLabs endpoints
3. **Audio Streaming**: Actual audio data streams to AI provider APIs
4. **Voice Responses**: Real AI voice responses play through speakers (not browser TTS)
5. **Conversation Data**: Transcripts contain actual AI responses with real timestamps and metadata
6. **No Simulation**: Zero references to "mock", "test", or "simulation" in voice-related code

### Package Installation Requirements

**MUST Install These Packages:**
```bash
# OpenAI Realtime API (verified from actual SDK)
npm install @openai/agents zod@3 uuid @types/uuid

# ElevenLabs Conversational AI (updated for @elevenlabs/client)
npm install @elevenlabs/client
```

**MUST Import Real SDKs:**
```typescript
// ✅ REQUIRED - OpenAI Realtime (actual SDK imports)
import { RealtimeAgent, RealtimeSession, tool } from '@openai/agents/realtime';
import { WavRecorder, WavStreamPlayer } from '@openai/agents/wav';

// ✅ REQUIRED - ElevenLabs (updated for @elevenlabs/client)
import { Conversation, ConnectionType, ConversationOptions, Message } from '@elevenlabs/client';

// ❌ FORBIDDEN - Mock implementation  
const mockAgent = { /* fake implementation */ };
```

### End-User Experience Requirements

**Users MUST be able to:**
- Actually speak into their microphone
- Hear real AI voice responses from GPT-Realtime or ElevenLabs
- Have natural voice conversations with AI models
- See live transcripts of real AI responses
- Experience <2 second latency for voice interactions

**Users MUST NOT encounter:**
- "Test" buttons instead of real voice interfaces
- Browser TTS instead of AI voice responses
- Mock responses or simulated conversations
- Error messages about missing real implementations

## Prerequisites

**Note:** This spec depends on the completion of Tiptap 3 integration in the main portfolio-projects spec. These tasks should only be started after the base portfolio system is stable and Tiptap 3 is fully integrated.

## Task List

- [x] **1. Unified Tool Call System Implementation (CRITICAL - ARCHITECTURE OVERHAUL)**

  - [x] 1.1 Create Unified Tool Definition System (CRITICAL - FOUNDATION)
    - Create `src/lib/ai/tools/types.ts` with `UnifiedToolDefinition` interface and `ToolExecutionContext` type
    - Define clear taxonomy: `client` tools (direct browser execution) vs `server` tools (backend processing)
    - Create `src/lib/ai/tools/client-tools.ts` with all client-side tool definitions (navigation, UI manipulation)
    - Create `src/lib/ai/tools/server-tools.ts` with all server-side tool definitions (context loading, job analysis, etc.)
    - Ensure each tool definition includes `executionContext`, `parameters` schema, and optional `outputSchema`
    - **Impact**: Establishes single source of truth for all tool definitions with clear execution boundaries
    - When finished - make a git commit, then fix build issues and make another commit with "fixed build issues" as the title
    - _Requirements: 8.11, 8.21, 8.22, 8.26_

  - [x] 1.2 Implement Centralized Tool Registry (CRITICAL - SINGLE SOURCE OF TRUTH)
    - Create `src/lib/ai/tools/UnifiedToolRegistry.ts` as singleton registry for all tool definitions
    - Implement tool registration, lookup, and filtering by execution context
    - Add provider-specific formatters: `getOpenAIToolsArray()` and `getElevenLabsClientToolsExecutor()`
    - Register all client and server tools during initialization
    - Provide methods to get tools by execution context for different use cases
    - **Impact**: Eliminates redundant tool definitions and provides consistent tool access across providers
    - When finished - make a git commit, then fix build issues and make another commit with "fixed build issues" as the title
    - _Requirements: 8.11, 8.21, 8.22, 8.26_
-

  - [x] 1.3 Implement Unified Tool Execution Pipeline (CRITICAL - STREAMLINED EXECUTION)
    - Add `_executeUnifiedTool(toolName: string, args: any)` method to `BaseConversationalAgentAdapter`
    - Implement execution routing: client tools → `UINavigationTools`, server tools → `/api/ai/tools/execute`
    - Add comprehensive debug event emission with `toolCallId` correlation across client-server boundary
    - Implement unified error handling and result reporting for both execution contexts
    - Ensure consistent tool call and result format across OpenAI and ElevenLabs adapters
    - **Impact**: Provides single, predictable execution path for all tools regardless of provider
    - When finished - make a git commit, then fix build issues and make another commit with "fixed build issues" as the title
    - _Requirements: 8.11, 8.21, 8.22, 8.26_


  - [x] 1.4 Create Unified Server-Side Tool Execution Endpoint (CRITICAL - SINGLE SERVER GATEWAY)
    - Create `/api/ai/tools/execute/route.ts` as single endpoint for all server-side tool execution
    - Implement tool validation, reflink-based access control, and session management
    - Replace all existing MCP-specific endpoints (`/api/ai/mcp/execute`, etc.) with unified endpoint
    - Add comprehensive error handling, logging, and usage tracking for reflink cost attribution
    - Ensure consistent response format and metadata across all server tools
    - **Impact**: Simplifies server-side tool architecture and provides unified access control
    - When finished - make a git commit, then fix build issues and make another commit with "fixed build issues" as the title
    - _Requirements: 8.11, 8.21, 8.22, 8.26, 5.2, 5.6_

  - [x] 1.5 Refactor Backend Tool Service (CRITICAL - SIMPLIFIED MCP REPLACEMENT)
    - Create `src/lib/ai/tools/BackendToolService.ts` to replace `src/lib/mcp/server.ts`
    - Implement `executeTool()` method that dispatches to specific backend service handlers
    - Remove client registration and state synchronization (handled by API calls)
    - Focus solely on server-side tool logic: project context, job analysis, user profiles, etc.
    - Integrate with existing services: projectIndexer, contextManager, reflinkManager
    - **Impact**: Simplifies backend architecture by removing unnecessary MCP complexity
    - When finished - make a git commit, then fix build issues and make another commit with "fixed build issues" as the title
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 4.1, 9.1, 9.3_
-

  - [x] 1.6 Update Voice Adapters for Unified Tool System (CRITICAL - ADAPTER INTEGRATION)
    - Modify `OpenAIRealtimeAdapter` to use `unifiedToolRegistry.getOpenAIToolsArray()` for tool definitions
    - Modify `ElevenLabsAdapter` to use `unifiedToolRegistry.getElevenLabsClientToolsExecutor()` for tool registration
    - Replace all direct tool execution with calls to `this._executeUnifiedTool(toolName, args)`
    - Remove redundant tool definition code from both adapters
    - Ensure both adapters emit identical debug events and transcript formats
    - **Impact**: Eliminates code duplication and ensures consistent tool behavior across providers
    - When finished - make a git commit, then fix build issues and make another commit with "fixed build issues" as the title
    - _Requirements: 8.11, 8.21, 8.22, 8.26_

  - [x] 1.7 Enhanced Debugging and Telemetry Integration (CRITICAL - UNIFIED MONITORING)
    - Update `debugEventEmitter` to support `toolCallId` correlation between client and server events
    - Implement consistent event emission in `_executeUnifiedTool`, `UINavigationTools`, and `/api/ai/tools/execute`
    - Add tool execution metrics: timing, success/failure rates, error patterns
    - Ensure admin debug interface works seamlessly with unified tool system
    - Create unified conversation logging that captures all tool calls regardless of execution context
    - **Impact**: Provides comprehensive debugging and monitoring across entire tool execution pipeline
    - When finished - make a git commit, then fix build issues and make another commit with "fixed build issues" as the title
    - _Requirements: 14.1, 14.2, 14.3, 8.26, 8.27, 8.28_

- [-] **2. Legacy Architecture Cleanup and Migration**

  - [x] 2.1 Remove Redundant Tool Definitions and Endpoints (CLEANUP)
    - Remove `createUINavigationToolDefinitions` from `UINavigationTools.ts` (replaced by unified registry)
    - Remove MCP-specific API endpoints: `/api/ai/mcp/execute`, `/api/ai/mcp/load-project-context`, etc.
    - Remove `getServerToolDefinitions` from `server-tools.ts` (replaced by unified registry)
    - Clean up duplicate tool schemas in API routes that generate tokens
    - Update all imports and references to use unified tool system
    - **Impact**: Eliminates technical debt and reduces maintenance burden
    - _Requirements: Architecture cleanup_

  - [x] 2.2 Migrate Existing Tool Calls to Unified System (MIGRATION)
    - Update all existing client-side tool calls to use `_executeUnifiedTool`
    - Migrate server-side tool handlers from MCP server to BackendToolService
    - Update admin debug components to work with unified tool call format
    - Test tool execution across both OpenAI and ElevenLabs providers
    - Verify conversation continuity and tool result reporting
    - **Impact**: Ensures all existing functionality works with new unified system
    - _Requirements: 8.11, 8.21, 8.22, 8.26_

- [-] **3. Configuration System Consolidation (FOUNDATION TASKS)**

  - [x] 3.1 Implement Provider-Specific Configuration Serializers (CRITICAL - FOUNDATION)
    - Create `src/lib/voice/config-serializers/OpenAIRealtimeSerializer.ts` for OpenAI-specific config handling
    - Create `src/lib/voice/config-serializers/ElevenLabsSerializer.ts` for ElevenLabs-specific config handling
    - Implement `VoiceConfigSerializer<T>` interface with serialize, deserialize, validate, and getDefaultConfig methods
    - Add JSON Schema generation for each provider to enable dynamic admin UI generation
    - Include comprehensive validation with helpful error messages for each provider's config format
    - **Impact**: Enables type-safe, provider-specific configuration management with flexible JSON storage
    - _Requirements: 8.2, 8.3, 8.25_

  - [x] 3.2 Implement ClientAIModelManager with JSON Storage (CRITICAL - REPLACES BACKEND AISERVICEMANAGER)
    - Create `src/lib/voice/ClientAIModelManager.ts` with database-backed JSON configuration storage
    - Implement CRUD operations for provider configurations using serializers
    - Add support for multiple named configurations per provider (e.g., "Professional", "Casual", "Technical")
    - Implement configuration caching and hot-reload capabilities
    - Add default provider selection and fallback logic
    - Create database migration for VoiceProviderConfigRecord table
    - **Impact**: Provides flexible, database-backed configuration management for voice AI systems
    - _Requirements: 8.2, 8.3, 8.25_

  - [x] 3.3 Implement OpenAI Realtime Agent with Proper Tool Definitions (CRITICAL - UPDATED BASED ON SDK ANALYSIS)
    - Create client-side `RealtimeAgent` with proper tool definitions using `tool()` function from SDK
    - Implement client-side UI navigation tools with direct execution (no `needsApproval: true`)
    - Implement client-side backend API tools that make fetch calls to our server endpoints
    - Create `RealtimeSession` with proper configuration including guardrails and audio settings
    - Update `src/app/api/ai/openai/session/route.ts` to inject system prompts and tool definitions into OpenAI's `client_secrets` API
    - Ensure server-side context injection occurs during token generation, not client-side
    - **Impact**: Enables proper OpenAI Realtime integration with seamless tool execution and context injection
    - _Requirements: 8.2, 8.3, 8.6, 8.25_

  - [x] 3.4 Implement OpenAI Realtime Event Handling and Auto-Approval (CRITICAL - UPDATED BASED ON SDK ANALYSIS)
    - Implement proper event listeners for `RealtimeSession` including `history_updated`, `tool_approval_requested`, `guardrail_tripped`
    - Set up auto-approval flow for seamless UX: automatically approve all tool calls without user confirmation
    - Implement conversation history processing with `RealtimeItem[]` arrays containing messages, tool calls, and outputs
    - Add comprehensive logging for debugging while maintaining seamless user experience
    - Process `tokensUsed` and `costUsd` metrics from conversation history for analytics
    - Report conversation data to server for persistent storage and cost tracking
    - **Impact**: Establishes clear client-server tool execution boundary with proper feedback
    - _Requirements: 8.11, 8.21, 8.22, 8.23_

  - [x] 3.5 Ensure Tool Result Reporting to AI Providers (CRITICAL - MISSING INTEGRATION)
    - **OpenAI Implementation**: Modify OpenAIRealtimeAdapter to capture ToolResult from _executeTool
    - **OpenAI Implementation**: Use `this._session?.sendToolOutput(toolCallId, result)` for OpenAI tool result reporting
    - **ElevenLabs Implementation**: For ElevenLabs, tool result reporting is handled automatically by `@elevenlabs/client` when tools are registered via `clientTools` object - no manual WebSocket messages needed
    - **ElevenLabs Implementation**: Ensure `_createClientToolsForElevenLabs()` returns tool results properly so `@elevenlabs/client` can report them back to the agent automatically
    - Ensure both providers receive feedback on tool execution success/failure for adaptive conversation
    - **Impact**: Enables AI to adapt conversation based on tool execution outcomes across both providers
    - **Note**: This task should be completed after Task 2.2 (ElevenLabsAdapter refactoring) for ElevenLabs portion
    - _Requirements: 8.11, 8.26_

  - [x] 3.6 Implement MCP Server-Side Tool Logic (CRITICAL - MISSING IMPLEMENTATION)
    - Create `src/lib/mcp/server.ts` with core mcpServer instance
    - Define `mcpServer.executeTool(toolCall: MCPToolCall)` method
    - Map toolCall.name to specific server-side service calls
    - Implement business logic for: getProjectSummary, loadUserProfile, searchProjects, processJobSpec, analyzeUserIntent, generateNavigationSuggestions, getNavigationHistory, reportUIState
    - Interact with projectIndexer, contextManager, reflinkManager services
    - Return structured MCPToolResult for each tool
    - **Impact**: Enables server-side AI capabilities for context retrieval and analysis
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 4.1, 9.1, 9.3_

  - [x] 3.7 Create Database Schema for Voice AI Configuration Storage
    - Add `VoiceProviderConfig` Prisma model with JSON storage for flexible provider configurations
    - Include fields: id, provider, name, isDefault, configJson, createdAt, updatedAt
    - Create database migration for the new table structure
    - Add indexes for efficient querying by provider and default status
    - **Impact**: Provides persistent storage for flexible voice AI configurations
    - _Requirements: 8.2, 8.3, 8.25_

  - [x] 3.8 Create Voice AI Configuration Schema and Validation
    - Define comprehensive TypeScript interfaces for voice AI configuration in `src/types/voice-config.ts`
    - Create provider-specific interfaces: OpenAIRealtimeConfig, ElevenLabsConfig
    - Create Zod schemas for runtime configuration validation within each serializer
    - Add configuration validation with helpful error messages
    - Support environment variable fallbacks for basic configuration
    - **Impact**: Ensures type-safe, validated configuration management for voice AI systems
    - _Requirements: 8.2, 8.3, 8.25_

  - [x] 3.9 Consolidate Configuration System and Finalize ClientAIModelManager Integration (CRITICAL - CONFIGURATION ROBUSTNESS)
    - **Configuration System Consolidation**:
      - Unify validation results: Replace `ConfigValidationResult` with detailed `ValidationResult` interface throughout system
      - Update `VoiceConfigValidator` to use serializer validation methods first, then augment with environment checks
      - Consolidate environment variable validation: Make `validateEnvironmentVariable` and `getEnvironmentVariable` from `voice-config.ts` the single source of truth
      - Remove duplicate environment validation methods from serializers and `VoiceConfigValidator`
      - Update API routes to use `getEnvironmentVariable(envVar, required: true)` for early validation with proper error handling
    - **ClientAIModelManager Enhancements**:
      - Modify `getProviderConfig()` to automatically return serializer default config when no database record found
      - Eliminate repetitive fallback logic in API routes by centralizing default handling in manager
      - Add `await this.prisma.$disconnect()` to `destroy()` method for proper connection cleanup
      - Implement configuration health checks with comprehensive validation and recommendations
    - **Voice Adapter Integration**:
      - Update `OpenAIRealtimeAdapter` to load configuration from ClientAIModelManager with automatic fallbacks
      - Update `ElevenLabsAdapter` to load configuration from ClientAIModelManager with automatic fallbacks
      - Remove all hardcoded model names, capabilities, agent instructions, and session configs
      - Implement dynamic configuration loading with validation and error handling
      - Add configuration hot-reload support for runtime updates
    - **Type System Alignment**:
      - Update `src/types/voice-agent.ts` to reference configuration types from `src/types/voice-config.ts`
      - Remove duplicate configuration interfaces to maintain single source of truth
      - Ensure consistent type usage across all voice-related components
    - **API Route Improvements**:
      - Update `/api/ai/openai/session/route.ts` to use centralized environment validation
      - Update `/api/ai/[provider]/agents/route.ts` to use centralized configuration management
      - Implement early environment variable validation with proper error responses
      - Add comprehensive error handling for configuration loading failures
    - **Impact**: Creates a robust, maintainable configuration system with centralized validation, automatic fallbacks, and proper resource management
    - _Requirements: 8.2, 8.3, 8.25_

- [ ] **4. ElevenLabs @elevenlabs/client Migration (CRITICAL - ARCHITECTURE UPDATE)**
  - **Migration Guide**: See `ELEVENLABS_CLIENT_MIGRATION.md` for detailed migration strategy and rationale
  - [x] 4.1 Install @elevenlabs/client and Remove Legacy Packages
    - Install `@elevenlabs/client` package: `npm install @elevenlabs/client`
    - Remove any existing `@elevenlabs/react` and `@elevenlabs/elevenlabs-js` packages if present
    - Update package.json to reflect the new dependency
    - **Impact**: Establishes foundation for native client-side tool support
    - When finished - make a git commit
    - _Requirements: 8.2, 8.3_
-
  - [x] 4.2 Refactor ElevenLabsAdapter for @elevenlabs/client Integration
    - Replace custom WebSocket implementation with `Conversation.startSession()` from `@elevenlabs/client`
    - Remove all WebSocket-related code (`_websocket`, `_connectWebSocket`, `_handleWebSocketMessage`)
    - Implement `_conversationInstance: Conversation | null` property management
    - Update `connect()` method to use `Conversation.startSession()` with proper `ConversationOptions`
    - Implement microphone permission request before `startSession()` as required by the library
    - Update `disconnect()` method to use `await this._conversationInstance?.endSession()`
    - Replace audio input/output methods to use conversation instance controls (`setMicMuted`, `setVolume`)
    - **Impact**: Enables native ElevenLabs client-side tool execution and proper WebRTC connection management
    - When finished - make a git commit, then fix build issues and make another commit with "fixed build issues" as the title
    - _Requirements: 8.2, 8.3, 8.5, 8.14, 8.18, 8.19, 8.20_

  - [x] 4.3 Implement Unified Client-Side Tool Registration System
    - Create `_createClientToolsForElevenLabs(toolDefinitions: ToolDefinition[])` method
    - Convert server-provided tool definitions into executable client-side functions
    - Implement tool execution for UI navigation tools using shared `UINavigationTools` (same as OpenAI)
    - Implement tool execution for server API calls (loadContext, analyzeJobSpec, submitContactForm)
    - Use unified `ToolCall` and `ToolResult` interfaces (same format as OpenAI adapter)
    - Ensure tool calls are logged to unified transcript system for admin debug page compatibility
    - Add proper error handling and result reporting using shared tool execution pipeline
    - Ensure tool results are automatically returned to ElevenLabs agent for conversation continuity
    - **Impact**: Enables seamless tool execution with unified debugging across both voice providers
    - When finished - make a git commit, then fix build issues and make another commit with "fixed build issues" as the title
    - _Requirements: 8.11, 8.21, 8.22, 8.26_

  - [x] 4.4 Update Server-Side Token Endpoint for Context Injection and Tool Definitions
    - Modify `/api/ai/elevenlabs/token/route.ts` to use `ClientAIModelManager` for configuration loading
    - Implement `contextInjector.generateElevenLabsPrompt()` for dynamic context injection
    - Construct comprehensive `overrides` object with agent prompt, first message, language, and TTS settings
    - Add `clientToolsDefinitions` to response containing tool names, descriptions, and parameters
    - Ensure server-side context injection occurs before token generation (not visible to client)
    - Add proper error handling for configuration loading and context injection failures
    - **Impact**: Enables server-side context injection and dynamic tool registration for ElevenLabs conversations
    - When finished - make a git commit, then fix build issues and make another commit with "fixed build issues" as the title
    - _Requirements: 8.6, 8.7, 8.8, 8.26, 8.29_

  - [x] 4.5 Remove Legacy ElevenLabs Components and Hooks
    - Delete `src/components/voice/ElevenLabsVoiceProvider.tsx` (replaced by ElevenLabsAdapter)
    - Delete `src/hooks/useElevenLabsConversation.ts` (functionality moved to adapter)
    - Update any imports or references to these deleted files
    - Ensure `ConversationalAgentProvider` manages ElevenLabsAdapter lifecycle directly
    - **Impact**: Removes redundant code and consolidates ElevenLabs functionality in the adapter
    - _Requirements: Architecture cleanup_

  - [x] 4.6 Implement Unified Conversation Transcript and Tool Call System
    - Update `_handleElevenLabsMessage()` to use unified `TranscriptItem` format (same as OpenAI adapter)
    - Ensure tool calls use unified `ToolCall` and `ToolResult` interfaces across both providers
    - Implement conversation transcript building with provider-agnostic format and metadata
    - Add periodic transcript reporting to server via unified `/api/ai/conversation/log` endpoint
    - Include unified conversation metadata (provider, session ID, tool calls, connection events)
    - Ensure admin debug page works seamlessly with ElevenLabs conversations (same as OpenAI)
    - Add proper error handling for failed transcript reporting with retry logic
    - **Impact**: Enables unified debugging and monitoring across OpenAI and ElevenLabs providers
    - _Requirements: 8.26, 8.27, 8.28, 8.29, 8.30_

- [ ] **5. Unified Systems Integration and Admin Debug Compatibility**
  - [x] 5.1 Ensure Admin Debug Page Works with ElevenLabs Provider
    - Verify that existing admin debug components work with ElevenLabs conversations
    - Test `ContextMonitor`, `ToolCallMonitor`, and `ConversationStateInspector` with ElevenLabs adapter
    - Ensure unified transcript display shows ElevenLabs conversations correctly
    - Verify tool call monitoring displays ElevenLabs tool executions in real-time
    - Test provider switching in admin debug interface (OpenAI ↔ ElevenLabs)
    - Ensure conversation history and debug events are captured consistently for both providers
    - **Impact**: Admin debug page provides unified monitoring for both OpenAI and ElevenLabs
    - _Requirements: 14.1, 14.2, 14.3, 19.9, 19.10_

  - [ ] 5.2 Validate Unified Tool Call System Across Providers
    - Test that `UINavigationTools` work identically with both OpenAI and ElevenLabs adapters
    - Verify tool call logging uses same format and appears in unified transcript
    - Test tool result reporting works consistently across both providers
    - Ensure tool execution timing and error handling is consistent
    - Validate that admin debug page shows tool calls from both providers in same format
    - **Impact**: Ensures consistent tool execution experience regardless of voice provider
    - _Requirements: 8.11, 8.21, 8.22, 8.26_

  - [ ] 5.3 Verify Unified Conversation Logging and Analytics
    - Test that conversation logs from both providers use same data format
    - Verify server-side conversation storage works consistently for OpenAI and ElevenLabs
    - Ensure analytics and cost tracking work across both providers
    - Test conversation history retrieval and display for both providers
    - Validate that reflink attribution and budget tracking work with both providers
    - **Impact**: Ensures consistent conversation data management across all voice providers
    - _Requirements: 8.26, 8.27, 8.28, 8.29, 11.2, 11.6_

- [ ] **6. Refactor Dependencies to Remove Backend AI System References**
  - [ ] 6.1 Update UnifiedConversationManager to Use ClientAIModelManager
    - Replace AIServiceManager import with ClientAIModelManager in `unified-conversation-manager.ts`
    - Update `loadAvailableModels()` to use ClientAIModelManager.getAvailableVoiceModels()
    - Update `getAIResponse()` to use voice-appropriate model selection
    - Ensure text/hybrid conversations work with voice model configurations
    - **Impact**: Removes dependency on backend AI system while maintaining functionality
    - _Requirements: 2.9, 2.10_

  - [ ] 6.2 Update AbuseDetector to Use Lightweight Content Analysis
    - Replace AIServiceManager dependency in `abuse-detector.ts`
    - Create lightweight content analysis using pattern matching and basic heuristics
    - Remove dependency on backend AI models for abuse detection
    - Maintain security effectiveness with client-appropriate detection methods
    - **Impact**: Removes backend AI dependency while maintaining abuse protection
    - _Requirements: 21.4, 21.5, 21.6, 21.7_

  - [ ] 6.3 Clean Up Remaining Backend AI References
    - Search and remove any remaining AIServiceManager imports in client-side AI files
    - Update type imports to use voice-specific types instead of backend AI types
    - Ensure clear separation between client-side and backend AI systems
    - **Impact**: Establishes clean architectural boundaries between AI systems
    - _Requirements: Architecture separation_

- [ ] **7. Passive F-I-D Context Provider Implementation (CRITICAL - PERFORMANCE OPTIMIZATION)**

  - [x] 7.1 Create Client-Side PassiveFIDManager (CRITICAL - FOUNDATION)





    - Convert existing `src/lib/ai/ContextFrameManager.ts` from server-side to client-side implementation
    - Create `PassiveFIDManager` class with session-based caching using `Map<string, FIDContext>` storage
    - Implement `getOrFetchContext(uiState: UIState): Promise<FIDContext>` with cache-first strategy
    - Add `setUserIntent(intent: string)` for optional proactive content search functionality
    - Implement cache key generation: `${route}-${projectId}-${intentHash}` format
    - Add `clearCache(projectId?: string)` for targeted cache invalidation per project
    - Include automatic cache cleanup on session end (20min TTL) and memory management
    - Add `_fetchFromServer(uiState: UIState)` method calling `/api/ai/context/fid` endpoint
    - Implement FIDContext interface with frame/index/details structure from design document
    - **Impact**: Provides client-side F-I-D context management with intelligent caching
    - _Requirements: 6.4, 6.5, 6.6, 6.7_

  - [x] 7.2 Extend UIManager with Passive Context Integration (CRITICAL - UI STATE TRACKING)






    - Add `_passiveFIDManager: PassiveFIDManager` property to UIManager class
    - Implement `_onSignificantNavigation(newState: UIState)` to detect modal opens/closes
    - Add `_detectSignificantChange(oldState: UIState, newState: UIState): boolean` logic for:
      - Route changes (home → projects)
      - Modal opens/closes (project modal opening)
      - Project selection changes (different project modal)
    - Implement `enablePassiveContext(voiceAdapter: IConversationalAgentAdapter)` for voice session integration
    - Add `_lastUIStateHash: string` property to track meaningful navigation changes vs minor updates
    - Integrate passive context updates into existing `executeIntent()` method after navigation completes
    - Ensure context updates are non-blocking using `Promise.resolve().then()` pattern
    - Add debounced scroll/anchor updates (5 second delay) for visible content changes
    - **Impact**: Automatically triggers F-I-D context updates based on UI navigation
    - _Requirements: 4.6, 7.12, 8.26_

  - [x] 7.3 Implement OpenAI NAV_CONTEXT Pattern (CRITICAL - VOICE INTEGRATION)








    - Add `pushPassiveContext(fidContext: FIDContext)` method to OpenAIRealtimeAdapter
    - Implement `transport.sendEvent({type: "conversation.item.create"})` with NAV_CONTEXT format
    - Add conversation item replacement using `conversation.item.delete` for previous context
    - Track `_lastNavItemId` property for proper context item lifecycle management
    - Listen for `conversation.item.created` events to capture server-assigned item IDs
    - Update session instructions to include NAV_CONTEXT handling guidance for AI
    - Ensure context updates never call `response.create` (silent injection only)
    - Add metadata `{channel: "nav", kind: "frame-index-details"}` for context identification
    - **Technical Reference**: Use exact OpenAI Realtime API conversation item patterns from design document
    - **Impact**: Provides seamless passive context injection for OpenAI Realtime conversations
    - _Requirements: 8.26, 8.27, 8.28_

  - [ ] 7.4 Update F-I-D API Endpoint for Client-Side Requests (SERVER ENHANCEMENT)
    - Modify `/api/ai/context/fid/route.ts` to accept UIState parameter from client requests
    - Implement automatic project summary inclusion when projectId is present in UIState
    - Add optional intent-based content search when userIntent is provided
    - Optimize response format for client-side caching (include cache metadata)
    - Add proper error handling for missing projects or invalid UI states
    - Implement request validation and rate limiting for client-side calls
    - Ensure response includes all three F-I-D components (Frame, Index, Details)
    - **Impact**: Provides optimized server endpoint for passive F-I-D context requests
    - _Requirements: 2.1, 2.3, 6.4_

  - [ ] 7.5 Add ElevenLabs Passive Context Support (VOICE PROVIDER PARITY)
    - Research ElevenLabs equivalent of OpenAI's NAV_CONTEXT pattern for conversation context injection
    - Implement `pushPassiveContext(fidContext: FIDContext)` method in ElevenLabsAdapter
    - Add context injection mechanism compatible with @elevenlabs/client conversation management
    - Ensure passive context updates work consistently across both voice providers
    - Test context injection timing and conversation flow with ElevenLabs sessions
    - Add fallback mechanism if ElevenLabs doesn't support silent context injection
    - **Impact**: Provides unified passive context experience across OpenAI and ElevenLabs
    - _Requirements: 8.25, 8.26, 8.27_

  - [ ] 7.6 Implement Optional User Intent System (ADVANCED OPTIMIZATION)
    - Create client-side tool for AI to call: `setUserIntent(intent: string)` 
    - Add intent detection logic that allows AI to signal current user focus/interest
    - Implement intent-based proactive content search in PassiveFIDManager
    - Add configuration option to enable/disable intent-based context enhancement
    - Create intent hashing for cache key generation and context relevance
    - Add intent clearing mechanism when context changes significantly
    - Include admin controls to monitor and adjust intent system effectiveness
    - **Impact**: Enables proactive context loading based on AI-detected user interests
    - _Requirements: 2.9, 2.10, 6.9_

  - [ ] 7.7 Add Client-Side Context Caching and Memory Management (PERFORMANCE)
    - Implement session-based cache with 20-minute TTL for voice conversation duration
    - Add memory usage monitoring and automatic cache eviction for large contexts
    - Implement cache statistics and hit/miss ratio tracking for optimization
    - Add cache warming for frequently accessed projects during session initialization
    - Create cache debugging tools for admin interface to monitor cache effectiveness
    - Implement graceful degradation when cache storage limits are reached
    - Add cache persistence across page refreshes within same session
    - **Impact**: Optimizes performance through intelligent client-side caching
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [ ] 7.8 Remove Legacy F-I-D Tool Calls (CLEANUP)
    - Remove or deprecate active F-I-D tool definitions from UnifiedToolRegistry
    - Update system prompts to rely on passive context instead of active tool calls
    - Add fallback mechanism for edge cases where passive context is insufficient
    - Update admin debug interface to show passive context updates instead of tool calls
    - Test conversation flows to ensure AI adapts to passive context model
    - Remove redundant server-side F-I-D tool handlers that are no longer needed
    - **Impact**: Eliminates redundant active tool calls in favor of passive context system
    - _Requirements: Architecture cleanup_

- [ ] **8. Automatic Content Indexing System (FUTURE ENHANCEMENT)**

  - [x] 8.1 Implement Automatic Vector Index Building on Project Updates




    - Convert `scripts/setup-vector-indexes.ts` to production service
    - Add database triggers or API hooks to rebuild indexes when projects are updated
    - Implement incremental indexing for individual project updates vs full rebuilds
    - Add index health monitoring and automatic repair mechanisms
    - **Impact**: Ensures vector search indexes stay current with content changes
    - _Requirements: 2.2, 2.3_

  - [ ] 8.2 Implement Automatic Semantic Project Decomposition
    - Convert `scripts/test-hybrid-content-ingestion.ts` to production pipeline
    - Add automatic content tier generation (T0-T4) when projects are saved
    - Implement per-project cache invalidation when content is updated
    - Add content analysis and semantic chunking for improved search relevance
    - **Impact**: Automatically maintains semantic content structure for AI consumption
    - _Requirements: 2.1, 2.2, 6.2_stem integration_

    - [x] 7.1 Implement Lightweight UI State Tracking with Background Updates
    - Read existing-tool-system-architecture-analysis.md for context
    - Create `src/lib/navigation/UIStateManager.ts` with breadcrumb-based state tracking
    - Implement `getCurrentUIState()` returning breadcrumbPath, visibleAnchors, and activeFilters
    - Add debounced state updates: scroll (10s), search/filter (5s), navigation (immediate)
    - Create `sendBackgroundResult()` using OpenAI's backgroundResult for non-interrupting updates
    - Implement visible anchor detection with intersection observer and change detection
    - Add breadcrumb path generation from current route and modal stack
    - Create state serialization for server tool call context inclusion
    - **Impact**: Keeps AI aware of user context without interrupting conversation flow
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 7.3_

  - [x] 7.2 Create Unified UI Management System (UIManager)
    - Read existing-tool-system-architecture-analysis.md for context
    - Create `src/lib/navigation/UIManager.ts` with goal-based navigation planning and UI state description
    - Implement `executeIntent(params: UIIntentParams)` with step sequencing and error handling
    - Add navigation planning logic: analyze current state → determine required steps → execute sequence
    - Implement timeout handling, ready-state detection, and retry logic for navigation steps
    - Add idempotency support to prevent duplicate navigation actions
    - Create navigation affordance detection (what transitions are possible from current state)
    - **Impact**: Enables single-call navigation goals instead of multi-step tool sequences
    - When finished with the task - add new context to existing-tool-system-architecture-analysis.md
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 7.3_

    - [x] 7.3 Consolidate UI State Management into UIManager
    - **CONSOLIDATION**: Merge UIStateManager functionality into UIManager for unified state management
    - **Migration**: Move breadcrumb-based state tracking from UIStateManager.ts into UIManager.describe()
    - **Integration**: Combine getCurrentUIState() logic with UIManager's existing state detection
    - **Background Updates**: Implement debounced state updates within UIManager (scroll 5s, filter 5s, navigation immediate)
    - **State Serialization**: Add state serialization methods to UIManager for server tool context
    - **Cleanup**: Remove separate UIStateManager.ts file after migration to avoid duplication
    - **Impact**: Single source of truth for all UI state management and navigation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 7.3_

  - [x] 7.4 Implement ui.navigate and ui.describe Client Tools with Full AI Integration
    - Add `ui.navigate` tool to `UINavigationTools.ts` using UIManager.executeIntent()
    - Add `ui.describe` tool to `UINavigationTools.ts` using UIManager.describe()
    - Implement semantic ID resolution (map user-friendly names to stable IDs)
    - Add navigation result reporting with performed steps and final state
    - Integrate with existing highlighting and modal systems
    - **Tool Registry Integration**: Register `ui.intent` and `ui.describe` in UnifiedToolRegistry as client-execution tools
    - **Tool Definitions**: Create proper UnifiedToolDefinition entries with comprehensive parameter schemas and descriptions
    - **Voice Adapter Integration**: Ensure both OpenAI and ElevenLabs adapters can access and execute the new navigation tools
    - **AI Instructions**: Update system prompts/instructions to guide AI agents on when and how to use declarative navigation
    - **Testing**: Verify AI agents can successfully discover, understand, and execute ui.intent/ui.describe tools
    - **Impact**: Provides fully integrated declarative navigation interface that AI agents can immediately use
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 7.3_

  - [X] 7.5 Migrate Existing Navigation to Declarative System and Establish Tool Hierarchy
    - **Primary Tool Refactoring**: Make `ui.navigate` the primary high-level navigation tool exposed to AI agents
    - **Legacy Tool Conversion**: Convert existing direct-action tools (`openProjectModal`, `navigateToProject`, `scrollToSection`) into internal helpers for UIManager
    - **Tool Hierarchy Enforcement**: Reserve step-by-step tools (`navigateTo`, `scrollIntoView`, `highlightText`) strictly for low-level recovery scenarios and debugging
    - **Voice Adapter Updates**: Update voice adapters to use `ui.navigate` as the default navigation method, with fallback to primitives only on UIManager failure
    - **Admin Interface**: Update admin debug interface to show declarative navigation events and orchestrator decision-making
    - **Testing**: Test navigation flows across different UI states and routes, ensuring "one UIManager, many primitives" principle
    - **Impact**: Establishes clear tool hierarchy with ui.navigate as primary interface and primitives as internal helpers
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 7.3_

  - [x] 7.6 Implement Semantic ID Registry System
    - Create `src/lib/navigation/SemanticIDRegistry.ts` for mapping stable IDs to DOM locators
    - Define registry structure: `{ [semanticId: string]: { selector: string; aliases: string[]; context?: string } }`
    - Implement registry population during component mounting using `data-semantic-id` attributes
    - Add automatic registry updates when components mount/unmount or route changes
    - Create semantic ID resolution for user-friendly names (e.g., "contact" → "section:contact")
    - Add registry validation and conflict detection for duplicate semantic IDs
    - Integrate registry with UIManager for reliable element targeting
    - **UIManager Integration Requirements**:
      - Create `SemanticIDRegistry` that implements `ContentProvider` interface from UIManager
      - Registry should provide `discoverSections()` method for UIManager's dynamic section discovery
      - Ensure semantic IDs have fallback to regular IDs for navigation (use `fallbackId` in navigation targets)
      - Add semantic ID validation to UIManager's navigation planning via `validateSection()` method
      - Register the semantic registry with UIManager using `registerContentProvider()`
      - Test: UIManager should work with and without semantic registry (graceful degradation)
    - **Impact**: Provides stable, maintainable mapping between semantic navigation targets and actual DOM elements
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 7.3_

  - [X] 7.7 Verify Complete AI Agent Integration and Tool Awareness
    - **End-to-End Testing**: Test that AI agents can successfully use `ui.intent` for complex navigation scenarios
    - **Tool Discovery Verification**: Confirm AI agents receive proper tool definitions and understand their capabilities
    - **System Prompt Integration**: Verify AI agents have appropriate instructions for using declarative navigation over step-by-step tools
    - **Cross-Provider Testing**: Test declarative navigation works identically across OpenAI Realtime and ElevenLabs adapters
    - **Fallback Behavior**: Verify AI agents gracefully handle navigation failures and use appropriate recovery strategies
    - **Debug Interface Validation**: Confirm admin debug interface properly displays declarative navigation events and tool calls
    - **Performance Verification**: Ensure declarative navigation reduces total tool calls compared to step-by-step approach
    - **Impact**: Guarantees AI agents are fully aware of and properly using the new declarative navigation system
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 7.3, 8.11, 8.21, 8.22, 8.26_

- [ ] **8. Hierarchical Content System with Vector Search (CRITICAL - F-I-D PATTERN)**

  - [x] 8.0 Analyze Existing Content and Database Architecture (PREREQUISITE - PREVENT DUPLICATION)
    - **Database Schema Review**: Study existing Prisma models and database structure to understand current content storage
    - **Content Service Analysis**: Review existing content management services and APIs to identify integration points
    - **Backend Service Integration**: Analyze BackendToolService to understand how to add content tools without creating redundant services
    - **API Endpoint Review**: Study existing API routes to determine where content search/retrieval endpoints should be added
    - **Context System Analysis**: Review existing context injection and management systems to avoid duplicating functionality
    - **Tool Registry Integration**: Understand how to add content.search/content.get tools to existing UnifiedToolRegistry
    - **Caching System Review**: Analyze existing caching patterns to integrate with rather than replace current systems
    - **Performance Considerations**: Study current database query patterns and optimization strategies
    - **Impact**: Ensures content system integrates with existing architecture and leverages current infrastructure
    - _Requirements: Architecture consistency, database integration_

  - [x] 8.1 Create Database Schema for Hierarchical Content Storage
    - Add Prisma models for `ContextChunk` and `ContentEntity` with pgvector support
    - Implement T0-T4 tier structure in database schema
    - Add vector embedding column with proper indexing for semantic search
    - Create content ingestion pipeline for existing portfolio content
    - Add content versioning and update tracking
    - Create database migration and seed scripts
    - **Impact**: Provides foundation for semantic content search and tiered context management
    - Analysis results from the previous task are in existing-content-database-architecture-analysis.md
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4_

  - [x] 8.2 Implement Hybrid Content Ingestion and Embedding Pipeline
    - Create `src/lib/content/ContentIngestionService.ts` with hybrid tier generation strategy
    - Implement user-defined section marker parsing (`<!-- T1: ... -->`, `<!-- T2: ... -->`, `<!-- T3: ... -->`)
    - Add automatic tier generation fallback using OpenAI API when markers are missing
    - Implement tier override logic: user markers take precedence over auto-generation
    - Add OpenAI embedding generation using `text-embedding-3-small` model for all tiers
    - Create content chunking logic for T4 tier (200-400 tokens with overlap)
    - Implement batch processing with progress tracking and cost estimation for auto-generation
    - Add content update detection and incremental re-processing with tier change detection
    - **UIManager Integration Requirements**:
      - Content ingestion should emit events when new sections are discovered during processing
      - UIManager should listen for `content-updated` events and refresh section cache using `_sectionCache.clear()`
      - Add content change detection to trigger navigation affordance updates via `_updateNavigationAffordances()`
      - Ensure ingestion doesn't break existing navigation during updates (graceful degradation)
      - Emit `sections-discovered` events that UIManager can listen to for real-time section registry updates
      - Test: Navigation should work during content ingestion process without interruption
    - **Impact**: Provides flexible content tier generation with user control and automatic fallbacks
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4_

  - [x] 8.3 Create Content Search and Retrieval Service





    - Create `src/lib/content/ContentSearchService.ts` with hybrid search (semantic + metadata)
    - Implement `searchContent(query, scope, k, maxTier)` with pgvector cosine similarity
    - Add metadata filtering by tags, tech stack, project type, and date ranges
    - Implement MMR (Maximal Marginal Relevance) for result diversification
    - Add result ranking with relevance scoring and facet extraction
    - Create content retrieval with token budget management
    - **UIManager Integration Requirements**:
      - Implement content search as a `ContentProvider` for UIManager's pluggable section discovery
      - Add `navigateToContent(query)` method to UIManager using search service for AI-driven navigation
      - Handle search failures gracefully with fallback navigation to prevent broken user experience
      - Add content-aware transitions to UIManager's `describe()` method for richer AI context
      - Implement `searchContent()` method in ContentProvider interface for UIManager integration
      - Test: Search-based navigation should degrade gracefully if search service fails or returns no results
    - **Impact**: Provides semantic content discovery for AI agents with controlled context loading
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4_

  - [x] 8.4 Implement Stateless content.search and content.get Server Tools





    - Add `content.search` tool to BackendToolService accepting `uiState` parameter for context-aware search
    - Add `content.get` tool for fetching specific content by ID with token limits and UI state context
    - Implement result formatting with navigation targets compatible with current UI state
    - Add stateless caching using request-scoped cache (no persistent server state)
    - Integrate with reflink-based access control using request-provided reflink ID
    - Create UI state-aware result ranking (prioritize content relevant to current route/project)
    - Implement comprehensive error handling with UI state context in error messages
    - **Impact**: Enables context-aware content discovery while maintaining server statelessness
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4_

  - [x] 8.5 Implement F-I-D Context Management Pattern





    - Create `src/lib/ai/ContextFrameManager.ts` implementing Frame/Index/Details pattern
    - Implement Frame loading (≤400 tokens): system rules, voice settings, routing primer
    - Implement Index loading (≤400-600 tokens): route-aware metadata and project summaries
    - Implement Details loading (≤1000 tokens): on-demand content via content.search/content.get
    - Add context swapping logic based on current route and modal state
    - Create context budget management and automatic tier escalation
    - **UIManager Integration Requirements**:
      - F-I-D context should influence UIManager's section discovery via enhanced `NavigationContext`
      - Add context-aware navigation planning based on user's focus/interest/domain from F-I-D pattern
      - Integrate F-I-D context into UIManager's `describe()` response for AI with `fidContext` field
      - Ensure F-I-D context updates don't interrupt ongoing navigation (async context loading)
      - Add `fidContext` to `NavigationContext` interface for content providers to use
      - Test: Navigation should work with and without F-I-D context (graceful degradation)
    - **Impact**: Provides efficient context management for AI agents with controlled token usage
    - PS: Keep in mind that to work with pgvector we use raw sql queries at the moment
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] **9. Conversation Monitoring by ID System**
  - [ ] 7.1 Enhance Database Storage for Voice Conversations with Unified Session IDs
    - Implement unified session ID strategy across voice adapters using `contextId` from AdapterInitOptions as primary identifier
    - Store complete session ID mapping (unified + provider-specific + generated IDs) for full traceability
    - Update voice adapters to use unified session ID for all conversation logging and reporting
    - Implement actual database storage in `/api/ai/conversation/log` route (currently only logs to console)
    - Add batch saving logic: save conversation data on session end + 5-minute intervals during active sessions
    - Add conversation retrieval by unified session ID with full transcript and tool call history
    - **Key files**: `OpenAIRealtimeAdapter.ts`, `ElevenLabsAdapter.ts`, `conversation/log/route.ts`, session API routes
    - **Impact**: Enables persistent storage of voice conversations with unified session identification for cross-provider monitoring
    - _Requirements: 14.1, 14.2, 14.3, 8.26, 8.27, 8.28_

  - [ ] 7.2 Create Unified Conversation Monitor Provider
    - Create ConversationMonitorProvider React context to manage conversation ID state across all monitoring components
    - Implement conversation ID selector with manual input, recent sessions dropdown, and current session option
    - Add manual refresh controls (no auto-refresh timers) with optional auto-refresh checkbox for real-time monitoring
    - Integrate with existing UnifiedConversationManager debug methods and conversation debug API
    - Update existing monitoring components to use shared conversation ID state instead of individual inputs
    - **Key files**: New `ConversationMonitorProvider.tsx`, `ContextMonitor.tsx`, `ToolCallMonitor.tsx`, `VoiceDebugInterface.tsx`
    - **Impact**: Enables monitoring any conversation by ID with clean, manual control over refresh behavior
    - _Requirements: 14.1, 14.2, 19.9, 19.10_

  - [ ] 7.3 Add Server-Sent Events for Real-time Monitoring
    - Create SSE endpoint for streaming real-time debug events for specific conversation IDs
    - Subscribe to debugEventEmitter events and filter by conversation ID (unified session ID)
    - Extend existing conversation debug API to support SSE alongside JSON responses
    - Implement client-side EventSource connection in ConversationMonitorProvider for real-time updates
    - Add graceful fallback to polling if SSE connection fails
    - Ensure compatibility with existing UnifiedConversationManager and debug systems
    - **Key files**: New `conversation/[id]/events/route.ts`, extend `conversation/debug/route.ts`, update `ConversationMonitorProvider`
    - **Impact**: Enables real-time monitoring of conversations by ID without breaking existing functionality
    - _Requirements: 14.1, 14.2, 16.1, 16.2, 16.3_

  - [ ] 7.4 Refactor Admin Voice Debug Interface
    - Remove duplicate monitoring components (keep upper section, remove expandable duplicates)
    - Integrate ConversationMonitorProvider to provide unified conversation ID control across all components
    - Update ContextMonitor and ToolCallMonitor to work with real conversation data instead of mock data
    - Add conversation source indicators: manual ID input, recent sessions dropdown, current session option
    - Remove individual "start monitoring" buttons and conversation ID inputs from each component
    - Ensure all monitoring components use the same conversation ID from the shared provider
    - **Key files**: `VoiceDebugInterface.tsx`, `voice-debug/page.tsx`, `ContextMonitor.tsx`, `ToolCallMonitor.tsx`
    - **Impact**: Creates clean, unified monitoring interface that works with actual voice conversation data
    - _Requirements: 14.1, 14.2, 14.3, 19.9, 19.10_date Admin Monitoring Components for Server-Side Data
    - Modify ContextMonitor, ToolCallMonitor, ConversationStateInspector components
    - Replace direct client state reading with server-side debug data fetching
    - Fetch initial data from `/api/admin/debug/conversation/[conversationId]` GET endpoint
    - Subscribe to `/api/admin/debug/conversation/[conversationId]/stream` for real-time updates
    - Refactor useToolCallMonitoring and useContextMonitoring to use server streams
    - **Impact**: Admin debug dashboard provides accurate, persistent insights into actual conversations
    - _Requirements: 14.1, 14.2, 14.3, 19.9, 19.10_

  - [ ] 7.4 Redefine Conversation Log as Telemetry Endpoint
    - Modify `src/app/api/ai/conversation/log/route.ts` for granular telemetry events
    - Rename to `/api/ai/telemetry/log` to reflect new purpose
    - Create AIDebugEvent Prisma model for storing client-side debug events
    - Update ConversationalAgentContext.logTranscriptToServer for telemetry events
    - Capture client-side connection status, tool executions, audio processing, errors
    - **Impact**: Lightweight, non-blocking channel for client-side debugging telemetry
    - _Requirements: 8.26, 8.29, 15.5, 16.4_

- [ ] **8. Complete Missing Infrastructure Components**
  - [x] 8.1 Create Provider-Specific Admin Configuration Interfaces





    - Create base admin page at `/admin/ai/voice-config` with provider selection and configuration list
    - Build `OpenAIRealtimeConfigPanel` component using OpenAI serializer's JSON schema for dynamic form generation
    - Build `ElevenLabsConfigPanel` component using ElevenLabs serializer's JSON schema for dynamic form generation
    - Implement configuration validation, preview, and testing functionality using provider serializers
    - Add configuration management: create, edit, delete, clone, set as default
    - Add configuration export/import with validation for backup and deployment
    - **Admin Integration**: MUST use AdminLayout, add to AdminSidebar, follow `/admin/ai/voice-config` route pattern
    - **Impact**: Enables dynamic, provider-specific voice AI configuration without code changes
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 8.2 Implement Public Access Settings Persistence
    - Define AIPublicAccessSettings Prisma model for configuration storage
    - Implement `src/lib/services/ai/public-access-manager.ts` database methods
    - Add loadSettingsFromDatabase() and saveSettingsToDatabase() methods
    - Connect with AIPublicAccessSettings model for dynamic configuration
    - **Impact**: Public AI access can be dynamically configured from database
    - _Requirements: 16.1, 17.1, 17.7, 17.10_

  - [ ] 8.3 Complete WebRTC Transport Implementation
    - Implement `src/lib/services/ai/conversation-transport.ts` WebRTCConversationTransport.sendMessage()
    - Handle text messages and structured tool calls over WebRTC data channel
    - Add proper error handling and connection management
    - **Impact**: Fully enables WebRTC transport for non-audio message communication
    - _Requirements: 15.10_

- [X] **9. Foundation Tasks: Context Management System**
  - [X] 9.1 Build project indexing system
    - Create ProjectIndexer service to generate searchable summaries on project save
    - Implement section-based indexing tied to Rich Content System's Tiptap structure
    - Build keyword and topic extraction from project content using Rich Content System APIs
    - Add automatic index regeneration when projects are updated
    - **Integration**: Connect with Rich Content System for content analysis and Media Management System for media context
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [X] 9.2 Implement context manager
    - Create ContextManager service for intelligent context building
    - Implement context caching per session (15-minute TTL)
    - Add context size optimization to manage token limits
    - Build content prioritization based on query relevance
    - **Integration**: Use Data & API Layer for public project access and portfolio owner profile information
    - _Requirements: 2.4, 2.5, 6.4, 6.5_

  - [X] 9.3 Create flexible content source system
    - Design pluggable architecture for new content sections (resume, about, etc.)
    - Implement enable/disable toggles for context sources
    - Add automatic inclusion of new content types in context system
    - Build content source management interface for admin
    - **Integration**: Connect with Data & API Layer for content source management and admin interfaces
    - _Requirements: 2.6, 2.7_

- [X] **10. Foundation Tasks: Security and Rate Limiting**
  - [X] 10.1 Implement rate limiting system
    - Create per-IP and per-session rate limiting with daily limits
    - Build reflink-based access control with different rate tiers
    - Implement rate limit status tracking and user feedback
    - Add automatic rate limit reset and monitoring
    - **Integration**: Use AI System's shared infrastructure for consistent rate limiting patterns
    - _Requirements: 5.1, 6.1_

  - [X] 10.2 Build enhanced reflink management system (UPDATED REQUIREMENTS)
    - Create unique reflink codes (hash-based or custom) for individual recipients
    - Implement admin interface with recipient name, custom context notes, token limits, and spend limits
    - Add budget tracking for LLM + voice costs per reflink with remaining balance display
    - Build reflink validation with expiration and budget checking
    - Add personalized welcome messages and budget exhausted notifications
    - Create cost tracking and analytics per reflink with usage breakdowns
    - **Admin Integration**: MUST use AdminLayout, add to AdminSidebar, follow /admin/ai/reflinks route pattern
    - **Integration**: Connect with Data & API Layer for admin interfaces and cost tracking
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [X] 10.3 Implement reflink detection and session management
    - Create URL parameter detection for reflink codes (e.g., ?ref=abc123)
    - Build reflink validation service with database lookup and budget checking
    - Implement session-based reflink context storage with browser refresh persistence
    - Add personalized welcome messages with recipient name and custom context
    - Create graceful degradation when reflinks expire or budgets are exhausted
    - Build public AI access control based on admin settings (disabled/basic/limited)
    - Add appropriate messaging for different access levels and reflink states
    - **Integration**: Connect with session management and AI feature gating systems
    - _Requirements: 5.2, 5.3, 5.4, 5.6, 16.1, 16.4, 16.5, 16.6, 16.7, 16.10, 17.1, 17.2_

  - [X] 10.4 Create abuse detection and blacklist system
    - Implement content analysis for spam and inappropriate queries
    - Build automatic warning system (first violation) and IP blocking (second violation)
    - Add admin-accessible blacklist with reinstatement options
    - Create notification system for portfolio owner to know about security violations
    - **Integration**: Use AI System's shared utilities for content analysis and validation
    - _Requirements: 21.4, 21.5, 21.6, 21.7_

- [ ] **7. Hybrid Serverless Conversation System: Unified Voice Agent**
  - [X] 7.1 Build PRODUCTION Unified Voice Agent Architecture (REAL IMPLEMENTATION REQUIRED, some subtasks were previously finished but additinal context was added)
    - **CRITICAL**: This task requires REAL implementation with actual voice AI providers - NO MOCKS ALLOWED
    - **Architecture**: Implement provider-agnostic interface with dynamic switching between OpenAI Realtime and ElevenLabs Conversational AI
    - **Sub-tasks**:
      - [ ] 7.1.1 Create Core Voice Agent Types and Interfaces:
        - Create unified types for voice agent state, transcript items, and provider metadata
        - Define IConversationalAgentAdapter interface for provider abstraction
        - Implement AdapterInitOptions with callbacks for connection events and transcript updates
        - Build unified audio element management for consistent playback across providers
        - Create provider-agnostic session status and connection state types
        - **Files**: `src/types/voice-agent.ts`, `src/lib/voice/IConversationalAgentAdapter.ts`
        - _Requirements: 8.25_
      - [ ] 7.1.2 Implement OpenAI Realtime Adapter (Based on Actual SDK Analysis):
        - **CRITICAL**: Use actual `@openai/agents/realtime` SDK with proper `RealtimeAgent` and `RealtimeSession` patterns
        - Install required packages: `npm install @openai/agents zod@3 uuid @types/uuid`
        - Create client-side `RealtimeAgent` with tool definitions using `tool()` function from SDK
        - Implement client-side UI navigation tools with direct execution (no `needsApproval: true`)
        - Implement client-side backend API tools that make fetch calls to server endpoints
        - Create `RealtimeSession` with proper configuration including guardrails and audio settings
        - Set up comprehensive event listeners: `history_updated`, `tool_approval_requested`, `guardrail_tripped`, `audio`, `transport_event`
        - Implement auto-approval flow for seamless UX (automatically approve all tool calls)
        - Process `RealtimeItem[]` arrays from `history_updated` events for conversation tracking
        - Use `WavRecorder` and `WavStreamPlayer` for proper audio handling
        - **Verification**: Must establish real WebRTC connections to `api.openai.com/v1/realtime`
        - **Files**: `src/lib/voice/OpenAIRealtimeAdapter.ts`, `src/hooks/useRealtimeSession.ts`
        - _Requirements: 8.2, 8.3, 8.5, 8.14, 8.18, 8.19, 8.20, 8.24_
      - [ ] 7.1.3 Implement ElevenLabs Conversational AI Adapter (Updated for @elevenlabs/client):
        - **CRITICAL**: Use actual `@elevenlabs/client` library for native client-side tool support and WebRTC connections
        - Install required packages: `npm install @elevenlabs/client` (replace any existing @elevenlabs/react)
        - Refactor ElevenLabsAdapter to use `Conversation.startSession()` from `@elevenlabs/client`
        - Implement native client-side tool execution via `clientTools` object registration
        - Update server-side token endpoint to return `overrides` object with server-injected context and voice settings
        - Update server-side token endpoint to return `clientToolsDefinitions` for dynamic tool registration
        - Implement `_createClientToolsForElevenLabs()` method to convert tool definitions into executable functions
        - Set up proper event handlers: `onConnect`, `onDisconnect`, `onMessage`, `onError`, `onModeChange`
        - Handle connection lifecycle: request microphone permission before `startSession`, proper cleanup on disconnect
        - Implement conversation transcript capture and reporting to server for debugging and analytics
        - **Key Advantage**: Native tool calling support with immediate execution and automatic result reporting to agent
        - **Verification**: Must establish real WebRTC connections to ElevenLabs platform with working tool execution
        - **Files**: `src/lib/voice/ElevenLabsAdapter.ts`, remove `src/hooks/useElevenLabsConversation.ts` and `src/components/voice/ElevenLabsVoiceProvider.tsx`
        - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.11, 8.13, 8.14, 8.18, 8.19, 8.20, 8.24, 8.26_
      - [ ] 7.1.4 Build ConversationalAgentProvider Context:
        - Create React Context Provider for global voice agent state management
        - Implement state management for activeProvider, connection status, and transcript items
        - Build adapter lifecycle management with automatic cleanup and re-initialization
        - Add unified asynchronous logging to server via HTTP POST requests
        - Integrate with existing ContextProviderService for context awareness
        - **Integration**: Core orchestration layer for all voice interactions
        - **Files**: `src/contexts/ConversationalAgentContext.tsx`, `src/contexts/TranscriptContext.tsx`
        - _Requirements: 8.1, 8.26_
      - [ ] 7.1.5 Create UINavigationTools System:
        - Create client-side JavaScript functions for UI manipulation (navigateTo, showProjectDetails, scrollIntoView)
        - Implement tool registration system with ConversationalAgentProvider
        - Build immediate tool execution without server round-trips
        - Add tool result reporting back to AI providers for conversation continuity
        - Create error handling and fallback for failed tool executions
        - **Integration**: Direct UI manipulation capabilities for voice agents
        - **Files**: `src/lib/voice/UINavigationTools.ts`, `src/hooks/useNavigationTools.ts`
        - _Requirements: 7.1, 8.5, 8.11, 8.21, 8.22, 9.1, 9.3_
      - [ ] 7.1.6 Implement useConversationalAgent Hook:
        - Create primary hook for React components to interact with voice agents
        - Expose all state variables and functions from ConversationalAgentProvider
        - Build provider selection and agent switching capabilities
        - Add conversation management functions (connect, disconnect, sendMessage)
        - Implement voice input controls (startVoiceInput, stopVoiceInput)
        - **Integration**: Main interface for UI components to access voice functionality
        - **Files**: `src/hooks/useConversationalAgent.ts`
        - _Requirements: 8.1_
      - [ ] 7.1.7 Build Next.js API Routes (Enhanced with Context Injection):
        - Implement POST `/api/ai/openai/session` for ephemeral OpenAI client_secret generation with server-side context injection
        - Use OpenAI's `client_secrets` API to inject system prompts and tool definitions into session configuration
        - Create GET `/api/ai/elevenlabs/token` for ElevenLabs conversation token generation using actual demo pattern
        - Build POST `/api/ai/conversation/log` for asynchronous client-side logging with conversation history
        - Add GET `/api/ai/elevenlabs/agents` for ElevenLabs agent management using their SDK
        - Implement context filtering and access control based on reflink permissions
        - **Integration**: Secure server-side token generation with comprehensive context injection
        - **Files**: `src/app/api/ai/openai/session/route.ts`, `src/app/api/ai/elevenlabs/token/route.ts`, `src/app/api/ai/conversation/log/route.ts`
        - _Requirements: 8.6, 8.29, 10.3_
    - **Technical Verification Requirements**:
      - Browser requests microphone permission for real audio capture
      - Network tab shows real API calls to OpenAI/ElevenLabs endpoints
      - Actual audio streams to AI provider APIs (not mock data)
      - Real AI voice responses play through speakers (not browser TTS)
      - Live transcripts show actual AI responses with real timestamps
      - Tool calls execute real UI changes immediately
      - Provider switching works seamlessly between OpenAI and ElevenLabs
      - No mock responses, simulations, or fake implementations exist
    - **Package Installation Requirements**:
      - MUST install for OpenAI: `npm install @openai/agents zod@3 uuid @types/uuid`
      - MUST install for ElevenLabs: `npm install @elevenlabs/client`
      - MUST use real SDK imports: `import { RealtimeAgent, RealtimeSession, tool } from '@openai/agents/realtime'`
      - MUST use real ElevenLabs imports: `import { useConversation } from '@elevenlabs/react'`
    - **Integration Requirements**:
      - MUST integrate with existing ContextProviderService for context injection
      - MUST connect with ReflinkService for access control and personalization
      - MUST report conversation transcripts to server for analytics and storage
      - MUST work with existing UI System components and navigation
    - When finished - create a git commit, then fix build issues and make another git commit "Fixed build issues"
    - _Requirements: 8.1, 8.2, 8.3, 8.6, 8.11, 8.14, 8.16, 8.17, 8.20, 8.21, 8.22, 8.23, 8.24, 8.25_

  - [X] 7.2 Build PRODUCTION Voice Debug & Testing System (REAL VOICE AI REQUIRED)
    - **CRITICAL**: This task requires REAL voice AI implementation - users must be able to actually talk to AI models
    - **Implementation Type**: ✅ Production Implementation (real voice conversations, real AI responses)
    - **End-User Experience Requirements**:
      - ✅ Admin can actually speak into microphone and have voice conversations with AI
      - ✅ Real AI voice responses play through speakers (not browser TTS)
      - ✅ Live transcripts show actual AI responses from OpenAI/ElevenLabs
      - ✅ Voice provider testing validates real WebRTC/WebSocket connections
      - ❌ NO "test" buttons that just show mock responses
      - ❌ NO browser TTS - only real AI voice responses
    - **Sub-tasks**:
      - [ ] 7.2.1 Create Admin Voice Debug Interface:
        - Create admin debug page at `/admin/ai/voice-debug` using AdminLayout and AdminPageLayout
        - Add proper sidebar navigation entry under "AI Assistant" section
        - Implement actual voice conversation testing with OpenAI Realtime and ElevenLabs
        - Add real-time transcript display showing actual AI responses (not mock text)
        - Build voice provider selection that connects to real APIs from task 7.1
        - Enable admin to have actual voice conversations with AI models for testing
        - **Admin Integration**: MUST use AdminLayout, add to AdminSidebar, follow `/admin/ai/voice-debug` route pattern
        - **Verification**: Admin can speak and hear real AI voice responses, not simulated ones
        - **Files**: `src/app/admin/ai/voice-debug/page.tsx`, `src/components/admin/VoiceDebugInterface.tsx`
        - _Requirements: 19.1, 19.2, 19.5, 19.6, 19.8_
      - [ ] 7.2.2 Implement Voice Provider Connection Testing:
        - Build provider connection testing that validates real WebRTC/WebSocket connections
        - Test actual microphone access and audio streaming to AI providers
        - Verify real ephemeral token generation and authentication
        - Add connection diagnostics for real API endpoints
        - Display real connection status and audio quality metrics
        - **Verification**: Connection tests validate real API connectivity, not mock responses
        - **Files**: `src/components/admin/VoiceConnectionTester.tsx`, `src/lib/voice/connectionDiagnostics.ts`
        - _Requirements: 14.4, 14.9_
      - [ ] 7.2.3 Build Real Conversation Transcript Collection:
        - Build TranscriptService that collects actual conversation transcripts from real AI interactions
        - Store real conversation data from OpenAI Realtime and ElevenLabs sessions
        - Implement real-time transcript display during actual voice conversations
        - Add conversation metadata from real AI provider responses
        - Build conversation replay using actual recorded AI interactions
        - **Verification**: Transcripts contain real AI responses, timestamps, and provider metadata
        - **Files**: `src/services/TranscriptService.ts`, `src/components/admin/ConversationTranscripts.tsx`
        - _Requirements: 8.26, 8.27, 8.28, 9.1, 9.3, 9.4_
      - [ ] 7.2.4 Create Voice Session Analytics Dashboard:
        - Track real usage metrics from actual voice AI sessions
        - Monitor real API costs and token usage from OpenAI/ElevenLabs
        - Analyze real conversation quality and AI response times
        - Build dashboard showing actual voice session performance
        - Export real conversation data for analysis
        - **Admin Integration**: MUST use AdminLayout, add to AdminSidebar, follow `/admin/ai/voice-analytics` route pattern
        - **Verification**: Analytics show real API usage, costs, and performance metrics
        - **Files**: `src/app/admin/ai/voice-analytics/page.tsx`, `src/components/admin/VoiceAnalyticsDashboard.tsx`
        - _Requirements: 11.3, 11.6, 11.7, 11.8, 11.9, 11.10_
    - **Technical Verification Checklist**:
      - Admin debug interface requests microphone permission
      - Real audio streams to OpenAI/ElevenLabs APIs (visible in network tab)
      - Actual AI voice responses play through speakers
      - Live transcripts show real AI responses, not mock text
      - Voice provider testing validates real API connections
      - Conversation history contains actual AI interactions
      - No mock responses or simulated conversations
      - Admin can have real voice conversations with AI models
    - **Integration Requirements**:
      - MUST use real voice providers implemented in task 7.1
      - MUST integrate with AdminLayout and AdminSidebar
      - MUST connect to real conversation storage and analytics systems
      - MUST follow admin route patterns and use existing admin components
    - When finished - create a git commit, then fix build issues and make another git commit "Fixed build issues"
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10_

  - [X] 7.3 Enhance Voice Debug Interface with Comprehensive Context and Tool Call Monitoring
    - **CRITICAL**: Enhance existing voice debug interface to provide complete visibility into AI context and tool execution
    - **Purpose**: Enable comprehensive debugging of voice AI integration using real client-side endpoints
    - **Sub-tasks**:
      - [ ] 7.3.1 Implement Real-Time Context Monitoring:
        - Add context inspection panel that shows all context being sent to AI models during conversations
        - Display system prompts including injected context and instructions from ContextProviderService
        - Show context filtering results based on access level and reflink permissions
        - Add context source breakdown (projects, profile, reflink context, etc.)
        - Implement real-time context updates as conversations progress
        - **Files**: `src/components/admin/ContextMonitor.tsx`, `src/hooks/useContextMonitoring.ts`
        - _Requirements: 14.1, 14.3, 10.1_
      - [ ] 7.3.2 Build Tool Call Debug Interface:
        - Create tool call monitoring panel that shows all MCP tool calls in real-time
        - Display tool call requests with parameters, execution time, and results
        - Show navigation tool executions (openProjectModal, scrollToSection, highlightText)
        - Add context loading tool calls to server APIs
        - Implement tool call success/failure indicators with error details
        - **Files**: `src/components/admin/ToolCallMonitor.tsx`, `src/hooks/useToolCallMonitoring.ts`
        - _Requirements: 14.2, 14.3, 17.2, 17.3, 17.4, 17.5, 17.6, 17.10_
      - [ ] 7.3.3 Integrate Production Client Endpoints:
        - Ensure debug interface uses same client-side endpoints as production
        - Test context loading via `/api/ai/context` endpoint with real filtering
        - Validate MCP tool execution through production navigation tools
        - Verify voice provider integration uses production token endpoints
        - Add endpoint response monitoring and validation
        - **Files**: Update existing `VoiceDebugInterface.tsx`, add endpoint validation utilities
        - _Requirements: 14.4, 14.6, 14.9, 14.10_
      - [ ] 7.3.4 Add Conversation State Visualization:
        - Create conversation state inspector showing connection status, session state, and audio state
        - Display real-time conversation metadata and provider information
        - Show conversation history with context and tool call correlation
        - Add conversation export with complete debug information
        - Implement conversation replay with context and tool call timeline
        - **Files**: `src/components/admin/ConversationStateInspector.tsx`, `src/services/ConversationDebugService.ts`
        - _Requirements: 14.3, 14.5, 19.7_
      - [ ] 7.3.5 Build Integration Validation Dashboard:
        - Create validation dashboard that tests all integration points
        - Validate ContextProviderService integration and context filtering
        - Test MCP navigation tools and server communication
        - Verify voice adapter functionality with real AI providers
        - Add integration health checks and status indicators
        - **Files**: `src/components/admin/IntegrationValidator.tsx`, `src/lib/validation/integrationTests.ts`
        - _Requirements: 14.4, 14.10_
    - **Technical Requirements**:
      - MUST use existing ConversationalAgentProvider and voice adapters from task 7.1
      - MUST integrate with real ContextProviderService for context monitoring
      - MUST use production client-side endpoints for accurate testing
      - MUST provide real-time monitoring without affecting voice performance
      - MUST export complete debug data for analysis and troubleshooting
    - **Integration Requirements**:
      - MUST enhance existing `/admin/ai/voice-debug` page without breaking current functionality
      - MUST use AdminLayout and follow existing admin interface patterns
      - MUST integrate with existing voice debug components from task 7.2
      - MUST connect to real conversation storage and analytics systems
    - **Verification Checklist**:
      - Context monitor shows real system prompts and injected context
      - Tool call monitor displays actual MCP tool executions with parameters
      - Integration validator confirms all production endpoints are working
      - Conversation state inspector shows real-time voice session data
      - Debug interface uses same endpoints as production voice features
      - Export functionality provides complete conversation and debug data
    - When finished - create a git commit, then fix build issues and make another git commit "Fixed build issues"
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10_

- [ ] **8. Pill-Shaped Floating AI Interface**
  - [x] 8.1 Build pill-shaped floating AI interface with reflink-based access control and REAL voice integration









    - **CRITICAL**: Integrate REAL voice providers from task 7.1, not mock implementations
    - **Interface Design**: Create pill-shaped floating interface (NOT a traditional chat interface)
      - Pill-shaped container with rounded corners (50px border-radius when collapsed, 16px when expanded)
      - Dynamic positioning: starts at 50vh from bottom, moves to 24px from bottom on scroll
      - No chat history display - focus on immediate voice interaction
      - Glowing animation effects to attract user attention (blue/purple/green color cycling)
      - Microphone button with pulse rings when listening
      - Text input field for manual commands
      - Status indicator (listening/processing/idle states)
      - Expandable response area for AI feedback (temporary display, auto-contracts)
    - **GSAP Animations**: 
      - Smooth position transitions between center and bottom positions
      - Edge glow effects with sophisticated color cycling
      - Pulse animations for interaction hints
      - Scale animations for user feedback
      - Background gradient overlay that follows the interface position
    - **Voice Integration Requirements**:
      - MUST use real ConversationalAgentProvider from task 7.1
      - MUST enable actual voice conversations for premium reflink users
      - MUST handle microphone permissions and audio streaming
      - MUST integrate with real conversation transcript collection
      - MUST support provider switching (OpenAI/ElevenLabs) via admin configuration
      - MUST support tool execution with system-wide and per-reflink enable/disable controls
    - **Reflink Integration**:
      - Implement reflink-based feature gating (hide interface, show basic, or show full features)
      - Add personalized welcome messages for reflink holders with recipient name and context
      - Build appropriate messaging for different access levels and reflink states
      - Support per-reflink agent configuration overrides (different from system default)
    - **Tool System Integration**:
      - Enable/disable tool use system-wide or per reflink via admin configuration
      - Agent must acknowledge tool availability but inform users when tools are disabled
      - Support all navigation and UI manipulation tools from existing debug interface
      - Provide conversation ID for admin monitoring in separate browser windows
    - **Sub-tasks**:
      - [ ] 8.1.1 Create Pill-Shaped Floating Interface Component:
        - Build pill-shaped container with dynamic border-radius animation
        - Implement GSAP-powered position transitions (center ↔ bottom)
        - Add sophisticated edge glow effects with color cycling
        - Create microphone button with pulse rings and status indicators
        - Add text input field with placeholder text and disabled states
        - Implement expandable response area with smooth height transitions
        - **Files**: `src/components/ai/FloatingAIInterface.tsx`, `src/components/ai/AIStatusIndicator.tsx`
        - _Requirements: 1.1, 1.2, 1.9, 11.1, 11.2, 11.3, 11.4, 11.5_
      - [ ] 8.1.2 Implement Reflink-Based Access Control and Configuration:
        - Create access control logic based on reflink validation using existing ReflinkSessionProvider
        - Implement feature gating for voice capabilities based on access level
        - Add personalized welcome messages and context injection
        - Support per-reflink agent configuration overrides (provider, model, instructions)
        - Build graceful degradation for different access levels
        - **Files**: `src/components/ai/AIAccessControlWrapper.tsx`, `src/hooks/useAIAccess.ts`
        - _Requirements: 5.4, 5.5, 5.6, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10, 17.1, 17.2, 17.3, 17.8, 17.9_
      - [ ] 8.1.3 Integrate Voice Provider and Tool System:
        - Connect with ConversationalAgentProvider for real voice interactions
        - Implement tool execution with enable/disable controls (system-wide and per-reflink)
        - Add conversation ID generation and sharing for admin monitoring
        - Create tool availability messaging when tools are disabled
        - Support provider switching based on admin configuration
        - **Files**: `src/components/ai/VoiceIntegration.tsx`, `src/hooks/useToolAvailability.ts`
        - _Requirements: 8.1, 8.2, 8.5, 8.11, 8.13, 8.15, 8.18, 8.19, 8.21, 8.22, 8.25, 8.26_
      - [ ] 8.1.4 Build Conversation State Management and Admin Monitoring:
        - Implement conversation persistence with server-side transcript sharing
        - Create conversation ID system for admin debug monitoring
        - Add real-time conversation logging to server for admin access
        - Build conversation analytics and usage tracking
        - Support conversation monitoring from separate admin browser windows
        - **Files**: `src/hooks/useConversationMonitoring.ts`, `src/services/ConversationSync.ts`
        - _Requirements: 1.10, 6.7, 8.9, 8.10, 14.1, 14.2, 14.3, 20.2, 20.3, 20.4, 20.5, 20.9, 20.10, 20.11, 20.15_
    - **Integration Requirements**:
      - MUST use ConversationalAgentProvider from task 7.1
      - MUST integrate with UI System GSAP animation orchestration
      - MUST connect with existing ReflinkSessionProvider for access control
      - MUST work with existing navigation and modal systems via tool calls
      - MUST support admin debug monitoring from separate browser windows
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.9, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 8.14, 8.15, 8.16, 8.17, 8.18, 8.19, 8.20, 8.21, 8.22, 8.23, 8.24, 8.25, 8.26, 8.27, 8.28, 8.29, 8.30, 11.1, 11.2, 11.3, 11.4, 11.5, 14.1, 14.2, 14.3, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10, 17.1, 17.2, 17.3, 17.4, 17.8_

  - [ ] 8.2 Implement tone selection system
    - Create tone selector dropdown (technical, casual, professional)
    - Implement system prompt modifiers for different communication styles (for server-injected prompts or client-side agent config)
    - Add tone persistence per conversation session
    - Build tone-appropriate response formatting
    - **Integration**: Use AI System's shared utilities for consistent prompt handling
    - _Requirements: 2.8, 10.5_

  - [ ] 8.3 Add conversation management
    - Build conversation state management and context preservation (server-side, with client reporting updates)
    - Create conversation analytics and review interface
    - **Integration**: Connect with Data & API Layer for conversation storage and admin analytics
    - _Requirements: 1.8, 1.10, 2.9, 2.10, 6.7, 20.2, 20.3, 20.4, 20.5, 20.9, 20.10, 20.11, 20.12, 20.13, 20.14, 20.15_

- [ ] **9. MCP-Based Navigation System**
  - [ ] 9.1 Build MCP Navigation Tools (Client-Side Execution)
    - Implement MCP client for navigation tool execution
    - Create navigation tools for UI manipulation (openProjectModal, scrollToSection, highlightText)
    - Build immediate command execution without server round-trips
    - Add error handling and fallback for failed navigation commands
    - Implement UI state reporting back to server via API calls
    - Create highlighting system based on Rich Content System's Tiptap structure
    - **Integration**: Connect with UI System navigation hooks and MCP system
    - _Requirements: 7.1, 7.2, 7.7, 7.11, 7.12, 8.11, 8.21, 8.22, 9.1, 9.3_

  - [ ] 9.2 Implement Navigation State Management (Hybrid Client-Server)
    - Build client-side navigation history for immediate previous/next functionality
    - Implement server-side navigation state tracking via client reports
    - Create navigation state persistence across mode switches
    - Add navigation context integration with conversation context
    - Build multi-project navigation context management
    - Implement mobile-specific navigation adaptations
    - **Integration**: Connect with conversation history and context management systems
    - _Requirements: 4.6, 4.7, 7.5, 7.6, 7.8, 7.12, 9.2, 9.7, 9.8, 9.10, 20.2, 20.9_

  - [ ] 9.3 Build Speech-Synchronized Navigation with REAL Voice AI (Client-Side)
    - **CRITICAL**: Must integrate with REAL voice providers from task 7.1, not mock implementations
    - Create timing coordination between REAL voice provider TTS and navigation execution
    - Implement natural demonstration sequences with actual AI speech pacing
    - Add interruption handling for navigation sequences during real voice conversations
    - Build command queuing and sequencing for smooth demonstrations with real AI voice
    - Implement visual emphasis with speech-synchronized timing from actual AI TTS
    - Add support for technical explanations with synchronized navigation during real voice interactions
    - **Sub-tasks**:
      - [ ] 9.3.1 Create Speech-Navigation Synchronization System:
        - Build timing coordination system that works with both OpenAI Realtime and ElevenLabs TTS
        - Implement speech event listeners to detect AI speech start/end events
        - Create navigation command queuing system for smooth demonstration sequences
        - Add timing delays and synchronization points for natural pacing
        - **Files**: `src/lib/navigation/SpeechNavigationSync.ts`, `src/hooks/useSpeechSync.ts`
        - _Requirements: 7.3, 7.7, 7.9, 7.13, 8.12, 8.24, 9.5_
      - [ ] 9.3.2 Implement Navigation Command Execution:
        - Create navigation command processor that executes UI changes during speech
        - Build visual emphasis system (highlighting, scrolling, modal opening) synchronized with speech
        - Implement interruption handling when user speaks during AI demonstrations
        - Add command rollback and state restoration for interrupted sequences
        - **Files**: `src/lib/navigation/NavigationCommandProcessor.ts`, `src/hooks/useNavigationCommands.ts`
        - _Requirements: 7.3, 7.7, 7.8, 7.13, 8.12, 8.13, 8.24, 9.5_
      - [ ] 9.3.3 Build Visual Demonstration System:
        - Create highlighting system that coordinates with AI speech timing
        - Implement smooth scrolling and element focusing during voice explanations
        - Add visual indicators for current focus during AI demonstrations
        - Build transition animations that match speech pacing
        - **Files**: `src/components/navigation/VisualDemonstration.tsx`, `src/lib/navigation/VisualEffects.ts`
        - _Requirements: 7.3, 7.9, 7.13, 8.12, 8.24, 9.5_
    - **Real Voice Integration Requirements**:
      - MUST coordinate with actual OpenAI Realtime or ElevenLabs TTS timing
      - MUST handle real voice interruptions and navigation state
      - MUST synchronize with actual AI speech output, not browser TTS
      - MUST work during real voice conversations, not simulated ones
    - **Integration**: Connect with REAL voice provider SDKs for actual TTS timing coordination
    - _Requirements: 7.3, 7.7, 7.9, 7.13, 8.12, 8.24, 9.5_

- [ ] **10. Job Specification Analysis**
  - [ ] 10.1 Build job specification interface
    - Create JobAnalysisInterface component with text paste input
    - Implement job specification validation and preprocessing
    - Add metadata collection (company, position, source)
    - Build submission confirmation and progress tracking using UI System components
    - **Integration**: Use UI System components (Input, Button, Progress, Alert) for consistent interface
    - _Requirements: 3.1, 3.4_

  - [ ] 10.2 Implement analysis engine
    - Create job specification analyzer with structured and conversational output (server-side)
    - Build skills matching algorithm against portfolio content using Rich Content System APIs (server-side)
    - Implement positive presentation while maintaining truthfulness using AI System shared utilities (server-side)
    - Add experience relevance scoring and strength identification (server-side)
    - **Integration**: Connect with Rich Content System for content analysis and AI System for processing
    - _Requirements: 3.2, 3.3, 3.4, 13.4, 13.5_

  - [ ] 10.3 Create analysis storage and review system
    - Implement complete job analysis data storage (spec, reflink, timestamp, response) (server-side)
    - Build admin interface for reviewing all job analysis reports using AdminLayout and AdminPageLayout
    - Add proper sidebar navigation entry under "AI Assistant" section
    - Add CSV export functionality for analysis data
    - Create analytics dashboard for job analysis trends
    - **Admin Integration**: MUST use AdminLayout, add to AdminSidebar, follow /admin/ai/job-analysis route pattern
    - **Integration**: Connect with Data & API Layer for storage and admin interface integration
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 13.10_

- [ ] **11. Performance and Caching**
  - [ ] 11.1 Implement AI status caching
    - Create AI availability/configuration caching with 15-minute TTL (server-side)
    - Cache AI model settings, rate limits, and configuration status (server-side)
    - Implement cache invalidation on AI settings changes (server-side)
    - **Integration**: Coordinate with AI System's caching strategy for consistent behavior
    - _Requirements: 6.1, 6.2_

  - [ ] 11.2 Implement conversation context caching
    - Build session-based conversation state preservation (server-side persistent storage, with client reporting)
    - Cache conversation history, current context, and navigation state (server-side)
    - Design cache format to support both text and voice message types
    - Continue storing cached conversations to database with correct conversation ID for analytics
    - Never retrieve conversations from database for unauthenticated sessions (security)
    - Implement graceful fallback if storage fails or is unavailable
    - **Integration**: Coordinate with Data & API Layer for secure conversation storage
    - _Requirements: 1.10, 6.4, 6.7, 20.2_

  - [ ] 11.3 Add project content caching
    - Cache project summaries and indexes per session to avoid repeated loading (server-side)
    - Implement intelligent cache invalidation on project updates (server-side)
    - Build progressive loading with cached content prioritization (server-side)
    - Optimize context building to reduce API calls (server-side)
    - **Integration**: Connect with Rich Content System for content updates and Media Management System for media context
    - _Requirements: 6.3, 6.4, 6.5_

- [ ] **12. Context Configuration System**
  - [ ] 12.1 Build context configuration interface
    - Create ContextConfigurationInterface for admin control of context breadth, depth, and token limits using AdminLayout and AdminPageLayout
    - Add proper sidebar navigation entry under "AI Assistant" section
    - Implement content source weight management (projects, about, resume, media priorities)
    - Add response style configuration (technical detail level, explanation thoroughness)
    - Build navigation behavior settings (when/how AI suggests portfolio navigation)
    - **Admin Integration**: MUST use AdminLayout, add to AdminSidebar, follow /admin/ai/context-config route pattern
    - **Integration**: Connect with Data & API Layer for configuration storage and UI System for admin interface
    - _Requirements: 10.1, 10.6, 10.8_

  - [ ] 12.2 Create conversation template editor
    - Build ConversationTemplateEditor for system prompts and conversation flow templates using AdminLayout and AdminPageLayout
    - Add proper sidebar navigation entry under "AI Assistant" section
    - Implement AI personality configuration (tone, expertise level, communication style)
    - Add conversation starter management and response pattern editing
    - Create navigation trigger configuration for template-specific behaviors
    - **Admin Integration**: MUST use AdminLayout, add to AdminSidebar, follow /admin/ai/templates route pattern
    - **Integration**: Use AI System's shared utilities for prompt template validation
    - _Requirements: 10.2, 10.5_

  - [ ] 12.3 Implement hidden context management
    - Create HiddenContextManager for background information injection (server-side)
    - Build priority-based hidden context system with topic association (server-side)
    - Add mode-specific context inclusion (voice vs text mode differences) (server-side)
    - Implement context testing and preview functionality (server-side)
    - **Integration**: Connect with context management system for seamless integration
    - _Requirements: 10.4, 10.10_

  - [ ] 12.4 Add key phrase and topic priority system
    - Build key phrase management with priority weighting and navigation triggers (server-side)
    - Implement topic priority configuration for context and navigation weighting (server-side)
    - Add custom response configuration for specific phrases and topics (server-side)
    - Create voice emphasis settings for important topics in voice mode (server-side, to be used by client-side voice agent)
    - **Integration**: Connect with voice processing system for emphasis coordination
    - _Requirements: 10.3, 10.9_

  - [ ] 12.5 Create configuration preview and testing system
    - Implement real-time configuration preview with test queries (server-side)
    - Build configuration validation system with error detection and suggestions (server-side)
    - Add A/B testing capabilities for different configuration approaches (server-side)
    - Create configuration backup and restore functionality (server-side)
    - **Integration**: Use unified conversation pipeline for accurate preview testing
    - _Requirements: 10.10_

- [ ] **13. Admin Interface and Analytics**
  - [ ] 13.1 Build conversation review interface
    - Create admin interface for reviewing all AI conversations using AdminLayout and AdminPageLayout
    - Add proper sidebar navigation entry under "AI Assistant" section
    - Implement filtering and search capabilities for conversation data
    - Add conversation analytics and trend analysis
    - Build export functionality for conversation data
    - **Admin Integration**: MUST use AdminLayout, add to AdminSidebar, follow /admin/ai/conversations route pattern
    - **Integration**: Connect with Data & API Layer for admin interfaces and analytics dashboard
    - _Requirements: 1.8, 4.8, 11.6, 11.7, 11.8, 16.8_

  - [ ] 13.2 Create security management interface
    - Build IP blacklist management with reinstatement options using AdminLayout and AdminPageLayout
    - Add proper sidebar navigation entry under "AI Assistant" section
    - Implement security log review and violation tracking
    - Add automated notification system for security events
    - Create security analytics and threat monitoring
    - **Admin Integration**: MUST use AdminLayout, add to AdminSidebar, follow /admin/ai/security route pattern
    - **Integration**: Use Data & API Layer for admin interfaces and notification systems
    - _Requirements: 5.10, 21.1, 21.2, 21.3, 21.4, 21.5_

  - [ ] 13.3 Implement public access control management
    - Create interface for public AI access settings (Disabled/Basic Only/Limited Features) using AdminLayout and AdminPageLayout
    - Add proper sidebar navigation entry under "AI Assistant" section
    - Build feature-level controls for what public users can access without reflinks
    - Add real-time settings application without requiring system restart
    - Create usage analytics separating public vs reflink usage with cost breakdowns
    - Implement access level messaging configuration for different user types
    - **Admin Integration**: MUST use AdminLayout, add to AdminSidebar, follow /admin/ai/access-control route pattern
    - **Integration**: Connect with Data & API Layer for access control and analytics
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10_

  - [ ] 13.4 Add Feature Bundle Tool Control to Reflinks (SIMPLIFIED - EXISTING SYSTEM INTEGRATION)

    - **Approach**: Use existing feature flags (`enableVoiceAI`, `enableJobAnalysis`, `enableAdvancedNavigation`) and map them to tool bundles
    - **CRITICAL: Work with Existing Reflink System**: 
      - **DO NOT BREAK**: The existing reflink system at `/admin/ai/reflinks` is working and must not be broken
      - **Files to Reference**: `src/components/admin/reflinks-manager.tsx`, `src/app/api/admin/ai/reflinks/[id]/route.ts`, `src/app/api/admin/ai/reflinks/route.ts`
      - **Integration Approach**: Map existing feature flags to tool bundles, no new database fields needed
    - **Tool Bundle Mapping**:
      - **Basic Navigation Bundle**: `enableVoiceAI` → `['navigateTo', 'showProjectDetails', 'scrollIntoView']`
      - **Job Analysis Bundle**: `enableJobAnalysis` → `['processJobSpec', 'analyzeUserIntent', 'loadUserProfile']`
      - **Advanced Navigation Bundle**: `enableAdvancedNavigation` → `['highlightText', 'generateNavigationSuggestions', 'getNavigationHistory']`
      - **Context Loading**: Always available for reflinks → `['loadProjectContext', 'searchProjects']`
    - **Create Special "Public Access" Reflink**:
      - **Database Seed**: Create special reflink with code "PUBLIC_ACCESS" for non-reflink users
      - **Admin UI**: Show "Public Access" reflink in reflinks list with special styling/label
      - **Default Configuration**: Initially all features disabled (secure by default)
      - **Editable**: Admin can edit "Public Access" reflink like any other reflink to control public user capabilities
    - **UnifiedToolRegistry Integration**:
      - Add `getToolsForReflink(reflinkId?: string)` method that maps feature flags to tool bundles
      - When no reflink provided, automatically use "PUBLIC_ACCESS" reflink from database
      - Create `/api/ai/tools/allowed/route.ts` endpoint for client-side tool loading
      - System-wide overrides take precedence (handled in task 13.5)
    - **CRITICAL OpenAI Tool Handling Architecture Integration**: 
      - **Background**: OpenAI Realtime SDK executes tools automatically on client, requiring wrapper system for server control
      - **Implementation**: Server injects tools via `/api/ai/openai/session/route.ts`, client redefines with wrapper functions in `OpenAIRealtimeAdapter._initializeAgent()`
      - **Tool Filtering**: Use feature flag → tool bundle mapping to filter tools before creating OpenAI tool definitions
      - **System Prompt Updates**: Adjust system prompt based on available tool bundles so AI doesn't mention disabled capabilities
    - **Client-Side Adapter Integration**:
      - **Update `src/lib/voice/OpenAIRealtimeAdapter.ts`**: Query `/api/ai/tools/allowed` during initialization
      - **Update `src/lib/voice/ElevenLabsAdapter.ts`**: Query `/api/ai/tools/allowed` during initialization
      - **Tool Filtering**: Filter tools based on feature flag bundles before creating tool definitions
      - **Fallback Behavior**: If no reflink or invalid reflink, use "PUBLIC_ACCESS" reflink configuration
    - **Files to Modify**: 
      - Database: Create "PUBLIC_ACCESS" reflink in seed data
      - API: Create `/api/ai/tools/allowed/route.ts`, enhance `/api/ai/openai/session/route.ts`
      - Registry: Enhance `src/lib/ai/tools/UnifiedToolRegistry.ts` with feature flag → tool bundle mapping
      - Adapters: Update `src/lib/voice/OpenAIRealtimeAdapter.ts` and `src/lib/voice/ElevenLabsAdapter.ts`
      - Admin: Add special styling for "Public Access" reflink in `src/components/admin/reflinks-manager.tsx`
    - **Admin Integration**: MUST work with existing AdminLayout and reflink management at `/admin/ai/reflinks`
    - **Integration**: Reuse existing feature flags, no breaking changes to reflink system
    - **Impact**: Enables feature-level tool control using existing reflink infrastructure with secure public defaults
    - _Requirements: 5.1, 5.2, 5.6, 5.8, 8.11, 8.21, 8.22, 8.26_

  - [ ] 13.5 Add System-Wide Tool Override and Default Agent Selection (VOICE CONFIG ENHANCEMENT)

    - **Purpose**: Add system-wide tool override panel and default agent selection to existing `/admin/ai/voice-config` page
    - **CRITICAL: Work with Existing Voice Config System**: 
      - **DO NOT BREAK**: The existing voice config system at `/admin/ai/voice-config` is working and must not be broken
      - **Files to Reference**: `src/app/admin/ai/voice-config/page.tsx`, existing voice config components
      - **Integration Approach**: Add two new sections to main voice config page (not separate tabs)
    - **System-Wide Tool Override Panel**:
      - **Add "System Tool Override" card**: Place above existing configuration list
      - **Override Logic**: System overrides take precedence over reflink feature flags
      - **Tool Bundle Controls**: Toggle switches for each tool bundle (Basic Navigation, Job Analysis, Advanced Navigation)
      - **Visual Feedback**: Show which tools are disabled system-wide vs reflink-level
      - **Database**: Add `systemToolOverrides` JSON field to a new SystemConfig model or existing config table
    - **Default Agent Selection Interface**:
      - **Add "Default Agent Selection" card**: Place above tool override panel
      - **Provider Selection**: Dropdown to choose default voice provider (OpenAI/ElevenLabs)
      - **Configuration Selection**: Dropdown to choose which named configuration is used as system default
      - **Real-time Updates**: Changes take effect immediately without system restart
    - **Cross-Reference Note**:
      - **Add info card**: "Public access tool configuration is managed in Reflinks → Public Access"
      - **Link to reflinks**: Provide direct link to `/admin/ai/reflinks` with filter for "Public Access"
      - **Clear separation**: System overrides vs public access configuration
    - **System Default Management**:
      - **Database Enhancement**: Add `isSystemDefault` boolean field to existing VoiceProviderConfig model
      - **Ensure Single Default**: Only one configuration per provider can be system default
      - **Fallback Logic**: If no system default set, use first available configuration for provider
    - **Tool Resolution Logic**:
      - **Step 1**: Get reflink feature flags (or "PUBLIC_ACCESS" reflink for non-reflink users)
      - **Step 2**: Map feature flags to tool bundles
      - **Step 3**: Apply system-wide tool overrides (remove disabled tools)
      - **Step 4**: Update system prompt to reflect final available tools
      - **Step 5**: Provide filtered tools to voice adapters
    - **Integration with Token Generation**:
      - **Update `/api/ai/openai/session/route.ts`**: Use system default configuration and apply tool overrides
      - **Update `/api/ai/elevenlabs/token/route.ts`**: Use system default configuration and apply tool overrides
      - **System Prompt Injection**: Modify system prompt based on final available tools so AI doesn't mention disabled capabilities
    - **Files to Modify**: 
      - Database: Add `isSystemDefault` to VoiceProviderConfig, create SystemConfig model for tool overrides
      - API: Enhance `/api/ai/tools/allowed/route.ts` with system override logic
      - Admin: Enhance `src/app/admin/ai/voice-config/page.tsx` with new panels
      - Manager: Update `src/lib/voice/ClientAIModelManager.ts` to handle system defaults
      - Tokens: Update token generation endpoints to use system defaults and tool overrides
    - **Admin Integration**: MUST work with existing AdminLayout and voice config management at `/admin/ai/voice-config`
    - **Integration**: Enhance existing voice config system without breaking current functionality
    - **Impact**: Enables system-wide tool control with clear hierarchy: System Override > Reflink Features > Public Access
    - _Requirements: 8.1, 8.2, 8.25, 10.1, 10.2, 10.3_

  - [ ] 13.5 Build AI debug and conversation inspection system
    - **IMPORTANT**: Build this system properly from the ground up using the scalable foundation from task 3.3
    - Create admin debug interface at /admin/ai/debug with separate conversation testing panel and data inspection panel
    - Implement conversation browser to view recent conversations and debug data by conversation ID with proper session handling
    - Build dedicated admin API endpoint for conversation debug data with proper authentication (completely separate from client APIs)
    - Add real-time conversation context and server-injected system prompt inspection for debugging with proper data flow
    - Create conversation replay functionality with step-by-step context and prompt analysis using proper conversation history
    - Implement conversation search and filtering by session ID, reflink, timestamp, and error status with proper indexing
    - Add conversation export functionality for debugging and analysis with comprehensive data formatting
    - Build conversation analytics dashboard with error tracking, performance metrics, and cost analysis
    - Ensure proper session management between debug conversations and data inspection (fix existing session mismatch issues)
    - **Admin Integration**: MUST use AdminLayout, add to AdminSidebar, follow /admin/ai/debug route pattern
    - **Integration**: Connect with properly architected unified conversation history system (task 2.3) and admin authentication
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10_

- [ ] **14. FINAL PRODUCTION VERIFICATION**
  - [ ] 14.1 End-to-End Voice AI Testing
    - **CRITICAL**: Verify entire system uses REAL voice AI, not mocks
    - Test complete user journey: reflink access → voice conversation → navigation → transcript storage
    - Verify real microphone access and AI voice responses throughout user flow
    - Test voice conversation quality and <2 second latency requirements
    - Validate real conversation transcripts and analytics data
    - **Verification Checklist**:
      - [ ] Users can have actual voice conversations with AI models
      - [ ] Real audio streams to OpenAI/ElevenLabs APIs (visible in network monitoring)
      [ ] Actual AI voice responses play through speakers (not browser TTS)
      - [ ] Voice-synchronized navigation works with real AI speech timing
      - [ ] Conversation transcripts contain real AI responses and metadata
      - [ ] Admin debug interfaces show real voice session data
      - [ ] No mock implementations remain in voice-related code
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 8.14, 8.15, 8.16, 8.17, 8.18, 8.19, 8.20, 8.21, 8.22, 8.23, 8.24, 8.25, 8.26, 8.27, 8.28, 8.29, 8.30, 9.1, 9.3, 9.4, 9.5, 9.7, 9.8, 9.9, 9.10, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 20.10, 20.11, 20.12, 20.13, 20.14, 20.15_

  - [ ] 14.2 Production Readiness Audit
    - Audit all voice-related code for production readiness
    - Remove any remaining development mocks or test implementations
    - Verify error handling for real API failures and network issues
    - Test system behavior under real-world conditions (network latency, API limits)
    - Validate security implementation for real voice sessions and ephemeral tokens
    - **Final Verification**:
      - [ ] Zero references to "mock", "simulation", or "fake" in production code
      - [ ] All voice providers use real SDKs and API connections
      - [ ] System handles real API errors gracefully
      - [ ] Voice sessions work reliably under production conditions
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7_

- [ ] **15. AI Tool-Call System (Modular Implementation)**
  - [ ] 15.1 Build core tool execution engine (Server-Side for backend tools)
    - Create AIToolCallManager as framework-agnostic TypeScript module (server-side)
    - Implement ToolRegistry with plugin system for extensible tool definitions (server-side and for client-side tool definitions)
    - Build ToolValidator for security validation and parameter sanitization (server-side, for backend tools)
    - Add standardized ToolResult handling with error management and context updates (server-side)
    - **Modularity**: Design for extraction to @portfolio/ai-tools-core package
    - _Requirements: 15.1, 15.2_

  - [ ] 15.2 Implement tool call parsing and execution (Server-Side for backend, Client-Side for UI)
    - Create tool call parser for AI response processing (server-side, for text/hybrid) with inline command support
    - Build execution queue with priority handling and timeout management (server-side for server tools, client-side for client tools)
    - Add conditional execution logic for complex workflows (server-side for orchestration, client-side for local execution)
    - Implement tool call validation and security checks (server-side for backend tools, client-side for local tools)
    - **Modularity**: Keep parsing logic separate from UI-specific implementations
    - _Requirements: 15.1, 15.3, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 20.5, 20.6, 20.9, 20.12_

  - [ ] 15.3 Build extensible tool registry
    - Create plugin architecture for custom tool registration (server-side for backend tools, client-side for voice agent tools)
    - Implement tool discovery and dynamic loading system
    - Add tool versioning and compatibility checking
    - Build tool documentation and help system
    - **Modularity**: Design for easy extension in other projects
    - _Requirements: 15.1, 15.6_

- [ ] **16. Web-Specific Tool Implementations**
  - [ ] 16.1 Build form interaction tools
    - Create FormInteractionManager for web form detection and interaction (server-side logic, client-side execution)
    - Implement smart form filling with field type detection and validation (client-side tool definition)
    - Add form submission with confirmation handling and error recovery (client-side tool definition for UI, server-side for backend API call)
    - Build form state management and data persistence (client-side for UI, server-side for logging)
    - **Modularity**: Design for extraction to @portfolio/ai-tools-web package
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10_

  - [ ] 16.2 Implement DOM manipulation tools
    - Create AdvancedUIController for element selection and interaction (server-side logic, client-side execution)
    - Build smart clicking with element waiting and scroll-into-view (client-side tool definition)
    - Add UI state detection and change monitoring (client-side reporting to server)
    - Implement accessibility-aware interactions (client-side tool definition)
    - **Modularity**: Keep DOM logic separate from React-specific code
    - _Requirements: 17.3, 17.4, 17.6_

  - [ ] 16.3 Build file processing tools
    - Create BackgroundProcessingManager for file upload and processing (server-side)
    - Implement processing status monitoring with real-time updates (server-side, client-reported status)
    - Add context integration for processed file results (server-side)
    - Build file type detection and validation (server-side)
    - **Modularity**: Design processing logic as pluggable modules
    - _Requirements: 13.1, 13.2, 13.3, 13.6, 13.8, 13.9, 13.10_

- [ ] **17. React Integration Layer**
  - [ ] 17.1 Build React hooks and providers
    - Create `useAITools` hook for React component integration
    - Implement `AIToolProvider` context for tool access and state management
    - Add `useToolExecution` hook for component-level tool execution
    - Build React-specific error boundaries and loading states
    - **Modularity**: Design for extraction to @portfolio/ai-tools-react package
    - _Requirements: 15.6, 15.9_

  - [ ] 17.2 Create React components for tool execution
    - Build `ToolCallComponent` for visual tool execution feedback
    - Implement `ConfirmationDialog` for user confirmation of sensitive actions
    - Add `ProcessingIndicator` for background task status display
    - Create `ErrorRecovery` component for tool execution error handling
    - **Modularity**: Keep components generic and reusable
    - _Requirements: 12.5_

- [ ] **18. Portfolio-Specific Integration**
  - [ ] 18.1 Build portfolio-specific tool implementations
    - Create `PortfolioFormHandler` for contact form and application form interactions (server-side for backend API calls, client-side for UI filling definitions)
    - Implement `PortfolioNavigationTools` for project navigation and highlighting (client-side tool definitions)
    - Add `PortfolioContextProvider` for portfolio-specific context integration (server-side for detailed context, client-side for public context)
    - Build `PortfolioFileProcessor` for job posting and resume analysis (server-side)
    - **Integration**: Connect with existing portfolio systems while maintaining modularity
    - _Requirements: 12.6, 12.9, 13.5_

  - [ ] 18.2 Integrate with existing conversation system
    - Connect tool-call system with UnifiedConversationManager (client-side tools report to server, server orchestrates backend tools)
    - Add tool execution to voice and text conversation flows
    - Implement tool result integration with conversation context (server-side)
    - Build tool execution logging and analytics (server-side)
    - **Integration**: Extend existing conversation pipeline with tool capabilities
    - _Requirements: 14.1, 14.2, 14.5, 14.8, 20.11, 20.15_

- [ ] **19. Advanced Tool Features**
  - [ ] 19.1 Implement workflow execution system
    - Create WorkflowManager for multi-step tool execution sequences (server-side orchestration)
    - Build conditional workflow logic with branching and loops (server-side)
    - Add workflow pause, resume, and cancellation capabilities (server-side, client reports state)
    - Implement workflow templates for common interaction patterns (server-side)
    - **Modularity**: Design workflows as reusable, configurable templates
    - _Requirements: 17.1, 17.4_

  - [ ] 19.2 Build background context monitoring
    - Create ContextMonitor for real-time backend context updates (server-side)
    - Implement invisible context enrichment during conversations (server-side)
    - Add processing completion detection and context integration (server-side)
    - Build context staleness detection and refresh mechanisms (server-side)
    - **Integration**: Connect with existing context management while maintaining modularity
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10_

  - [ ] 19.3 Add error handling and recovery
    - Implement comprehensive error detection for all tool types (server-side for backend tools, client-side for UI tools)
    - Build automatic retry logic with exponential backoff (server-side for backend tools, client-side for UI tools)
    - Add error recovery suggestions and alternative action paths (server-side for AI generation)
    - Create error logging and analytics for tool performance monitoring (server-side)
    - **Modularity**: Design error handling as pluggable strategies
    - _Requirements: 17.5, 17.10, 21.7_

- [ ] **20. Integration and Testing**
  - [ ] 20.1 Test modular architecture
    - Verify tool-call system works independently of portfolio-specific code
    - Test extraction of core modules to separate packages
    - Validate plugin system with custom tool implementations
    - Test integration with different React applications
    - **Modularity**: Ensure clean separation of concerns and reusability
    - _Requirements: 15.1_

  - [ ] 20.2 Theme integration
    - Ensure all AI components support light and dark themes
    - Implement gradient and translucency effects for dark theme
    - Add smooth theme transitions for AI interface
    - Test theme consistency across all AI components
    - _Requirements: 1.9_

  - [ ] 20.3 Performance testing and optimization
    - Test AI response times and optimize for sub-2-second responses (for both server-side text and client-side voice)
    - Validate caching effectiveness and cache hit rates (server-side)
    - Test rate limiting accuracy and user experience (server-side)
    - Optimize context building and token usage (server-side)
    - Test tool execution performance and timeout handling (client-side for UI, server-side for backend)
    - _Requirements: 6.6, 6.9, 6.10, 8.14_

  - [ ] 20.4 Security testing and validation
    - Test rate limiting under various load conditions
    - Validate abuse detection accuracy and false positive rates
    - Test reflink security and expiration functionality
    - Verify IP blacklisting and reinstatement processes
    - Test tool call validation and security measures (server-side for backend tools)
    - Validate form interaction security and data handling
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7_

  - [ ] 20.5 Tool-call system comprehensive testing
    - Test all tool types (form, file, UI, workflow) independently
    - Validate tool execution in different browser environments
    - Test error handling and recovery for all tool failures
    - Verify accessibility compliance for all tool interactions
    - Test tool execution logging and analytics accuracy
    - **Modularity**: Ensure tests work with extracted modules
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10_

- [ ] **21. Privacy and Compliance**
  - [ ] 21.1 Add privacy disclaimers and terms
    - Create appropriate disclaimers for data usage and storage
    - Implement terms of service for AI feature usage
    - Add privacy notices for conversation logging
    - Build consent management for data collection
    - _Requirements: 3.9_

  - [ ] 21.2 Data protection measures
    - Ensure job specification data is not used for LLM training
    - Implement data retention policies for conversations and analyses
    - Add data anonymization options for analytics
    - Create data deletion capabilities for privacy compliance
    - _Requirements: 3.10_

**🧪 User Testing Checkpoint**: Test complete client-side AI assistant functionality with real users

## Future Enhancements (Post-MVP)

- [ ] 22. Advanced Voice Features
  - Multi-language voice support
  - Voice emotion detection and response adaptation
  - Advanced voice analytics and conversation insights
  - Voice-activated project search and filtering
  - Integration with external voice assistants
  - Enhanced voice security and speaker verification
#
# External API Integration Points

### APIs This System Provides (for other specs to reference)

```typescript
// For UI System (Navigation Integration)
"POST /api/public/ai/chat": "Handle visitor text/hybrid chat messages and client-reported voice agent metrics, provide AI responses for text/hybrid.";
"POST /api/public/ai/analyze-job": "Analyze job specifications against portfolio (server-side).";
// "POST /api/public/ai/navigate" is now largely handled by client-side voice agent tools or server-sent commands.

// Voice Integration APIs
"POST /api/ai/session-init": "Initialize voice conversation session, validate reflink, get access, and generate ephemeral voice AI provider token with server-injected instructions.";
// "POST /api/public/ai/voice/process-audio" - REMOVED, as audio is processed directly by AI provider.
// "POST /api/public/ai/voice/end-session" - REMOVED, as session management is largely provider-managed/client-side with server logging.

// On-demand context loading for client-side voice agent tools
"POST /api/ai/context/load": "Provide filtered, detailed context to client-side voice agent tools based on conversation state and reflink permissions.";

// Components for UI System
VisitorAIChatInterface: "Main chat interface for portfolio visitors with client-side voice agent support";
// VoiceInterface: REMOVED as standalone, now integrated into VisitorAIChatInterface, orchestrating client-side VoiceAgentManager.
VoiceContextProvider: "Context provider for client-side voice agent interactions with navigation hooks";
JobAnalysisInterface: "Job specification analysis interface";

// Hooks for UI System
useVisitorAIChat: "Manage visitor AI chat sessions with client-side voice agent capabilities";
useVoiceAgentManager: "Manage client-side voice AI provider (OpenAI/ElevenLabs) connections and interactions";
useClientNavigationExecutor: "Execute navigation commands from server or client-side voice agent";
useAINavigation: "AI-guided portfolio navigation (orchestrates server context and client execution)";

// For Data & API Layer (Admin Analytics)
"GET /api/admin/visitor-ai/analytics": "Visitor AI usage analytics for admin dashboard";
"GET /api/admin/visitor-ai/conversations": "Visitor conversations for admin review";
VisitorAIAnalyticsDashboard: "Admin dashboard for visitor AI analytics";
```

### APIs This System Requires (from other specs)

```typescript
// From UI System (Navigation Integration)
openProjectModal: "(projectId: string, highlightSections?: string[]) => void";
navigateToProject: "(projectSlug: string) => void";
highlightText: "(selector: string, text: string) => void";
scrollToSection: "(sectionId: string, behavior?: ScrollBehavior) => void";
currentTheme: "Current theme (light/dark) for chat interface";

// From UI System (Voice Navigation Support - now for client-side agent's local tools)
UIControlHooks: "Access to current modal state, scroll position, and visible content (for client-side agent to query)";
AnimationQueue: "Coordinate voice-synchronized animations and transitions (client-side)";
NavigationHooks: "Project navigation, modal management, and content highlighting (client-side functions for agent tools)";
ThemeProvider: "Theme-aware styling for voice interface components";

// From Rich Content System (Content Access)
TiptapDisplayRenderer: "Render content with highlighting for AI navigation";
getContentSummary: "Content summaries for AI conversation context (server-side)";
highlightContentSections: "Highlight specific content sections with timing control (client-side)";

// From Media Management System (Media Context)
"GET /api/public/media/[id]": "Public access to media items for AI context (server-side)";
getProjectMediaSummary: "Media summaries for AI conversation context (server-side)";

// From AI System (Shared Infrastructure)
SharedAIProviders: "OpenAI and Anthropic provider implementations (for server-side text/hybrid LLM calls)";
SharedAIUtilities: "Token estimation, cost calculation, response validation, (server-side)";
SharedAITypes: "Common AI interfaces and response types";
// AudioProcessingUtils: REMOVED, as audio processing is provider-managed.

// From Portfolio-Projects System (Public Data Access)
"GET /api/public/projects": "Public project list for AI context (server-side)";
"GET /api/public/projects/[slug]": "Detailed project information for AI responses (server-side)";
"GET /api/public/profile": "Portfolio owner profile for AI context (server-side)";
"POST /api/public/contact": "Submit contact forms on behalf of visitors (server-side API called by client-side tool)";
"POST /api/public/file-upload": "Upload files for AI processing (server-side API called by client-side tool)";
"GET /api/public/processing-status/[taskId]": "Monitor background processing status (server-side API called by client-side tool)";
```

## Modular Tool-Call System APIs (Extractable)

### Core Tool System (@portfolio/ai-tools-core)
```typescript
// Framework-agnostic core that can be used in any JavaScript project
AIToolCallManager: "Core tool execution engine (server-side for backend tools)";
ToolRegistry: "Extensible tool registration and discovery (server-side, also defines client-side tools)";
ToolValidator: "Security validation and parameter sanitization (server-side, for backend tools)";
ToolResult: "Standardized result handling with context updates (server-side)";
WorkflowManager: "Multi-step tool execution with conditional logic (server-side)";
```

### Web Tools (@portfolio/ai-tools-web)
```typescript
// Web-specific implementations for DOM and form interaction
FormInteractionManager: "Web form detection, filling, and submission (server-side logic generating commands for client, or executing backend APIs)";
DOMController: "Element selection, clicking, and state management (client-side tool definition)";
FileUploadManager: "File upload with progress tracking and validation (server-side)";
UIStateManager: "UI state detection and change monitoring (client-side reporting to server)";
BackgroundProcessingManager: "File processing and status monitoring (server-side)";
```

### React Integration (@portfolio/ai-tools-react)
```typescript
// React-specific hooks and components
useAITools: "React hook for tool integration and state management";
AIToolProvider: "React context provider for tool access";
useToolExecution: "Hook for component-level tool execution";
ToolCallComponent: "Visual feedback for tool execution";
ConfirmationDialog: "User confirmation for sensitive actions";
ProcessingIndicator: "Background task status display";
```

### Portfolio Integration (Portfolio-Specific)
```typescript
// Portfolio-specific tool implementations (not extracted)
PortfolioFormHandler: "Contact and application form interactions (server-side API calls, client-side UI filling definitions)";
PortfolioNavigationTools: "Project navigation and content highlighting (client-side tool definitions)";
PortfolioContextProvider: "Portfolio context integration (server-side for detailed context, client-side for public context)";
PortfolioFileProcessor: "Job posting and resume analysis (server-side)";
```

### Cross-System Integration Notes

**Navigation Integration**: Client-Side AI agent can invoke UI System hooks directly to open project modals, navigate to projects, and highlight content sections for AI-guided portfolio exploration. Server can also send these commands for text/hybrid modes.

**Content Integration**: Rich Content System provides content summaries and highlighting capabilities for AI conversation context (server-side) and navigation assistance (client-side execution).

**Shared AI Infrastructure**: AI System provides shared provider implementations, utilities, and types to avoid code duplication while maintaining consistent AI behavior for **server-side text/hybrid processing**. Voice-specific aspects are now client-side.

This implementation plan provides a complete roadmap for building the Client-Side AI Assistant with comprehensive cross-system integration while maintaining clear domain boundaries and shared infrastructure with the AI System.The changes have been applied across `requirements.md`, `design.md`, and `tasks.md`.

Here's a summary of the key modifications reflecting the shift to client-side voice agents and server-controlled context:

**General Principles Applied:**

*   **Removal of Server-Side LiveKit Agent for Audio**: All mentions of "LiveKit agent on our server" processing raw audio (STT, TTS) have been removed or recontextualized. Our server is no longer responsible for real-time audio streaming or processing.
*   **Client-Side Direct Connection to Voice AI Providers**: The architecture now explicitly states that the client (browser) connects directly to OpenAI GPT Realtime or ElevenLabs Conversational AI via WebRTC/WebSocket for audio, STT, TTS, VAD, and interruption handling.
*   **Server's Role as Orchestrator and Context Provider**: Our Next.js backend (server-side) is now focused on:
    *   Generating **ephemeral tokens** for client-side voice AI providers.
    *   **Injecting hidden system prompts and initial context** into these tokens (if the provider API supports it).
    *   Handling **on-demand, filtered context loading** via API calls for client-side tools.
    *   **Executing server-side tool calls** (e.g., submitting forms, accessing sensitive backend APIs) when initiated by client-side voice agents.
    *   **Logging client-reported voice interaction metrics**, conversation history, and analytics.
    *   Enforcing **reflink-based access control** and budget tracking.
*   **Client's Role as Executor**: The client manages the UI, orchestrates the client-side voice agent, executes UI navigation commands locally (via agent's tool calls), and reports UI state and voice usage metrics back to our server.
*   **Abstraction Layer**: The design now includes a `VoiceAgentManager` abstraction layer on the client-side to manage different voice AI providers consistently.
*   **Navigation Command Flow Reworked**: Navigation commands are primarily initiated as tool calls by the *client-side voice agent* and executed locally. Our server can still *generate* commands (e.g., for text-only mode or server-orchestrated workflows) and send them to the client for execution. Speech-navigation synchronization is now orchestrated by the *client-side voice agent* with its own TTS.
*   **Data Models Updated**: Conversation and message data models now account for client-reported voice metrics, provider details, and tool call logs.

## External System Dependencies

### Context Provider System APIs
```typescript
// Required from context-provider-system
ContextProvider: "Secure context injection and management for AI agents";
loadContext: "(type: string, filters: AccessFilters) => Promise<FilteredContext>";
injectSystemPrompt: "(context: Context, permissions: Permissions) => SystemPrompt";
```

### MCP System Dependencies
```typescript
// Required from mcp-system
MCPServer: "Navigation tools server for client MCP tools";
MCPClient: "Client-side tool execution for voice agents";
NavigationTools: "UI manipulation tools (openModal, highlight, scroll, etc.)";
```

### Voice AI Provider Dependencies
```typescript
// Required from external providers
OpenAIRealtimeAPI: "Direct client connection for voice interactions";
ElevenLabsConversationalAI: "Direct client connection for voice interactions";
```

### UI System Dependencies
```typescript
// Required from ui-system
NavigationHooks: "UI manipulation hooks for MCP tool execution";
AdminLayout: "Admin interface components for AI management";
ThemeSystem: "Consistent styling for AI chat interface";
```

## External System Dependencies

### Portfolio Projects System APIs
```typescript
// Required from portfolio-projects system
"GET /api/public/projects": "Get public project list for AI context";
"GET /api/public/projects/[slug]": "Get detailed project information";
"GET /api/public/profile": "Get portfolio owner profile for AI context";
"POST /api/public/contact": "Submit contact form data on behalf of visitors";
```

### UI System Dependencies
```typescript
// Required from UI system
navigation: {
  openProjectModal: "(projectId: string, highlightSections?: string[]) => void";
  navigateToProject: "(projectSlug: string) => void";
  scrollToSection: "(sectionId: string) => void";
  highlightText: "(selector: string, text: string) => void";
};
components: {
  Button: "Consistent button styling";
  Card: "Container component for chat interface";
  Input: "Form inputs for job analysis";
  AdminLayout: "Main admin layout wrapper";
  AdminPageLayout: "Page layout with title and breadcrumbs";
};
```

## APIs This System Provides (for other specs to reference)

### Voice Agent APIs
```typescript
// For UI components and admin interfaces
ConversationalAgentProvider: "React Context Provider for unified voice agent management";
useConversationalAgent: "Hook for accessing voice agent functionality";
IConversationalAgentAdapter: "Provider-agnostic interface for voice AI implementations";

// Voice provider implementations
OpenAIRealtimeAdapter: "OpenAI Realtime API integration with WebRTC";
ElevenLabsAdapter: "ElevenLabs Conversational AI integration";
UINavigationTools: "Client-side UI manipulation tools for voice agents";
```

### Server-Side APIs
```typescript
// For voice agent token generation and management
"GET /api/ai/openai/session": "Generate ephemeral OpenAI Realtime session tokens";
"GET /api/ai/elevenlabs/token": "Generate ElevenLabs conversation tokens";
"GET /api/ai/elevenlabs/agents": "Manage ElevenLabs conversational AI agents";
"POST /api/ai/conversation/log": "Asynchronous conversation transcript logging";
"GET /api/ai/context": "Dynamic context loading for voice agents";
```

### Admin Interfaces
```typescript
// For admin system integration
"/admin/ai/voice-debug": "Voice AI testing and debugging interface";
"/admin/ai/voice-analytics": "Voice session analytics dashboard";
"/admin/ai/reflinks": "Reflink management with budget tracking";
"/admin/ai/context-config": "Context provider configuration";
```
- [ ] **8. 
Hierarchical Content System and Vector Index Management (CRITICAL - CONTENT ARCHITECTURE)**

  - [-] 8.1 Implement Automatic Vector Index Building on Project Updates
    - Create database triggers or event handlers that automatically rebuild vector indexes when project content changes
    - Implement incremental index updates to avoid full rebuilds on minor content changes
    - Add index health monitoring and automatic maintenance scheduling
    - Ensure vector indexes stay synchronized with content changes for optimal search performance
    - Integrate with hierarchical content system to maintain relationships during index updates
    - **Impact**: Maintains optimal search performance automatically without manual intervention while preserving content hierarchy
    - **Admin Integration**: Works with admin-side content management from ai-system spec for seamless content updates
    - _Requirements: Performance optimization, automated maintenance, hierarchical content support, ai-system requirements 12.7, 13.7_

  - [-] 8.2 Implement Hierarchical Content System with Line-Based Mapping
    - Extend ContextChunk model with hierarchical relationship fields (parentChunkId, rootChunkId, sectionGroup, derivationPath)
    - Add line-based content mapping fields (startLine, endLine, sourceHash) for admin editor integration
    - Implement content hierarchy traversal methods (getAncestors, getDescendants, getSiblings)
    - Create hierarchical content search capabilities within section groups and across tiers
    - Add content relationship visualization support for admin UI integration
    - **Impact**: Enables proper content relationships and admin-side content management integration
    - **Admin Integration**: Provides foundation for manual text selection, tier assignment, and AI-assisted generation in admin editor
    - **Client-Side AI Integration**: Enables semantic navigation, contextual awareness, and content lineage tracing
    - _Requirements: Content hierarchy, admin editor integration, semantic navigation, ai-system requirements 9.4, 9.8, 13.1, 13.2, 13.4_

  - [ ] 8.3 Implement Enhanced Content Search with Hierarchical Support
    - Add hierarchical content search methods to ContentSearchService (getContentHierarchy, searchWithinSection, getRelatedContentAcrossTiers)
    - Create AI tools for hierarchical content navigation (content.getHierarchy, content.searchSection, content.getRelated)
    - Implement content lineage tracing and relationship mapping for AI context
    - Add line-number based navigation support for precise content scrolling
    - Integrate with existing semantic search while maintaining backward compatibility
    - **Impact**: Enables AI to understand and navigate content relationships, supporting both automatic and manual content organization
    - **Admin Integration**: Supports admin-side content management by providing hierarchical context and navigation
    - _Requirements: Hierarchical search, content relationships, semantic navigation, ai-system requirements 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ] 8.4 Create Admin-Side Content Management Integration Points
    - Create API endpoints for admin editor integration (/api/admin/content/hierarchy, /api/admin/content/line-mapping)
    - Implement content selection validation (non-overlapping, line-based boundaries)
    - Add tier assignment and hierarchy management endpoints for admin UI
    - Create content change detection and regeneration triggers
    - Implement line-number to content chunk mapping for precise navigation
    - **Impact**: Enables seamless integration between client-side AI and admin-side content management
    - **Admin Integration**: Provides API foundation for manual text selection, tier assignment, and AI-assisted generation
    - **Note**: This task provides integration points for the ai-system spec's admin UI implementation
    - _Requirements: Admin integration, content management, API endpoints, ai-system requirements 9.2, 9.4, 12.1, 12.2, 13.8_