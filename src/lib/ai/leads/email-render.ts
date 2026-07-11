/**
 * Minimal email HTML rendering for notification-seam mail (Block G6).
 *
 * The artifacts we send (JD compatibility documents, later lead notes and
 * conversation summaries) are plain prose with light markdown — headings and
 * bold. This renders exactly that subset with full HTML escaping and inline
 * styles (email clients ignore stylesheets), deliberately WITHOUT a markdown
 * dependency: a half-rendered exotic construct in an email is worse than
 * plain text, and the text/plain part always carries the verbatim document.
 */

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** `**bold**` on already-escaped text. */
function inlineBold(escaped: string): string {
  return escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

const P_STYLE = 'margin:0 0 12px;line-height:1.55;color:#1f2933;font-size:15px;';
const H_STYLE = 'margin:20px 0 8px;line-height:1.3;color:#111827;';

/** Markdown-lite (headings, bold, paragraphs) → email-safe HTML body. */
export function renderEmailBody(markdownish: string): string {
  const blocks = markdownish.replace(/\r\n/g, '\n').split(/\n{2,}/);
  const parts: string[] = [];
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading && !trimmed.includes('\n')) {
      const level = Math.min(heading[1].length + 2, 5); // # → h3, ## → h4 …
      parts.push(`<h${level} style="${H_STYLE}">${inlineBold(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }
    const lines = trimmed.split('\n').map((l) => inlineBold(escapeHtml(l)));
    parts.push(`<p style="${P_STYLE}">${lines.join('<br/>')}</p>`);
  }
  return parts.join('\n');
}

/** Full document shell: lead-in line, rendered body, honest footer. */
export function renderEmailShell(options: {
  intro?: string;
  bodyMarkdown: string;
  footer: string;
}): string {
  const intro = options.intro
    ? `<p style="${P_STYLE}">${inlineBold(escapeHtml(options.intro))}</p>`
    : '';
  return [
    '<div style="max-width:640px;margin:0 auto;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#ffffff;">',
    intro,
    renderEmailBody(options.bodyMarkdown),
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;"/>`,
    `<p style="margin:0;line-height:1.5;color:#6b7280;font-size:12px;">${escapeHtml(options.footer)}</p>`,
    '</div>',
  ].join('\n');
}
