# Project Semantic Manager Implementation

## Overview

This document describes the implementation of the project-level semantic management interface that provides granular control over individual processing stages with job queue monitoring. The system allows admins to process specific stages independently or run the full processing loop, with real-time progress tracking and operation management.

## Problem Solved

The user requested:
- Individual buttons for each processing stage (chunking, summaries, embeddings, validation)
- Full processing loop button
- Job queue system to monitor current and queued operations
- Ability to see progress and cancel operations
- Project-specific processing interface at `/admin/semantic/projects/[id]`

## Solution Architecture

### Project Semantic Manager Page

**Route**: `/admin/semantic/projects/[id]`
**Component**: `ProjectSemanticManager`

The page provides a comprehensive interface for managing semantic content processing for individual projects.

### Key Components

#### 1. Project Overview Card
- Project title, ID, and slug
- Semantic content statistics (chunk count, tier distribution)
- Last processed timestamp
- Content availability status

#### 2. Processing Controls
**Individual Stage Buttons:**
- **Generate Chunks**: Runs chunking + validation stages
- **Generate Summaries**: Runs summaries + validation stages  
- **Generate Embeddings**: Runs embeddings + validation stages (batch mode for cost savings)
- **Validate & Store**: Runs validation stage only

**Full Processing:**
- **Full Processing Loop**: Runs all stages (chunking → summaries → embeddings → validation)

#### 3. Job Queue Monitor
- Real-time display of current and queued operations
- Progress bars with percentage completion
- Operation controls (pause, resume, cancel)
- Job details (type, estimated duration, stages)
- Auto-refresh every 5 seconds

#### 4. Semantic Tree View
- Integrated tree view of existing semantic content
- Hierarchical display of T0-T3 chunks
- Content editing capabilities

## API Endpoints

### Project Information
```
GET /api/admin/semantic/projects/[id]/info
```
Returns detailed project information including:
- Basic project data (title, slug, ID)
- Semantic content statistics
- Chunk count and tier distribution
- Last processed timestamp
- Content entity status

### Job Queue Management
```
GET /api/admin/semantic/processing/queue?projectId=[id]
POST /api/admin/semantic/processing/queue
DELETE /api/admin/semantic/processing/queue?operationId=[id]
```
Manages the processing job queue:
- List jobs for specific project or all projects
- Add new jobs to queue
- Remove completed/failed jobs
- Real-time status updates

### Stage-Based Processing
```
POST /api/admin/semantic/processing/start
GET /api/admin/semantic/processing/[operationId]
POST /api/admin/semantic/processing/[operationId]
```
Handles stage-based processing operations:
- Start processing with custom stage configuration
- Monitor progress with SSE support
- Control operations (pause, resume, cancel)

## Stage Configuration Mapping

### Individual Stages

**Chunking Operation:**
```typescript
{
  stages: [
    { stage: 'chunking', enabled: true, mode: 'immediate' },
    { stage: 'validation', enabled: true, mode: 'immediate' }
  ]
}
```

**Summaries Operation:**
```typescript
{
  stages: [
    { stage: 'summaries', enabled: true, mode: 'immediate' },
    { stage: 'validation', enabled: true, mode: 'immediate' }
  ]
}
```

**Embeddings Operation:**
```typescript
{
  stages: [
    { stage: 'embeddings', enabled: true, mode: 'batch' }, // 50% cost savings
    { stage: 'validation', enabled: true, mode: 'immediate' }
  ]
}
```

**Validation Operation:**
```typescript
{
  stages: [
    { stage: 'validation', enabled: true, mode: 'immediate' }
  ]
}
```

### Full Processing Loop
```typescript
{
  stages: [
    { stage: 'chunking', enabled: true, mode: 'immediate' },
    { stage: 'summaries', enabled: true, mode: 'immediate' },
    { stage: 'embeddings', enabled: true, mode: 'immediate' },
    { stage: 'validation', enabled: true, mode: 'immediate' }
  ]
}
```

## Job Queue System

### Job Structure
```typescript
interface JobQueueItem {
  operationId: string;
  type: 'full' | 'chunking' | 'summaries' | 'embeddings' | 'validation';
  status: 'queued' | 'in_progress' | 'paused' | 'completed' | 'failed';
  progress: ProcessingProgress | null;
  startedAt: Date;
  estimatedDuration: string;
  stages: ProcessingStage[];
}
```

### Job Lifecycle
1. **Queued**: Job added to queue, waiting to start
2. **In Progress**: Job actively processing with real-time updates
3. **Paused**: Job temporarily paused (can be resumed)
4. **Completed**: Job finished successfully
5. **Failed**: Job encountered errors

### Operation Controls
- **Pause**: Temporarily stop processing (can resume from checkpoint)
- **Resume**: Continue from last checkpoint
- **Cancel**: Terminate processing immediately
- **Remove**: Remove completed/failed jobs from queue display

## Real-Time Updates

### Server-Sent Events (SSE)
The system uses SSE for real-time progress updates:
```typescript
const eventSource = new EventSource(
  `/api/admin/semantic/processing/${operationId}?sse=true`
);

eventSource.onmessage = (event) => {
  const progressData: ProcessingProgress = JSON.parse(event.data);
  // Update UI with progress data
};
```

### Progress Tracking
Each job shows:
- Overall progress percentage
- Current processing stage
- Items processed vs total items
- Cost accumulated
- Error count
- Estimated time remaining

## Cost Optimization

### Batch Mode for Embeddings
Individual embedding operations automatically use batch mode:
- **Cost Savings**: 50% reduction ($0.01 vs $0.02 per 1M tokens)
- **Processing Time**: ~24 hours vs immediate
- **Automatic Fallback**: Falls back to immediate mode if batch fails

### Smart Stage Selection
- **Validation Always Included**: Ensures data integrity
- **Dependency Management**: Summaries require chunking, embeddings are independent
- **Cost Estimation**: Real-time cost calculation based on selected stages

## Usage Examples

### Starting Individual Operations

```typescript
// Generate chunks only
await startProcessing('chunking');

// Generate summaries (requires existing chunks)
await startProcessing('summaries');

// Generate embeddings with batch mode cost savings
await startProcessing('embeddings');

// Run full processing loop
await startProcessing('full');
```

### Monitoring Progress

```typescript
// Subscribe to job updates
const monitorJob = (operationId: string) => {
  const eventSource = new EventSource(
    `/api/admin/semantic/processing/${operationId}?sse=true`
  );

  eventSource.onmessage = (event) => {
    const progress = JSON.parse(event.data);
    updateJobInQueue(operationId, progress);
  };
};
```

### Controlling Operations

```typescript
// Pause active job
await controlJob(operationId, 'pause');

// Resume paused job
await controlJob(operationId, 'resume');

// Cancel job
await controlJob(operationId, 'cancel');
```

## Benefits

### Admin Benefits
1. **Granular Control**: Process individual stages as needed
2. **Cost Optimization**: Batch mode for embeddings saves 50%
3. **Progress Visibility**: Real-time updates on all operations
4. **Operation Management**: Pause, resume, cancel capabilities
5. **Queue Monitoring**: See all active and queued operations

### Technical Benefits
1. **Modular Processing**: Independent stage execution
2. **Scalable Architecture**: Queue-based operation management
3. **Real-Time Updates**: SSE for immediate feedback
4. **Error Recovery**: Checkpoint-based resume capability
5. **Resource Management**: Batch processing for efficiency

### User Experience Benefits
1. **Non-Blocking UI**: Operations run in background
2. **Immediate Feedback**: Real-time progress updates
3. **Flexible Workflow**: Choose specific stages or full loop
4. **Error Transparency**: Clear error reporting and recovery options
5. **Cost Awareness**: Upfront cost estimation and tracking

## Testing

Run the test suite to verify functionality:

```bash
npm run test:single -- scripts/test-project-semantic-manager.ts
```

The test suite covers:
- Project information fetching
- Individual stage operations
- Full processing loop
- Job queue management
- Progress monitoring
- Operation controls
- API endpoint validation

## Integration with Existing System

### Backward Compatibility
- Works alongside existing regeneration workflows
- Uses same underlying StageBasedProcessingService
- Compatible with existing semantic tree view
- Maintains existing API contracts

### Navigation
- Accessible from semantic dashboard project list
- Direct URL: `/admin/semantic/projects/[projectId]`
- Integrated with existing admin navigation

## Future Enhancements

1. **Bulk Operations**: Process multiple projects simultaneously
2. **Scheduling**: Schedule operations for specific times
3. **Notifications**: Email/webhook notifications on completion
4. **Analytics**: Detailed processing analytics and reporting
5. **Templates**: Save and reuse stage configurations

## Conclusion

The Project Semantic Manager provides a comprehensive interface for granular semantic content processing with real-time monitoring and operation management. It addresses the user's requirements for individual stage control while maintaining the benefits of the stage-based processing architecture implemented in Task 15.

Key features delivered:
- ✅ Individual stage processing buttons
- ✅ Full processing loop option
- ✅ Job queue monitoring with progress tracking
- ✅ Pause/resume/cancel operations
- ✅ Real-time updates via SSE
- ✅ Cost optimization with batch mode
- ✅ Project-specific interface