# Batch API Integration Strategy

## Overview

OpenAI's Batch API provides 50% cost savings on embeddings ($0.01 vs $0.02 per 1M tokens) with a 24-hour processing window. This is perfect for non-time-sensitive operations like index generation and regeneration.

## Use Cases

### ✅ Use Batch API For:
1. **Initial project indexing** - New projects being added
2. **Overnight regeneration** - Scheduled bulk updates
3. **Full reindexing** - Maintenance operations
4. **Bulk embedding updates** - Model changes, dimension updates
5. **Historical data migration** - One-time operations

### ❌ Don't Use Batch API For:
1. **Real-time search** - User is waiting for results
2. **Immediate project updates** - User just saved content
3. **Interactive operations** - UI feedback required
4. **Small operations** - < 100 embeddings (overhead not worth it)

## Cost Savings Analysis

### Example: 100 Projects with 500 chunks each

**Standard API:**
- Total chunks: 50,000
- Tokens per chunk: ~300
- Total tokens: 15M
- Cost: 15 × $0.02 = **$0.30**

**Batch API:**
- Same workload
- Cost: 15 × $0.01 = **$0.15**
- **Savings: $0.15 (50%)**

### Annual Savings Projection

**Medium portfolio (200 projects, monthly updates):**
- Monthly regeneration: 200 projects × 500 chunks = 100K chunks
- Monthly tokens: ~30M
- Standard cost: $0.60/month = $7.20/year
- Batch cost: $0.30/month = $3.60/year
- **Annual savings: $3.60**

**Large portfolio (1000 projects, monthly updates):**
- Monthly tokens: ~150M
- Standard cost: $3.00/month = $36/year
- Batch cost: $1.50/month = $18/year
- **Annual savings: $18**

## Implementation Strategy

### Phase 1: Basic Batch Support
```typescript
interface BatchEmbeddingOptions {
  mode: 'standard' | 'batch';
  chunks: string[];
  projectId: string;
  onComplete?: (results: EmbeddingResult[]) => void;
}

class BatchEmbeddingService {
  async submitBatchJob(chunks: string[]): Promise<string> {
    // Submit to OpenAI Batch API
    // Returns batch job ID
  }
  
  async pollBatchStatus(jobId: string): Promise<BatchStatus> {
    // Check job status
    // Returns: queued, processing, completed, failed
  }
  
  async retrieveBatchResults(jobId: string): Promise<EmbeddingResult[]> {
    // Get completed embeddings
  }
}
```

### Phase 2: Smart Mode Selection
```typescript
interface RegenerationOptions {
  urgency: 'immediate' | 'scheduled' | 'background';
  // Auto-select API based on urgency
}

function selectEmbeddingMode(options: RegenerationOptions): 'standard' | 'batch' {
  if (options.urgency === 'immediate') return 'standard';
  if (options.urgency === 'scheduled') return 'batch';
  if (options.urgency === 'background') return 'batch';
  return 'standard';
}
```

### Phase 3: Hybrid Approach
```typescript
// For partial updates: use standard for changed sections, batch for unchanged
async function hybridRegeneration(project: Project, changes: ChangeMap) {
  const changedSections = changes.modified;
  const unchangedSections = changes.unchanged;
  
  // Immediate: Changed sections (user is waiting)
  const immediateEmbeddings = await standardAPI.generateEmbeddings(changedSections);
  
  // Batch: Unchanged sections that need reprocessing
  const batchJobId = await batchAPI.submitJob(unchangedSections);
  
  // Update UI immediately with changed sections
  // Process batch results when ready
}
```

## UI/UX Considerations

### Regeneration Dialog
```
┌─────────────────────────────────────────┐
│ Regenerate Semantic Index               │
├─────────────────────────────────────────┤
│ Sections to regenerate: 25              │
│ Estimated tokens: 7,500                 │
│                                         │
│ Processing Mode:                        │
│ ○ Immediate ($0.15)                     │
│   Complete in ~30 seconds               │
│                                         │
│ ● Scheduled ($0.075) - 50% savings      │
│   Complete within 24 hours              │
│   Best for non-urgent updates           │
│                                         │
│ [Cancel]  [Start Regeneration]          │
└─────────────────────────────────────────┘
```

### Batch Job Status
```
┌─────────────────────────────────────────┐
│ Batch Jobs                              │
├─────────────────────────────────────────┤
│ ⏳ Project Index Update                 │
│    Status: Processing                   │
│    Progress: 45%                        │
│    Est. completion: 8 hours             │
│    Savings: $0.12                       │
│                                         │
│ ✅ Bulk Reindexing                      │
│    Status: Completed                    │
│    Processed: 50,000 chunks             │
│    Saved: $0.15                         │
│    Duration: 18 hours                   │
└─────────────────────────────────────────┘
```

## Database Schema

### Batch Job Tracking
```prisma
model BatchEmbeddingJob {
  id              String   @id @default(cuid())
  batchId         String   @unique // OpenAI batch job ID
  status          String   // queued, processing, completed, failed
  projectIds      Json     // Array of project IDs
  chunksCount     Int
  tokensCount     Int
  estimatedCost   Decimal
  actualCost      Decimal?
  submittedAt     DateTime @default(now())
  completedAt     DateTime?
  errorMessage    String?
  results         Json?    // Embedding results when completed
  
  @@index([status])
  @@index([submittedAt])
}
```

## API Integration

### OpenAI Batch API Flow
```typescript
// 1. Create batch file
const batchFile = {
  custom_id: "chunk-1",
  method: "POST",
  url: "/v1/embeddings",
  body: {
    model: "text-embedding-3-small",
    input: "content to embed"
  }
};

// 2. Upload batch file
const file = await openai.files.create({
  file: batchFileContent,
  purpose: "batch"
});

// 3. Create batch job
const batch = await openai.batches.create({
  input_file_id: file.id,
  endpoint: "/v1/embeddings",
  completion_window: "24h"
});

// 4. Poll for completion
const status = await openai.batches.retrieve(batch.id);

// 5. Retrieve results
if (status.status === 'completed') {
  const results = await openai.files.content(status.output_file_id);
}
```

## Configuration

### ChunkingConfig Extension
```typescript
interface ChunkingConfig {
  // ... existing fields
  
  // Batch API settings
  batchModeEnabled: boolean;
  batchMinChunks: number;        // Minimum chunks to use batch (default: 100)
  batchMaxWaitHours: number;     // Max acceptable wait (default: 24)
  batchAutoSchedule: boolean;    // Auto-schedule overnight (default: true)
}
```

## Monitoring & Analytics

### Batch Operation Metrics
- Total batch jobs submitted
- Average processing time
- Success rate
- Total cost savings
- Cost per batch job
- Tokens processed via batch
- Comparison: batch vs standard costs

### Dashboard Display
```
Batch API Savings (Last 30 Days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Standard cost:  $12.50
Batch cost:     $6.25
Savings:        $6.25 (50%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Jobs completed: 15
Avg duration:   16 hours
Success rate:   100%
```

## Error Handling

### Batch Job Failures
1. **Automatic retry** - Retry failed jobs once
2. **Fallback to standard** - If batch fails twice, use standard API
3. **Partial results** - Process successful chunks, retry failed ones
4. **User notification** - Alert admin of batch failures

### Timeout Handling
- If batch exceeds 24 hours, mark as failed
- Automatically resubmit or use standard API
- Track timeout rate for monitoring

## Migration Path

### Phase 1: Infrastructure (Week 1)
- Implement BatchEmbeddingService
- Add database models
- Create batch job polling system

### Phase 2: Integration (Week 2)
- Integrate with BudgetAwareAIOperations
- Add batch mode to regeneration workflow
- Implement status tracking

### Phase 3: UI (Week 3)
- Add batch mode toggle to regeneration dialog
- Create batch job status dashboard
- Add cost savings display

### Phase 4: Optimization (Week 4)
- Implement smart mode selection
- Add hybrid approach for partial updates
- Optimize batch job scheduling

## Best Practices

1. **Default to batch for bulk operations** - Save costs automatically
2. **Provide immediate option** - Let users choose urgency
3. **Show cost comparison** - Make savings visible
4. **Monitor success rates** - Track batch reliability
5. **Graceful degradation** - Fall back to standard if batch fails
6. **Clear communication** - Set expectations about processing time

## ROI Analysis

**Development time**: ~2 weeks  
**Annual savings** (medium portfolio): $3.60  
**Annual savings** (large portfolio): $18  
**Break-even**: Immediate (cost savings start day 1)

**Additional benefits**:
- Reduced API rate limit pressure
- Better resource utilization
- Improved system scalability

## Conclusion

Batch API integration provides significant cost savings (50%) for non-time-sensitive embedding operations. The 24-hour processing window is acceptable for scheduled regeneration and bulk operations, making this a high-value, low-risk optimization.

**Recommendation**: Implement in Phase 2 of semantic content management system, after core functionality is stable.
