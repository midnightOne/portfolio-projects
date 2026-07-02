# Semantic Content Management System

## Overview

The Semantic Content Management System provides comprehensive admin-side tools for managing hierarchical content decomposition, vector embeddings, and semantic search indexes for portfolio projects. This system enables portfolio owners to organize, monitor, and optimize the semantic structure of their content through an intuitive admin interface.

## Key Features

### Simplified Tier Structure (T0-T3)
- **T0**: Auto-generated project metadata (no AI, no manual edit)
- **T1**: Project summary (AI or user-pasted, editable)
- **T2**: Heading-based summaries (H1/H2/H3 with proper nesting)
- **T3**: Raw content chunks (heading-bounded, never cross section boundaries)

### Admin Dashboard
- Real-time vector index health monitoring
- Project-level semantic chunk status
- Hierarchical tree view with inline editing
- Cost tracking and budget management
- Granular regeneration control

### Smart Automation
- Heading-bounded change detection (section-level precision)
- Surgical section updates (only regenerate changed sections)
- Partial updates on save (50-75% cost reduction)
- Cost estimation before operations (per-section accuracy)
- Draft mode skips indexing
- Configurable default behavior

### Cost Control
- Global budget allocation and tracking
- Real-time cost deduction
- Warning thresholds (80%, 90%)
- Operation blocking when depleted
- Comprehensive spending analytics

## Architecture

### Tier Hierarchy Example

```
T0 (Project Metadata)
└── T1 (Project Summary)
    ├── T2 (H1: Introduction)
    │   ├── T2 (H2: Background)
    │   │   └── T3 (Raw chunks)
    │   └── T3 (Raw chunks)
    └── T2 (H1: Implementation)
        ├── T2 (H2: Architecture)
        │   ├── T2 (H3: Database)
        │   │   └── T3 (Raw chunks)
        │   └── T3 (Raw chunks)
        └── T3 (Raw chunks)
```

### System Components

1. **Semantic Dashboard** - Centralized monitoring and control
2. **Hierarchical Tree View** - Visual content structure navigation
3. **Chunk Editor** - Inline editing with AI assistance
4. **Chunking Configuration** - System-wide settings management
5. **Budget Manager** - Financial oversight and control
6. **Regeneration Engine** - Granular content updates
7. **Bulk Operations** - Maintenance and optimization tools

## Integration Points

### Consumes From
- **client-side-ai**: ContentSearchService, VectorOperations, PassiveFIDManager
- **ai-system**: OpenAIProvider, AIAssistantPanel
- **rich-content-system**: TiptapEditor, ProjectSaveHook
- **portfolio-projects**: Project APIs, authentication

### Provides To
- **client-side-ai**: Semantic chunks for F-I-D context
- **rich-content-system**: Change detection on save
- **admin-dashboard**: Semantic content health monitoring

## Getting Started

### Prerequisites
- OpenAI API key configured
- PostgreSQL with pgvector extension
- Existing project content to index

### Initial Setup

1. **Configure Budget**
   ```typescript
   // Allocate initial funds for AI operations
   POST /api/admin/semantic/budget/allocate
   { amount: 10.00 } // $10 USD
   ```

2. **Configure Chunking**
   ```typescript
   // Set chunking parameters
   PUT /api/admin/semantic/config
   {
     chunkSize: 300,
     chunkOverlap: 50,
     embeddingModel: 'text-embedding-3-small',
     summaryMaxLength: { T1: 200, T2: 150 }
   }
   ```

3. **Generate Initial Indexes**
   ```typescript
   // Estimate cost first
   POST /api/admin/semantic/regenerate/estimate
   { scope: 'all' }
   
   // Then regenerate
   POST /api/admin/semantic/regenerate
   { scope: 'all', preserveManualEdits: false }
   ```

### Daily Workflow

1. **Edit Project Content** - Make changes in project editor
2. **Save Changes** - System detects changes automatically
3. **Review Estimation** - Modal shows cost for regeneration
4. **Confirm or Skip** - Choose to regenerate or defer
5. **Monitor Progress** - Track regeneration in dashboard
6. **Review Results** - Check updated semantic structure

## Key Concepts

### Heading-Bounded Chunking

The system uses a **heading-bounded hybrid chunking strategy** that dramatically improves efficiency:

**Core Principle**: T3 chunks never cross heading boundaries (H1/H2/H3)

**Benefits**:
- **Surgical Updates**: Edit one section → regenerate only that section's chunks
- **Stable Embeddings**: Unchanged sections keep their embeddings (no API calls)
- **Cost Efficiency**: 50-75% cost reduction for partial updates
- **Semantic Coherence**: Each chunk contains content from a single logical section

**Strategy**:
1. **Small sections** (< 50 tokens): Single chunk or merge with parent
2. **Medium sections** (50-500 tokens): Single chunk
3. **Large sections** (> 500 tokens): Split within section boundaries using natural breaks (paragraphs)
4. **Optional overlap**: Add 25 tokens overlap between chunks in same section for context

**Example**:
```
H1: Introduction (200 tokens)
  → [T3 chunk 1: entire section]

H2: Background (800 tokens)  
  → [T3 chunk 2: lines 1-400]
  → [T3 chunk 3: lines 375-800]  // 25 token overlap

H2: Motivation (150 tokens)
  → [T3 chunk 4: entire section]
```

### Change Detection

The system uses **section-level change detection** with content hashing:

**Process**:
1. Parse heading structure (old vs new)
2. Hash content for each section independently
3. Compare hashes to identify changed sections
4. Only regenerate sections with different hashes

**Change Categories**:
- **None**: No sections changed → Skip regeneration
- **Minor**: 1-2 sections changed → Selective regeneration
- **Moderate**: 3-5 sections changed → Selective regeneration
- **Major**: 5+ sections or structural changes → Full regeneration recommended
- **New**: Entirely new content → Full regeneration required

**Cost Impact**:
```
Example: 10-section article, edit 1 section

Before (uniform grid): Regenerate 3-4 overlapping chunks
Cost: ~$0.0005

After (heading-bounded): Regenerate 1-2 chunks in that section only
Cost: ~$0.0001

Savings: 80% cost reduction
```

### Cost Management

All AI operations deduct from allocated budget:

- **Embedding Generation**: ~$0.00002 per 1K tokens (small model)
- **AI Summarization**: ~$0.00015 per 1K tokens (gpt-4o-mini)
- **Warning at 80%**: System alerts when budget is low
- **Block at 100%**: No operations until more funds allocated

### Importance Scores

Each chunk has an importance score (0-1) that affects search ranking:

- **AI-Generated**: Default scores based on content analysis
- **Manual Override**: Admins can adjust for specific chunks
- **Separate Field**: Stored outside metadata for query performance
- **Preserved**: Manual scores preserved during regeneration

## API Reference

### Dashboard
- `GET /api/admin/semantic/dashboard` - Dashboard metrics
- `GET /api/admin/semantic/projects` - Project list with status

### Chunks
- `GET /api/admin/semantic/projects/[id]/tree` - Hierarchical tree
- `GET /api/admin/semantic/chunks/[id]` - Chunk details
- `PUT /api/admin/semantic/chunks/[id]` - Update chunk
- `POST /api/admin/semantic/chunks/[id]/ai-edit` - AI-assisted edit

### Regeneration
- `POST /api/admin/semantic/regenerate/estimate` - Cost estimation
- `POST /api/admin/semantic/regenerate` - Trigger regeneration
- `GET /api/admin/semantic/regenerate/[operationId]` - Progress

### Configuration
- `GET /api/admin/semantic/config` - Get configuration
- `PUT /api/admin/semantic/config` - Update configuration

### Budget
- `GET /api/admin/semantic/budget` - Budget status
- `POST /api/admin/semantic/budget/allocate` - Allocate funds
- `GET /api/admin/semantic/budget/operations` - Spending history

### Bulk Operations
- `POST /api/admin/semantic/bulk/cleanup` - Cleanup orphaned chunks
- `POST /api/admin/semantic/bulk/export` - Export indexes
- `POST /api/admin/semantic/bulk/import` - Import indexes

## Migration from T0-T4 to T0-T3

The system includes a migration script to convert existing content:

1. **Backup**: Automatic backup before migration
2. **Convert**: T0, T1, T2 preserved; T3 and T4 merged into new T3
3. **Validate**: Data integrity checks after migration
4. **Rollback**: Available if migration fails

## Performance Targets

- **Dashboard Load**: <2 seconds
- **Tree View Render**: <1 second for 500 chunks
- **Chunk Edit Save**: <500ms
- **Regeneration**: <30 seconds per project (average)
- **Bulk Cleanup**: <10 seconds for 1000 orphaned chunks

## Troubleshooting

### Budget Depleted
**Problem**: AI operations blocked due to depleted budget
**Solution**: Allocate more funds via Budget Manager

### Outdated Indexes
**Problem**: Project shows "outdated" status
**Solution**: Trigger selective regeneration for affected sections

### Orphaned Chunks
**Problem**: Chunks without parent projects
**Solution**: Run bulk cleanup operation

### High Costs
**Problem**: Regeneration costs exceed expectations
**Solution**: Adjust change detection thresholds or use selective regeneration

## Best Practices

1. **Start Small**: Allocate modest budget initially, increase as needed
2. **Use Thresholds**: Configure change detection to avoid unnecessary regeneration
3. **Preserve Edits**: Always enable "preserve manual edits" during regeneration
4. **Monitor Costs**: Review spending history regularly
5. **Bulk Operations**: Use bulk cleanup periodically to maintain database health
6. **Draft Mode**: Skip indexing for draft content until ready
7. **Selective Regeneration**: Use section-level regeneration when possible
8. **Export Regularly**: Backup semantic indexes for disaster recovery

## Related Specs

- **client-side-ai**: Consumes semantic chunks for F-I-D context and navigation
- **ai-system**: Provides AI summarization and embedding generation
- **rich-content-system**: Triggers change detection on project save
- **portfolio-projects**: Source of project content for semantic processing

## Status

**Current Phase**: Specification Complete
**Next Steps**: Begin implementation with Task 1 (Database Schema and Models)

## Contributing

When implementing tasks:
1. Follow the task order in tasks.md
2. Reference requirements in commit messages
3. Update API documentation as you build
4. Add tests for each component
5. Update this README with any architectural changes
