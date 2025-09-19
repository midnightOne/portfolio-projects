# MCP Tool Routing Fix Summary

## Problem Identified

The voice agent system was incorrectly routing MCP (Model Context Protocol) tool calls to UI navigation tools, causing failures when trying to execute tools like `project_context_loader`.

### Root Cause Analysis

From the console logs, we identified that:

1. **Incorrect Tool Name Inference**: When an MCP tool was called (e.g., `project_context_loader` with arguments `{projectId: "e-commerce-website", includeContent: true, includeMedia: true}`), the system was incorrectly inferring the function name as `scrollIntoView` based on the most recent function call in history.

2. **Missing MCP Tool Routing**: The tool execution switch statement in `OpenAIRealtimeAdapter.ts` only handled UI navigation tools (`scrollIntoView`, `navigateTo`, `showProjectDetails`, etc.) but had no logic for MCP tools.

3. **Argument Mismatch**: When `scrollIntoView` was called with MCP tool arguments, it failed because the arguments didn't match the expected format (missing `selector` parameter).

## Solution Implemented

### 1. Enhanced Tool Name Inference Logic

**File**: `portfolio-projects/src/lib/voice/OpenAIRealtimeAdapter.ts`

**Changes**: Updated the argument-based inference logic to properly detect MCP tools:

```typescript
// OLD: Would incorrectly infer showProjectDetails for any projectId
} else if (args.projectId) {
    functionName = 'showProjectDetails';

// NEW: Correctly identifies loadProjectContext when MCP-specific parameters are present
} else if (args.projectId && (args.includeContent !== undefined || args.includeMedia !== undefined)) {
    functionName = 'loadProjectContext';
} else if (args.projectId) {
    functionName = 'showProjectDetails';
} else if (args.specPath || args.jobSpec) {
    functionName = 'processJobSpec';
} else if (args.contextType || args.includeFiles) {
    functionName = 'loadContext';
```

### 2. Added MCP Tool Detection and Routing

**Changes**: Modified the tool execution logic to check for MCP tools first:

```typescript
// Check if this is an MCP tool first
if (this._mcpTools.includes(functionName) || 
    functionName === 'loadProjectContext' || 
    functionName === 'processJobSpec' || 
    functionName === 'loadContext') {
    console.log(`Executing MCP tool: ${functionName}`);
    result = await this._executeMcpTool(functionName, parsedArgs);
} else {
    // Handle UI navigation tools
    switch (functionName) {
        case 'scrollIntoView':
        // ... existing UI tool cases
    }
}
```

### 3. Implemented MCP Tool Execution Method

**Added**: New `_executeMcpTool` method that makes API calls to the MCP server:

```typescript
private async _executeMcpTool(functionName: string, args: any): Promise<any> {
    try {
        console.log(`Executing MCP tool ${functionName} with args:`, args);
        
        const response = await fetch('/api/ai/mcp/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                toolName: functionName, 
                parameters: args 
            })
        });
        
        if (!response.ok) {
            throw new Error(`MCP server tool failed: ${response.status}`);
        }
        
        const result = await response.json();
        console.log(`MCP tool ${functionName} result:`, result);
        
        return {
            success: result.success,
            message: result.success ? 'MCP tool executed successfully' : result.error,
            data: result.data,
            error: result.error
        };
        
    } catch (error) {
        console.error(`Error executing MCP tool ${functionName}:`, error);
        return {
            success: false,
            message: `MCP tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
```

## Verification

### Test Results

Created and ran inference logic tests that confirmed the fix:

```
Testing loadProjectContext inference (the failing case):
Arguments: {"projectId":"e-commerce-website","includeContent":true,"includeMedia":true}
✅ Correctly inferred: loadProjectContext

Results: 6/6 tests passed
```

### Key Test Cases Covered

1. **MCP Tool Detection**: `{projectId: "e-commerce-website", includeContent: true, includeMedia: true}` → `loadProjectContext`
2. **UI Tool Preservation**: `{selector: ".test", behavior: "smooth"}` → `scrollIntoView`
3. **Disambiguation**: `{projectId: "test"}` (without MCP flags) → `showProjectDetails`
4. **Additional MCP Tools**: `{specPath: "/path"}` → `processJobSpec`, `{contextType: "project"}` → `loadContext`

## Expected Behavior After Fix

When a voice agent calls an MCP tool like `project_context_loader`:

1. **Correct Inference**: Arguments `{projectId: "e-commerce-website", includeContent: true, includeMedia: true}` will be correctly inferred as `loadProjectContext`
2. **Proper Routing**: The system will detect this as an MCP tool and route to `_executeMcpTool` instead of UI navigation tools
3. **API Integration**: The tool will make a proper API call to `/api/ai/mcp/execute` with the correct parameters
4. **Success Response**: The MCP server will process the request and return project context data

## Files Modified

1. **`portfolio-projects/src/lib/voice/OpenAIRealtimeAdapter.ts`**
   - Enhanced tool name inference logic
   - Added MCP tool detection in execution flow
   - Implemented `_executeMcpTool` method
   - Updated API endpoint path to `/api/ai/mcp/execute`

## API Endpoints Verified

- **`/api/ai/mcp/execute`** (POST): Executes MCP tools
- **`/api/ai/mcp/execute`** (GET): Lists available MCP tools

## Next Steps

1. **Test in Voice Interface**: Use the voice debug interface to test MCP tool calls
2. **Monitor Console Logs**: Verify that MCP tools are being correctly identified and routed
3. **Validate Results**: Ensure MCP tool responses are properly formatted and returned to the voice agent

## Impact

This fix resolves the core issue where MCP tools were being misrouted to UI navigation tools, enabling proper integration between voice agents and the MCP server for context loading and other advanced functionality.