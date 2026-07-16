jest.mock('@/lib/database/connection', () => {
  const tx = {
    contextChunk: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  return {
    prisma: {
      __tx: tx,
      $transaction: jest.fn(async (fn: (transaction: typeof tx) => unknown) => fn(tx)),
    },
  };
});

const { prisma: mockPrisma } = jest.requireMock('@/lib/database/connection') as {
  prisma: { __tx: any; $transaction: jest.Mock };
};
const mockTx = mockPrisma.__tx;

import { scaffoldChunkKey, selectStaleScaffoldChunkIds } from '../StageBasedProcessingService';
import { StageBasedProcessingService } from '../StageBasedProcessingService';

describe('atomic scaffold replacement policy', () => {
  const existing = [
    { id: 'same', tier: 2, chunkId: 'overview', manuallyEdited: false },
    { id: 'stale-system', tier: 3, chunkId: 'old-system', manuallyEdited: false },
    { id: 'stale-manual', tier: 3, chunkId: 'old-manual', manuallyEdited: true },
    { id: 'reused-other-tier', tier: 3, chunkId: 'overview', manuallyEdited: false },
  ];
  const incoming = [{ tier: 2, chunkId: 'overview' }];

  it('uses tier plus chunkId as scaffold identity', () => {
    expect(scaffoldChunkKey(existing[0])).toBe('2:overview');
    expect(scaffoldChunkKey(existing[3])).toBe('3:overview');
  });

  it('retains stale manual rows when preservation is requested', () => {
    expect(selectStaleScaffoldChunkIds(existing, incoming, true)).toEqual([
      'stale-system',
      'reused-other-tier',
    ]);
  });

  it('removes stale manual rows only when preservation is explicitly disabled', () => {
    expect(selectStaleScaffoldChunkIds(existing, incoming, false)).toEqual([
      'stale-system',
      'stale-manual',
      'reused-other-tier',
    ]);
  });

  it('does not delete stale rows before all replacement upserts succeed', async () => {
    jest.clearAllMocks();
    mockTx.contextChunk.findMany.mockResolvedValue(existing);
    mockTx.contextChunk.upsert.mockRejectedValue(new Error('injected upsert failure'));
    const replace = (StageBasedProcessingService.prototype as any).batchStoreChunks;
    const t0 = {
      tier: 0,
      chunkId: 'metadata',
      content: '{}',
      tokenCount: 1,
      metadata: {},
      rootChunkId: 'metadata',
      derivationPath: 'T0',
    };

    await expect(replace.call({}, [t0], 'entity-1', true)).rejects.toThrow('injected upsert failure');

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.contextChunk.deleteMany).not.toHaveBeenCalled();
  });

  it('does not overwrite a same-key manual chunk when preservation is enabled', async () => {
    jest.clearAllMocks();
    mockTx.contextChunk.findMany.mockResolvedValue([
      { id: 'manual-t0', tier: 0, chunkId: 'metadata', manuallyEdited: true },
    ]);
    const replace = (StageBasedProcessingService.prototype as any).batchStoreChunks;
    const t0 = {
      tier: 0,
      chunkId: 'metadata',
      content: 'generated replacement',
      tokenCount: 5,
      metadata: {},
      rootChunkId: 'metadata',
      derivationPath: 'T0',
    };

    await replace.call({}, [t0], 'entity-1', true);

    expect(mockTx.contextChunk.upsert).not.toHaveBeenCalled();
    expect(mockTx.contextChunk.update).not.toHaveBeenCalled();
    expect(mockTx.contextChunk.deleteMany).not.toHaveBeenCalled();
  });
});
