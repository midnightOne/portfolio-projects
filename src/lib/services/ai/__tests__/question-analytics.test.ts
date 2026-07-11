/**
 * Block I1 — the question-analytics attribution join (Req 16.1): first N user
 * turns after each node_transition, bounded by the conversation's NEXT
 * transition so a turn is entry evidence for exactly one node. Pure function;
 * the SQL around it is exercised by the in-session drill (D46).
 */

import {
  attributeEntryTurns,
  attributeOrganicEntryTurns,
  protoNodeKey,
  TransitionMarkerRow,
  UserTurnRow,
  OrganicTurnRow,
} from '../question-analytics';

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

// ---------------------------------------------------------------------------
// M3 — proto-node keys + the organic sampling join (Req 16 extension, §9.7)
// ---------------------------------------------------------------------------

describe('protoNodeKey (M3)', () => {
  it('derives project_opened from fid ui_state evidence (string or {slug})', () => {
    expect(protoNodeKey({ type: 'ui_state', route: '/projects', project: 'chrono-kiln' })).toBe(
      'proto:project_opened:chrono-kiln'
    );
    expect(protoNodeKey({ type: 'ui_state', project: { slug: 'Chrono-Kiln' } })).toBe(
      'proto:project_opened:chrono-kiln'
    );
  });

  it('derives section_viewed for anchored routes, route_changed otherwise', () => {
    expect(protoNodeKey({ type: 'ui_state', route: '/projects/kiln#architecture' })).toBe(
      'proto:section_viewed:/projects/kiln#architecture'
    );
    expect(protoNodeKey({ type: 'ui_state', route: '/about' })).toBe('proto:route_changed:/about');
  });

  it("excludes non-visitor-locus events (agent navigation, preference flips)", () => {
    expect(protoNodeKey({ type: 'navigation', target: { id: 'kiln' } })).toBeNull();
    expect(protoNodeKey({ event: 'autonav_changed', value: true })).toBeNull();
    expect(protoNodeKey({ type: 'ui_state' })).toBeNull();
  });

  it('normalizes and caps key values', () => {
    const key = protoNodeKey({ type: 'ui_state', project: `Weird Name!! ${'x'.repeat(100)}` });
    expect(key).toMatch(/^proto:project_opened:weird-name-x+$/);
    expect(key!.length).toBeLessThanOrEqual('proto:project_opened:'.length + 60);
  });
});

describe('attributeOrganicEntryTurns (M3)', () => {
  const oturn = (
    conversationId: string,
    sec: number,
    content: string,
    uiEvents: Array<Record<string, unknown>> = []
  ): OrganicTurnRow => ({ ...turn(conversationId, sec, content), uiEvents });

  it('the carrier turn + the next turn attribute to the event, capped at N', () => {
    const out = attributeOrganicEntryTurns([
      oturn('c1', 10, 'what is this project?', [{ type: 'ui_state', project: 'kiln' }]),
      oturn('c1', 11, 'how does the control loop work?'),
      oturn('c1', 12, 'third — beyond the cap'),
    ]);
    expect(out.map((o) => o.text)).toEqual(['what is this project?', 'how does the control loop work?']);
    expect(out.every((o) => o.protoKey === 'proto:project_opened:kiln')).toBe(true);
  });

  it('a new carrier bounds the previous attribution — one proto-node per turn', () => {
    const out = attributeOrganicEntryTurns([
      oturn('c1', 10, 'kiln question', [{ type: 'ui_state', project: 'kiln' }]),
      oturn('c1', 11, 'about page question', [{ type: 'ui_state', route: '/about' }]),
      oturn('c1', 12, 'follow-up'),
    ]);
    expect(out.filter((o) => o.protoKey === 'proto:project_opened:kiln').map((o) => o.text)).toEqual([
      'kiln question',
    ]);
    expect(out.filter((o) => o.protoKey === 'proto:route_changed:/about').map((o) => o.text)).toEqual([
      'about page question',
      'follow-up',
    ]);
  });

  it('the LAST derivable event on a carrier wins (most recent before the turn)', () => {
    const out = attributeOrganicEntryTurns([
      oturn('c1', 10, 'question', [
        { type: 'ui_state', route: '/projects' },
        { type: 'ui_state', project: 'kiln' },
      ]),
    ]);
    expect(out[0].protoKey).toBe('proto:project_opened:kiln');
  });

  it('turns before any derivable event contribute nothing; empty turns dropped', () => {
    const out = attributeOrganicEntryTurns([
      oturn('c1', 9, 'pre-event chatter'),
      oturn('c1', 10, '  ', [{ type: 'ui_state', project: 'kiln' }]),
      oturn('c1', 11, 'real question'),
    ]);
    expect(out.map((o) => o.text)).toEqual(['real question']);
  });

  it('keeps conversations independent and sorts internally', () => {
    const out = attributeOrganicEntryTurns([
      oturn('c2', 11, 'c2 q'),
      oturn('c2', 10, 'c2 carrier', [{ type: 'ui_state', route: '/about' }]),
      oturn('c1', 10, 'c1 carrier', [{ type: 'ui_state', project: 'kiln' }]),
    ]);
    expect(out.find((o) => o.conversationId === 'c1')?.protoKey).toBe('proto:project_opened:kiln');
    expect(out.filter((o) => o.conversationId === 'c2').map((o) => o.text)).toEqual(['c2 carrier', 'c2 q']);
  });
});
