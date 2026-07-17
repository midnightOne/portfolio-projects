/**
 * Generated portfolio summary (ai-assistant 7.22). Load-bearing behaviors:
 * regeneration runs through the Block M path with the `default-summarizer`
 * ALIAS; a manually-edited chunk is never overwritten; unchanged inputs are a
 * hash-compare no-op (repeat ingest triggers must not burn model calls); a
 * failed generation leaves the previous chunk in place; success clears the
 * start-frame cache so the next mint reads fresh.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findMany: jest.fn() },
    contextChunk: { findMany: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
    contentEntity: { upsert: jest.fn() },
  },
}));
jest.mock('@/lib/services/ai/secondary-llm', () => ({
  runSecondaryLLMJob: jest.fn(),
}));
jest.mock('../start-frame', () => ({
  __clearStartFrameCache: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { runSecondaryLLMJob } from '@/lib/services/ai/secondary-llm';
import { __clearStartFrameCache } from '../start-frame';
import { regeneratePortfolioSummary } from '../portfolio-summary';

const mockPrisma = prisma as unknown as {
  project: { findMany: jest.Mock };
  contextChunk: { findMany: jest.Mock; findFirst: jest.Mock; upsert: jest.Mock };
  contentEntity: { upsert: jest.Mock };
};
const mockJob = runSecondaryLLMJob as jest.Mock;
const mockClearCache = __clearStartFrameCache as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.project.findMany.mockResolvedValue([
    { slug: 'llm-systems-research', title: 'Modern LLM Systems — Research Notes', tags: [{ name: 'AI Engineering' }] },
    { slug: 'e-commerce-platform', title: 'E-commerce Platform', tags: [{ name: 'React' }] },
  ]);
  mockPrisma.contextChunk.findMany.mockResolvedValue([
    { content: 'Deep research notes on LLM internals.', entity: { slug: 'llm-systems-research' } },
  ]);
  mockPrisma.contextChunk.findFirst.mockResolvedValue(null);
  mockPrisma.contentEntity.upsert.mockResolvedValue({ id: 'entity-1' });
  mockPrisma.contextChunk.upsert.mockResolvedValue({ id: 'chunk-1' });
  mockJob.mockResolvedValue({
    result: { summary: 'A portfolio spanning LLM research (llm-systems-research) and commerce engineering (e-commerce-platform).' },
    timedOut: false,
    raw: '{}',
    provider: 'fake',
    modelId: 'fake-summarizer',
    usage: { inputTokens: 300, outputTokens: 80 },
  });
});

describe('regeneratePortfolioSummary', () => {
  it('generates via the default-summarizer ALIAS, upserts the chunk, and clears the frame cache', async () => {
    const outcome = await regeneratePortfolioSummary();
    expect(outcome.status).toBe('generated');
    expect(mockJob.mock.calls[0][0].alias).toBe('default-summarizer'); // D4 — alias, never a model id
    expect(mockJob.mock.calls[0][0].usageType).toBe('portfolio_summary');
    // the model receives current project data incl. slugs
    expect(mockJob.mock.calls[0][0].prompt[1].content).toContain('slug: llm-systems-research');
    const upsert = mockPrisma.contextChunk.upsert.mock.calls[0][0];
    expect(upsert.create.content).toContain('llm-systems-research');
    expect(upsert.create.metadata.sourceHash).toBeTruthy();
    expect(upsert.create.metadata.modelId).toBe('fake-summarizer');
    expect(mockClearCache).toHaveBeenCalled();
  });

  it('NEVER overwrites a manually-edited chunk (7.15 preservation rule)', async () => {
    mockPrisma.contextChunk.findFirst.mockResolvedValue({ id: 'chunk-1', manuallyEdited: true, metadata: {} });
    const outcome = await regeneratePortfolioSummary();
    expect(outcome.status).toBe('skipped_manual');
    expect(mockJob).not.toHaveBeenCalled();
    expect(mockPrisma.contextChunk.upsert).not.toHaveBeenCalled();
  });

  it('unchanged inputs are a hash-compare no-op — no model call', async () => {
    // First run records the hash the inputs produce
    await regeneratePortfolioSummary();
    const recordedHash = mockPrisma.contextChunk.upsert.mock.calls[0][0].create.metadata.sourceHash;
    jest.clearAllMocks();
    mockPrisma.project.findMany.mockResolvedValue([
      { slug: 'llm-systems-research', title: 'Modern LLM Systems — Research Notes', tags: [{ name: 'AI Engineering' }] },
      { slug: 'e-commerce-platform', title: 'E-commerce Platform', tags: [{ name: 'React' }] },
    ]);
    mockPrisma.contextChunk.findMany.mockResolvedValue([
      { content: 'Deep research notes on LLM internals.', entity: { slug: 'llm-systems-research' } },
    ]);
    mockPrisma.contextChunk.findFirst.mockResolvedValue({
      id: 'chunk-1',
      manuallyEdited: false,
      metadata: { sourceHash: recordedHash },
    });
    const outcome = await regeneratePortfolioSummary();
    expect(outcome.status).toBe('skipped_unchanged');
    expect(mockJob).not.toHaveBeenCalled();
  });

  it('a failed generation leaves the previous chunk untouched and reports honestly', async () => {
    mockJob.mockResolvedValue({ result: null, timedOut: true, raw: null, provider: null, modelId: null, usage: null });
    const outcome = await regeneratePortfolioSummary();
    expect(outcome).toMatchObject({ status: 'failed', reason: 'timed out' });
    expect(mockPrisma.contextChunk.upsert).not.toHaveBeenCalled();
    expect(mockClearCache).not.toHaveBeenCalled();
  });

  it('never throws — a hard DB failure degrades to a failed outcome', async () => {
    mockPrisma.project.findMany.mockRejectedValue(new Error('db down'));
    const outcome = await regeneratePortfolioSummary();
    expect(outcome.status).toBe('failed');
  });
});
