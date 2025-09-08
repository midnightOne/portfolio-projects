# Voice Debug Monitoring System - User Guide

## Overview

The Voice Debug Monitoring System provides real-time monitoring of AI voice conversations, context loading, and tool execution. The monitoring components are now connected to live data and will show actual activity from your voice AI system.

## Accessing the Monitoring System

1. Navigate to `/admin/ai/voice-debug`
2. You'll see several tabs: **Voice**, **Context**, **Tools**, **State**, **Health**, **Debug**, **History**

## Monitoring Components

### 1. Context Monitor (Context Tab)
**What it monitors:**
- Context API requests and responses
- Token counts and processing times
- Context source filtering and access levels
- Real-time context updates

**How to test:**
- Click "Test Context Load" button to trigger a real context API call
- Use "🔥 Trigger All Debug Events" to simulate multiple context events
- Watch the "Real-time Updates" section for live activity

**What you'll see:**
- System prompt and injected context
- Context sources (projects, profile, system)
- Filtering results based on access level
- Live updates with timestamps and processing details

### 2. Tool Call Monitor (Tools Tab)
**What it monitors:**
- MCP (Model Context Protocol) tool executions
- Navigation tools (scrolling, highlighting, modal opening)
- Server tools (context loading, API calls)
- Tool execution times and success/failure rates

**How to test:**
- Click "Test Tool Calls" to execute a navigation tool
- Click "Test Server Tools" to execute a server-side tool
- Click "Test Multiple Tools" to execute several tools in sequence
- Use "🔥 Trigger All Debug Events" to simulate various tool calls

**What you'll see:**
- Real-time tool execution with parameters and results
- Execution times and success rates
- Tool categorization (navigation, context, server, system)
- Statistics dashboard with success/failure counts

### 3. Conversation State Inspector (State Tab)
**What it monitors:**
- Voice connection status and session state
- Audio configuration and recording status
- Conversation metadata and duration
- Error counts and last activity

**What you'll see:**
- Connection details (provider, status, reconnect attempts)
- Session state (audio enabled, muted, conversation active)
- Audio state (recording, playing, volume, configuration)
- Conversation statistics (messages, duration, errors)

## Debug Event System

The monitoring system uses a debug event emitter that captures:

### Context Events
- `context_request`: When context is requested
- `context_loaded`: When context is successfully loaded

### Tool Call Events
- `tool_call_start`: When a tool execution begins
- `tool_call_complete`: When a tool execution finishes

### Voice Session Events
- `voice_session_start`: When a voice session begins
- `voice_session_end`: When a voice session ends
- `transcript_update`: When new transcript items are added

## Testing the System

### Quick Test (Recommended)
1. Go to the Voice Debug page
2. Click "🔥 Trigger All Debug Events (Test Monitoring)"
3. Switch between Context, Tools, and State tabs to see the data
4. Look for event counters and real-time updates

### Manual Testing
1. **Context Testing:**
   - Click "Test Context Load"
   - Check Context tab → Real-time Updates section
   - Verify token counts and processing times

2. **Tool Call Testing:**
   - Click "Test Tool Calls", "Test Server Tools", or "Test Multiple Tools"
   - Check Tools tab → Tool Call list
   - Verify execution times and success rates

3. **Voice Session Testing:**
   - Connect to a voice provider (OpenAI or ElevenLabs)
   - Send voice or text messages
   - Check State tab for session details
   - Monitor transcript updates

## Real-Time Features

### Auto-Refresh
- Context Monitor has auto-refresh enabled by default
- Updates every 5 seconds when a conversation is active
- Can be toggled on/off

### Live Indicators
- Context Monitor shows event count badge
- Tool Call Monitor shows monitoring status and call count
- State Inspector shows real-time connection status

### Event History
- Context Monitor keeps last 50 context updates
- Tool Call Monitor keeps last 100 tool executions
- All data can be exported as JSON

## Troubleshooting

### No Events Showing
1. Ensure you're on the correct tab (Context/Tools/State)
2. Try the "🔥 Trigger All Debug Events" button
3. Check browser console for any errors
4. Verify the conversation ID is set (should show in monitoring components)

### Events Not Updating
1. Check if auto-refresh is enabled (Context Monitor)
2. Try manual refresh buttons
3. Ensure debug event emitter is enabled (happens automatically)

### Tool Calls Not Appearing
1. Click "Start Monitoring" in Tool Call Monitor
2. Execute test tool calls using the debug buttons
3. Check that MCP client is properly initialized

## API Endpoints

### Debug Test Endpoint
- **URL:** `/api/debug/test-monitoring`
- **Method:** POST
- **Body:** `{ "testType": "all" }` (or "context", "tools", "voice")
- **Purpose:** Triggers debug events for testing

### Context API
- **URL:** `/api/ai/context`
- **Method:** POST
- **Purpose:** Loads context and emits debug events

## Integration with Voice Agents

The monitoring system automatically integrates with:
- ConversationalAgentContext (voice sessions and transcripts)
- MCP Client (tool executions)
- Context API (context loading)
- Debug Event Emitter (real-time events)

When you use the voice AI system normally, all activity will be captured and displayed in the monitoring components.