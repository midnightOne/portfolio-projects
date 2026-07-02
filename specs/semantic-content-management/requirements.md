# Semantic Content Management System - Requirements Document

## Introduction

The Semantic Content Management System provides comprehensive admin-side tools for managing hierarchical content decomposition, vector embeddings, and semantic search indexes for portfolio projects. This system enables portfolio owners to organize, monitor, and optimize the semantic structure of their content through an intuitive admin interface with AI-assisted generation, manual editing capabilities, and real-time health monitoring.

The system implements a simplified 4-tier hierarchy (T0-T3) based on document structure, with intelligent change detection, cost-aware regeneration, and granular control over semantic chunking and embedding generation.

## Requirements

### Requirement 1

**User Story:** As a portfolio owner, I want a centralized admin dashboard for semantic content health, so that I can monitor the status of all my project indexes and vector embeddings in one place.

#### Acceptance Criteria

1. WHEN accessing the semantic content dashboard THEN the system SHALL display real-time vector index health metrics (size, performance, last updated)
2. WHEN viewing the dashboard THEN the system SHALL show a list of all projects with their semantic chunk status (total chunks, tier distribution, last regeneration date)
3. WHEN viewing project status THEN the system SHALL indicate which projects have outdated indexes or missing embeddings
4. WHEN monitoring index health THEN the system SHALL display database performance metrics (query times, index size, embedding coverage)
5. WHEN viewing cost metrics THEN the system SHALL show cumulative costs for embedding generation and AI summarization per project
6. WHEN checking system health THEN the system SHALL provide warnings for projects with incomplete or corrupted semantic structures
7. WHEN viewing the dashboard THEN the system SHALL display the current global budget allocation and remaining funds for AI operations
8. WHEN budget is depleted THEN the system SHALL prominently display a warning and provide options to allocate more funds
9. WHEN viewing project list THEN the system SHALL allow sorting and filtering by chunk count, last updated, cost, or health status
10. WHEN accessing the dashboard THEN the system SHALL provide quick action buttons for common operations (regenerate all, cleanup orphaned chunks, export indexes)

### Requirement 2

**User Story:** As a portfolio owner, I want to view and edit the hierarchical semantic structure of each project, so that I can understand and refine how my content is organized for AI navigation.

#### Acceptance Criteria

1. WHEN selecting a project THEN the system SHALL display a hierarchical tree view of all semantic chunks (T0 → T1 → T2 → T3)
2. WHEN viewing the tree THEN the system SHALL show each chunk's tier, title, content preview, parent-child relationships, and metadata
3. WHEN expanding a chunk node THEN the system SHALL display its full content, token count, embedding status, and importance score
4. WHEN viewing T2 chunks THEN the system SHALL clearly indicate which heading (H1/H2/H3) each chunk represents and its nesting level
5. WHEN viewing T3 chunks THEN the system SHALL show the raw article content with line number ranges for precise location mapping
6. WHEN clicking on a chunk THEN the system SHALL open an inline editor with the chunk's current content
7. WHEN editing a chunk THEN the system SHALL provide both manual text editing and AI-assisted editing with custom prompts
8. WHEN using AI-assisted editing THEN the system SHALL provide the same prompt interface as project edit mode (tone, style, custom instructions)
9. WHEN saving edited chunks THEN the system SHALL mark them as manually modified and preserve them during automatic regeneration
10. WHEN viewing chunk relationships THEN the system SHALL visually indicate parent-child connections and allow drag-and-drop reorganization

### Requirement 3

**User Story:** As a portfolio owner, I want granular control over semantic index regeneration, so that I can update specific sections without regenerating entire projects unnecessarily.

#### Acceptance Criteria

1. WHEN triggering regeneration THEN the system SHALL provide three scope options: all projects, single project, or specific section
2. WHEN selecting "regenerate all projects" THEN the system SHALL display a cost estimation modal with total token usage and API costs before proceeding
3. WHEN selecting "regenerate single project" THEN the system SHALL show project-specific cost estimation and allow confirmation or cancellation
4. WHEN selecting "regenerate specific section" THEN the system SHALL identify the section by heading (H1/H2/H3) and regenerate only affected T2 and T3 chunks
5. WHEN regenerating sections THEN the system SHALL preserve manually edited chunks unless explicitly overridden by user
6. WHEN regeneration is in progress THEN the system SHALL display real-time progress (chunks processed, tokens used, estimated time remaining)
7. WHEN regeneration completes THEN the system SHALL show a summary report (chunks created/updated, embeddings generated, total cost, processing time)
8. WHEN regeneration fails THEN the system SHALL provide detailed error messages and allow retry with adjusted parameters
9. WHEN triggering regeneration THEN the system SHALL check global budget allocation and prevent operation if insufficient funds remain
10. WHEN regeneration would exceed budget THEN the system SHALL prompt user to allocate additional funds or reduce scope

### Requirement 4

**User Story:** As a portfolio owner, I want intelligent change detection for semantic indexes, so that minor edits don't trigger expensive full regenerations.

#### Acceptance Criteria

1. WHEN saving article changes THEN the system SHALL detect the scope of changes (typo fixes, minor edits, major rewrites, new content)
2. WHEN changes are minor (below threshold) THEN the system SHALL preserve existing semantic indexes without regeneration
3. WHEN changes are moderate THEN the system SHALL identify affected sections and offer selective regeneration with cost estimation
4. WHEN changes are major THEN the system SHALL recommend full project regeneration with detailed cost breakdown
5. WHEN saving entirely new articles THEN the system SHALL display a cost estimation modal before generating semantic indexes
6. WHEN in draft mode THEN the system SHALL skip automatic index generation and allow manual triggering when ready
7. WHEN configuring change detection THEN the system SHALL provide threshold settings (character change percentage, section modification count)
8. WHEN viewing change detection results THEN the system SHALL highlight which sections were identified as changed
9. WHEN change detection identifies conflicts THEN the system SHALL provide conflict resolution UI for overlapping or invalid tier assignments
10. WHEN manually edited chunks exist THEN the system SHALL preserve them during automatic regeneration unless explicitly overridden

### Requirement 5

**User Story:** As a portfolio owner, I want configurable chunking parameters, so that I can optimize semantic decomposition for my specific content and use cases.

#### Acceptance Criteria

1. WHEN accessing chunking settings THEN the system SHALL provide configuration for chunk size (tokens per T3 chunk) with live examples
2. WHEN configuring chunk size THEN the system SHALL display sample chunks at different sizes to illustrate the impact
3. WHEN setting chunk overlap THEN the system SHALL allow configuration of overlap tokens for context continuity between chunks
4. WHEN configuring overlap THEN the system SHALL explain the trade-off between context continuity and index size
5. WHEN selecting embedding model THEN the system SHALL provide options (text-embedding-3-small, text-embedding-3-large) with cost comparison
6. WHEN choosing embedding model THEN the system SHALL default to text-embedding-3-small (cheaper option) with clear upgrade path
7. WHEN configuring tier generation THEN the system SHALL explain the heading-based approach (H1/H2/H3 → T2 hierarchy)
8. WHEN setting summary max length THEN the system SHALL allow configuration of maximum tokens for AI-generated summaries per tier
9. WHEN summary exceeds max length THEN the system SHALL truncate intelligently at sentence boundaries
10. WHEN changing chunking parameters THEN the system SHALL warn about the need to regenerate existing indexes and provide cost estimation

### Requirement 6

**User Story:** As a portfolio owner, I want cost tracking and budget management for AI operations, so that I can control spending on semantic index generation and embedding creation.

#### Acceptance Criteria

1. WHEN accessing budget settings THEN the system SHALL display current global budget allocation for AI operations
2. WHEN setting budget THEN the system SHALL allow configuration of total funds allocated for semantic content management
3. WHEN AI operations occur THEN the system SHALL deduct costs in real-time from the allocated budget
4. WHEN budget is depleted THEN the system SHALL prevent further AI operations and prompt user to allocate additional funds
5. WHEN viewing cost breakdown THEN the system SHALL show separate costs for embedding generation and AI summarization
6. WHEN viewing project costs THEN the system SHALL display per-project cost history and cumulative spending
7. WHEN estimating costs THEN the system SHALL provide accurate token-based cost calculations before operations
8. WHEN budget approaches limit THEN the system SHALL display warnings at 80% and 90% thresholds
9. WHEN reviewing spending THEN the system SHALL provide cost analytics (cost per project, cost per tier, cost trends over time)
10. WHEN exporting cost data THEN the system SHALL allow CSV export of all AI operation costs with timestamps and project attribution

### Requirement 7

**User Story:** As a portfolio owner, I want bulk operations for semantic content management, so that I can efficiently maintain and optimize my entire content library.

#### Acceptance Criteria

1. WHEN accessing bulk operations THEN the system SHALL provide "cleanup orphaned chunks" action to remove chunks without parent projects
2. WHEN cleaning up orphaned chunks THEN the system SHALL display a preview of chunks to be deleted and require confirmation
3. WHEN accessing bulk operations THEN the system SHALL provide "regenerate from scratch" action for complete index rebuild
4. WHEN regenerating from scratch THEN the system SHALL display comprehensive cost estimation for all projects before proceeding
5. WHEN performing bulk regeneration THEN the system SHALL process projects in batches with progress tracking
6. WHEN bulk operations fail THEN the system SHALL provide detailed error logs and allow resumption from last successful point
7. WHEN accessing bulk operations THEN the system SHALL provide "export all indexes" action for backup purposes
8. WHEN exporting indexes THEN the system SHALL generate a downloadable archive with all semantic chunks and embeddings
9. WHEN accessing bulk operations THEN the system SHALL provide "import indexes" action for restoration or migration
10. WHEN importing indexes THEN the system SHALL validate data integrity and provide conflict resolution for existing chunks

### Requirement 8

**User Story:** As a portfolio owner, I want manual control over chunk importance scores, so that I can influence which content appears in semantic search results.

#### Acceptance Criteria

1. WHEN viewing a chunk THEN the system SHALL display its current importance score (0-1 scale)
2. WHEN editing importance score THEN the system SHALL provide a slider or numeric input for manual adjustment
3. WHEN importance score is AI-generated THEN the system SHALL clearly indicate it as default and allow override
4. WHEN manually setting importance THEN the system SHALL mark the score as user-defined and preserve it during regeneration
5. WHEN importance score changes THEN the system SHALL store it in a separate database field for faster query performance
6. WHEN viewing importance scores THEN the system SHALL provide explanations of how scores affect semantic search ranking
7. WHEN bulk editing importance THEN the system SHALL allow selection of multiple chunks and batch score updates
8. WHEN resetting importance scores THEN the system SHALL provide option to regenerate AI-based scores for selected chunks
9. WHEN importance scores are inconsistent THEN the system SHALL provide warnings and suggestions for normalization
10. WHEN querying semantic search THEN the system SHALL use importance scores as a ranking factor alongside embedding similarity

### Requirement 9

**User Story:** As a portfolio owner, I want to understand the simplified tier structure, so that I can effectively organize my content for AI navigation and semantic search.

#### Acceptance Criteria

1. WHEN viewing tier documentation THEN the system SHALL explain T0 as auto-generated project metadata (no AI, no manual edit, 1 per project)
2. WHEN viewing tier documentation THEN the system SHALL explain T1 as project summary (AI or user-pasted, editable, 1 per project, child of T0)
3. WHEN viewing tier documentation THEN the system SHALL explain T2 as heading-based summaries (H1/H2/H3 with proper parent-child nesting)
4. WHEN viewing tier documentation THEN the system SHALL explain T3 as raw content chunks (actual article text, terminal tier)
5. WHEN creating T2 chunks THEN the system SHALL generate summaries of entire sections including all subsections
6. WHEN T2 represents H2 inside H1 THEN the system SHALL create proper parent-child relationship (H2's T2 is child of H1's T2)
7. WHEN generating T2 content THEN the system SHALL create AI summaries that capture the essence of the section and its subsections
8. WHEN creating T3 chunks THEN the system SHALL chunk the raw article content with configured size and overlap
9. WHEN viewing tier hierarchy THEN the system SHALL visually represent the tree structure (T0 → T1 → T2 → T2 → T3)
10. WHEN tier structure is violated THEN the system SHALL prevent invalid relationships and provide clear error messages

### Requirement 10

**User Story:** As a portfolio owner, I want heading-bounded chunking for T3 content, so that editing one section doesn't invalidate chunks from other sections.

#### Acceptance Criteria

1. WHEN generating T3 chunks THEN the system SHALL never create chunks that cross heading boundaries (H1/H2/H3)
2. WHEN a section is small THEN the system SHALL create a single T3 chunk for that section
3. WHEN a section is large THEN the system SHALL split it into multiple T3 chunks within section boundaries
4. WHEN splitting large sections THEN the system SHALL prefer natural boundaries (paragraphs, sentences) over arbitrary token counts
5. WHEN creating multiple chunks in a section THEN the system SHALL optionally add overlap between chunks for context continuity
6. WHEN a section is tiny THEN the system SHALL merge it with parent context or create a minimal chunk
7. WHEN detecting content changes THEN the system SHALL identify which sections changed using content hashing
8. WHEN regenerating content THEN the system SHALL only regenerate T3 chunks for sections that actually changed
9. WHEN preserving unchanged sections THEN the system SHALL keep existing T3 chunks and embeddings without API calls
10. WHEN configuring chunking THEN the system SHALL provide settings for target chunk size, max section size, min section size, and overlap

### Requirement 11

**User Story:** As a portfolio owner, I want embedding generation monitoring, so that I can track progress and costs for vector index creation.

#### Acceptance Criteria

1. WHEN embedding generation starts THEN the system SHALL display a progress indicator with chunks processed and estimated time remaining
2. WHEN generating embeddings THEN the system SHALL show real-time cost accumulation based on token usage
3. WHEN embedding generation completes THEN the system SHALL display a summary report (total embeddings, tokens used, total cost, processing time)
4. WHEN embedding generation fails THEN the system SHALL provide detailed error messages and allow retry for failed chunks
5. WHEN viewing embedding status THEN the system SHALL indicate which chunks have embeddings and which are pending
6. WHEN embeddings are outdated THEN the system SHALL flag chunks whose content has changed since embedding generation
7. WHEN regenerating embeddings THEN the system SHALL provide selective regeneration for outdated chunks only
8. WHEN embedding model changes THEN the system SHALL warn that all embeddings need regeneration and provide cost estimation
9. WHEN monitoring embedding quality THEN the system SHALL provide basic quality metrics (embedding dimension, model version)
10. WHEN embedding generation is interrupted THEN the system SHALL allow resumption from last successful chunk

## Tier Structure Reference

### T0: Project Metadata
- **Count**: Exactly 1 per project
- **Content**: Auto-generated JSON (title, tags, technologies, workDate)
- **Generation**: System-generated, no AI, no manual edit
- **Parent**: None (root)
- **Children**: Exactly 1 T1
- **Regeneration**: Automatic when project metadata changes

### T1: Project Summary
- **Count**: Exactly 1 per project
- **Content**: High-level project summary (AI-generated or user-pasted)
- **Generation**: AI or manual, editable
- **Parent**: T0
- **Children**: Multiple T2 (one per top-level heading)
- **Regeneration**: On demand or when article significantly changes

### T2: Heading-Based Summaries
- **Count**: One per H1/H2/H3 heading
- **Content**: AI-generated summary of entire section including subsections
- **Generation**: AI-generated based on section content
- **Parent**: T1 (for H1) or parent heading's T2 (for H2/H3)
- **Children**: Child heading's T2 (if nested) and T3 chunks
- **Regeneration**: When section content changes

### T3: Raw Content Chunks
- **Count**: Multiple per section (heading-bounded)
- **Content**: Raw article text chunks (never cross heading boundaries)
- **Generation**: Heading-bounded hybrid chunking with intelligent splitting
- **Parent**: Parent heading's T2 chunk
- **Children**: None (terminal tier)
- **Regeneration**: Only when parent section content changes (surgical updates)
