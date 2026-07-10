/**
 * Block E1 — traversal walk (Req 9.1): in-order node attribution over a replay
 * timeline. Attribution follows persistence order (design §1 race contract) —
 * a message is credited to the node that governed it when it was produced.
 */

import { extractTraversal, nodeAtEachStep, type TimelineStepLike } from '../traversal-utils';

const msg = (id: string, metadata?: TimelineStepLike['message']['metadata']): TimelineStepLike => ({
  message: { id, metadata },
  timestamp: '2026-07-10T00:00:00.000Z',
});

const transition = (id: string, fromNode: string | null, toNode: string, edgeId: string | null = null): TimelineStepLike =>
  msg(id, { markerType: 'node_transition', fromNode, toNode, edgeId, conditionType: 'pattern', graphVersionId: 'v1' });

describe('traversal-utils (E1, Req 9.1)', () => {
  const timeline: TimelineStepLike[] = [
    transition('m0', null, 'n_start'),        // turn-zero entry (∅ → start)
    msg('m1'),                                 // user turn under start
    msg('m2'),                                 // assistant answer under start
    transition('m3', 'n_start', 'n_deep', 'e_1'),
    msg('m4'),                                 // answer under deep dive
    msg('m5', { markerType: 'conversation_summary', graphVersionId: 'v1' }), // non-transition marker
    msg('m6'),
  ];

  it('extracts ordered hops including the turn-zero entry', () => {
    const hops = extractTraversal(timeline);
    expect(hops).toHaveLength(2);
    expect(hops[0]).toMatchObject({ stepIndex: 0, fromNode: null, toNode: 'n_start', messageId: 'm0' });
    expect(hops[1]).toMatchObject({ stepIndex: 3, fromNode: 'n_start', toNode: 'n_deep', edgeId: 'e_1' });
  });

  it('attributes each step to the node active when it was produced', () => {
    expect(nodeAtEachStep(timeline)).toEqual([
      'n_start', // the entry marker itself belongs to the node it enters
      'n_start',
      'n_start',
      'n_deep',  // transition marker = entry moment
      'n_deep',
      'n_deep',  // summary marker does not move state
      'n_deep',
    ]);
  });

  it('returns null attribution before any graph entry (engine-off prefix)', () => {
    const late: TimelineStepLike[] = [msg('m1'), msg('m2'), transition('m3', null, 'n_start'), msg('m4')];
    expect(nodeAtEachStep(late)).toEqual([null, null, 'n_start', 'n_start']);
  });

  it('ignores malformed transition markers instead of corrupting the walk', () => {
    const broken: TimelineStepLike[] = [
      transition('m0', null, 'n_start'),
      msg('m1', { markerType: 'node_transition' } as TimelineStepLike['message']['metadata']), // no toNode
      msg('m2'),
    ];
    expect(extractTraversal(broken)).toHaveLength(1);
    expect(nodeAtEachStep(broken)).toEqual(['n_start', 'n_start', 'n_start']);
  });
});
