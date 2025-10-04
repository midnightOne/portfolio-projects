# Chunking Configuration Implementation

## Overview

This document describes the implementation of Task 10: Chunking Configuration Interface for the Semantic Content Management System.

## Components Implemented

### 1. ChunkingConfigService (`src/lib/content/ChunkingConfigService.ts`)

A comprehensive service for managing chunking configuration settings with the following features:

**Core Functionality:**
- Get/create/update/delete chunking configurations
- Default configuration management
- Configuration caching for performance
- Cost impact calculation for configuration changes

**Configuration Settings:**
- **Chunking Strategy:**
  - Target chunk size (tokens per T3 chunk)
  - Max/min section sizes
  - Section boundary overlap
  - Split strategy (paragraph/sentence/token)

- **Embedding:**
  - Model selection (text-embedding-3-small vs text-embedding-3-large)
  - Cost comparison and impact calculation

- **Summary Generation:**
  - T1 (project summary) max length
  - T2 (section summary) max length

- **Batch Mode:**
  - Enable/disable batch processing
  - Minimum chunks threshold
  - Auto-schedule overnight
  - Default batch mode for different operation types

- **Change Detection:**
  - Section change percentage threshold
  - Minor change threshold

- **Behavior:**
  - Default behavior (auto/manual/prompt)
  - Draft mode skip indexing

**Cost Impact Analysis:**
- Calculates embedding cost changes when switching models
- Estimates summarization cost changes
- Identifies affected projects
- Determines if regeneration is required
- Provides total regeneration cost estimate

### 2. API Endpoints (`src/app/api/admin/semantic/config/route.ts`)

RESTful API for chunking configuration management:

**GET /api/admin/semantic/config**
- Query params:
  - `?default=true` - Get default configuration
  - `?name=xxx` - Get specific configuration
  - No params - List all configurations

**POST /api/admin/semantic/config**
- Create new configuration
- Calculate cost impact (with `action: 'calculate-cost-impact'`)

**PUT /api/admin/semantic/config**
- Update existing configuration

**DELETE /api/admin/semantic/config?name=xxx**
- Delete configuration (cannot delete default)

### 3. React Component (`src/components/admin/chunking-config.tsx`)

A comprehensive admin interface with the following features:

**UI Organization:**
- Tabbed interface with 4 sections:
  1. Chunking - Size and strategy configuration
  2. Embedding - Model selection with cost comparison
  3. Batch Mode - Batch processing preferences
  4. Behavior - Change detection and default behavior

**Key Features:**
- Real-time cost impact calculation
- Live examples showing effect of settings
- Slider controls with numeric displays
- Cost comparison cards for embedding models
- Batch mode configuration with savings information
- Regeneration warnings when changes require re-indexing
- Save/reset functionality with change detection

**User Experience:**
- Automatic change detection
- Cost impact warnings before saving
- Success notifications
- Loading states
- Help text for all settings
- Trade-off explanations

## Configuration Options

### Chunking Settings

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Target Chunk Size | 300 | 100-1000 | Ideal tokens per T3 chunk |
| Max Section Size | 500 | 200-2000 | Max tokens before splitting |
| Min Section Size | 50 | 10-200 | Min tokens to avoid tiny chunks |
| Section Boundary Overlap | 25 | 0-100 | Overlap tokens within sections |
| Split Strategy | paragraph | - | How to split large sections |

### Embedding Settings

| Setting | Default | Options | Cost per 1M tokens |
|---------|---------|---------|-------------------|
| Embedding Model | text-embedding-3-small | small/large | $0.02 / $0.13 |

### Summary Generation

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| T1 Max Length | 200 | 50-500 | Project summary max tokens |
| T2 Max Length | 150 | 50-300 | Section summary max tokens |

### Batch Mode Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Batch Mode Enabled | true | Use OpenAI Batch API for 50% savings |
| Min Chunks Threshold | 100 | Minimum chunks to use batch mode |
| Auto-schedule Overnight | false | Automatically schedule batch jobs |
| Default for Regeneration | false | Use batch mode by default |
| Default for Bulk Ops | true | Use batch mode for bulk operations |
| Default for Initial Indexing | true | Use batch mode for initial indexing |

### Change Detection

| Setting | Default | Description |
|---------|---------|-------------|
| Section Change Percent | 0.2 (20%) | % sections changed for full regen |
| Minor Change Threshold | 2 | Max sections for "minor" classification |

### Behavior Settings

| Setting | Default | Options | Description |
|---------|---------|---------|-------------|
| Default Behavior | prompt | auto/manual/prompt | Regeneration behavior |
| Draft Mode Skip Indexing | true | - | Skip indexing for drafts |

## Cost Impact Calculation

The system automatically calculates cost impact when configuration changes:

1. **Embedding Model Changes:**
   - Calculates cost difference per token
   - Multiplies by total tokens across all projects
   - Requires full regeneration

2. **Chunk Size Changes:**
   - Significant changes (>50 tokens) require regeneration
   - Affects number of chunks generated

3. **Summary Length Changes:**
   - Estimates summarization cost changes
   - Based on number of T1/T2 chunks

4. **Total Impact:**
   - Shows cost change per regeneration
   - Estimates total regeneration cost
   - Identifies number of affected projects

## Usage Examples

### Get Default Configuration

```typescript
const configService = ChunkingConfigService.getInstance();
const config = await configService.getDefaultConfig();
```

### Create Custom Configuration

```typescript
const customConfig = await configService.createConfig({
  name: 'High Quality',
  isDefault: false,
  targetChunkSize: 400,
  embeddingModel: 'text-embedding-3-large',
  batchModeEnabled: true,
  batchModeDefaultForRegeneration: true,
  // ... other settings
});
```

### Calculate Cost Impact

```typescript
const costImpact = await configService.calculateCostImpact(
  currentConfig,
  { embeddingModel: 'text-embedding-3-large' }
);

console.log(`Cost change: $${costImpact.totalCostChange}`);
console.log(`Regeneration required: ${costImpact.regenerationRequired}`);
console.log(`Estimated cost: $${costImpact.estimatedRegenerationCost}`);
```

### Update Configuration

```typescript
const updated = await configService.updateConfig('Default', {
  targetChunkSize: 350,
  batchModeEnabled: true
});
```

## Integration Points

### With Semantic Content Management

The chunking configuration is used by:

1. **SmartContentGenerator** - Uses chunk size and split strategy settings
2. **ContentIngestionService** - Applies configuration during indexing
3. **SelectiveSectionRegenerator** - Uses batch mode settings
4. **ChangeDetectionIntegration** - Uses change detection thresholds

### With Budget Management

- Cost impact calculations integrate with budget tracking
- Regeneration cost estimates help with budget planning
- Batch mode settings affect cost optimization

### With Batch API

- Batch mode preferences control when to use Batch API
- Minimum chunks threshold determines batch vs standard API
- Auto-schedule settings enable overnight processing

## Testing

### Service Tests

Run the comprehensive test suite:

```bash
npx tsx portfolio-projects/scripts/test-chunking-config.ts
```

Tests cover:
- Default configuration loading
- Custom configuration creation
- Configuration updates
- Cost impact calculation
- Batch mode settings
- Configuration deletion

### API Tests

Test API endpoints (requires dev server):

```bash
node portfolio-projects/scripts/test-chunking-config-simple.js
```

### Manual Testing

1. Start dev server: `npm run dev`
2. Navigate to `/admin/semantic` (requires admin auth)
3. Click on "Configuration" or similar navigation
4. Test the chunking configuration interface

## Database Schema

The configuration is stored in the `chunking_configs` table:

```sql
CREATE TABLE chunking_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Default',
  is_default BOOLEAN NOT NULL DEFAULT true,
  respect_heading_boundaries BOOLEAN NOT NULL DEFAULT true,
  target_chunk_size INTEGER NOT NULL DEFAULT 300,
  max_section_size INTEGER NOT NULL DEFAULT 500,
  min_section_size INTEGER NOT NULL DEFAULT 50,
  section_boundary_overlap INTEGER NOT NULL DEFAULT 25,
  split_strategy TEXT NOT NULL DEFAULT 'paragraph',
  embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  t1_max_length INTEGER NOT NULL DEFAULT 200,
  t2_max_length INTEGER NOT NULL DEFAULT 150,
  section_change_percent REAL NOT NULL DEFAULT 0.2,
  minor_change_threshold INTEGER NOT NULL DEFAULT 2,
  default_behavior TEXT NOT NULL DEFAULT 'prompt',
  draft_mode_skip_indexing BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Batch mode settings are stored in the `default_behavior` field as JSON.

## Future Enhancements

1. **Configuration Presets:**
   - Add predefined configurations (Fast, Balanced, Quality)
   - Allow users to clone configurations

2. **A/B Testing:**
   - Compare different configurations
   - Track quality metrics per configuration

3. **Configuration History:**
   - Track configuration changes over time
   - Allow rollback to previous configurations

4. **Per-Project Configuration:**
   - Override global settings for specific projects
   - Project-specific optimization

5. **Advanced Cost Optimization:**
   - Automatic model selection based on content type
   - Dynamic chunk sizing based on content complexity

## Troubleshooting

### Configuration Not Saving

- Check admin authentication
- Verify database connection
- Check browser console for errors

### Cost Impact Not Calculating

- Ensure projects have semantic indexes
- Check that contentChunks relation is populated
- Verify token counts are accurate

### Batch Mode Not Working

- Verify batch mode is enabled in configuration
- Check minimum chunks threshold
- Ensure OpenAI Batch API is configured

## Related Documentation

- [Semantic Content Management Design](../.kiro/specs/semantic-content-management/design.md)
- [Batch API Integration](./BATCH_API_IMPLEMENTATION_COMPLETE.md)
- [Budget Management](./BUDGET_MANAGEMENT_IMPLEMENTATION.md)
- [Change Detection System](./SELECTIVE_SECTION_REGENERATION_IMPLEMENTATION.md)
