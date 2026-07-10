/**
 * D55 context buffer — deterministic unit tests (conversation-engine task A3).
 * Injectable clock per P16: no wall-clock dependence.
 */

import { ContextBuffer } from '../context-buffer';

describe('ContextBuffer (D55)', () => {
  it('last-write-wins per source key', () => {
    const buf = new ContextBuffer();
    buf.publish('fid', '{"a":1}');
    buf.publish('fid', '{"a":2}');
    const block = buf.getBlock();
    expect(block.text).toBe('{"a":2}');
    expect(block.keys).toEqual(['fid']);
  });

  it('renders a single fid entry VERBATIM (legacy NAV_CONTEXT payload compatibility)', () => {
    const buf = new ContextBuffer();
    const fidJson = '{"frame":"x","index":{"route":"/projects"}}';
    buf.publish('fid', fidJson);
    expect(buf.getBlock().text).toBe(fidJson);
  });

  it('renders multiple sources as labeled sections in priority order', () => {
    const buf = new ContextBuffer();
    buf.publish('engine', 'node guidance here', { priority: 50 });
    buf.publish('fid', '{"route":"/"}', { priority: 10 });
    const block = buf.getBlock();
    expect(block.keys).toEqual(['fid', 'engine']);
    expect(block.text).toBe('[fid]\n{"route":"/"}\n\n[engine]\nnode guidance here');
  });

  it('bumps the content version ONLY when merged content changes', () => {
    const buf = new ContextBuffer();
    buf.publish('fid', 'A');
    const v1 = buf.getBlock().version;
    expect(buf.getBlock().version).toBe(v1); // unchanged re-read
    buf.publish('fid', 'A'); // republish identical content
    expect(buf.getBlock().version).toBe(v1);
    buf.publish('fid', 'B');
    expect(buf.getBlock().version).toBe(v1 + 1);
  });

  it('bumps the version when a key is removed', () => {
    const buf = new ContextBuffer();
    buf.publish('fid', 'A');
    const v1 = buf.getBlock().version;
    buf.remove('fid');
    const block = buf.getBlock();
    expect(block.version).toBe(v1 + 1);
    expect(block.text).toBe('');
    expect(block.keys).toEqual([]);
  });

  it('evicts entries by TTL using the injected clock', () => {
    let now = 1_000;
    const buf = new ContextBuffer({ now: () => now });
    buf.publish('engine', 'ephemeral', { ttlMs: 500 });
    buf.publish('fid', 'stable', { priority: 10 });
    expect(buf.getBlock().keys).toEqual(['fid', 'engine']);
    now = 1_499;
    expect(buf.getBlock().keys).toEqual(['fid', 'engine']);
    now = 1_500;
    const block = buf.getBlock();
    expect(block.keys).toEqual(['fid']);
    expect(block.text).toBe('stable');
  });

  it('drops whole items from the tail when over budget, never truncating inside one', () => {
    // budget 10 tokens = 40 chars at char/4
    const buf = new ContextBuffer({ budgetTokens: 10 });
    buf.publish('fid', 'x'.repeat(30), { priority: 10 }); // ~8 tokens
    buf.publish('engine', 'y'.repeat(30), { priority: 50 }); // would exceed
    const block = buf.getBlock();
    expect(block.keys).toEqual(['fid']);
    expect(block.dropped).toEqual(['engine']);
    expect(block.text).toBe('x'.repeat(30)); // intact, not truncated
  });

  it('always keeps the first (highest-priority) item even when it alone exceeds budget', () => {
    const buf = new ContextBuffer({ budgetTokens: 5 });
    buf.publish('fid', 'z'.repeat(100));
    const block = buf.getBlock();
    expect(block.keys).toEqual(['fid']);
    expect(block.dropped).toEqual([]);
  });
});
