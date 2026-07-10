/**
 * Block E3 — coverage aggregation (Req 9.3): version scoping, P17 test
 * exclusion, dead nodes, hot off-graph exits, edge fire counts, and the
 * reconciliation surface for markers on since-removed nodes.
 */

import { aggregateCoverage, TransitionMarkerRow } from '../graph-coverage';
import type { GraphDocument } from '@/lib/ai/engine/types';

const doc: GraphDocument = {
  nodes: [
    { id: 'n_start', name: 'Start', role: 'start', guidance: { promptFragments: [] }, contextSet: [] },
    { id: 'n_deep', name: 'Deep dive', role: 'state', guidance: { promptFragments: [] }, contextSet: [] },
    { id: 'n_dead', name: 'Never entered', role: 'state', guidance: { promptFragments: [] }, contextSet: [] },
    { id: 'n_off', name: 'Off-graph', role: 'offgraph', guidance: { promptFragments: [] }, contextSet: [] },
  ],
  edges: [
    { id: 'e_1', from: 'n_start', to: 'n_deep', priority: 10, condition: { type: 'pattern', anyOf: ['kiln'] }, purge: 'replace' },
    { id: 'e_exit', from: 'n_deep', to: 'n_off', priority: 20, condition: { type: 'pivot' }, purge: 'replace' },
  ],
};

const V1 = 'v_current';
const OPTS = { versionIds: new Set([V1, 'v_old']), windowDays: 30, since: '2026-06-10T00:00:00.000Z' };

function row(overrides: Partial<TransitionMarkerRow>): TransitionMarkerRow {
  return {
    conversationId: 'c1',
    timestamp: '2026-07-01T00:00:00.000Z',
    fromNode: null,
    toNode: 'n_start',
    edgeId: null,
    conditionType: null,
    graphVersionId: V1,
    isTest: false,
    ...overrides,
  };
}

describe('aggregateCoverage (E3, Req 9.3)', () => {
  it('counts entries, edge fires, distinct conversations; flags dead nodes', () => {
    const report = aggregateCoverage(doc, [
      row({ conversationId: 'c1', toNode: 'n_start' }),
      row({ conversationId: 'c1', toNode: 'n_deep', fromNode: 'n_start', edgeId: 'e_1', conditionType: 'pattern' }),
      row({ conversationId: 'c2', toNode: 'n_start' }),
      row({ conversationId: 'c2', toNode: 'n_deep', fromNode: 'n_start', edgeId: 'e_1', conditionType: 'pattern' }),
    ], OPTS);

    expect(report.conversations).toBe(2);
    expect(report.transitions).toBe(4);
    const start = report.nodes.find((n) => n.nodeId === 'n_start')!;
    const deep = report.nodes.find((n) => n.nodeId === 'n_deep')!;
    const dead = report.nodes.find((n) => n.nodeId === 'n_dead')!;
    expect(start).toMatchObject({ entries: 2, conversations: 2, dead: false });
    expect(deep).toMatchObject({ entries: 2, conversations: 2, dead: false });
    expect(dead).toMatchObject({ entries: 0, dead: true });
    expect(report.edgeFires).toEqual({ e_1: 2 });
  });

  it('excludes test-tagged conversations entirely and reports how many (P17)', () => {
    const report = aggregateCoverage(doc, [
      row({ conversationId: 'c1', toNode: 'n_start' }),
      row({ conversationId: 'c_test', toNode: 'n_start', isTest: true }),
      row({ conversationId: 'c_test', toNode: 'n_deep', fromNode: 'n_start', edgeId: 'e_1', isTest: true }),
    ], OPTS);

    expect(report.conversations).toBe(1);
    expect(report.transitions).toBe(1);
    expect(report.testConversationsExcluded).toBe(1);
    expect(report.edgeFires).toEqual({});
  });

  it("scopes to the graph's own version ids — other graphs' markers never count", () => {
    const report = aggregateCoverage(doc, [
      row({ toNode: 'n_start' }),
      row({ conversationId: 'c_other', toNode: 'n_start', graphVersionId: 'v_other_graph' }),
    ], OPTS);

    expect(report.transitions).toBe(1);
    expect(report.conversations).toBe(1);
  });

  it('counts markers from OLDER versions of the same graph (stable node ids, Req 1.5)', () => {
    const report = aggregateCoverage(doc, [
      row({ toNode: 'n_deep', fromNode: 'n_start', edgeId: 'e_1', graphVersionId: 'v_old' }),
    ], OPTS);
    expect(report.nodes.find((n) => n.nodeId === 'n_deep')!.entries).toBe(1);
    expect(report.edgeFires).toEqual({ e_1: 1 });
  });

  it('ranks off-graph exits by frequency of the last node before off-graph', () => {
    const report = aggregateCoverage(doc, [
      row({ conversationId: 'c1', toNode: 'n_off', fromNode: 'n_deep', edgeId: 'e_exit' }),
      row({ conversationId: 'c2', toNode: 'n_off', fromNode: 'n_deep', edgeId: 'e_exit' }),
      row({ conversationId: 'c3', toNode: 'n_off', fromNode: 'n_start' }),
    ], OPTS);

    expect(report.offGraphExits).toEqual([
      { fromNode: 'n_deep', name: 'Deep dive', count: 2 },
      { fromNode: 'n_start', name: 'Start', count: 1 },
    ]);
  });

  it('surfaces entries on nodes removed from the reference document instead of dropping them', () => {
    const report = aggregateCoverage(doc, [
      row({ toNode: 'n_removed', fromNode: 'n_start', edgeId: 'e_gone' }),
    ], OPTS);

    expect(report.removedNodeEntries).toEqual([{ nodeId: 'n_removed', entries: 1 }]);
    // an edge id absent from the reference document is not invented into edgeFires
    expect(report.edgeFires).toEqual({});
    // but the transition still counts toward totals — numbers reconcile
    expect(report.transitions).toBe(1);
  });
});
