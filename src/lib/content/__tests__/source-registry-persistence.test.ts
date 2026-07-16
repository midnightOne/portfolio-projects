jest.mock('@/lib/prisma', () => {
  const tx = {
    aIContentSourceConfig: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    contentEntity: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  return {
    prisma: {
      __tx: tx,
      aIContentSourceConfig: { findMany: jest.fn() },
      $transaction: jest.fn(async (fn: (transaction: typeof tx) => unknown) => fn(tx)),
    },
  };
});

const { prisma: mockPrisma } = jest.requireMock('@/lib/prisma') as {
  prisma: { __tx: any; aIContentSourceConfig: { findMany: jest.Mock }; $transaction: jest.Mock };
};
const mockTx = mockPrisma.__tx;

import {
  deleteDocumentSource,
  getSourceExclusions,
  invalidateSourceRegistryCache,
  upsertDocumentSource,
} from '../source-registry';

const now = new Date('2026-07-16T00:00:00.000Z');

function configRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'config-1',
    sourceId: 'doc:resume',
    providerId: 'document',
    enabled: true,
    priority: 50,
    config: {
      entityType: 'RESUME',
      slug: 'resume',
      title: 'Resume',
      content: 'Existing content',
      tags: [],
      technologies: [],
      uiLocation: null,
    },
    createdAt: now,
    updatedAt: now,
    contentEntity: { id: 'entity-1' },
    ...overrides,
  };
}

const input = {
  slug: 'resume',
  entityType: 'RESUME' as const,
  title: 'Resume',
  content: 'Resume content',
  tags: [],
  technologies: [],
};

describe('document source ownership persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateSourceRegistryCache();
  });

  it('creates a config and its owned entity in one transaction', async () => {
    mockTx.aIContentSourceConfig.findUnique.mockResolvedValueOnce(null);
    mockTx.aIContentSourceConfig.create.mockResolvedValue(configRow({ contentEntity: null }));
    mockTx.contentEntity.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockTx.contentEntity.create.mockResolvedValue({ id: 'entity-1' });
    mockTx.aIContentSourceConfig.findUniqueOrThrow.mockResolvedValue(configRow());

    const saved = await upsertDocumentSource(input);

    expect(saved.entityId).toBe('entity-1');
    expect(mockTx.contentEntity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sourceConfigId: 'config-1', entityType: 'RESUME', slug: 'resume' }),
    }));
  });

  it('rejects a type/slug collision instead of adopting an unowned entity', async () => {
    mockTx.aIContentSourceConfig.findUnique.mockResolvedValueOnce(null);
    mockTx.aIContentSourceConfig.create.mockResolvedValue(configRow({ contentEntity: null }));
    mockTx.contentEntity.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'unowned-entity', sourceConfigId: null });

    await expect(upsertDocumentSource(input)).rejects.toThrow('already exists and is not owned');
    expect(mockTx.contentEntity.create).not.toHaveBeenCalled();
  });

  it('migrates slug/type on the same owned entity without orphaning chunks', async () => {
    const existing = configRow();
    const renamed = configRow({
      sourceId: 'doc:career-history',
      config: { ...existing.config, entityType: 'EXPERIENCE', slug: 'career-history' },
    });
    mockTx.aIContentSourceConfig.findUnique
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(null);
    mockTx.aIContentSourceConfig.update.mockResolvedValue(renamed);
    mockTx.contentEntity.findUnique.mockResolvedValueOnce({ id: 'entity-1' }).mockResolvedValueOnce(null);
    mockTx.contentEntity.update.mockResolvedValue({ id: 'entity-1' });
    mockTx.aIContentSourceConfig.findUniqueOrThrow.mockResolvedValue(renamed);

    const saved = await upsertDocumentSource({
      ...input,
      sourceId: 'doc:resume',
      slug: 'career-history',
      entityType: 'EXPERIENCE',
      content: '',
    });

    expect(saved.sourceId).toBe('doc:career-history');
    expect(mockTx.aIContentSourceConfig.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'config-1' },
      data: expect.objectContaining({ sourceId: 'doc:career-history' }),
    }));
    expect(mockTx.contentEntity.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'entity-1' },
      data: expect.objectContaining({ entityType: 'EXPERIENCE', slug: 'career-history' }),
    }));
  });

  it('deletes only through the proven config-to-entity cascade', async () => {
    mockTx.aIContentSourceConfig.findUnique.mockResolvedValue(configRow());
    mockTx.aIContentSourceConfig.delete.mockResolvedValue(configRow());

    await expect(deleteDocumentSource('resume')).resolves.toEqual({ deletedEntity: true });
    expect(mockTx.aIContentSourceConfig.delete).toHaveBeenCalledWith({ where: { id: 'config-1' } });
    expect(mockTx.contentEntity.update).not.toHaveBeenCalled();
  });

  it('fails closed when source visibility cannot be read', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockPrisma.aIContentSourceConfig.findMany.mockRejectedValue(new Error('database unavailable'));

    await expect(getSourceExclusions()).rejects.toThrow('retrieval refused to fail open');
    consoleError.mockRestore();
  });
});
