/**
 * Block I3 — resume-briefing rendering (Req 17.3 / P24 ladder): summary
 * present → summary + short verbatim tail; absent → full-recap briefing;
 * nothing at all → null (no briefing block).
 */

import { renderResumeBriefing } from '../resume-briefing';

describe('renderResumeBriefing (I3 / Req 17.3)', () => {
  it('returns null when there is neither a summary nor recent turns', () => {
    expect(renderResumeBriefing({ recentTurns: [] })).toBeNull();
  });

  it('renders the no-summary (P24 fallback) briefing from recent turns alone', () => {
    const text = renderResumeBriefing({
      recentTurns: [
        { role: 'user', content: 'tell me about the kiln' },
        { role: 'assistant', content: 'It is a controller project.' },
      ],
    });
    expect(text).toContain('SESSION RESUME');
    expect(text).toContain('Recent conversation (ground truth from the server log):');
    expect(text).toContain('Visitor: tell me about the kiln');
    expect(text).toContain('You: It is a controller project.');
    expect(text).not.toContain('running summary');
  });

  it('renders summary + verbatim tail when a running summary exists (Req 17.3)', () => {
    const text = renderResumeBriefing({
      summary: { text: 'Visitor explored the kiln project and asked about PID control.', version: 3 },
      recentTurns: [{ role: 'user', content: 'what about overshoot?' }],
    });
    expect(text).toContain('running summary v3');
    expect(text).toContain('Visitor explored the kiln project');
    expect(text).toContain('Most recent turns verbatim:');
    expect(text).toContain('Visitor: what about overshoot?');
    // Summary precedes the verbatim tail (stable → recent ordering)
    expect(text!.indexOf('running summary v3')).toBeLessThan(text!.indexOf('Most recent turns verbatim:'));
  });

  it('briefs from the summary alone when no verbatim turns are available', () => {
    const text = renderResumeBriefing({
      summary: { text: 'Discussed firmware background.', version: 1 },
      recentTurns: [],
    });
    expect(text).toContain('Discussed firmware background.');
    expect(text).not.toContain('Most recent turns verbatim:');
  });

  it('keeps the disruption cause and previous-leg note', () => {
    const text = renderResumeBriefing({
      recentTurns: [{ role: 'user', content: 'hi' }],
      lastDisruption: { issueType: 'network' },
      snapshot: { provider: 'openai', modelAlias: 'default-realtime' },
    });
    expect(text).toContain('(network)');
    expect(text).toContain('openai / default-realtime');
  });

  it('states the unceremonious-recall tone rule (Req 17.4)', () => {
    const text = renderResumeBriefing({ recentTurns: [{ role: 'user', content: 'hi' }] });
    expect(text).toContain('unceremoniously');
  });
});
