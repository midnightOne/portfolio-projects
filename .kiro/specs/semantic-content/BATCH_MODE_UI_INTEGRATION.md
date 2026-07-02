> **Status:** current (supporting reference — semantic-content — Batch mode UI reference). Predates the 2026-07-02 spec rewrite; where this conflicts with code or the owning spec's requirements/design, those win.
> **Last verified against code:** carried over 2026-07-02 (e2d75b4) without line-by-line reverification.

# Batch Mode UI Integration

## Overview

Batch mode selection has been integrated into all relevant admin UI tasks, allowing users to choose between immediate processing (standard API) and scheduled processing (batch API with 50% savings).

## Updated Tasks

### Task 7: Semantic Dashboard Page
**Added**: Batch job status section
- Display active batch jobs with progress bars
- Show completed batch jobs with savings achieved
- Real-time status updates (queued, processing, completed)
- Quick access to batch job details

**UI Mockup**:
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Semantic Content Management Dashboard              â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Budget Status: $34.50 / $50.00 (69% used) âš ï¸       â”‚
â”‚                                                     â”‚
â”‚ Active Batch Jobs (2)                              â”‚
â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚ â”‚ â³ Project Reindexing                        â”‚   â”‚
â”‚ â”‚    Progress: â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘ 45%                 â”‚   â”‚
â”‚ â”‚    Est. completion: 8 hours                 â”‚   â”‚
â”‚ â”‚    Savings: $0.12                           â”‚   â”‚
â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                     â”‚
â”‚ Recent Completions                                 â”‚
â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚ â”‚ âœ… Bulk Embedding Update                     â”‚   â”‚
â”‚ â”‚    Completed: 2 hours ago                   â”‚   â”‚
â”‚ â”‚    Saved: $0.15 (50%)                       â”‚   â”‚
â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Task 10: Chunking Configuration Interface
**Added**: Batch mode preferences
- Enable/disable batch mode globally
- Set minimum chunks threshold (default: 100)
- Auto-schedule overnight option
- Default mode selection per operation type

**UI Mockup**:
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Batch API Settings                                  â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ â˜‘ Enable Batch API (50% cost savings)              â”‚
â”‚                                                     â”‚
â”‚ Minimum chunks for batch: [100    ] chunks         â”‚
â”‚ â„¹ï¸ Operations with fewer chunks use standard API   â”‚
â”‚                                                     â”‚
â”‚ â˜‘ Auto-schedule overnight (11 PM - 6 AM)           â”‚
â”‚                                                     â”‚
â”‚ Default Mode by Operation:                         â”‚
â”‚ â€¢ Initial indexing:     â— Batch  â—‹ Standard        â”‚
â”‚ â€¢ Regeneration:         â— Batch  â—‹ Standard        â”‚
â”‚ â€¢ Bulk operations:      â— Batch  â—‹ Standard        â”‚
â”‚ â€¢ Real-time updates:    â—‹ Batch  â— Standard        â”‚
â”‚                                                     â”‚
â”‚ [Save Configuration]                                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Task 12: Regeneration Workflow Implementation
**Added**: Batch mode selection with cost comparison
- Radio buttons for immediate vs scheduled
- Cost comparison display
- Processing time estimates
- Total savings calculation

**UI Mockup**:
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Regenerate Semantic Index                           â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Project: Portfolio Website Redesign                 â”‚
â”‚ Sections to regenerate: 25                          â”‚
â”‚ Estimated tokens: 7,500                             â”‚
â”‚                                                     â”‚
â”‚ Processing Mode:                                    â”‚
â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚ â”‚ â—‹ Immediate Processing                       â”‚   â”‚
â”‚ â”‚   Cost: $0.15                                â”‚   â”‚
â”‚ â”‚   Time: ~30 seconds                          â”‚   â”‚
â”‚ â”‚   Best for: Urgent updates, small changes    â”‚   â”‚
â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                     â”‚
â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚ â”‚ â— Scheduled Processing (Batch API) ðŸ’°        â”‚   â”‚
â”‚ â”‚   Cost: $0.075                               â”‚   â”‚
â”‚ â”‚   Time: Complete within 24 hours             â”‚   â”‚
â”‚ â”‚   Savings: $0.075 (50%)                      â”‚   â”‚
â”‚ â”‚   Best for: Non-urgent updates, bulk work    â”‚   â”‚
â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                     â”‚
â”‚ â˜‘ Schedule for overnight (11 PM tonight)           â”‚
â”‚                                                     â”‚
â”‚ Budget Impact:                                      â”‚
â”‚ Current: $34.50 / $50.00                           â”‚
â”‚ After:   $34.58 / $50.00 (immediate)               â”‚
â”‚          $34.58 / $50.00 (scheduled)               â”‚
â”‚                                                     â”‚
â”‚ [Cancel]  [Start Regeneration]                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Task 13: Bulk Operations Implementation
**Added**: Batch mode for bulk operations
- Automatic batch mode suggestion for large operations
- Overnight scheduling option
- Estimated completion time and savings

**UI Mockup**:
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Bulk Regeneration                                   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Operation: Regenerate all projects                  â”‚
â”‚ Projects: 150                                       â”‚
â”‚ Estimated chunks: 75,000                            â”‚
â”‚ Estimated tokens: 22.5M                             â”‚
â”‚                                                     â”‚
â”‚ âš ï¸ Large Operation Detected                         â”‚
â”‚                                                     â”‚
â”‚ Recommended: Batch Mode                             â”‚
â”‚ â€¢ 50% cost savings ($0.45 vs $0.225)               â”‚
â”‚ â€¢ Completes overnight                               â”‚
â”‚ â€¢ No impact on system performance                   â”‚
â”‚                                                     â”‚
â”‚ Processing Mode:                                    â”‚
â”‚ â— Batch (Recommended) - $0.225                      â”‚
â”‚   Complete by: Tomorrow 8 AM                        â”‚
â”‚                                                     â”‚
â”‚ â—‹ Immediate - $0.45                                 â”‚
â”‚   Complete in: ~45 minutes                          â”‚
â”‚                                                     â”‚
â”‚ [Cancel]  [Start Operation]                         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## User Experience Flow

### Scenario 1: Quick Update (User Chooses Immediate)
1. User edits project content
2. Clicks "Regenerate Index"
3. Sees cost comparison: $0.15 immediate vs $0.075 batch
4. Chooses immediate (needs results now)
5. Progress bar shows real-time updates
6. Completes in 30 seconds
7. User can immediately search updated content

### Scenario 2: Bulk Update (User Chooses Batch)
1. User wants to reindex all projects
2. System recommends batch mode (large operation)
3. User sees: $0.45 immediate vs $0.225 batch (saves $0.225)
4. Chooses batch with overnight scheduling
5. Job queued for 11 PM
6. User receives notification when complete
7. Wakes up to updated indexes and cost savings

### Scenario 3: Automatic Batch (Configured Default)
1. Admin configures: "Bulk operations always use batch"
2. User triggers bulk regeneration
3. System automatically selects batch mode
4. Shows: "Scheduled for overnight processing (saves $0.225)"
5. User confirms
6. Job runs automatically

## Smart Recommendations

The system provides intelligent recommendations based on:

### Operation Size
- **< 100 chunks**: Standard API (overhead not worth it)
- **100-1000 chunks**: Suggest batch, allow immediate
- **> 1000 chunks**: Strongly recommend batch

### Time of Day
- **Business hours (9 AM - 5 PM)**: Offer both options
- **Evening (5 PM - 11 PM)**: Suggest overnight batch
- **Night (11 PM - 6 AM)**: Auto-select batch

### Budget Status
- **Budget healthy (< 50% used)**: Neutral recommendation
- **Budget warning (50-80% used)**: Encourage batch
- **Budget critical (> 80% used)**: Strongly recommend batch

### User Behavior
- **First-time user**: Explain both options clearly
- **Frequent batch user**: Default to batch
- **Frequent immediate user**: Default to immediate

## Configuration Options

### Global Settings
```typescript
interface BatchModeConfig {
  enabled: boolean;                    // Master switch
  minChunksForBatch: number;          // Default: 100
  autoScheduleOvernight: boolean;      // Default: true
  overnightStartTime: string;         // Default: "23:00"
  overnightEndTime: string;           // Default: "06:00"
  
  // Default modes per operation
  defaultModes: {
    initialIndexing: 'batch' | 'standard';
    regeneration: 'batch' | 'standard';
    bulkOperations: 'batch' | 'standard';
    realtimeUpdates: 'batch' | 'standard';
  };
  
  // Recommendation thresholds
  recommendBatchAbove: number;        // Chunks, default: 500
  requireBatchAbove: number;          // Chunks, default: 5000
}
```

### Per-Operation Override
Users can always override the default:
- "Use batch this time" checkbox
- "Always use immediate for this project" setting
- "Schedule for specific time" option

## Cost Transparency

Every operation shows:
1. **Standard cost**: What it would cost immediately
2. **Batch cost**: What it costs with batch mode
3. **Savings**: Difference (always 50% for embeddings)
4. **Time trade-off**: 30 seconds vs 24 hours

Example display:
```
Cost Comparison:
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Immediate:  $0.30  (30 seconds)
Batch:      $0.15  (24 hours)
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
You save:   $0.15  (50%)
```

## Error Handling

### Batch Job Failures
If a batch job fails:
1. User receives notification
2. Option to retry with batch
3. Option to run immediately instead
4. Detailed error log available

### Timeout Handling
If batch exceeds 24 hours:
1. Mark as failed
2. Notify user
3. Offer to resubmit
4. Track timeout rate for monitoring

## Analytics Integration

Track and display:
- Total batch jobs submitted
- Success rate
- Average processing time
- Total cost savings
- Cost savings per project
- User adoption rate (batch vs standard)

## Implementation Priority

1. **Phase 1**: Basic batch mode selection in regeneration UI
2. **Phase 2**: Batch job status dashboard
3. **Phase 3**: Smart recommendations
4. **Phase 4**: Configuration interface
5. **Phase 5**: Advanced scheduling

## Benefits

âœ… **Cost savings**: 50% reduction on embeddings  
âœ… **User control**: Choose urgency vs cost  
âœ… **Transparency**: Clear cost comparison  
âœ… **Flexibility**: Override defaults anytime  
âœ… **Intelligence**: Smart recommendations  
âœ… **Visibility**: Track savings over time  

This integration ensures users always have the option to optimize costs while maintaining the ability to get immediate results when needed.
