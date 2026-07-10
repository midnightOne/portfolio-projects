/**
 * Block I3 — same-device continuity marker (Req 17.1 / P32). localStorage
 * hint only: read/write/clear round-trips, per-reflink isolation, and garbage
 * tolerance (a corrupted store must never throw — worst case is one extra
 * confirmation tap).
 */

import { readContinuityMarker, writeContinuityMarker, clearContinuityMarker } from '../continuity-marker';

const KEY = 'portfolio-ai-continuity';

describe('continuity-marker (I3 / P32)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips a marker per reflink', () => {
    expect(readContinuityMarker('ref-a')).toBeNull();
    writeContinuityMarker('ref-a', 'session_1');
    expect(readContinuityMarker('ref-a')).toBe('session_1');
    expect(readContinuityMarker('ref-b')).toBeNull(); // isolation
  });

  it('overwrites on a new session and clears on demand', () => {
    writeContinuityMarker('ref-a', 'session_1');
    writeContinuityMarker('ref-a', 'session_2');
    expect(readContinuityMarker('ref-a')).toBe('session_2');
    clearContinuityMarker('ref-a');
    expect(readContinuityMarker('ref-a')).toBeNull();
  });

  it('keeps other reflinks when clearing one', () => {
    writeContinuityMarker('ref-a', 'session_1');
    writeContinuityMarker('ref-b', 'session_2');
    clearContinuityMarker('ref-a');
    expect(readContinuityMarker('ref-b')).toBe('session_2');
  });

  it('tolerates a corrupted store', () => {
    window.localStorage.setItem(KEY, '{not json');
    expect(readContinuityMarker('ref-a')).toBeNull();
    expect(() => writeContinuityMarker('ref-a', 'session_1')).not.toThrow();
    expect(readContinuityMarker('ref-a')).toBe('session_1');
  });

  it('idempotent write does not touch storage for the same session id', () => {
    writeContinuityMarker('ref-a', 'session_1');
    const before = window.localStorage.getItem(KEY);
    const spy = jest.spyOn(Storage.prototype, 'setItem');
    writeContinuityMarker('ref-a', 'session_1');
    expect(spy).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(KEY)).toBe(before);
    spy.mockRestore();
  });
});
