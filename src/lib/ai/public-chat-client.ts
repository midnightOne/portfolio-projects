/**
 * Client helper for the public text-chat tier (access-and-cost Req 2/3, D31).
 *
 * Session cookies are minted via POST /api/ai/chat/session and ride HttpOnly —
 * this module only tracks the expiry hint so it can re-mint proactively.
 *
 * Turnstile note: dev runs Cloudflare's official always-pass TEST keys, whose
 * secret accepts any response token — so a placeholder token is sent without
 * rendering the widget. Deploy-time swap (documented in CLAUDE.md): set real
 * TURNSTILE keys AND render the Turnstile widget to produce real tokens here.
 */

export interface PublicChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type PublicChatResult =
  | { ok: true; reply: string; requestId?: string }
  | { ok: false; error: string; code?: string };

const SESSION_EXPIRY_KEY = 'ai_public_chat_session_until';
const PLACEHOLDER_TURNSTILE_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

async function mintSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/ai/chat/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turnstileToken: PLACEHOLDER_TURNSTILE_TOKEN }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (typeof data?.expiresAt === 'string') {
      sessionStorage.setItem(SESSION_EXPIRY_KEY, data.expiresAt);
    }
    return true;
  } catch {
    return false;
  }
}

function sessionLooksValid(): boolean {
  const until = sessionStorage.getItem(SESSION_EXPIRY_KEY);
  return !!until && new Date(until).getTime() > Date.now() + 30_000;
}

export async function sendPublicChatMessage(
  message: string,
  history: PublicChatTurn[]
): Promise<PublicChatResult> {
  const doSend = () =>
    fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });

  if (!sessionLooksValid() && !(await mintSession())) {
    return { ok: false, error: 'The assistant is unavailable right now — please try again later.', code: 'SESSION_MINT_FAILED' };
  }

  let res = await doSend();
  if (res.status === 401) {
    // cookie expired or IP changed — one re-mint + retry
    if (await mintSession()) {
      res = await doSend();
    }
  }

  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (res.ok) {
    return { ok: true, reply: typeof data.reply === 'string' ? data.reply : '', requestId: data.requestId as string | undefined };
  }
  return {
    ok: false,
    error: typeof data.error === 'string' ? data.error : 'Something went wrong — please try again.',
    code: data.code as string | undefined,
  };
}
