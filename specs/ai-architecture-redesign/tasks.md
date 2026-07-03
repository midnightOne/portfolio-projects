# AI Architecture Redesign - Implementation Plan

## Foundation Tasks

- [x] 1. Environment Configuration Setup
  - Update .env.example to include OPENAI_API_KEY and ANTHROPIC_API_KEY variables
  - Create environment validation utilities to check API key presence
  - Remove existing AI settings database tables and create simplified schema
  - Add database migration to clean up old AI configuration data
  - _Requirements: 1.1, 1.2, 10.1, 10.2_

- [x] 2. Provider Abstraction Layer
  - [x] 2.1 Create core AI provider interfaces
    - Define AIProvider interface with connection testing and chat methods
    - Create ProviderChatRequest and ProviderChatResponse interfaces
    - Build provider factory for dynamic provider instantiation
    - _Requirements: 7.1, 7.3_

  - [x] 2.2 Implement OpenAI provider
    - Create OpenAIProvider class with connection testing and model listing
    - Implement chat method with proper error handling and cost calculation
    - Add token estimation and cost calculation utilities
    - _Requirements: 3.1, 4.1, 6.1_

  - [x] 2.3 Implement Anthropic provider
    - Create AnthropicProvider class with connection testing
    - Implement chat method with Anthropic-specific message formatting
    - Add model listing with hardcoded known models (no API endpoint)
    - _Requirements: 3.1, 4.1, 6.1_

- [x] 3. AI Service Manager
  - [x] 3.1 Build core service manager
    - Create AIServiceManager class with provider management
    - Implement getAvailableProviders method with connection status
    - Add testConnection method for real API validation
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 3.2 Add model configuration management
    - Implement getConfiguredModels method reading from database
    - Create validateModels method for model ID validation
    - Add model configuration persistence and retrieval
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Implement content editing functionality
    - Create editContent method for article writing/editing operations
    - Add suggestTags method for intelligent tag inference
    - Implement improveContent method for content enhancement
    - Build structured response parsing for content changes
    - _Requirements: 6.1, 6.2, 6.3, 8.1, 8.2_

## API Endpoints

- [x] 4. Environment Status API
  - Create /api/admin/ai/environment-status endpoint
  - Implement API key presence checking and masking
  - Add environment variable validation and status reporting
  - Return structured status for both OpenAI and Anthropic
  - _Requirements: 1.3, 1.4_

- [x] 5. Connection Testing API
  - Create /api/admin/ai/test-connection endpoint
  - Implement real API connection testing for each provider
  - Add detailed error reporting with actionable messages
  - Return connection status with available models list
  - _Requirements: 4.1, 4.2, 4.3, 9.1, 9.2_

- [x] 6. Content Editing API
  - [x] 6.1 Create content editing endpoints
    - Build POST /api/admin/ai/edit-content for article editing operations
    - Create POST /api/admin/ai/suggest-tags for tag inference
    - Add POST /api/admin/ai/improve-content for content enhancement
    - Implement structured JSON response parsing and validation
    - _Requirements: 6.1, 6.2, 6.3, 8.1, 8.2_

  - [x] 6.2 Create model configuration endpoints
    - Build GET /api/admin/ai/model-config for retrieving current configuration
    - Create PUT /api/admin/ai/model-config for saving model lists
    - Add GET /api/admin/ai/available-models endpoint with provider grouping
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 5.4_

## User Interface Components

- [x] 7. Admin Tab Layout Foundation
  - [x] 7.1 Create basic admin tab layout
    - Build AdminLayout component with tab navigation using shadcn/ui Tabs
    - Create tab structure with "AI Settings" as first tab
    - Add foundation for future tabs (Projects, Media, Analytics, etc.)
    - Update admin dashboard to use new tabbed layout
    - _Requirements: UI improvement foundation_

- [x] 8. Redesigned AI Settings Page
  - [x] 8.1 Create environment status section
    - Display API key configuration status with masked previews
    - Add connection test buttons with loading states and results
    - Show clear setup instructions for missing environment variables
    - _Requirements: 1.3, 1.4, 1.5, 4.1, 4.2_

  - [x] 8.2 Build model configuration interface
    - Create text inputs for comma-separated model IDs per provider
    - Add model validation with warnings for unknown models
    - Disable inputs when provider API keys are not configured
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 8.3 Add general settings section
    - Create default provider selection dropdown
    - Add system prompt textarea and parameter controls
    - Implement save functionality with validation and feedback
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 9. Unified Model Selection Component
  - [x] 9.1 Create UnifiedModelSelector component
    - Build dropdown that loads available models from API
    - Group models by provider (OpenAI, then Anthropic) in same dropdown
    - Filter out models from providers without valid API keys
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 9.2 Add model status and availability
    - Display model availability status and disable unavailable options
    - Show provider grouping with clear visual separation
    - Handle loading states and empty model lists gracefully
    - _Requirements: 3.4, 3.5_

- [x] 10. Content Editing AI Assistant
  - [x] 10.1 Create AI quick actions component
    - Build AIQuickActions component with content editing buttons
    - Implement "Make Professional", "Make Casual", "Expand", "Summarize" actions
    - Add "Suggest Tags" functionality for tag inference
    - Create text selection detection and handling
    - _Requirements: 6.1, 6.2, 6.3, 9.1, 9.2, 9.3_

  - [x] 10.2 Build text selection manager
    - Create TextSelectionManager for textarea compatibility
    - Add selection detection and change application for current text fields
    - Prepare extension points for Tiptap and Novel editor integration
    - Implement precise text replacement with character position tracking
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 10.3 Integrate with project editor
    - Connect AI assistant to existing project editing interface
    - Add AI panel to project editor with unified model selection
    - Implement change preview and application workflow
    - Add undo/redo support for AI-generated changes
    - _Requirements: 6.4, 6.5, 6.6, 8.7_

## Error Handling and User Experience

- [x] 11. Comprehensive Error Handling
  - [x] 11.1 Implement error classification system
    - Create AIErrorType enum and AIError interface
    - Build AIErrorHandler class with context-aware error parsing
    - Add actionable error messages with suggested solutions
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 11.2 Add graceful degradation
    - Disable AI features when no providers are configured
    - Show clear status messages when AI is unavailable
    - Provide fallback options and configuration guidance
    - _Requirements: 6.6, 9.5_

- [x] 12. User Feedback and Status
  - Add loading indicators for all async operations
  - Implement success/error toast notifications
  - Create status badges for connection and configuration states
  - Add help text and documentation links throughout interface
  - _Requirements: 4.4, 5.5, 9.4_

## Database Migration and Cleanup

- [x] 13. Database Schema Migration
  - [x] 13.1 Remove old AI tables
    - Drop existing ai_settings, ai_providers, and related tables
    - Clean up any encrypted API key data from database
    - Remove foreign key constraints and indexes
    - _Requirements: 1.1, 10.3_

  - [x] 13.2 Create new simplified schema
    - Create ai_model_config table for model configuration
    - Create ai_general_settings table for non-sensitive settings
    - Add default configuration data for both providers
    - _Requirements: 2.5, 5.1_

## Integration and Testing

- [x] 14. Integration with Existing Features
  - [x] 14.1 Update project editor integration
    - Connect existing AI assistant panel to new architecture
    - Ensure backward compatibility with current editing workflows
    - Test AI functionality within project editing context
    - _Requirements: 6.1, 6.2_

  - [x] 14.2 Update admin navigation
    - Ensure AI settings page is accessible from admin dashboard
    - Update navigation links and breadcrumbs
    - Test admin workflow from settings to usage
    - _Requirements: 5.1_

- [x] 15. Testing and Validation
  - [x] 15.1 Test environment configuration scenarios
    - Test with no API keys configured ✅
    - Test with only OpenAI configured ✅
    - Test with only Anthropic configured ✅
    - Test with both providers configured ✅
    - Created comprehensive test suite in `src/__tests__/ai-environment-configuration.test.ts`
    - Tests all four environment configuration scenarios with 33 passing tests
    - Validates EnvironmentValidator behavior and AIAvailabilityChecker responses
    - Includes edge cases and error handling scenarios
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 15.2 Test error handling scenarios
    - Test with invalid API keys ✅
    - Test with network connectivity issues ✅
    - Test with rate limiting scenarios ✅
    - Test with malformed model configurations ✅
    - Created comprehensive test suite in `src/__tests__/ai-error-handling-scenarios.test.ts`
    - Tests all error handling scenarios with 32 passing tests
    - Validates AIErrorHandler parsing, classification, and recovery guidance
    - Tests AIServiceManager error responses and cascading error handling
    - Includes error context, logging, and service degradation scenarios
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

## Editor Migration Preparation

- [x] 16. Tiptap/Novel Integration Preparation
  - [x] 16.1 Create rich text editor abstraction
    - Build EditorAdapter interface for different editor types
    - Create TiptapAdapter class with selection and change application methods
    - Build NovelAdapter class for JSON-based content structures
    - Add editor type detection and dynamic adapter selection
    - _Requirements: 7.4, 7.5, 7.6_

  - [x] 16.2 Implement structured content handling
    - Create JSON content parser for Tiptap/Novel structures
    - Build block-based content modification utilities
    - Add rich text formatting preservation during AI operations
    - Implement link and media element handling in AI responses
    - _Requirements: 7.5, 7.6, 8.1, 8.2_

## Future Extension Preparation

- [x] 17. Extension Architecture Setup

  - [x] 17.1 Create function registry foundation
    - Build AIFunctionRegistry class for MCP-like function calling
    - Define AIFunction interface for system operations
    - Create example system functions (bulk edit, analytics)
    - _Requirements: Future extensibility_

  - [x] 17.2 Prepare bulk operations infrastructure
    - Create BulkEditOperation interface and database schema
    - Build BulkEditService class with background processing
    - Add operation status tracking and progress reporting
    - _Requirements: Future extensibility_

## Documentation and Deployment

- [x] 18. Documentation Updates
  - Update README with new environment variable requirements
  - Create AI configuration guide for different deployment scenarios
  - Document model configuration and troubleshooting steps
  - Add API documentation for new endpoints
  - _Requirements: 10.4, 10.5_

- [ ] 19. Environment Setup Guide
  - Create deployment guide for Vercel with environment variables
  - Document development setup with local environment configuration
  - Add troubleshooting guide for common configuration issues
  - Create migration guide from old AI architecture
  - _Requirements: 10.1, 10.2, 10.4_

## Missing Core Functionality (CRITICAL)

- [x] 20. Interactive AI Prompt Interface
  - [x] 20.1 Create Claude Artifacts-style prompt interface
    - Build AIPromptInterface component with custom prompt input and execution
    - Implement text selection detection and targeted editing capabilities
    - Add single-prompt processing without maintaining chat history
    - Create persistent user feedback display with manual dismiss option
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7_

  - [x] 20.2 Implement undo/redo with prompt restoration
    - Create snapshot system that captures both content and prompt state
    - Build undo functionality that restores article content AND previous prompt text
    - Add redo functionality with linear stack management (no branching)
    - Implement prompt restoration for user modification after undo
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7_

  - [x] 20.3 Build AI prompt processing API
    - Create POST /api/admin/ai/process-prompt endpoint for custom prompts
    - Implement single-prompt processing (system prompt + context + user prompt)
    - Add structured response parsing with content changes and user feedback
    - Handle both full content replacement and partial text updates
    - _Requirements: 6.3, 6.4, 6.8, 9.6_

  - [x] 20.4 Integrate prompt interface with project editor
    - Replace or supplement existing AI assistant panel with prompt interface
    - Combine custom prompts with quick action buttons in cohesive UI
    - Ensure both prompt and quick actions use same undo/redo system
    - Add proper text selection handling for targeted edits
    - _Requirements: 6.5, 6.9, 6.10, 8.3_

## Final Integration

- [x] 21. Remove Old AI Implementation
  - Delete old AI settings page and related components
  - Remove old AI assistant panel implementation
  - Clean up old API endpoints and database queries
  - Update imports and references throughout codebase
  - _Requirements: Cleanup and consolidation_

- [x] 22. Performance and Security Review
  - Review API key handling and ensure no database storage
  - Test performance of new provider abstraction layer
  - Validate error handling and security boundaries
  - Ensure proper rate limiting and cost controls
  - _Requirements: 1.1, 9.5, 10.5_

**🎯 Success Criteria:**
- API keys stored only in environment variables
- Simple text input model configuration working
- Unified model dropdown showing grouped models
- Real connection testing validating environment keys
- Modular architecture ready for future extensions
- Complete removal of old complex AI implementation