# Regeneration Workflow - Visual Guide

## User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                     SEMANTIC DASHBOARD                          │
│                                                                 │
│  Quick Actions:                                                 │
│  ┌──────────────┐                                              │
│  │ Regenerate ▼ │ ← Click to open dropdown                     │
│  └──────────────┘                                              │
│       │                                                         │
│       ├─ All Projects                                          │
│       ├─ Entire Project (if viewing project)                   │
│       └─ This Section Only (if viewing section)                │
│                                                                 │
│  Project List:                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Project A  │ 150 chunks │ ... │ [View Tree] [Regenerate]│   │
│  │ Project B  │ 200 chunks │ ... │ [View Tree] [Regenerate]│   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STEP 1: COST ESTIMATION                        │
│                                                                 │
│  Regeneration Scope                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Regenerate project: My Portfolio Project                 │  │
│  │                                                           │  │
│  │ Projects Affected: 1    Sections to Regenerate: 8       │  │
│  │ Sections Preserved: 2   Chunks Affected: 45             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Cost Breakdown                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Embedding Generation:        $0.0015                     │  │
│  │ AI Summarization:            $0.0025                     │  │
│  │ ─────────────────────────────────────                   │  │
│  │ Total Estimated Cost:        $0.0040                     │  │
│  │                                                           │  │
│  │ Estimated tokens: 12,500                                 │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Processing Mode                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ [⚡ Immediate Processing ▼]                              │  │
│  │                                                           │  │
│  │ ┌─────────────┬──────────────┬─────────────────────┐   │  │
│  │ │ Cost        │ Time         │ Savings             │   │  │
│  │ │ $0.0040     │ ~30 seconds  │ -                   │   │  │
│  │ └─────────────┴──────────────┴─────────────────────┘   │  │
│  │                                                           │  │
│  │ OR select: [🌙 Batch Processing (50% savings)]          │  │
│  │ ┌─────────────┬──────────────┬─────────────────────┐   │  │
│  │ │ Cost        │ Time         │ Savings             │   │  │
│  │ │ $0.0020     │ ~24 hours    │ $0.0020 (50%)       │   │  │
│  │ └─────────────┴──────────────┴─────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Budget Status: ✅ OK (15% used)                               │
│                                                                 │
│  [Cancel]                                    [Continue]         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STEP 2: CONFIRMATION                           │
│                                                                 │
│  ⚠️  This operation will cost $0.0040. Please confirm.         │
│                                                                 │
│  Confirmation Summary                                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Scope:                    project                        │  │
│  │ Sections to Regenerate:   8                             │  │
│  │ Processing Mode:          [⚡ Immediate]                 │  │
│  │ Estimated Cost:           $0.0040                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Back]                              [Confirm & Start]          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STEP 3: PROGRESS TRACKING                      │
│                                                                 │
│  ⚙️ Regeneration Progress                                      │
│  Processing: Technical Implementation                           │
│                                                                 │
│  Progress                                                       │
│  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 37.5%   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Sections Processed:  3 / 8                              │  │
│  │ Chunks Processed:    17                                 │  │
│  │ Tokens Used:         4,687                              │  │
│  │ Cost Accumulated:    $0.0015                            │  │
│  │                                                           │  │
│  │ ⏱️ Estimated time remaining: 19s                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Real-time updates via Server-Sent Events]                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  STEP 4: COMPLETION SUMMARY                     │
│                                                                 │
│  ✅ Regeneration completed successfully!                       │
│                                                                 │
│  Summary Report                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Sections Processed:  8                                   │  │
│  │ Chunks Created:      45                                  │  │
│  │ Total Tokens:        12,500                              │  │
│  │ Total Cost:          $0.0040                             │  │
│  │                                                           │  │
│  │ Processing Time:     28.3s                               │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│                                              [Done]             │
└─────────────────────────────────────────────────────────────────┘
```

## Batch Mode Comparison

```
┌──────────────────────────────────────────────────────────────┐
│                    IMMEDIATE MODE                            │
├──────────────────────────────────────────────────────────────┤
│  Icon:        ⚡ Lightning                                   │
│  Cost:        $0.0040 (standard rate)                        │
│  Time:        ~30 seconds                                    │
│  Savings:     $0 (0%)                                        │
│  Use Case:    Urgent updates, testing, small projects       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     BATCH MODE                               │
├──────────────────────────────────────────────────────────────┤
│  Icon:        🌙 Moon                                        │
│  Cost:        $0.0020 (50% discount)                         │
│  Time:        ~24 hours                                      │
│  Savings:     $0.0020 (50%)                                  │
│  Use Case:    Overnight regeneration, bulk operations       │
└──────────────────────────────────────────────────────────────┘
```

## Budget Warning States

```
┌──────────────────────────────────────────────────────────────┐
│  ✅ OK (0-79% used)                                          │
│  No warnings, operation proceeds normally                    │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  ⚠️  WARNING (80-89% used)                                   │
│  Budget warning: 85% of allocated funds used.                │
│  Consider allocating more funds.                             │
│  Operation can proceed.                                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  🔴 CRITICAL (90-99% used)                                   │
│  Budget critically low (95% used).                           │
│  Consider allocating more funds.                             │
│  Operation can proceed but budget will be depleted soon.     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  ❌ DEPLETED (100% used or insufficient)                     │
│  Insufficient budget. Required: $0.0040, Available: $0.0015  │
│  Operation BLOCKED. Allocate more funds to continue.         │
│  [Continue] button is DISABLED                               │
└──────────────────────────────────────────────────────────────┘
```

## Error Handling Display

```
┌──────────────────────────────────────────────────────────────┐
│  ⚠️ Errors (2)                                               │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Technical Implementation                                │ │
│  │ Failed to generate embedding: Rate limit exceeded      │ │
│  │ [Retryable]                                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Results and Conclusion                                  │ │
│  │ Content too large for summarization (max 8000 tokens)  │ │
│  │ [Not Retryable]                                        │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                    SEMANTIC DASHBOARD                       │
│                                                             │
│  Quick Actions:                                             │
│  [Regenerate ▼] ← Dropdown with all scopes                 │
│                                                             │
│  Project List:                                              │
│  [Regenerate Project] ← Per-project button                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SEMANTIC TREE VIEW                       │
│                                                             │
│  Header Actions:                                            │
│  [Regenerate ▼] [Expand All] [Collapse All]               │
│       │                                                     │
│       ├─ This Section Only                                 │
│       ├─ Entire Project                                    │
│       └─ All Projects                                      │
└─────────────────────────────────────────────────────────────┘
```

## Scope Selection

```
┌──────────────────────────────────────────────────────────────┐
│  SCOPE: ALL PROJECTS                                         │
├──────────────────────────────────────────────────────────────┤
│  Icon:        ⚡ Zap                                         │
│  Description: Regenerate semantic indexes for all projects  │
│  Impact:      High cost, long duration                      │
│  Use Case:    System-wide updates, model changes            │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  SCOPE: SINGLE PROJECT                                       │
├──────────────────────────────────────────────────────────────┤
│  Icon:        📁 Folder                                      │
│  Description: Regenerate semantic indexes for one project   │
│  Impact:      Medium cost, medium duration                  │
│  Use Case:    Project updates, content changes              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  SCOPE: SPECIFIC SECTION                                     │
├──────────────────────────────────────────────────────────────┤
│  Icon:        📄 File                                        │
│  Description: Regenerate semantic indexes for one section   │
│  Impact:      Low cost, short duration                      │
│  Use Case:    Section edits, surgical updates               │
└──────────────────────────────────────────────────────────────┘
```

## Real-time Progress Updates

```
Time: 0s
┌────────────────────────────────────────────────────────────┐
│ ⚙️ Starting regeneration...                                │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0%   │
└────────────────────────────────────────────────────────────┘

Time: 5s
┌────────────────────────────────────────────────────────────┐
│ ⚙️ Processing: Introduction                                │
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 12.5%  │
│ Sections: 1/8 | Chunks: 5 | Cost: $0.0005                 │
└────────────────────────────────────────────────────────────┘

Time: 15s
┌────────────────────────────────────────────────────────────┐
│ ⚙️ Processing: Technical Implementation                    │
│ ████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░ 37.5%   │
│ Sections: 3/8 | Chunks: 17 | Cost: $0.0015                │
│ ⏱️ Estimated time remaining: 19s                           │
└────────────────────────────────────────────────────────────┘

Time: 28s
┌────────────────────────────────────────────────────────────┐
│ ✅ Regeneration completed successfully!                    │
│ ████████████████████████████████████████████████████ 100%  │
│ Sections: 8/8 | Chunks: 45 | Cost: $0.0040                │
│ Processing Time: 28.3s                                     │
└────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
SemanticRegenerationTrigger
    │
    ├─ Button Variant
    │   └─ Single scope (all/project/section)
    │
    └─ Dropdown Variant
        └─ Multiple scope options
            │
            └─ Launches ──────────────────────┐
                                              │
                                              ▼
                        SemanticRegenerationWorkflow
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            Estimate Step   Confirm Step   Progress Step
                    │               │               │
                    └───────────────┴───────────────┘
                                    │
                                    ▼
                            Complete Step
```

## API Flow

```
User Action
    │
    ▼
[Trigger Regeneration]
    │
    ├─ POST /api/admin/semantic/regenerate/estimate
    │   └─ Returns: RegenerationEstimate
    │
    ├─ GET /api/admin/semantic/budget
    │   └─ Returns: BudgetStatus
    │
    ├─ POST /api/admin/semantic/regenerate
    │   └─ Returns: { operationId, status }
    │
    └─ GET /api/admin/semantic/regenerate/[operationId]?sse=true
        └─ Returns: Server-Sent Events stream
            │
            ├─ Progress updates every 1-2 seconds
            ├─ Section completion events
            ├─ Error events
            └─ Completion event
```

## Success Metrics

```
┌──────────────────────────────────────────────────────────────┐
│  OPERATION SUCCESSFUL                                        │
├──────────────────────────────────────────────────────────────┤
│  ✅ Status:              Completed                           │
│  📊 Sections Processed:  8 / 8 (100%)                        │
│  📦 Chunks Created:      45                                  │
│  🔢 Total Tokens:        12,500                              │
│  💰 Total Cost:          $0.0040                             │
│  ⏱️ Processing Time:     28.3s                               │
│  ❌ Errors:              0                                   │
│  💾 Budget Remaining:    $9.9960                             │
└──────────────────────────────────────────────────────────────┘
```

This visual guide demonstrates the complete user journey through the regeneration workflow, from initial trigger to completion summary, with all intermediate steps and states clearly illustrated.
