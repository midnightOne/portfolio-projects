# Semantic Content Management System - Implementation Plan

## Foundation and Data Models

- [x] **1. Database Schema and Models (FOUNDATION)**





  - Create enhanced `ContextChunk` model with all hierarchical fields (parentChunkId, rootChunkId, sectionGroup)
  - Move `derivationPath` to `metadata` JSON field with migration (no database reset)
  - Add `importance` as separate indexed field for query performance (not in metadata JSON)
  - Add `importanceSource` field to track if AI-generated or manually set
  - Add `manuallyEdited` boolean flag to preserve chunks during regeneration
  - Add `embeddingModel` and `embeddingGeneratedAt` fields for embedding tracking
  - Create `SemanticBudget` model for global budget tracking
  - Create `SemanticOperation` model for cost tracking and operation history
  - Create `ChunkingConfig` model for storing configuration settings
  - Create `SummaryGenerationConfig` model for configurable AI prompts and model selection
  - Create `SummaryGenerationLog` model for tracking summary generation quality and costs
  - Add database indexes for performance: (projectId, tier), (importance), (manuallyEdited), (embeddingGeneratedAt)
  - Create database migration for all new tables and fields
  - **Impact**: Establishes data foundation for semantic content management with configurable AI generation
  - _Requirements: 1.1-1.10, 6.1-6.10, 8.1-8.10_

- [x] **2. Simplified Tier Structure with Heading-Bounded Chunking (CRITICAL - ARCHITECTURE)**





  - Update `SmartContentGenerator` to implement simplified T0-T3 structure (remove T4)
  - Implement T0 generation: system-generated metadata (no AI, no manual edit, 1 per project)
  - Implement T1 generation: project summary (AI or user-pasted, editable, 1 per project)
  - Implement T2 generation: heading-based summaries (H1/H2/H3 with proper parent-child nesting)
  - Implement T3 generation: heading-bounded hybrid chunking (never cross heading boundaries)
  - Create heading-bounded chunking algorithm with three strategies: single chunk (small sections), split within boundaries (large sections), merge with parent (tiny sections)
  - Implement intelligent section splitting using natural boundaries (paragraphs preferred over arbitrary token counts)
  - Add optional overlap between chunks within same section for context continuity
  - Update `ProjectIndexer` to parse headings and create proper parent-child relationships with section content hashing
  - Implement section content extraction (including all subsections for T2 summaries)
  - Update `ContentIngestionService` to use new tier structure and heading-bounded chunking
  - Add validation to prevent chunks from crossing heading boundaries
  - Update all existing code references to use T0-T3 instead of T0-T4
  - **Impact**: Simplifies tier structure, enables surgical section updates, dramatically reduces regeneration costs
  - _Requirements: 9.1-9.10, 10.1-10.10_

## Change Detection and Smart Regeneration

- [x] **3. Simplified Change Detection System (CRITICAL - SURGICAL UPDATES)**





  - Create `ContentChangeDetector` class with diff-based change detection using old vs new content comparison
  - Implement heading parsing from both old and new content versions
  - Create heading matching algorithm using text similarity and position proximity (no invisible IDs needed)
  - Hash section content between matched headings to detect actual content changes
  - Implement change type detection (unchanged, content-modified, heading-added, heading-removed, heading-moved)
  - Calculate section-level metrics and determine change scope (minor, moderate, major, new)
  - Implement recommendation engine based on section changes (skip, selective, full regeneration)
  - Create cost estimation that only counts affected sections (not entire project)
  - Integrate with project save workflow to trigger change detection on content updates
  - Store change detection results with affected chunk IDs for audit trail
  - Add configuration for change detection thresholds (section change percentage, minor change limits)
  - **Impact**: Enables surgical section updates with 50-75% cost reduction, no cross-spec dependencies
  - _Requirements: 4.1-4.10, 10.1-10.10_

- [x] **4. Selective Section Regeneration Engine (CRITICAL - SURGICAL UPDATES)**





  - Implement three regeneration scopes: all projects, single project, specific section
  - Create section-level cost estimation API (only count affected sections, not entire project)
  - Implement section-specific regeneration that preserves unchanged sections completely (no API calls for unchanged sections)
  - Add logic to delete old T3 chunks for modified sections and generate new heading-bounded chunks
  - Implement preservation of manually edited chunks during regeneration with explicit override option
  - Create regeneration workflow that processes sections independently (parallel processing possible)
  - Implement progress tracking showing sections processed vs total sections affected
  - Add real-time progress updates via Server-Sent Events (SSE) with section-level granularity
  - Implement error handling and retry logic for failed sections (not entire project)
  - Create regeneration summary report showing preserved vs regenerated sections with cost breakdown
  - Integrate with budget system to check funds before regeneration (based on affected sections only)
  - **Impact**: Enables surgical section updates with 50-75% cost reduction for partial updates
  - _Requirements: 3.1-3.10, 4.1-4.10, 10.1-10.10_

## Budget Management and Cost Tracking

- [x] **5. Budget Management System (CRITICAL - COST CONTROL)**





  - Create `SemanticBudgetManager` class for budget operations
  - Implement budget allocation API with validation
  - Implement real-time cost deduction on AI operations
  - Add budget depletion detection and operation blocking
  - Implement warning thresholds (80%, 90%) with notifications
  - Create budget status API for dashboard display
  - Implement spending history API with filtering (project, date range, operation type)
  - Add cost breakdown by operation type (embedding, summarization)
  - Create budget analytics (cost per project, cost trends, projections)
  - Implement CSV export for cost data
  - **Impact**: Provides financial control over AI operations
  - _Requirements: 6.1-6.10_

- [x] **6. Cost Estimation and Tracking (CRITICAL - TRANSPARENCY)**





  - Implement accurate token-based cost calculation for embeddings
  - Implement token-based cost calculation for AI summarization
  - Create cost estimation for regeneration operations (before execution)
  - Add real-time cost tracking during operations
  - Implement cost attribution to projects and operations
  - Create cost analytics aggregation (daily, weekly, monthly)
  - Add cost comparison between embedding models
  - Implement cost projection based on historical data
  - Create cost alerts for unusual spending patterns
  - Add cost breakdown in operation summary reports
  - **Impact**: Enables informed decision-making about AI operations
  - _Requirements: 6.1-6.10, 3.1-3.10_

- [x] **6.1 Batch API Integration for Cost Optimization (CRITICAL - 50% COST SAVINGS)**





  - Implement OpenAI Batch API support for embedding generation during index creation/regeneration
  - Create batch job submission for non-time-sensitive embedding operations (overnight regeneration, bulk indexing)
  - Add batch job status polling and completion detection (24-hour processing window)
  - Implement automatic fallback to standard API for time-sensitive operations (real-time search, immediate updates)
  - Create batch mode toggle in regeneration UI with cost comparison (standard vs batch pricing)
  - Add batch job queue management and prioritization
  - Implement batch result processing and database updates
  - Create batch operation analytics (cost savings, processing time, success rate)
  - Add configuration for batch vs standard API selection based on urgency
  - Display estimated savings in regeneration cost estimation UI
  - **Impact**: 50% cost reduction on embeddings for non-urgent operations ($0.01 vs $0.02 per 1M tokens)
  - _Requirements: 6.1-6.10_

## Admin Dashboard and UI Components

- [x] **7. Semantic Dashboard Page (CRITICAL - ADMIN INTERFACE)**





  - Create `/admin/semantic` route and page component
  - Implement dashboard metrics API (`/api/admin/semantic/dashboard`)
  - Display vector index health metrics (total chunks, embeddings, query performance)
  - Display project list with semantic status (chunk count, tier distribution, last updated)
  - Show global budget status with visual indicators (ok, warning, critical, depleted)
  - Add health status indicators per project (healthy, outdated, incomplete, error)
  - Implement sorting and filtering for project list
  - Add quick action buttons (regenerate all, cleanup, export)
  - Display cost analytics overview (total spent, breakdown by type)
  - Implement real-time updates for ongoing operations
  - **Add batch job status section** showing active/completed batch operations with progress and savings
  - **Impact**: Provides centralized monitoring and control interface
  - _Requirements: 1.1-1.10_

- [x] **8. Hierarchical Tree View Component (CRITICAL - CONTENT VISUALIZATION)**





  - Create `SemanticTreeView` component with expandable/collapsible nodes
  - Implement tree data fetching API (`/api/admin/semantic/projects/[id]/tree`)
  - Display tier hierarchy (T0 → T1 → T2 → T2 → T3) with visual nesting
  - Show chunk metadata (title, content preview, token count, importance)
  - Add tier-specific icons and colors for visual distinction
  - Implement expand/collapse all functionality
  - Add chunk selection for bulk operations
  - Show embedding status indicators (has embedding, pending, outdated)
  - Display manual edit indicators for preserved chunks
  - Implement search/filter within tree view
  - **Impact**: Enables understanding and navigation of semantic structure
  - _Requirements: 2.1-2.10_

- [x] **9. Chunk Editor Component (CRITICAL - CONTENT EDITING)**





  - Create `SemanticChunkEditor` component with inline editing
  - Implement chunk details API (`/api/admin/semantic/chunks/[id]`)
  - Add manual text editing with validation
  - Integrate AI-assisted editing with prompt interface (reuse from project editor)
  - Implement importance score adjustment with slider/numeric input
  - Add metadata display and editing
  - Show chunk relationships (parent, children, siblings)
  - Implement save/cancel with optimistic updates
  - Add "preserve during regeneration" toggle
  - Create AI-assisted editing API (`/api/admin/semantic/chunks/[id]/ai-edit`)
  - **Impact**: Enables manual refinement of semantic content
  - _Requirements: 2.1-2.10, 8.1-8.10_

- [x] **10. Chunking Configuration Interface (CRITICAL - SYSTEM SETTINGS)**





  - Create `ChunkingConfig` component for settings management
  - Implement configuration API (`/api/admin/semantic/config`)
  - Add chunk size configuration with live examples at different sizes
  - Add chunk overlap configuration with explanation of trade-offs
  - Implement embedding model selection (small vs large) with cost comparison
  - Add summary max length settings for T1 and T2
  - Implement change detection threshold configuration
  - Add default behavior setting (auto, manual, prompt)
  - **Add batch mode preferences** (enable/disable, minimum chunks threshold, auto-schedule overnight)
  - **Add batch mode default selection** for different operation types (regeneration, bulk operations, initial indexing)
  - Show cost impact calculator for configuration changes
  - Add "regenerate required" warning when changing parameters
  - **Impact**: Enables optimization of semantic decomposition with cost control
  - _Requirements: 5.1-5.10_

- [x] **11. Budget Manager Interface (CRITICAL - FINANCIAL CONTROL)**





  - Create `SemanticBudgetManager` component for budget management
  - Display current budget status with visual progress bar
  - Implement fund allocation interface with validation
  - Show spending history with filtering and sorting
  - Display cost breakdown by operation type (pie chart)
  - Add warning threshold configuration
  - Show cost analytics (trends, projections, per-project breakdown)
  - Implement budget depletion alerts with action buttons
  - Add CSV export for spending history
  - Create budget allocation API (`/api/admin/semantic/budget/allocate`)
  - **Impact**: Provides financial oversight and control
  - _Requirements: 6.1-6.10_

## Regeneration and Bulk Operations

- [x] **12. Regeneration Workflow Implementation (CRITICAL - CORE FUNCTIONALITY)**





  - Create regeneration estimation API (`/api/admin/semantic/regenerate/estimate`)
  - Implement regeneration trigger API (`/api/admin/semantic/regenerate`)
  - Create regeneration progress API with SSE (`/api/admin/semantic/regenerate/[operationId]`)
  - Implement cost estimation modal with detailed breakdown
  - **Add batch mode selection UI** with cost comparison (immediate vs scheduled with 50% savings)
  - **Display processing time estimates** for both modes (30 seconds vs 24 hours)
  - **Show total savings** when batch mode is selected
  - Add confirmation dialog for expensive operations
  - Implement progress tracking UI with real-time updates
  - Show regeneration summary report on completion
  - Add error handling and retry UI for failed operations
  - Implement budget check before starting regeneration
  - Create operation cancellation functionality
  - **Impact**: Enables controlled semantic index updates with cost optimization options
  - _Requirements: 3.1-3.10, 4.1-4.10_

- [x] **13. Bulk Operations Implementation (CRITICAL - MAINTENANCE)**






  - Implement cleanup orphaned chunks API (`/api/admin/semantic/bulk/cleanup`)
  - Create cleanup preview UI showing chunks to be deleted
  - Implement regenerate from scratch with comprehensive cost estimation
  - **Add batch mode option for bulk regeneration** with automatic scheduling for overnight processing
  - Add batch processing with progress tracking
  - Create export semantic indexes API (`/api/admin/semantic/bulk/export`)
  - Implement import semantic indexes API (`/api/admin/semantic/bulk/import`)
  - Add conflict resolution UI for import operations
  - Implement validation for imported data
  - Create bulk importance score update functionality
  - **Add bulk embedding regeneration with batch mode** for model changes (50% cost savings)
  - **Display estimated completion time and cost savings** for batch operations
  - **Impact**: Enables efficient maintenance of semantic content with cost optimization
  - _Requirements: 7.1-7.10_

## Integration and Migration

- [x] **14. Production-Ready Semantic System Integration (CRITICAL - FINAL MILESTONE)**
  - **Architectural Constraints (MUST FOLLOW):**
    - **Principle of "Extend, Don't Reinvent":** Before creating any new service, you MUST search the codebase for existing services with similar functionality. Your primary goal is to extend and enhance existing components. Do not create redundant services.
    - **Service Discovery:** Key existing services and tools are defined in `src/lib/ai/tools/server-tools.ts` and implemented by services like `ContentSearchService.ts`. You must analyze these files to identify the correct services to modify.
    - **Adherence to Existing Patterns:** All new code must follow the patterns and architectural principles established in the existing codebase.
  - **Integration Steps:**
    - **Update Existing ContentSearchService:** Find the service that implements the `content_search` tool and update its `searchContentInternal()` method to use the `importance` field from semantic chunks in the ranking algorithm, alongside the existing similarity scores. **DO NOT CREATE A NEW SEARCH SERVICE.**
    - **Enhance VectorOperations:** Verify that the existing `VectorOperations.upsertContextChunkWithVector()` method properly handles all hierarchical fields (`parentChunkId`, `rootChunkId`, etc.) passed from the `SmartContentGenerator`.
    - **Connect SmartContentGenerator:** Update `ContentIngestionService.ingestProject()` to use `SmartContentGenerator.generateHierarchicalContent()` instead of any legacy tier generation logic.
    - **Integrate Change Detection:** Add a `ContentChangeDetector.detectChanges()` trigger to the project save workflow in the project editor to enable surgical regeneration.
    - **Create Semantic Chunks API:** Implement the `/api/semantic/chunks/[projectId]` endpoint for the `PassiveFIDManager` to consume for F-I-D context.
    - **Integrate Centralized Budget/AI Provider:** Ensure that the `SmartContentGenerator` and `ContentIngestionService` use the **existing, centralized `BudgetAwareAIOperations` service** for all AI calls. Do not create new client instances.
    - **Verify Backend Tool Integration:** Confirm that the **existing** `content_search` server tool in `BackendToolService` correctly uses the now-updated `ContentSearchService`. No new tool should be created.
    - **Create SummaryGenerationService:** Implement a new, configurable `SummaryGenerationService` with anti-hallucination measures, model selection, and quality tracking for T1/T2 generation.
    - **Implement Embedding Strategy:** Create the embedding generation strategy where T1/T2 use summaries + project context, T3 uses full content, and T0 gets no embedding.
    - **Update UI Components:** Update the project list and admin components to display semantic index health (chunk count, last regenerated, embedding coverage).
    - **Create Health Monitoring:** Implement semantic system health checks with database performance metrics, embedding coverage analytics, and cost tracking.
    - **Ensure Client-Side AI Compatibility**: Verify all existing client-side AI integrations continue working.
  - **Impact**: Creates a production-ready semantic content management system that is fully and correctly integrated with the existing infrastructure, avoiding redundancy and maintaining client-side AI compatibility.
  - _Requirements: 1.1-1.10 (dashboard integration), 2.1-2.10 (content editing), 3.1-3.10 (regeneration), 4.1-4.10 (change detection), 6.1-6.10 (budget management), 8.1-8.10 (importance scoring), 9.1-9.10 (tier structure), 10.1-10.10 (heading-bounded chunking), 11.1-11.10 (embedding monitoring)_


- [x] **15. Stage-Based Content Processing with Granular Control**





  - **Problem**: Current system processes all stages (chunking, summaries, embeddings) in one monolithic operation, causing UX issues: modal blocking, progress loss on failure, no granular control, and 404 errors from missing progress endpoints.
  - **Solution**: Implement a stage-based processing architecture with persistent progress tracking, granular admin control, and resumable operations.
  - **Key Components**:
    - **Stage-Based Processing Service**: Break content generation into independent stages (chunking → summaries → embeddings → validation)
    - **Persistent Progress Panel**: Replace modal with dashboard-integrated progress tracking using Server-Sent Events (SSE)
    - **Granular Control Interface**: Allow admins to select which stages to execute and processing modes (immediate vs batch)
    - **Checkpoint System**: Enable resuming operations from last successful stage
    - **Progress API Endpoints**: Implement proper progress tracking endpoints to eliminate 404 errors
    - **Background Processing**: Long operations run in background without blocking UI navigation
  - **Admin Benefits**: Step-by-step control, progress persistence, cost optimization, failure recovery, and better UX
  - _Requirements: 1.1-1.10 (dashboard integration), 2.1-2.10 (content editing), 3.1-3.10 (regeneration), 6.1-6.10 (budget management)_



## Testing and Documentation

- [ ] **15. Testing Suite (CRITICAL - QUALITY ASSURANCE)**
  - Create unit tests for tier generation logic
  - Add unit tests for change detection algorithm
  - Implement unit tests for cost calculation
  - Create integration tests for regeneration workflow
  - Add integration tests for budget management
  - Implement performance tests for large projects (1000+ chunks)
  - Create load tests for concurrent regeneration operations
  - Add database query performance tests
  - Implement end-to-end tests for admin workflows
  - Create visual regression tests for UI components
  - **Impact**: Ensures system reliability and performance
  - _Requirements: All requirements - quality assurance_

- [ ] **16. Data Migration and Backward Compatibility (CRITICAL - MIGRATION)**
  - Create migration script to convert existing T0-T4 structure to T0-T3
  - Implement data validation for existing chunks
  - Add importance score generation for existing chunks (AI-based)
  - Migrate existing embeddings to new schema
  - Create backup mechanism before migration
  - Implement rollback capability for failed migrations
  - Add migration progress tracking and reporting
  - Create data integrity validation after migration
  - Update all existing API consumers to use new structure
  - Add deprecation warnings for old tier structure
  - **Impact**: Enables smooth transition to new tier structure
  - _Requirements: All requirements - backward compatibility_

- [ ] **17. Documentation and User Guides (CRITICAL - USABILITY)**
  - Create admin user guide for semantic content management
  - Document tier structure and relationships
  - Write guide for change detection and regeneration
  - Create budget management documentation
  - Document chunking configuration options
  - Write API documentation for all endpoints
  - Create troubleshooting guide for common issues
  - Document data migration process
  - Add inline help text and tooltips in UI
  - Create video tutorials for key workflows
  - **Impact**: Enables effective use of the system
  - _Requirements: All requirements - documentation_

## Task 14 Implementation Context

### Current System Analysis

**Existing Services (Already Implemented):**
- `ContentSearchService`: Full semantic search with MMR, embedding cache, importance scoring support
- `VectorOperations`: pgvector operations with hierarchical field support (parentChunkId, rootChunkId, etc.)
- `SmartContentGenerator`: T0-T3 tier generation with heading-bounded chunking
- `ContentIngestionService`: Hybrid tier generation with user markers and AI fallback
- `BudgetAwareAIOperations`: Budget tracking for all AI operations with batch API support
- `PassiveFIDManager`: Client-side F-I-D context management with server API integration
- `BackendToolService`: Server-side tool execution (needs content.search tool)

**Integration Requirements for Task 14:**

```typescript
// 1. ContentSearchService Enhancement (EXISTING - needs importance integration)
class ContentSearchService {
  // EXISTING: Full semantic search implementation
  async searchContentInternal(params: ContentSearchParams): Promise<ContentSearchResult>
  
  // NEEDED: Integrate importance scores in ranking
  // Current: Uses only similarity scores
  // Required: Combine similarity + importance for final ranking
}

// 2. Semantic Chunks API (NEW - needed for PassiveFIDManager)
"GET /api/semantic/chunks/[projectId]": {
  purpose: "Provide semantic chunks for F-I-D context";
  consumer: "PassiveFIDManager._fetchFromServer()";
  implementation: "Query context_chunks table with hierarchical data";
  response: "Array of semantic chunks with tier, content, importance";
}

// 3. Content Search Tool (NEW - needed for BackendToolService)
const contentSearchTool: UnifiedToolDefinition = {
  name: 'content.search',
  description: 'Search semantic content using embeddings and importance scores',
  executionContext: 'server',
  implementation: 'Use existing ContentSearchService.searchContentInternal()'
}

// 4. Change Detection Integration (NEW - needed for project editor)
// Trigger: Project save in enhanced-project-editor.tsx
// Action: Call ContentChangeDetector.detectChanges() 
// Result: Surgical regeneration recommendations

// 5. SummaryGenerationService (NEW - quality control)
class SummaryGenerationService {
  // Anti-hallucination measures: low temperature, factual accuracy instructions
  // Model selection: gpt-4o, gpt-4o-mini, claude-3-5-sonnet with cost comparison
  // Quality tracking: confidence scoring, manual review flags
  async generateT1Summary(project: any, config: SummaryConfig): Promise<string>
  async generateT2Summary(section: any, config: SummaryConfig): Promise<string>
}
```

### Integration Verification Checklist

**Client-Side AI Compatibility:**
- [ ] PassiveFIDManager can fetch semantic chunks via new API
- [ ] ContentSearchService continues to work with client-side tools
- [ ] F-I-D context includes semantic chunk data
- [ ] Existing voice AI tools continue to function

**Production Readiness:**
- [ ] All AI operations use BudgetAwareAIOperations for cost tracking
- [ ] Semantic system health monitoring implemented
- [ ] Database performance optimized for semantic queries
- [ ] Error handling and fallbacks for all integrations

## External API Integration Points

### APIs This System Provides

```typescript
// For Client-Side AI System (CRITICAL - maintains compatibility)
"GET /api/semantic/chunks/[projectId]": "Retrieve semantic chunks for F-I-D context";
"POST /api/ai/tools/execute": "Server-side content.search tool execution";

// For Rich Content System
"POST /api/semantic/detect-changes": "Detect content changes on project save";
"GET /api/semantic/status/[projectId]": "Get semantic index status for project";

// For Admin Dashboard
"GET /api/admin/semantic/dashboard": "Dashboard metrics and project status";
"GET /api/admin/semantic/projects/[id]/tree": "Hierarchical tree view data";

// Services for Integration (EXISTING - verified working)
ContentSearchService: "Semantic search with importance scoring";
SmartContentGenerator: "T0-T3 tier generation with heading-bounded chunking";
BudgetAwareAIOperations: "Budget-aware AI operations with cost tracking";
ContentChangeDetector: "Change detection for surgical regeneration";
```

### APIs This System Requires (EXISTING - verified available)

```typescript
// From Client-Side AI System (EXISTING)
ContentSearchService: "Semantic search functionality - IMPLEMENTED";
VectorOperations: "pgvector database operations - IMPLEMENTED";
PassiveFIDManager: "F-I-D context caching - IMPLEMENTED";
BackendToolService: "Server-side tool execution - NEEDS content.search tool";

// From AI System (EXISTING)
BudgetAwareAIOperations: "Budget-aware AI operations - IMPLEMENTED";
OpenAI: "AI summarization and embedding generation - IMPLEMENTED";

// From Rich Content System (EXISTING)
enhanced-project-editor: "Article content editing - NEEDS change detection trigger";
ProjectIndexer: "Content indexing and structure analysis - IMPLEMENTED";

// From Portfolio-Projects System (EXISTING)
"GET /api/projects/[id]": "Project data for semantic processing - AVAILABLE";
Prisma models: "Database access for semantic chunks - AVAILABLE";

// From UI System (EXISTING)
Button, Card, Input, Select, Badge, Progress, Alert, Modal, Tree: "Base UI components - AVAILABLE";
Admin components: "Semantic dashboard, tree view, chunk editor - IMPLEMENTED";
```

### Task 14 Success Criteria

**Integration Completeness:**
1. ContentSearchService uses importance scores in ranking algorithm
2. PassiveFIDManager can fetch semantic chunks via new API endpoint
3. BackendToolService includes content.search tool for voice AI
4. Project editor triggers change detection on save
5. All AI operations use BudgetAwareAIOperations for cost tracking

**Production Readiness:**
1. Semantic system health monitoring dashboard
2. Database performance optimized for semantic queries  
3. Error handling and graceful fallbacks for all integrations
4. Client-side AI compatibility maintained (no breaking changes)
5. Cost tracking and budget management fully operational

**Quality Controls:**
1. SummaryGenerationService with anti-hallucination measures
2. Configurable prompts and model selection
3. Quality tracking with confidence scoring
4. Embedding strategy optimized for search effectiveness
5. Comprehensive monitoring and analytics

## Implementation Notes

### Tier Structure Migration

The system implements a simplified tier structure:
- **T0**: Project metadata (system-generated, no AI, no edit)
- **T1**: Project summary (AI or manual, editable)
- **T2**: Heading summaries (H1/H2/H3 with nesting)
- **T3**: Raw content chunks (terminal tier)

This replaces the previous T0-T4 structure where T4 was the terminal tier. The migration script will:
1. Keep T0, T1, T2 as-is
2. Merge T3 and T4 into new T3
3. Update all parent-child relationships
4. Regenerate embeddings if needed

### Change Detection Thresholds

Default thresholds for change detection:
- **Minor**: <5% character change, 0 sections modified → Skip regeneration
- **Moderate**: <20% character change, <3 sections modified → Selective regeneration
- **Major**: >20% character change or >5 sections modified → Full regeneration
- **New**: Entirely new content → Full regeneration with cost estimation

### Budget Management

Default budget settings:
- **Warning threshold**: 80% of allocated funds
- **Critical threshold**: 90% of allocated funds
- **Depletion**: 100% - blocks all AI operations
- **Default allocation**: $10 USD (configurable)

### Cost Estimates

Approximate costs (as of 2024):
- **text-embedding-3-small**: $0.00002 per 1K tokens
- **text-embedding-3-large**: $0.00013 per 1K tokens
- **gpt-4o-mini summarization**: $0.00015 per 1K input tokens

### Performance Targets

- **Dashboard load**: <2 seconds
- **Tree view render**: <1 second for 500 chunks
- **Chunk edit save**: <500ms
- **Regeneration**: <30 seconds per project (average)
- **Bulk cleanup**: <10 seconds for 1000 orphaned chunks
