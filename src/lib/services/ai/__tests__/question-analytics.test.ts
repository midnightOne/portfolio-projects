/**
 * Block I1 — the question-analytics attribution join (Req 16.1): first N user
 * turns after each node_transition, bounded by the conversation's NEXT
 * transition so a turn is entry evidence for exactly one node. Pure function;
 * the SQL around it is exercised by the in-session drill (D46).
 */

import { attributeEntryTurns, TransitionMarkerRow, UserTurnRow } from '../question-analytics';

const at = (s: number) => new Date(2026, 6, 10, 12, 0, s);

const marker = (conversationId: string, sec: number, toNode: string): TransitionMarkerRow => ({
  conversationId,
  timestamp: at(sec),
  toNode,
  graphVersionId: 'v1',
});

const turn = (conversationId: string, sec: number, content: string, id?: string): UserTurnRow => ({
  id: id ?? `${conversationId}-t${sec}`,
  conversationId,
  timestamp: at(sec),
  content,
});

describe('attributeEntryTurns (I1 / Req 16.1)', () => {
  it('takes the first N user turns after a transition', () => {
    const out = attributeEntryTurns(
      [marker('c1', 10, 'nodeA')],
      [turn('c1', 11, 'first'), turn('c1', 12, 'second'), turn('c1', 13, 'third')],
      2
    );
    expect(out.map((o) => o.text)).toEqual(['first', 'second']);
    expect(out[0]).toMatchObject({ nodeId: 'nodeA', graphVersionId: 'v1', conversationId: 'c1' });
  });

  it('bounds attribution at the next transition — one node per turn', () => {
    const out = attributeEntryTurns(
      [marker('c1', 10, 'nodeA'), marker('c1', 12, 'nodeB')],
      [turn('c1', 11, 'for A'), turn('c1', 13, 'for B'), turn('c1', 14, 'also B')],
      2
    );
    expect(out).toHaveLength(3);
    expect(out.filter((o) => o.nodeId === 'nodeA').map((o) => o.text)).toEqual(['for A']);
    expect(out.filter((o) => o.nodeId === 'nodeB').map((o) => o.text)).toEqual(['for B', 'also B']);
  });

  it('ignores turns at or before the transition timestamp', () => {
    const out = attributeEntryTurns(
      [marker('c1', 10, 'nodeA')],
      [turn('c1', 9, 'before'), turn('c1', 10, 'same instant'), turn('c1', 11, 'after')]
    );
    expect(out.map((o) => o.text)).toEqual(['after']);
  });

  it('drops empty/near-empty turns and caps stored text length', () => {
    const long = 'x'.repeat(600);
    const out = attributeEntryTurns(
      [marker('c1', 10, 'nodeA')],
      [turn('c1', 11, '  '), turn('c1', 12, long)],
      2
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toHaveLength(500);
  });

  it('keeps conversations independent', () => {
    const out = attributeEntryTurns(
      [marker('c1', 10, 'nodeA'), marker('c2', 10, 'nodeB')],
      [turn('c1', 11, 'c1 turn'), turn('c2', 11, 'c2 turn')]
    );
    expect(out.find((o) => o.conversationId === 'c1')?.nodeId).toBe('nodeA');
    expect(out.find((o) => o.conversationId === 'c2')?.nodeId).toBe('nodeB');
  });

  it('handles unsorted input (markers and turns sort internally)', () => {
    const out = attributeEntryTurns(
      [marker('c1', 20, 'nodeB'), marker('c1', 10, 'nodeA')],
      [turn('c1', 21, 'B entry'), turn('c1', 11, 'A entry')]
    );
    expect(out.filter((o) => o.nodeId === 'nodeA').map((o) => o.text)).toEqual(['A entry']);
    expect(out.filter((o) => o.nodeId === 'nodeB').map((o) => o.text)).toEqual(['B entry']);
  });
});
