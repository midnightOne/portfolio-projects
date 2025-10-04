# Budget Management System Implementation

## Overview

The Budget Management System provides comprehensive financial control over AI operations in the semantic content management system. It tracks costs, enforces budget limits, provides analytics, and prevents budget overruns.

## Components Implemented

### 1. SemanticBudgetManager Class
**Location**: `src/lib/content/SemanticBudgetManager.ts`

Core service for budget operations:
- Budget allocation and tracking
- Real-time cost deduction
- Budget depletion detection
- Warning thresholds (80%, 90%)
- Spending history with filtering
- Cost breakdown by operation type
- Budget analytics with projections
- CSV export for cost data

**Key Methods**:
```typescript
// Get or create active budget
getActiveBudget(): Promise<BudgetStatus>

// Allocate additional funds
allocateFunds(allocation: BudgetAllocation): Promise<BudgetStatus>

// Deduct cost from budget in real-time
deductCost(operationCost: OperationCost): Promise<DeductionResult>

// Check if operation can proceed
canAffordOperation(estimatedCost: number): Promise<AffordabilityCheck>

// Get spending history with filters
getSpendingHistory(filter: SpendingHistoryFilter): Promise<Operation[]>

// Get cost breakdown by operation type
getCostBreakdown(): Promise<CostBreakdown>

// Get budget analytics with trends
getBudgetAnalytics(days: number): Promise<BudgetAnalytics>

// Export spending data as CSV
exportSpendingDataCSV(filter?: SpendingHistoryFilter): Promise<string>

// Update warning thresholds
updateThresholds(warning: number, critical: number): Promise<BudgetStatus>

// Record failed operation (no cost deduction)
recordFailedOperation(operation: FailedOperation): Promise<void>
```

### 2. BudgetAwareAIOperations Class
**Location**: `src/lib/content/BudgetAwareAIOperations.ts`

Wrapper for AI operations with automatic budget tracking:
- Budget-aware embedding generation
- Budget-aware summarization
- Cost estimation for regeneration
- Automatic cost deduction
- Failed operation tracking

**Key Methods**:
```typescript
// Generate embeddings with budget tracking
generateEmbedding(options: BudgetAwareEmbeddingOptions): Promise<EmbeddingResult>

// Generate AI summary with budget tracking
generateSummary(options: BudgetAwareSummarizationOptions): Promise<SummaryResult>

// Estimate regeneration cost
estimateRegenerationCost(options: RegenerationOptions): Promise<CostEstimate>

// Check affordability
canAffordOperation(estimatedCost: number): Promise<AffordabilityCheck>

// Get budget status
getBudgetStatus(): Promise<BudgetStatus>
```

### 3. API Endpoints

#### GET /api/admin/semantic/budget
Get current budget status
```typescript
Response: {
  success: boolean;
  budget: BudgetStatus;
}
```

#### POST /api/admin/semantic/budget/allocate
Allocate additional funds
```typescript
Request: {
  amount: number;
  description?: string;
}
Response: {
  success: boolean;
  budget: BudgetStatus;
  message: string;
}
```

#### GET /api/admin/semantic/budget/operations
Get spending history with filtering
```typescript
Query Parameters:
  - projectId?: string
  - operationType?: 'embedding' | 'summarization' | 'regeneration'
  - startDate?: string (ISO date)
  - endDate?: string (ISO date)
  - success?: boolean

Response: {
  success: boolean;
  operations: Operation[];
  count: number;
}
```

#### GET /api/admin/semantic/budget/breakdown
Get cost breakdown by operation type
```typescript
Response: {
  success: boolean;
  breakdown: CostBreakdown;
}
```

#### GET /api/admin/semantic/budget/analytics
Get budget analytics with trends and projections
```typescript
Query Parameters:
  - days?: number (default: 30)

Response: {
  success: boolean;
  analytics: BudgetAnalytics;
  period: { days, startDate, endDate };
}
```

#### GET /api/admin/semantic/budget/export
Export spending data as CSV
```typescript
Query Parameters: (same as operations endpoint)

Response: CSV file download
```

#### PUT /api/admin/semantic/budget/thresholds
Update warning and critical thresholds
```typescript
Request: {
  warningThreshold: number; // 0-1
  criticalThreshold: number; // 0-1
}
Response: {
  success: boolean;
  budget: BudgetStatus;
  message: string;
}
```

## Database Models

### SemanticBudget
```prisma
model SemanticBudget {
  id                 String              @id @default(cuid())
  allocatedFunds     Decimal             @default(0.00)
  remainingFunds     Decimal             @default(0.00)
  totalSpent         Decimal             @default(0.00)
  embeddingCosts     Decimal             @default(0.00)
  summarizationCosts Decimal             @default(0.00)
  warningThreshold   Float               @default(0.8)
  criticalThreshold  Float               @default(0.9)
  isActive           Boolean             @default(true)
  lastAllocatedAt    DateTime?
  depletedAt         DateTime?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  operations         SemanticOperation[]
}
```

### SemanticOperation
```prisma
model SemanticOperation {
  id              String         @id @default(cuid())
  budgetId        String
  projectId       String?
  operationType   String         // 'embedding' | 'summarization' | 'regeneration'
  tokensUsed      Int            @default(0)
  cost            Decimal        @default(0.00)
  model           String?
  chunksProcessed Int            @default(0)
  tiersAffected   Json           @default("[]")
  success         Boolean        @default(true)
  error           String?
  metadata        Json           @default("{}")
  startedAt       DateTime       @default(now())
  completedAt     DateTime?
  duration        Int?
  budget          SemanticBudget @relation(...)
}
```

## Usage Examples

### Basic Budget Operations

```typescript
import { semanticBudgetManager } from '@/lib/content/SemanticBudgetManager';

// Get current budget
const budget = await semanticBudgetManager.getActiveBudget();
console.log(`Remaining: $${budget.remainingFunds.toFixed(2)}`);

// Allocate funds
await semanticBudgetManager.allocateFunds({
  amount: 50.00,
  description: 'Monthly AI operations budget'
});

// Check affordability
const check = await semanticBudgetManager.canAffordOperation(5.00);
if (!check.canAfford) {
  console.log(`Shortfall: $${check.shortfall}`);
}

// Deduct cost
await semanticBudgetManager.deductCost({
  operationType: 'embedding',
  tokensUsed: 1500,
  cost: 0.03,
  model: 'text-embedding-3-small',
  projectId: 'project-123'
});
```

### Budget-Aware AI Operations

```typescript
import { getBudgetAwareAI } from '@/lib/content/BudgetAwareAIOperations';

const budgetAI = getBudgetAwareAI();

// Generate embedding with automatic budget tracking
const result = await budgetAI.generateEmbedding({
  input: 'Content to embed',
  model: 'text-embedding-3-small',
  projectId: 'project-123'
});

// Generate summary with automatic budget tracking
const summary = await budgetAI.generateSummary({
  content: 'Long content to summarize...',
  systemPrompt: 'Summarize in 2-3 sentences',
  model: 'gpt-4o-mini',
  projectId: 'project-123'
});

// Estimate regeneration cost
const estimate = await budgetAI.estimateRegenerationCost({
  projectId: 'project-123',
  sectionsToRegenerate: 5,
  averageTokensPerSection: 500,
  includeEmbeddings: true
});
console.log(`Estimated cost: $${estimate.estimatedCost.toFixed(4)}`);
```

### Spending Analytics

```typescript
// Get spending history
const history = await semanticBudgetManager.getSpendingHistory({
  projectId: 'project-123',
  startDate: new Date('2025-01-01'),
  operationType: 'embedding'
});

// Get cost breakdown
const breakdown = await semanticBudgetManager.getCostBreakdown();
console.log('Embedding costs:', breakdown.embedding.cost);
console.log('Summarization costs:', breakdown.summarization.cost);

// Get analytics
const analytics = await semanticBudgetManager.getBudgetAnalytics(30);
console.log('Average daily cost:', analytics.projections.averageDailyCost);
console.log('Estimated days remaining:', analytics.projections.estimatedDaysRemaining);

// Export to CSV
const csv = await semanticBudgetManager.exportSpendingDataCSV({
  startDate: new Date('2025-01-01')
});
```

## Cost Tracking

### Cost Constants (USD per 1K tokens)
- `text-embedding-3-small`: $0.00002
- `text-embedding-3-large`: $0.00013
- `gpt-4o-mini`: $0.00015
- `gpt-4o`: $0.0025
- `gpt-4`: $0.03

### Automatic Cost Calculation
The system automatically:
1. Estimates cost before operation
2. Checks budget availability
3. Performs operation if affordable
4. Deducts actual cost from budget
5. Records operation in history
6. Updates cost breakdowns

### Budget Warning Levels
- **ok**: < 80% of budget used
- **warning**: 80-90% of budget used
- **critical**: 90-100% of budget used
- **depleted**: 100% of budget used (operations blocked)

## Testing

### Unit Tests
```bash
# Test budget management system
npx tsx scripts/test-budget-management.ts

# Test budget-aware AI operations
npx tsx scripts/test-budget-aware-ai.ts
```

### API Tests
```bash
# Test API endpoints (requires dev server running)
npx tsx scripts/test-budget-api.ts
```

## Integration Points

### With SmartContentGenerator
The SmartContentGenerator should use BudgetAwareAIOperations for all AI operations:

```typescript
import { getBudgetAwareAI } from '@/lib/content/BudgetAwareAIOperations';

class SmartContentGenerator {
  private budgetAI = getBudgetAwareAI();
  
  async generateT1Summary(project: any) {
    // Use budget-aware summarization
    const result = await this.budgetAI.generateSummary({
      content: project.articleContent.content,
      systemPrompt: 'Generate project summary...',
      projectId: project.id
    });
    return result.summary;
  }
}
```

### With VectorOperations
Embedding generation should go through BudgetAwareAIOperations:

```typescript
import { getBudgetAwareAI } from '@/lib/content/BudgetAwareAIOperations';

async function generateEmbeddings(chunks: string[], projectId: string) {
  const budgetAI = getBudgetAwareAI();
  
  const result = await budgetAI.generateEmbedding({
    input: chunks,
    model: 'text-embedding-3-small',
    projectId
  });
  
  return result.embeddings;
}
```

## Error Handling

### Insufficient Budget
```typescript
try {
  await budgetAI.generateEmbedding({ input: 'content' });
} catch (error) {
  if (error.message.includes('Insufficient budget')) {
    // Handle budget depletion
    // - Notify admin
    // - Prompt for fund allocation
    // - Queue operation for later
  }
}
```

### Failed Operations
Failed operations are automatically recorded without cost deduction:
```typescript
// Automatically handled by BudgetAwareAIOperations
// Failed operations appear in spending history with success: false
```

## Best Practices

1. **Always use BudgetAwareAIOperations** for AI operations
2. **Check affordability** before expensive batch operations
3. **Monitor warning levels** and allocate funds proactively
4. **Review analytics regularly** to optimize costs
5. **Export spending data** for financial reporting
6. **Set appropriate thresholds** based on usage patterns
7. **Track costs per project** for cost attribution

## Future Enhancements

- Budget alerts via email/webhook
- Per-project budget limits
- Cost optimization recommendations
- Budget forecasting based on historical trends
- Integration with billing systems
- Multi-currency support
- Budget approval workflows
- Cost allocation by user/team

## Summary

The Budget Management System provides:
✅ Real-time cost tracking
✅ Budget enforcement
✅ Spending analytics
✅ Cost breakdown by operation type
✅ CSV export for reporting
✅ Warning thresholds
✅ Failed operation tracking
✅ Budget-aware AI operations
✅ Comprehensive API endpoints
✅ Full test coverage

All requirements from Task 5 have been successfully implemented and tested.
