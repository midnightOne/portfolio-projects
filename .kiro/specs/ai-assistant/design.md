# ai-assistant — Design (overview)

**Status:** current — describes implemented system (Gen-2 client-direct)
**Owner domain:** visitor AI runtime
**Last verified against code:** 2026-07-02 (`e2d75b4`)
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
- **Passive context first, tools second** (F-I-D): the model is told where the user is; it searches only for what it can't see.
- **One persistence path** (D26): adapters log to `conversation-history-manager`; debug replays the log.

## 2. Module map (code truth)

| Concern | Location |
|---|---|
| Adapter interface + implementations | `src/lib/voice/IConversationalAgentAdapter.ts`, `OpenAIRealtimeAdapter.ts`, `ElevenLabsAdapter.ts` |
| Client model/config management | `src/lib/voice/ClientAIModelManager.ts`, `config-validation.ts` |
| Provider (React) | `src/components/providers/conversational-agent-provider.tsx` |
| Tool registry + tools | `src/lib/ai/tools/UnifiedToolRegistry.ts`, `client-tools.ts`, `server-tools.ts`, `BackendToolService.ts` |
| Declarative navigation | `src/lib/navigation/UIManager.ts`, `SemanticIDRegistry.ts` |
| F-I-D | `src/lib/ai/PassiveFIDManager.ts` (client), `src/lib/ai/ContextFrameManager.ts` (server), `/api/ai/context/fid` |
| Persistence | `src/lib/services/ai/conversation-history-manager.ts`, `/api/ai/conversation/log` + read-only history/transcript/replay routes |
| Voice session config | `VoiceProviderConfig` (Prisma), `/api/admin/ai/voice-config*` |

## 3. Deletions this design assumes (Phase 3)

- Gen-1 stack: `conversation-manager.ts`, `unified-conversation-manager.ts`, `conversation-transport.ts`, `context-manager.ts`; `context-injector.ts` folded into `context-provider.ts` (token-mint prompt assembly is the only surviving duty).
- Duplicate provider `src/contexts/ConversationalAgentContext.tsx` (admin debug re-pointed).
- `src/lib/voice/UINavigationTools.ts` merged with `client-tools.ts` into one client-tool module backed by `UIManager` (two files currently describe UI tools).
- Mock endpoints under `/api/ai/conversation/*` (analytics, search, transcripts) and `/api/admin/ai/voice-analytics*`.
- Handler-less/orphaned tools per D18/D19.

## 4. Debug & monitoring design

Admin surfaces (`/admin/ai/debug` and voice panels) mount the production provider, subscribe to its event stream (context injections, tool calls, transcripts), and read persisted sessions for replay. Live tail via the existing debug event emitter; no separate conversation engine. What the model saw = what the log shows — that identity is the debugging feature.

## 5. Security posture

See requirements Req 11 + `access-and-cost`. Key mechanics: prompts and tool schemas never constructed client-side; per-tier tool allowlists enforced inside `/api/ai/tools/execute`; ephemeral tokens carry duration caps; PRIVATE-visibility content excluded from all public-session retrieval at the service layer.
