# ElevenLabs @elevenlabs/client Migration Task

## Overview

This document outlines the critical migration from the current custom WebSocket ElevenLabs implementation to the `@elevenlabs/client` library, which provides native client-side tool support and proper WebRTC integration.

## Current Problems

1. **Wrong Library**: Current implementation uses custom WebSocket connections instead of `@elevenlabs/client`
2. **Missing Package**: `@elevenlabs/client` is not installed in package.json
3. **No Tool Support**: Current implementation lacks native client-side tool execution
4. **Incomplete Context Injection**: Server-side context injection is not properly implemented
5. **Mock Implementation**: Current code has placeholder/mock functionality instead of real voice AI

## Migration Strategy

### Phase 1: Package Installation and Cleanup
- Install `@elevenlabs/client` package
- Remove any existing `@elevenlabs/react` or `@elevenlabs/elevenlabs-js` packages
- Update imports throughout the codebase

### Phase 2: ElevenLabsAdapter Refactoring
- Replace custom WebSocket implementation with `Conversation.startSession()`
- Implement native client-side tool registration via `clientTools` object
- Add proper microphone permission handling before session start
- Implement conversation lifecycle management (connect/disconnect)

### Phase 3: Server-Side Context Injection
- Update `/api/ai/elevenlabs/token` to return `overrides` object with server-injected context
- Implement `clientToolsDefinitions` response for dynamic tool registration
- Ensure context injection occurs server-side before token generation

### Phase 4: Tool Execution System
- Implement `_createClientToolsForElevenLabs()` method
- Create executable functions for UI navigation tools
- Create executable functions for server API calls
- Add proper error handling and result reporting

### Phase 5: Unified Systems Integration
- Implement conversation transcript capture using unified format (same as OpenAI)
- Ensure tool calls use unified interfaces and logging
- Add server reporting for debugging and analytics using shared endpoints
- Verify admin debug page works with ElevenLabs conversations
- Ensure conversation data is properly logged in provider-agnostic format

## Key Requirements

### Server-Side Context Injection
- Context must be injected server-side via `overrides` object
- System prompts and initial context must not be visible to client
- Support for reflink-based personalization and access control

### Unified Tool Execution System
- Tools must execute immediately without message parsing
- Must use same `UINavigationTools` and tool interfaces as OpenAI adapter
- Results must be automatically returned to ElevenLabs agent
- Tool calls must be logged in unified format for admin debug page
- Support for both UI manipulation and server API calls

### Real Voice AI Implementation
- Must use actual `@elevenlabs/client` library
- Must establish real WebRTC connections to ElevenLabs
- Must request real microphone access and stream audio
- Must play real AI voice responses (not browser TTS)

## Success Criteria

1. **Package Installation**: `@elevenlabs/client` installed and imported correctly
2. **Real Connections**: Actual WebRTC connections to ElevenLabs platform
3. **Tool Execution**: Native client-side tools working with immediate execution
4. **Context Injection**: Server-side context injection working via overrides
5. **Unified Transcript Logging**: Conversation data properly captured in same format as OpenAI and reported to server
6. **Admin Debug Compatibility**: Admin debug page works seamlessly with ElevenLabs conversations
6. **No Mock Code**: Zero references to mock, test, or simulation in voice code

## Implementation Priority

This migration is **CRITICAL** and should be prioritized as it addresses fundamental architectural issues with the current ElevenLabs implementation. The current implementation cannot provide real voice AI functionality without this migration.