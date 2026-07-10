/**
 * Block D1 — structural version diff (Req 8.4). Joins on stable ids (Req 1.5);
 * layout and publish-time embeddings must never register as changes.
 */

import { diffGraphDocuments } from '../graph-diff';
import { GraphDocumentSchema, type GraphDocument } from '@/lib/ai/engine/types';

function doc(overrides: Partial<GraphDocument> = {}): GraphDocument {
  return GraphDocumentSchema.parse({
    nodes: [
      { id: 'n_start', name: 'Start', role: 'start', guidance: { promptFragments: [] }, contextSet: [] },
      { id: 'n_off', name: 'Off-graph', role: 'offgraph', guidance: { promptFragments: [] }, contextSet: [] },
    ],
    edges: [],
    ...overrides,
  });
}

describe('diffGraphDocuments', () => {
  it('reports identical for byte-equal documents', () => {
    const diff = diffGraphDocuments(doc(), doc());
    expect(diff.identical).toBe(true);
    expect(diff.nodes).toHaveLength(0);
    expect(diff.edges).toHaveLength(0);
  });

  it('layout and embeddings changes are NOT structural changes', () => {
    const older = doc({ layout: { n_start: { x: 0, y: 0 } } });
    const newer = doc({
      layout: { n_start: { x: 500, y: 300 } },
      embeddings: { e_x: { model: 'text-embedding-3-small', vectors: [[0.1, 0.2]] } },
    });
    expect(diffGraphDocuments(older, newer).identical).toBe(true);
  });

  it('detects added, removed, and changed nodes by stable id', () => {
    const older = doc();
    const newer = doc({
      nodes: [
        // changed: same id, new guidance
        { id: 'n_start', name: 'Start', role: 'start', guidance: { promptFragments: ['be terse'] }, contextSet: [] },
        { id: 'n_off', name: 'Off-graph', role: 'offgraph', guidance: { promptFragments: [] }, contextSet: [] },
        // added
        { id: 'n_deep', name: 'Deep dive', role: 'state', guidance: { promptFragments: [] }, contextSet: [] },
      ] as GraphDocument['nodes'],
    });
    const diff = diffGraphDocuments(older, newer);
    expect(diff.identical).toBe(false);
    expect(diff.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'n_deep', change: 'added' }),
        expect.objectContaining({ id: 'n_start', change: 'changed' }),
      ])
    );
    const removed = diffGraphDocuments(newer, older);
    expect(removed.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'n_deep', change: 'removed' })])
    );
  });

  it('detects edge changes and labels them with node names + condition type', () => {
    const base = doc();
    const withEdge = doc({
      edges: [
        { id: 'e_1', from: 'n_start', to: 'n_off', priority: 10, condition: { type: 'pattern', anyOf: ['bye'] }, purge: 'replace' },
      ] as GraphDocument['edges'],
    });
    const added = diffGraphDocuments(base, withEdge);
    expect(added.edges).toEqual([expect.objectContaining({ id: 'e_1', change: 'added', label: 'Start → Off-graph (pattern)' })]);

    const retargeted = doc({
      edges: [
        { id: 'e_1', from: 'n_start', to: 'n_off', priority: 20, condition: { type: 'pattern', anyOf: ['bye'] }, purge: 'replace' },
      ] as GraphDocument['edges'],
    });
    expect(diffGraphDocuments(withEdge, retargeted).edges).toEqual([expect.objectContaining({ id: 'e_1', change: 'changed' })]);
  });

  it('is insensitive to property order (stable stringify)', () => {
    const a = doc();
    // Same node content, keys in a different order
    const b = GraphDocumentSchema.parse({
      nodes: [
        { role: 'start', guidance: { promptFragments: [] }, name: 'Start', contextSet: [], id: 'n_start' },
        { contextSet: [], id: 'n_off', role: 'offgraph', name: 'Off-graph', guidance: { promptFragments: [] } },
      ],
      edges: [],
    });
    expect(diffGraphDocuments(a, b).identical).toBe(true);
  });
});
