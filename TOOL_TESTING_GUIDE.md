# Tool Testing Interface Guide

## Overview

The Tool Testing Interface is an admin panel for testing and debugging server-side AI tools. It provides a comprehensive interface to:

- Discover available tools automatically
- Generate example parameters with realistic data
- Execute tools with custom parameters
- View formatted and raw results
- Save and load test configurations
- Monitor execution timing and errors

## Access

Navigate to `/admin/ai/tool-testing` (requires admin authentication)

## Features

### 1. Tool Discovery
- Automatically loads all available server-side tools from the UnifiedToolRegistry
- Shows tool descriptions, execution context, and parameter schemas
- Displays required vs optional parameters with badges

### 2. Parameter Configuration
- **Generate Example**: Creates realistic example parameters based on tool schema
- **Parameter Schema**: Shows detailed information about each parameter including:
  - Type information (string, number, boolean, array, object)
  - Required/optional status
  - Enum options where applicable
  - Default values
  - Descriptions

### 3. Smart Example Generation
The interface generates contextually appropriate examples:
- `query` parameters: "React TypeScript projects"
- `projectId` parameters: "portfolio-website"
- `userMessage` parameters: "Show me projects with React"
- `formData` objects: Complete contact form examples
- `uiState` objects: Realistic UI state with navigation context

### 4. Test Execution
- Executes tools through the existing `/api/ai/tools/execute` endpoint
- Provides real-time execution status
- Shows execution timing in milliseconds
- Handles both successful results and error cases

### 5. Result Viewing
- **Formatted View**: Pretty-printed, color-coded results with sections for:
  - Success/error status
  - Data payload (for successful executions)
  - Error messages (for failed executions)
  - Metadata (timing, session info, etc.)
- **Raw JSON View**: Complete JSON response for debugging

### 6. Configuration Management
- **Save Configurations**: Store parameter sets for reuse
- **Load Saved Configs**: Quick access to previously saved configurations
- **Delete Configs**: Remove outdated configurations
- Uses localStorage for persistence across sessions

### 7. Export and Copy
- **Copy Results**: Copy full results to clipboard
- **Download Results**: Export test results as JSON files with metadata
- **Copy Parameters**: Copy current parameter configuration

## Available Tools

The interface automatically discovers these server-side tools:

1. **loadProjectContext** - Load detailed project information
2. **loadUserProfile** - Load user profile for AI context
3. **searchProjects** - Search projects by keywords and filters
4. **getProjectSummary** - Get comprehensive project overview
5. **openProject** - Navigate to projects by name
6. **processJobSpec** - Analyze job specifications
7. **analyzeUserIntent** - Analyze user messages for intent
8. **generateNavigationSuggestions** - Generate navigation recommendations
9. **getNavigationHistory** - Retrieve navigation history
10. **submitContactForm** - Process contact form submissions
11. **processUploadedFile** - Analyze uploaded documents
12. **content_search** - Semantic content search with UI context
13. **content_get** - Fetch specific content by ID

## Usage Examples

### Testing Content Search
1. Select `content_search` tool
2. Generate example parameters
3. Modify the query to test specific searches
4. Execute and review semantic search results

### Testing Project Operations
1. Select `getProjectSummary` tool
2. Adjust `maxProjects` and `sortBy` parameters
3. Execute to see project data structure
4. Save configuration for repeated testing

### Testing Contact Forms
1. Select `submitContactForm` tool
2. Generate example with realistic contact data
3. Test different priority levels and sources
4. Verify form processing and validation

## Best Practices

1. **Start with Examples**: Always generate example parameters first
2. **Save Useful Configs**: Save parameter sets you use frequently
3. **Test Edge Cases**: Try invalid parameters to test error handling
4. **Monitor Timing**: Watch execution times for performance insights
5. **Use Both Views**: Check formatted view for readability, raw view for debugging

## Troubleshooting

### Tool Not Found
- Refresh the tool list using the refresh button
- Check if the tool is properly registered in UnifiedToolRegistry

### Execution Errors
- Verify JSON syntax in parameters
- Check required parameters are provided
- Review parameter types match schema requirements

### Authentication Issues
- Ensure you're logged in as admin
- Check session hasn't expired

## Integration with Development

This tool testing interface integrates with:
- **UnifiedToolRegistry**: Automatic tool discovery
- **BackendToolService**: Tool execution engine
- **Debug Event Emitter**: Execution logging and monitoring
- **Context Injector**: Access control and validation

The interface is designed to complement your existing development workflow and provide insights into tool behavior during development and debugging.