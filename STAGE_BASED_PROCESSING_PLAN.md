# Stage-Based Content Processing Implementation Plan

## Problem Analysis

Based on your testing experience, the current system has several critical UX issues:

1. **Monolithic Processing**: All stages (chunking, summaries, embeddings) run in one operation
2. **Modal Blocking**: Progress shown in modal that blocks navigation
3. **Progress Loss**: If process fails, all progress is lost
4. **No Granular Control**: Can't choose which stages to execute
5. **404 Errors**: Missing progress endpoints cause continuous 404s
6. **Poor UX**: No way to review intermediate results before proceeding

## Solution: Stage-Based Architecture

### Stage Breakdown

```
Stage 1: Content Analysis & Chunking
├── Parse project content structure
├── Generate T0 metadata chunk
├── Generate T1 project summary (basic)
├── Create T2/T3 heading-bounded chunks (no AI summaries yet)
└── Store basic chunk structure → CHECKPOINT

Stage 2: AI Summary Generation (Optional)
├── Generate AI summaries for T1/T2 tiers
├── Apply quality scoring and anti-hallucination
├── Update existing chunks with summaries
└── Allow manual review/editing → CHECKPOINT

Stage 3: Embedding Generation (Optional)
├── Generate embeddings for all chunks
├── Support batch vs immediate processing
├── Update chunks with embedding vectors
└── Verify embedding coverage → CHECKPOINT

Stage 4: Quality Validation & Indexing
├── Validate hierarchical relationships
├── Update search indexes
├── Generate completion report
└── Mark operation complete
```

## Implementation Components

### 1. Stage-Based Processing Service

```typescript
interface ProcessingStage {
  id: string;
  name: string;
  description: string;
  optional: boolean;
  dependencies: string[];
  estimatedDuration: number;
  costEstimate: number;
}

interface ProcessingOperation {
  id: string;
  projectId: string;
  stages: ProcessingStage[];
  currentStage: string | null;
  completedStages: string[];
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  startedAt: Date;
  lastCheckpoint: Date;
  results: Record<string, any>;
  errors: string[];
}

class StageBasedProcessor {
  async startProcessing(projectId: string, selectedStages: string[]): Promise<string>
  async resumeProcessing(operationId: string): Promise<void>
  async pauseProcessing(operationId: string): Promise<void>
  async getProgress(operationId: string): Promise<ProcessingOperation>
  async executeStage(operationId: string, stageId: string): Promise<void>
}
```

### 2. Persistent Progress Panel

Replace the modal with a dashboard-integrated progress panel:

```typescript
// Components/admin/semantic-progress-panel.tsx
interface ProgressPanelProps {
  operations: ProcessingOperation[];
  onStageSelect: (operationId: string, stageId: string) => void;
  onPause: (operationId: string) => void;
  onResume: (operationId: string) => void;
  onCancel: (operationId: string) => void;
}

// Features:
// - Non-modal, persistent in dashboard
// - Real-time updates via SSE
// - Stage-by-stage progress visualization
// - Ability to pause/resume operations
// - Review intermediate results
// - Navigate away and come back
```

### 3. API Endpoints

```typescript
// /api/admin/semantic/processing/start
POST /api/admin/semantic/processing/start
{
  "projectId": "project-slug",
  "stages": ["chunking", "summaries", "embeddings"],
  "options": {
    "summaryConfig": "high-quality",
    "embeddingMode": "batch",
    "qualityThreshold": 0.8
  }
}

// /api/admin/semantic/processing/[operationId]
GET /api/admin/semantic/processing/[operationId]
// Returns current progress and results

// /api/admin/semantic/processing/[operationId]/stage/[stageId]
POST /api/admin/semantic/processing/[operationId]/stage/[stageId]
// Execute specific stage

// /api/admin/semantic/processing/[operationId]/progress (SSE)
GET /api/admin/semantic/processing/[operationId]/progress
// Server-Sent Events for real-time progress
```

### 4. Database Schema Updates

```sql
-- Processing operations table
CREATE TABLE processing_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL,
  operation_type VARCHAR NOT NULL DEFAULT 'content_processing',
  stages JSONB NOT NULL,
  current_stage VARCHAR,
  completed_stages TEXT[],
  status VARCHAR NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT NOW(),
  last_checkpoint TIMESTAMP,
  results JSONB DEFAULT '{}',
  errors TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Stage execution logs
CREATE TABLE stage_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID REFERENCES processing_operations(id),
  stage_id VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  results JSONB,
  error_message TEXT,
  cost DECIMAL(10,6)
);
```

## Implementation Steps

### Phase 1: Core Infrastructure
1. Create `StageBasedProcessor` service
2. Implement processing operations database schema
3. Create basic API endpoints for starting/monitoring operations
4. Add Server-Sent Events support for real-time progress

### Phase 2: Stage Implementation
1. **Chunking Stage**: Extract from current `SmartContentGenerator`
2. **Summary Stage**: Use existing `SummaryGenerationService`
3. **Embedding Stage**: Use existing `BudgetAwareAIOperations`
4. **Validation Stage**: Create new validation and indexing logic

### Phase 3: UI Components
1. Create persistent progress panel component
2. Add stage selection interface
3. Implement real-time progress visualization
4. Add checkpoint review capabilities

### Phase 4: Integration
1. Update semantic dashboard to use new system
2. Replace existing regeneration workflow
3. Add migration for existing operations
4. Update documentation and testing guides

## User Experience Flow

### New Project Processing
1. **Admin clicks "Process Project"**
2. **Stage Selection Modal**: Choose stages to execute
   - ✅ Content Chunking (required)
   - ✅ AI Summary Generation (optional)
   - ✅ Embedding Generation (optional)
   - ✅ Quality Validation (required)
3. **Processing Starts**: Progress panel appears in dashboard
4. **Stage 1 Complete**: Admin can review chunk structure
5. **Continue or Edit**: Admin chooses to proceed or edit chunks
6. **Stage 2 Complete**: Admin can review AI summaries
7. **Continue or Edit**: Admin can edit summaries before embeddings
8. **Stage 3 Complete**: Admin can verify embedding coverage
9. **Final Validation**: System completes indexing and validation

### Benefits
- ✅ **No Progress Loss**: Each stage saves results to database
- ✅ **Granular Control**: Admin chooses which stages to run
- ✅ **Review Points**: Can inspect results between stages
- ✅ **Cost Control**: Can stop before expensive operations
- ✅ **Background Processing**: Can navigate away and return
- ✅ **Resume Capability**: Failed operations can be resumed
- ✅ **Better UX**: No blocking modals, persistent progress tracking

## Success Metrics

After implementation:
- ✅ No 404 errors from missing progress endpoints
- ✅ Operations can be paused and resumed
- ✅ Admin can review intermediate results
- ✅ Progress persists across browser sessions
- ✅ Granular control over processing stages
- ✅ Better cost optimization through stage selection
- ✅ Improved error recovery and debugging

This addresses all the UX issues you identified while maintaining the quality and integration benefits of the current system.