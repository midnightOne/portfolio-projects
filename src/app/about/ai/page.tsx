import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { MainNavigation } from '@/components/layout/main-navigation';
import { AIInterfaceWrapper } from '@/components/ai/ai-interface-wrapper';
import { McpConnectCard } from '@/components/about/McpConnectCard';

export const metadata: Metadata = {
  title: 'How the AI works — Portfolio',
  description:
    'The architecture behind this portfolio’s AI assistant: three voice/text modes sharing one grounded brain, a tiered semantic index, a metered gateway, and a hardened public MCP server.',
};

/**
 * About/AI — the architecture explanation as a portfolio piece
 * (roadmap 4.6 / mcp-server task 5). Written for a technical visitor: what
 * the assistant is, why it answers the same in every mode, what it costs to
 * run safely in public, and how to connect an AI agent of your own to it.
 */
export default async function AboutAIPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin';

  return (
    <div className="min-h-screen">
      <MainNavigation />

      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <article className="space-y-14">
          {/* ---- Hero ---- */}
          <header className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              About the AI
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              This portfolio talks. Here&rsquo;s how.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              The site you&rsquo;re on is its own flagship project. The assistant in the
              floating pill isn&rsquo;t a chat widget bolted on top — it is the portfolio
              speaking in first person, navigating its own pages while it answers, and
              every layer of it (voice pipelines, retrieval, cost control, the public
              MCP endpoint) was built as a demonstration of production AI engineering.
            </p>
          </header>

          {/* ---- Three modes, one brain ---- */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">Three modes, one brain</h2>
            <p className="leading-relaxed">
              You can talk to the portfolio three ways, and all three give the same
              grounded answers because they share a single reasoning-and-tools backend:
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="font-semibold">Native speech-to-speech</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Realtime voice models from OpenAI (WebRTC) and Google Gemini Live
                  (WebSocket), connected directly from your browser with short-lived
                  session tokens. The flagship experience: the model hears you and
                  speaks back with no transcription hop.
                </p>
              </div>
              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="font-semibold">Cascade voice</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Speech-to-text &rarr; the text pipeline&rsquo;s reasoning model &rarr;
                  text-to-speech (ElevenLabs, OpenAI, or Gemini TTS as the engine). Any
                  chat model gains a voice — and tool calls run server-side, where they
                  are reliable.
                </p>
              </div>
              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="font-semibold">Text chat</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The base mode, on a cost-efficient reasoning model. The cascade is
                  literally this pipeline with audio layered on — so a typed question
                  and a spoken one produce the same substance.
                </p>
              </div>
            </div>
            <p className="leading-relaxed">
              All three sit behind one adapter interface, so a session can even be
              resumed on a <em>different</em> provider mid-conversation: connection
              recovery and deliberate provider switching are the same code path. When a
              connection drops, the new session is briefed from the server-side
              conversation store — the server is the ground truth; a model&rsquo;s
              in-session memory is treated as a cache.
            </p>
            <p className="leading-relaxed">
              Which models, which voices, and what they&rsquo;re allowed to spend are
              all admin-configurable data — no model ID is hardcoded anywhere in the
              codebase.
            </p>
          </section>

          {/* ---- Grounding ---- */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Grounded in a tiered semantic index
            </h2>
            <p className="leading-relaxed">
              Answers come from the portfolio&rsquo;s actual content, not the
              model&rsquo;s imagination. Every project is ingested into a four-tier
              index — <strong>T0</strong> one portfolio-level overview,{' '}
              <strong>T1</strong> a summary per project, <strong>T2</strong> section
              summaries, <strong>T3</strong> heading-bounded content chunks — each
              chunk carrying an embedding in Postgres/pgvector. Retrieval is hybrid:
              vector similarity, full-text search, and metadata filters combined, so
              &ldquo;the kiln project&rdquo; and &ldquo;PID control loops&rdquo; both
              land in the right place.
            </p>
            <p className="leading-relaxed">
              The assistant also knows where you <em>are</em>. A passive context
              pipeline pushes Frame (current page), Index (what content exists), and
              Details (the item you&rsquo;re focused on) into the session as you
              browse, each on a strict token budget, replacing stale context rather
              than accumulating it. Questions about what&rsquo;s on screen need no
              lookup at all; anything deeper goes through search tools over the index.
              And when retrieval comes back weak, the assistant is instructed to say
              the portfolio doesn&rsquo;t cover it — a low-relevance match is not an
              answer.
            </p>
            <p className="leading-relaxed">
              Navigation is a tool like any other: the model expresses{' '}
              <em>intent</em> against a registry of semantic UI targets, and the site
              animates itself there — the model never touches the DOM.
            </p>
          </section>

          {/* ---- The silence problem ---- */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Voice UX: the silence tells the truth
            </h2>
            <p className="leading-relaxed">
              In a voice interface, the gap between your question and the answer is
              itself an interface element — two seconds of dead air reads as a dropped
              call. This system treats filler as a <em>latency instrument</em>, driven
              by measurement:
            </p>
            <ul className="list-disc space-y-2 pl-6 leading-relaxed marker:text-muted-foreground">
              <li>
                Per-tool median execution times, measured from real conversations, are
                injected when a session starts. Tools that finish imperceptibly fast
                are called silently — narrating &ldquo;one moment&rdquo; around a
                sub-second call only prolongs the interaction. Slower tools earn a
                short, topic-relevant lead-in.
              </li>
              <li>
                For genuinely slow calls, a pre-recorded clip in the assistant&rsquo;s
                own voice plays the instant the call starts — chosen so its length
                fits the expected gap, one clip per silence, cut off the moment real
                speech arrives. Clips are rendered per configured voice; a provider
                with no matching voice gets silence, never the wrong voice.
              </li>
              <li>
                The worst moment — a dropped connection, when there is no model to
                speak at all — is covered by the same mechanism: a client-side
                &ldquo;reconnecting&rdquo; clip plays over the automatic resume flow.
              </li>
            </ul>
            <p className="leading-relaxed">
              Every clip playback is logged as its own event, so the admin replay of a
              conversation never mistakes a canned clip for model speech. Honest
              telemetry over polish.
            </p>
          </section>

          {/* ---- Cost & abuse ---- */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Running LLMs in public without a blank check
            </h2>
            <p className="leading-relaxed">
              Every AI entry point on this site — text chat, voice session minting,
              the MCP endpoint — passes through one gateway: kill switch, then access
              tier, then rate limits, then execution, then a metered write to a single
              usage ledger. There is exactly one place where money is counted, and
              everything reads from it.
            </p>
            <ul className="list-disc space-y-2 pl-6 leading-relaxed marker:text-muted-foreground">
              <li>
                <strong>Anonymous visitors</strong> get bot-challenged text chat with
                per-minute, per-day, and token budgets, and a strict tool allowlist.
              </li>
              <li>
                <strong>Invitation links</strong> (for recruiters: premium voice
                access, job-spec analysis) are treated as leakable credentials from
                day one: each link carries its own budget, binds to the first few
                devices that use it (IPs stored only as hashes), and enforces per-device
                daily sublimits — a leaked link doesn&rsquo;t open premium access to
                the whole internet.
              </li>
              <li>
                <strong>A global spend watchdog</strong> reads the ledger and trips a
                kill switch that darkens every public AI surface at once, requiring
                manual re-enable. Voice sessions carry duration caps enforced
                client-and-server side.
              </li>
            </ul>
            <p className="leading-relaxed">
              The honest version of the security claim: a determined adversary with
              unlimited IPs is <em>bounded</em> by the watchdog, not stopped. That is
              the design goal — graceful, capped failure instead of a surprise bill.
            </p>
          </section>

          {/* ---- MCP ---- */}
          <section className="space-y-5">
            <h2 className="text-2xl font-semibold tracking-tight">
              Bring your own AI: the public MCP server
            </h2>
            <p className="leading-relaxed">
              You don&rsquo;t have to use the pill. This portfolio exposes a public{' '}
              <a
                href="https://modelcontextprotocol.io"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-primary"
              >
                Model Context Protocol
              </a>{' '}
              server, so your own AI — Claude, an agent framework, anything that
              speaks MCP over Streamable HTTP — can search and read the portfolio
              directly. Three read-only tools:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-sm">search_portfolio</code>,{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-sm">get_project</code>,{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-sm">list_projects</code>{' '}
              — the same backend chain the voice assistant uses, exposed twice,
              implemented once.
            </p>

            <McpConnectCard />

            <h3 className="text-lg font-semibold pt-2">
              How an open endpoint stays safe (the part that&rsquo;s also the pitch)
            </h3>
            <p className="leading-relaxed">
              An anonymous, cookie-less AI endpoint is exactly the kind of thing that
              goes wrong in public, so its hardening is deliberate and testable — the
              safeguards below double as the endpoint&rsquo;s test plan:
            </p>
            <ul className="list-disc space-y-2 pl-6 leading-relaxed marker:text-muted-foreground">
              <li>
                Every call passes the same gateway as everything else, with its own
                stricter per-IP rate bucket and its own kill switch — when the spend
                watchdog trips, MCP goes dark with the rest of public AI.
              </li>
              <li>
                Inputs are schema-validated with hard length caps before any service
                or database is touched; oversized and traversal-shaped inputs are
                rejected at the door.
              </li>
              <li>
                Only PUBLIC content is reachable, enforced in SQL — not by prompt, not
                by post-hoc trimming. A private project and a nonexistent one answer
                identically, so the endpoint isn&rsquo;t an existence oracle.
              </li>
              <li>
                Errors are mapped to generic messages — no stack traces, no SQL, no
                paths. Content retrieved from the database is returned as data, never
                executed as instructions.
              </li>
              <li>
                Every tool call is metered into the ledger with the tool name and a
                hashed caller IP — the endpoint is fully accounted for, per call.
              </li>
            </ul>
            <p className="leading-relaxed text-muted-foreground text-sm">
              v1 is deliberately read-only. Write tools (contact, messaging) and deep
              reasoning tools would each require their own abuse analysis before they
              exist.
            </p>
          </section>

          {/* ---- Closing ---- */}
          <section className="space-y-4 border-t pt-8">
            <h2 className="text-2xl font-semibold tracking-tight">Why build it this way</h2>
            <p className="leading-relaxed">
              Everything above follows a few principles applied repeatedly: one
              mechanism, many triggers (recovery-resume is provider-switching; voice
              tools are MCP tools); the server is truth and sessions are caches;
              observability as the development loop (every turn, tool call, clip, and
              disruption is replayable in an admin timeline); and security posture as
              a feature with an audience, stated honestly. The system was also built{' '}
              <em>with</em> AI agents as first-class users — including the agent that
              helped build it, which drives the real voice pipeline in tests through a
              synthesized microphone because it doesn&rsquo;t have one of its own.
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Curious how it behaves? Open the pill and ask it about any of this —
              it&rsquo;s the same brain this page just described.
            </p>
          </section>
        </article>
      </main>

      <AIInterfaceWrapper defaultProvider="openai" isAdmin={isAdmin} />
    </div>
  );
}
