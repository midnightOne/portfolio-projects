/**
 * fill_field client tool (ai-assistant 7.16b — the generic dictation
 * text-fill D18 was parked for). Load-bearing behaviors: the fill goes
 * through the NATIVE value setter + a bubbling input event (React-controlled
 * inputs are blind to plain `.value=` — known trap); the result reads the
 * value BACK from the DOM (6.10 honesty — a failed fill reports failure,
 * never narrates success); submission is hard-gated on the explicit-consent
 * attestation; a missing field returns an actionable error listing what CAN
 * be filled.
 *
 * The adapter dispatch (`_executeUnifiedTool`) THROWS on `success: false`, so
 * every failure asserted here reaches the model as an error, not a result.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { uiNavigationTools } from '../client-tools';

const fill = (args: Record<string, unknown>) => (uiNavigationTools as any)['fill_field'](args, 'sess_test');

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('fill_field — filling (native setter + events, readback honesty)', () => {
  it('fills by data-semantic-id, fires bubbling input+change, and reads the value back', async () => {
    document.body.innerHTML = `
      <form><input id="msg" data-semantic-id="client-request-message" type="text" /></form>`;
    const input = document.getElementById('msg') as HTMLInputElement;
    const seen: string[] = [];
    // Listener on the FORM asserts the events bubble (what React's root listener needs).
    input.form!.addEventListener('input', () => seen.push('input'));
    input.form!.addEventListener('change', () => seen.push('change'));

    const result = await fill({ field: 'client-request-message', value: 'Build me a shop' });
    expect(result.success).toBe(true);
    expect(input.value).toBe('Build me a shop');
    expect(result.data.currentValue).toBe('Build me a shop');
    expect(seen).toEqual(['input', 'change']);
    expect(result.message).toContain('Build me a shop'); // the model can repeat back what landed
  });

  it('resolves by element id, name attribute, and visible label text', async () => {
    document.body.innerHTML = `
      <form>
        <input id="email" type="email" />
        <input name="phone" type="text" />
        <label for="subj">Subject *</label><input id="subj" type="text" />
      </form>`;
    expect((await fill({ field: 'email', value: 'a@b.c' })).success).toBe(true);
    expect((await fill({ field: 'phone', value: '555' })).success).toBe(true);
    expect((await fill({ field: 'subject', value: 'Quote request' })).success).toBe(true);
    expect((document.getElementById('subj') as HTMLInputElement).value).toBe('Quote request');
  });

  it('a fill that does not land FAILS with the real state — never narrates success (6.10)', async () => {
    document.body.innerHTML = `<form><input id="ro" readonly value="locked" /></form>`;
    // jsdom allows setting .value on readonly inputs; force the mismatch the
    // way a rejecting control would: a value setter that keeps the old value.
    const input = document.getElementById('ro') as HTMLInputElement;
    Object.defineProperty(input, 'value', { get: () => 'locked', set: () => undefined });
    const result = await fill({ field: 'ro', value: 'new text' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('FAILED');
    expect(result.message).toContain('locked'); // the REAL current state, for honest reporting
  });

  it('an OPEN AI overlay wins over the page behind it (live-drill finding 2026-07-17)', async () => {
    // Background contact form has #message; the intake modal (data-ai-surface)
    // has its own message field — "message" while the modal is open must fill
    // the MODAL's field, not the hidden page one.
    document.body.innerHTML = `
      <form><textarea id="message"></textarea></form>
      <div data-ai-surface="true">
        <form>
          <label for="client-request-message">Your message / request *</label>
          <textarea id="client-request-message" name="client-request-message"></textarea>
        </form>
      </div>`;
    const result = await fill({ field: 'message', value: 'modal text' });
    expect(result.success).toBe(true);
    expect((document.getElementById('client-request-message') as HTMLTextAreaElement).value).toBe('modal text');
    expect((document.getElementById('message') as HTMLTextAreaElement).value).toBe('');
  });

  it('a UNIQUE handle-substring match resolves; an ambiguous one falls to the honest error', async () => {
    document.body.innerHTML = `
      <div data-ai-surface="true"><form>
        <input id="client-request-contact" name="client-request-contact" />
        <textarea id="client-request-message"></textarea>
      </form></div>`;
    // "contact" appears in exactly one handle inside the open modal → resolves
    const r1 = await fill({ field: 'contact', value: 'jane@x.test' });
    expect(r1.success).toBe(true);
    expect((document.getElementById('client-request-contact') as HTMLInputElement).value).toBe('jane@x.test');
    // "request" matches BOTH fields → ambiguous → honest not-found with the field list
    const r2 = await fill({ field: 'request', value: 'x' });
    expect(r2.success).toBe(false);
    expect(r2.message).toContain('client-request-contact');
  });

  it('a missing field returns an actionable error listing the fillable fields', async () => {
    document.body.innerHTML = `<form><input id="name" /><textarea name="message"></textarea></form>`;
    const result = await fill({ field: 'does-not-exist', value: 'x' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
    expect(result.message).toContain('name');
    expect(result.message).toContain('message');
  });
});

describe('fill_field — the consent gate (submit)', () => {
  it('submit WITHOUT the attestation performs the fill but never the submit', async () => {
    document.body.innerHTML = `<form><input id="msg" /></form>`;
    const form = document.querySelector('form') as HTMLFormElement;
    const requestSubmit = jest.fn();
    form.requestSubmit = requestSubmit;

    const result = await fill({ field: 'msg', value: 'hello', submit: true });
    expect(requestSubmit).not.toHaveBeenCalled();
    expect(result.success).toBe(true); // the FILL succeeded — honest partial outcome
    expect(result.data.submitted).toBe(false);
    expect(result.message).toContain('NOT submitted');
    expect(result.message).toContain('confirm');
  });

  it('submit-only WITHOUT the attestation does nothing and tells the model to ask', async () => {
    document.body.innerHTML = `<form><input id="msg" value="prefilled" /></form>`;
    const form = document.querySelector('form') as HTMLFormElement;
    form.requestSubmit = jest.fn();
    const result = await fill({ field: 'msg', submit: true });
    expect(form.requestSubmit).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.message).toContain('confirmation is required');
  });

  it('submits through requestSubmit (form onSubmit runs) only with submitConfirmed: true', async () => {
    document.body.innerHTML = `<form><input id="msg" /></form>`;
    const form = document.querySelector('form') as HTMLFormElement;
    const requestSubmit = jest.fn();
    form.requestSubmit = requestSubmit;

    const result = await fill({ field: 'msg', value: 'hello', submit: true, submitConfirmed: true });
    expect(requestSubmit).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.data.submitted).toBe(true);
  });

  it('a field outside any form reports the missing form honestly instead of pretending', async () => {
    document.body.innerHTML = `<input id="orphan" />`;
    const result = await fill({ field: 'orphan', value: 'x', submit: true, submitConfirmed: true });
    expect(result.success).toBe(false);
    expect(result.message).toContain('press the submit button themselves');
  });
});
