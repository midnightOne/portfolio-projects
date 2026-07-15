# ai-assistant — Design (overview)

**Status:** current — describes implemented system (Gen-2 client-direct)
**Owner domain:** visitor AI runtime
**Last verified against code:** 2026-07-15 (7.1d push/pull boundary recorded; 7.2a/b/e prompt-diet + legacy-context cleanup session)
**Focused designs:** [design-voice-adapters.md](./design-voice-adapters.md) · [design-tools-and-context.md](./design-tools-and-context.md)

---

## 1. Architecture in one pass

```
Browser                                      Server (Vercel serverless)
┌──────────────────────────────┐             ┌──────────────────────────────────┐
│ AI Pill (floating UI)        │             │ /api/ai/openai/session           │
│  └ ConversationalAgentProvider ──token──▶  │ /api/ai/elevenlabs/token         │
│     └ IConversationalAgentAdapter          │   (gateway: tier check, prompt   │
│        ├ OpenAIRealtimeAdapter ◀─WebRTC─▶ OpenAI Realtime                     │
│        ├ ElevenLabsAdapter    ◀─WebRTC─▶ ElevenLabs Agents                    │
│        └ GoogleLiveAdapter (planned D22)   │    + tools injected at mint)     │
│ UnifiedToolRegistry          │             │ /api/ai/tools/execute (gateway)  │
│  ├ client tools → UIManager  │             │   └ BackendToolService           │
│  └ server tools ─────────────┼──HTTP────▶  │      ├ ContentSearchService (RAG)│
│ PassiveFIDManager ───────────┼──/api/ai/context/fid──▶ ContextFrameManager    │
│ conversation events ─────────┼──/api/ai/conversation/log──▶ history manager   │
└──────────────────────────────┘             └──────────────────────────────────┘
```

Principles:
- **Client-direct voice** (browser ↔ provider WebRTC) with server-minted ephemeral tokens; system prompt + tool schema injected server-side at mint. The server never proxies audio.
- **One provider component** (`src/components/providers/conversational-agent-provider.tsx`, D21) drives both the public pill and admin debug.
- **One tool chain**: registry → `/api/ai/tools/execute` → `BackendToolService` — shared with the future MCP server (D39).
- **Passive context first, tools second** (F-I-D): the model is told where the user is; it searches only for what it can't see. **Push = orientation + pull handles only (7.1d):** the passive push carries a location line and id/heading handles, never content prose — prose travels exclusively via pull tools (`ui_details` / `content_search` / `content_get` / `portfolio_overview`) or the engine's budgeted PREPARED CONTEXT.
- **One persistence path** (D26/D58): voice adapters log via `/api/ai/conversation/log`, the text tier writes server-side in `/api/ai/chat`, both into `conversation-history-manager` — one text pipeline regardless of modality, per-message `voice`/`text` labels, audio never stored (debug audio would be a separate `media` file). Implemented + verified 2026-07-07 (task 2b).

## 2. Module map (code truth)

| Concern | Location |
|---|---|
| Adapter interface + implementations | `src/lib/voice/IConversationalAgentAdapter.ts`, `OpenAIRealtimeAdapter.ts`, `ElevenLabsAdapter.ts` |
| Client model/config management | `src/lib/voice/ClientAIModelManager.ts`, `config-validation.ts` |
| Provider (React) | `src/components/providers/conversational-agent-provider.tsx` |
| Tool registry + tools | `src/lib/ai/tools/UnifiedToolRegistry.ts`, `client-tools.ts`, `server-tools.ts`, `BackendToolService.ts` |
| Declarative navigation | `src/lib/navigation/UIManager.ts`, `SemanticIDRegistry.ts` |
| F-I-D | `src/lib/ai/PassiveFIDManager.ts` (client), `src/lib/ai/ContextFrameManager.ts` (server), `/api/ai/context/fid` |
| Persistence | `src/lib/services/ai/conversation-history-manager.ts` + read routes (history/replay/analytics); writers: `/api/ai/chat` (text turns, server-side) + `/api/ai/conversation/log` POST (voice transcripts + tool events, idempotent) — task 2b, 2026-07-07 |
| Voice session config | `VoiceProviderConfig` (Prisma), `/api/admin/ai/voice-config*` |

## 3. Deletions this design assumes (Phase 3)

- Gen-1 stack: `conversation-manager.ts`, `unified-conversation-manager.ts`, `conversation-transport.ts`, `context-manager.ts`; `context-injector.ts` folded into `context-provider.ts` (token-mint prompt assembly is the only surviving duty).
- Duplicate provider `src/contexts/ConversationalAgentContext.tsx` (admin debug re-pointed).
- `src/lib/voice/UINavigationTools.ts` merged with `client-tools.ts` into one client-tool module backed by `UIManager` (two files currently describe UI tools).
- Mock endpoints under `/api/ai/conversation/*` (analytics, search, transcripts) and `/api/admin/ai/voice-analytics*`.
- Handler-less/orphaned tools per D18/D19.

## 4. Debug & monitoring design

Admin surfaces (`/admin/ai/debug` and voice panels) mount the production provider, subscribe to its event stream (context injections, tool calls, transcripts), and read persisted sessions for replay. Live tail via the existing debug event emitter; no separate conversation engine. What the model saw = what the log shows — that identity is the debugging feature.

## 5. Modularity & future-engine constraints (D47/D48 — binding on all work in this spec)

The agent subsystem is a future standalone platform (`_backlog/agentic-platform.md`) and will later host a node-graph conversation engine (`_backlog/conversation-engine.md`). Neither is built now; both forbid shortcuts now:

- **Dependency direction:** `src/lib/{ai,voice,navigation}` never import from `src/app/**` or portfolio components. Portfolio-specific tools (job analysis, contact) register into `UnifiedToolRegistry` from outside the core libs — capabilities are plugins, not built-ins.
- **Optional composition:** every adapter must run a useful session with **zero** F-I-D injections and **no** client tools (pure Q&A mode). UI navigation is a capability, not a prerequisite. Don't let convenience couplings creep in.
- **One policy home:** conversational policy (prompts, context scope, tool allowlists, model choice) is assembled server-side in exactly one place (context provider + token mint). The pill never embeds policy. The future engine replaces that one function.
- **`updateSession` primitive:** the adapter contract includes mid-session reconfiguration (instructions, context items, tool set) — OpenAI Realtime supports `session.update`; the cascade applies changes per-turn; any adapter that can't must document session re-mint as its fallback. The engine's forks ("purge and switch context and model") ride on this + alias-based model selection (D4).
- **No hardcoded host strings** in core libs — prompts/branding come from config/DB.

## 6. Security posture

See requirements Req 11 + `access-and-cost`. Key mechanics: prompts and tool schemas never constructed client-side; per-tier tool allowlists enforced inside `/api/ai/tools/execute`; ephemeral tokens carry duration caps; PRIVATE-visibility content excluded from all public-session retrieval at the service layer.
