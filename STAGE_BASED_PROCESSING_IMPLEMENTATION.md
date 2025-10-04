# Stage-Based Content Processing Implementation

## Overview

This document describes the implementation of Task 15: Stage-Based Content Processing with Granular Control. The new system replaces the monolithic content processing approach with a stage-based architecture that provides granular control, persistent progress tracking, and resumable operations.

## Problem Solved

The previous system had several UX issues:
- **Modal blocking**: Progress tracking blocked UI navigation
- **Progress loss on failure**: Failed operations lost all progress
- **No granular control**: All-or-nothing processing approach
- **404 errors**: Missing progress endpoints caused errors
- **Monolithic operations**: Chunking, summaries, and embeddings processed together

## Solution Architecture

### Stage-Based Processing Service

The new `StageBasedProcessingService` breaks content generation into independent stages:

1. **Chunking Stage**: Parse content and create hierarchical chunks (T0-T3)
2. **Summaries Stage**: Generate AI summaries for T1 and T2 tiers
3. **Embeddings Stage**: Generate vector embeddings for semantic search
4. **Validation Stage**: Validate structure and store in database

Each stage can be:
- Enabled/disabled independently
- Configured with different processing modes (immediate vs batch)
- Resumed from checkpoints on failure
- Monitored with granular progress tracking

### Key Components

#### 1. StageBasedProcessingService (`src/lib/content/StageBasedProcessingService.ts`)

**Core Features:**
- Independent stage execution with dependency validation
- Persistent progress tracking with checkpoints
- Pause/resume capability at stage boundaries
- Background processing without UI blocking
- Real-time progress updates via Server-Sent Events

**Processing Stages:**
```typescript
type ProcessingStage = 'chunking' | 'summaries' | 'embeddings' | 'validation';
type ProcessingMode = 'immediate' | 'batch';

interface StageConfig {
  stage: ProcessingStage;
  enabled: boolean;
  mode: ProcessingMode;
  options?: Record<string, any>;
}
```

**Progress Tracking:**
```typescript
interface ProcessingProgress {
  operationId: string;
  status: 'pending' | 'in_progress' | 'paused' | 'completed' | 'failed';
  currentStage: ProcessingStage | null;
  stageProgress: {
    [K in ProcessingStage]: {
      status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
      progress: number; // 0-100
      itemsProcessed: number;
      totalItems: number;
      errors: string[];
      checkpoint?: any; // Stage-specific checkpoint data
    };
  };
  overallProgress: number;
  canResume: boolean;
  nextStage?: ProcessingStage;
}
```

#### 2. API Endpoints

**Start Processing:**
```
POST /api/admin/semantic/processing/start
```
- Accepts scope (all/project/section) and stage configurations
- Returns operation ID for progress tracking
- Validates dependencies and configurations

**Progress Tracking:**
```
GET /api/admin/semantic/processing/[operationId]
GET /api/admin/semantic/processing/[operationId]?sse=true
```
- Regular JSON responses or Server-Sent Events
- Real-time progress updates
- Automatic cleanup on completion

**Operation Control:**
```
POST /api/admin/semantic/processing/[operationId]
```
- Actions: pause, resume, cancel
- Resume from specific stage
- Graceful operation management

#### 3. UI Components

**StageBasedProcessingPanel (`src/components/admin/stage-based-processing-panel.tsx`)**
- Persistent progress panel (replaces modal)
- Stage selection and configuration
- Real-time progress visualization
- Pause/resume/cancel controls
- Cost estimation with batch mode savings

**GranularProcessingControl (`src/components/admin/granular-processing-control.tsx`)**
- Advanced stage configuration interface
- Quality settings and batch size controls
- Dependency validation
- Cost and time estimation
- Processing mode selection (immediate vs batch)

**Dashboard Integration**
- New buttons in semantic dashboard quick actions
- Non-blocking progress panels
- Background operation monitoring

## Key Features

### 1. Independent Stage Execution

Each stage runs independently with proper dependency validation:

```typescript
// Example: Only enable summaries if chunking is enabled
const validateDependencies = (stages: StageConfig[]): string[] => {
  const errors: string[] = [];
  const enabledStages = stages.filter(s => s.enabled).map(s => s.stage);
  
  if (enabledStages.includes('summaries') && !enabledStages.includes('chunking')) {
    errors.push('Summaries stage requires chunking to be enabled');
  }
  
  return errors;
};
```

### 2. Persistent Progress Tracking

Progress is stored in memory with checkpoint data for each stage:

```typescript
interface ChunkingCheckpoint {
  projectsProcessed: string[];
  sectionsProcessed: string[];
  chunksCreated: TierContent[];
}

interface EmbeddingsCheckpoint {
  embeddingsGenerated: Array<{
    chunkId: string;
    embedding: number[];
    cost: number;
  }>;
  batchJobIds?: string[]; // For batch processing
}
```

### 3. Granular Control Interface

Admins can configure each stage individually:

- **Processing Mode**: Immediate (fast) vs Batch (50% cost savings, 24h delay)
- **Quality Level**: Fast, Balanced, High
- **Batch Size**: Number of items processed together
- **Retry Attempts**: Error recovery configuration
- **Timeout Settings**: Per-stage timeout limits

### 4. Checkpoint System

Operations can be resumed from the last successful stage:

```typescript
// Resume from specific stage
await processingService.resumeProcessing(operationId, 'embeddings');

// Resume from next available stage
await processingService.resumeProcessing(operationId);
```

### 5. Background Processing

Long operations run in background without blocking UI:

- Non-modal progress panels
- Server-Sent Events for real-time updates
- Navigation doesn't interrupt processing
- Multiple operations can run concurrently

### 6. Cost Optimization

Batch mode provides significant cost savings:

- **Embeddings**: 50% cost reduction with OpenAI Batch API
- **Processing Time**: Trade-off between speed and cost
- **Smart Scheduling**: Batch jobs run overnight automatically

## Usage Examples

### Basic Stage-Based Processing

```typescript
const stageConfigs: StageConfig[] = [
  { stage: 'chunking', enabled: true, mode: 'immediate' },
  { stage: 'summaries', enabled: true, mode: 'immediate' },
  { stage: 'embeddings', enabled: true, mode: 'batch' }, // 50% savings
  { stage: 'validation', enabled: true, mode: 'immediate' }
];

const request: ProcessingRequest = {
  operationId: 'my-operation',
  scope: 'project',
  projectId: 'my-project',
  stages: stageConfigs
};

const operationId = await processingService.startProcessing(request);
```

### Progress Monitoring

```typescript
// Subscribe to real-time updates
processingService.subscribeToProgress(operationId, (progress) => {
  console.log(`Overall: ${progress.overallProgress}%`);
  console.log(`Current stage: ${progress.currentStage}`);
  
  // Check individual stage progress
  Object.entries(progress.stageProgress).forEach(([stage, stageProgress]) => {
    console.log(`${stage}: ${stageProgress.status} (${stageProgress.progress}%)`);
  });
});
```

### Operation Control

```typescript
// Pause processing
await processingService.pauseProcessing(operationId);

// Resume from where it left off
await processingService.resumeProcessing(operationId);

// Resume from specific stage
await processingService.resumeProcessing(operationId, 'embeddings');

// Cancel operation
await processingService.cancelProcessing(operationId);
```

## Benefits

### Admin Benefits

1. **Step-by-step Control**: Choose which stages to execute
2. **Progress Persistence**: No progress loss on failure or navigation
3. **Cost Optimization**: Batch mode for 50% savings on embeddings
4. **Failure Recovery**: Resume from last successful stage
5. **Better UX**: Non-blocking background processing

### Technical Benefits

1. **Modularity**: Independent, testable stages
2. **Scalability**: Parallel processing capability
3. **Reliability**: Checkpoint-based recovery
4. **Monitoring**: Granular progress tracking
5. **Flexibility**: Configurable processing modes

### Cost Benefits

1. **Batch Processing**: 50% savings on embedding generation
2. **Selective Processing**: Only process changed content
3. **Smart Scheduling**: Overnight batch jobs
4. **Cost Transparency**: Real-time cost tracking

## Testing

Run the test suite to verify functionality:

```bash
npm run test:single -- scripts/test-stage-based-processing.ts
```

The test suite covers:
- Stage configuration validation
- Progress tracking initialization
- Pause/resume functionality
- Progress subscription system
- API endpoint simulation
- Error handling
- Checkpoint system
- Cost estimation

## Migration from Monolithic System

The new system is backward compatible:

1. **Existing APIs**: Continue to work with legacy regeneration
2. **Gradual Migration**: Can be adopted incrementally
3. **Data Compatibility**: Uses same database schema
4. **UI Integration**: Added to existing dashboard

## Future Enhancements

1. **Parallel Stage Execution**: Independent stages run concurrently
2. **Advanced Scheduling**: Cron-based batch job scheduling
3. **Quality Metrics**: Stage-specific quality scoring
4. **Resource Management**: CPU/memory usage optimization
5. **Audit Logging**: Detailed operation history

## Conclusion

The Stage-Based Content Processing system addresses all the UX issues identified in Task 15:

- ✅ **Modal blocking**: Replaced with persistent progress panels
- ✅ **Progress loss**: Checkpoint system enables resume capability
- ✅ **Granular control**: Individual stage configuration
- ✅ **404 errors**: Proper progress API endpoints implemented
- ✅ **Background processing**: Non-blocking operations

The system provides a foundation for scalable, reliable, and cost-effective content processing with excellent admin experience.