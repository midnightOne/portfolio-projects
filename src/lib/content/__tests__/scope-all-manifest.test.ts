jest.mock('@/lib/database/connection', () => ({ prisma: {} }));

import {
  loadEnabledDocumentSources,
  recordOperationFailure,
  type ProcessingProgress,
} from '../StageBasedProcessingService';

function progress(): ProcessingProgress {
  const stage = () => ({
    status: 'pending' as const,
    progress: 0,
    itemsProcessed: 0,
    totalItems: 0,
    errors: [],
  });
  return {
    operationId: 'all-1',
    status: 'in_progress',
    currentStage: null,
    stageProgress: {
      chunking: stage(),
      summaries: stage(),
      embeddings: stage(),
      validation: stage(),
    },
    overallProgress: 0,
    totalItemsProcessed: 0,
    totalItems: 0,
    costAccumulated: 0,
    tokensUsed: 0,
    errors: [],
    startedAt: new Date(),
    lastUpdatedAt: new Date(),
    canResume: true,
  } as ProcessingProgress;
}

describe("scope:'all' manifest handling", () => {
  it('propagates a manifest read failure instead of returning an empty source list', async () => {
    const load = jest.fn().mockRejectedValue(new Error('manifest unavailable'));
    await expect(loadEnabledDocumentSources(load)).rejects.toThrow('manifest unavailable');
  });

  it('filters only after a successful manifest read', async () => {
    const sources = [
      { enabled: true, content: 'ready' },
      { enabled: false, content: 'disabled' },
      { enabled: true, content: '   ' },
    ] as any;
    await expect(loadEnabledDocumentSources(async () => sources)).resolves.toEqual([sources[0]]);
  });

  it('records coordinator failures in durable progress projections', () => {
    const state = progress();
    recordOperationFailure(state, new Error('manifest unavailable'));
    expect(state.errors).toMatchObject([
      { itemId: 'system', itemTitle: 'Processing coordinator', error: 'manifest unavailable', retryable: true },
    ]);
  });
});
