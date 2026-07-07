# Phase 3 dead-code cleanup manifest

**Status:** current — input for the Phase 3 hygiene/consolidation session (D42 hard delete)
**Owner domain:** cross-cutting (execution detail for roadmap 3.x tasks across specs)
**Source:** owner-run reachability tool output, 2026-07-06 (85 orphans, 2 test-only, 124 unused imports, 52 never-instantiated) + spot verification the same day
**Last verified against code:** 2026-07-06 (staging)

**Tool caveat (binding):** the graph's entry roots are the app tree. `scripts/`, `prisma/seed*`, Jest setup, and TypeScript **module augmentation** are invisible to it. Every "orphan" is a *candidate*: before deleting, grep for dynamic `import()`, string-based references, jest `moduleNameMapper`, and script/seed usage. After each batch: `npm run type-check && npm run build && npm test`.

---

## Spec cross-reference — direction of travel (added 2026-07-06)

Every orphan was checked against the live specs' open tasks and `_backlog/` outlines, to catch files that are unreachable *today* but pre-built for *scheduled* work (deleting those would force re-implementation). Three verdicts:

**1. Deletion CONFIRMED by the specs** (the ledgers already schedule these removals — orphanhood just proves the ledger right): `page.new.tsx` (portfolio-core 2.2) · `useRealtimeSession` (roadmap 3.3) · `use-project-indexing`, `project-indexing-status`, `project-indexer`, `project-indexing-integration` (D37, semantic-content 3) · `content-ingestion` + `lib/content/index.ts` (D27) · `project-editor`, `unified-project-editor`, `project-preview-editor`, `project-display` (D10, admin-cms 1) · `use-unified-conversation`, `use-conversation-history` (ai-assistant 2) · `use-context-manager` (wave 3) · `UINavigationTools` (D18/D19) · `reflink-session-manager`, `rate-limiting-integration` (superseded by the Phase 2 gateway).

**2. Scheduled-adjacent — REVIEW/HARVEST at the named task, do NOT delete before it** (unreachable now, but a live ledger task may want the material):

| Orphan | Scheduled work it may serve | Decision point |
|---|---|---|
| `lib/ai/editors/*` (10 files) | ai-admin design §5 **claims it as current architecture** (it isn't wired); ai-admin task 4.3 migrates editing endpoints onto reasoning adapters — the natural moment to either wire this abstraction for real or delete it + correct the spec | **ai-admin 4.3** |
| `lib/voice/connectionDiagnostics.ts` | D49 resume flow needs disruption detection ("adapter connection-state events or heartbeat") — harvest heartbeat/diagnostic logic | **ai-assistant 5b.3** |
| `components/admin/conversation-replay.tsx` | D49 5b.2 requires replay timeline rendering markers inline — the mounted `conversation-management.tsx` has replay *fetching*; this dead twin may have harvestable timeline UI | **ai-assistant 5b.2** |
| `components/ai/reflink-status-indicator.tsx` | access-and-cost Req 7.3 (budget-status surfacing) + the reflink leak-containment backlog + Phase 4 voice caps — a pill-side reflink/budget indicator is plausible near-term UI | **access-and-cost 8** |
| `components/admin/VoiceConnectionTester.tsx` | D16 allows one admin-gated playground per subsystem; Phase 4 Google adapter + cascade need connection testing UI | **ai-assistant 6 / ui-system 1.2** |
| `lib/voice/config-validation.ts` (test-only) | ai-assistant 6 adds Google (and later STT) provider configs — validation schemas will be extended then | **ai-assistant 6** |

**3. No spec wants them** (~60 files: example/demo debris, dead twins, abandoned parallel approaches, junk-drawer utils, dead barrels): no requirement, task, or backlog outline references their functionality, or a mounted equivalent already owns it. Direction of travel is away — delete on the wave schedule below.

## A. Verified FALSE POSITIVES — do not delete

| File | Why the tool is wrong |
|---|---|
| `lib/types/auth.ts` | `declare module "next-auth"` **module augmentation** — imported nowhere by design; deleting breaks session typing everywhere |
| `lib/services/encryption.ts` | used by `scripts/seed-detailed-case-studies.ts` and `prisma/seed.ts` (outside graph roots) |
| `lib/types.ts`, `lib/types/index.ts`, `hooks/index.ts`, other barrels | verify per-barrel: some are type-only surfaces or script-consumed; delete only individually-confirmed-dead barrels |

## B. Wave 1 — instant deletes (zero consumers, verified or trivially checkable)

- **Example/demo debris (D42):** `*.example.tsx`, `*.demo.tsx` (ai-quick-actions, clickable-media-upload, inline-editable.demo, smart-tag-input.demo/.example, text-selection-manager.example, unified-model-selector.example, projects-section.example), `lib/navigation/examples/`, `lib/voice/examples/`, `lib/voice/config-serializers/examples.ts`
- **The legacy-ingestion pair closes itself:** `lib/content/index.ts` (barrel, itself orphaned) + `lib/services/content-ingestion.ts` (T0–T4; held only by that barrel) — delete both together
- `app/projects/page.new.tsx` (already ledgered, portfolio-core task 2.2)
- Dead UI shims: `components/layout/navigation-bar-skeleton.tsx`, `components/media/cloudinary-image.tsx` (`reflink-status-indicator.tsx` moved to the review bucket — see cross-reference §2)
- Dead barrels after individual confirmation: `components/{admin,ai,projects}/index.ts`, `components/ui/wave-background/index.ts`, `lib/{ai,ui,utils}/index.ts`, `lib/ai/providers/index.ts`
- `lib/utils/context-builder.ts`, `lib/utils/project-utils.ts` (junk drawer)

## C. Wave 2 — conversation/debug cluster (with ai-assistant tasks 1–2)

- **Dead twins (mounted versions exist):** `components/admin/conversations-management.tsx` (plural — dead; the mounted one is `conversation-management.tsx` at `/admin/ai/conversations`, which already includes replay fetching), `components/admin/ConversationTranscripts.tsx`. (`conversation-replay.tsx`: harvest-review first — cross-reference §2, D49 5b.2)
- **Abandoned parallel debug approach:** `contexts/TranscriptContext.tsx`, `services/TranscriptService.ts` (also resolves the stray `src/services/` folder), `hooks/useContextMonitoring.ts`, `hooks/useToolCallMonitoring.ts`, `hooks/use-floating-ai-interface.ts`, `hooks/useRealtimeSession.ts`. (`VoiceConnectionTester.tsx`: review at ai-assistant 6 / D16 playground — cross-reference §2)
- **Dies with the Gen-1 stack (task 2):** `hooks/use-unified-conversation.ts`, `hooks/use-conversation-history.ts`, `lib/services/ai/index.ts` (test-only barrel), `__tests__/unified-conversation-system.test.ts`, `__tests__/context-*.test.ts` (rewrite or drop with their subjects)
- **Legacy editors cluster (D10, admin-cms task 1):** `project-editor.tsx`, `unified-project-editor.tsx`, `project-preview-editor.tsx`, `project-display.tsx` — all four confirmed unreachable. Also orphaned admin primitives that the enhanced editor apparently superseded inline: `floating-save-bar.tsx`, `inline-editable.tsx` (+ its test), `admin-table.tsx`, `admin-form.tsx`, `admin-actions.tsx` — **verify `enhanced-project-editor.tsx` truly self-implements these, then delete and correct the admin-cms design §5 claim about shared table/form patterns**

## D. Wave 3 — context layer (+ Phase-2 leftovers)

- `lib/hooks/use-context-manager.ts`, `lib/hooks/use-content-sources.ts` (with context-manager work)
- `lib/services/ai/reflink-session-manager.ts`, `lib/utils/rate-limiting-integration.ts` — superseded by the Phase 2 gateway; confirm no scripts use them, then delete
- `lib/voice/config-validation.ts` (test-only) — **hold until ai-assistant task 6** (Google/STT config schemas will extend it or replace it — cross-reference §2)
- `lib/voice/connectionDiagnostics.ts` — **hold until ai-assistant task 5b.3** (harvest heartbeat/diagnostic logic for D49 disruption detection — cross-reference §2)

## E. Wave 4 — dies with `ProjectAIIndex` (D37, semantic-content task 3)

`lib/hooks/use-project-indexing.ts`, `components/admin/project-indexing-status.tsx`, `lib/services/project-indexer.ts` (+ its test), `lib/utils/project-indexing-integration.ts`
**Gem from the unused-imports list:** `BackendToolService`'s `projectIndexer` import is already **unused** — its D37 re-pointing is nearly free. Same for `context-manager` (type-only `ProjectIndex`). The hard dependency is the semantic services' write path, as mapped 2026-07-06.

## F. Decision required — unwired abstractions (delete + spec correction recommended)

| Cluster | Finding | Recommendation |
|---|---|---|
| `lib/ai/editors/*` (10 files: adapters, selection-manager, content-parser, …) | **Never wired** — zero imports from any component; the Tiptap AI panel talks to Tiptap directly. BUT the ai-admin spec claims it as current architecture (design §5) | **Defer to ai-admin task 4.3** (adapter-layer migration of editing endpoints): wire it for real there, or delete it and correct the spec in the same change. Do not delete in the Phase 3 sweep — the abstraction serves the spec's stated decoupling intent and D48 reuse if the 4.3 rework adopts it |
| `lib/ai/extensions/*` (12 files: function-registry, bulk-operations, functions) | Never wired extension architecture | Delete; `BulkOperationsService` (live, in `lib/content/`) is the real bulk path |
| `lib/content/ContentSearchServiceIntegration.ts`, `lib/content/UIManagerIntegration.ts` | Integration glue never mounted | Delete |
| `components/admin/summary-config.tsx` | Orphaned — the mounted summary config lives elsewhere in `/admin/semantic`; confirm then delete | Delete after grep |
| `hooks/use-undo-redo.ts` | Editor undo comes from Tiptap history | Delete |

## G. Unused imports (124) and never-instantiated (52) — do not hand-edit

- Run an automated sweep: ESLint `unused-imports` plugin + `--fix` (or `organize-imports`), one commit, Phase 3 tail. Phase 5's `strict` + CI lint keeps it fixed.
- The never-instantiated list is mostly **false alarms**: `used as: call` = static-method classes (`AIErrorHandler`, `UIManager`, `AvailabilityChecker`), `used as: type` = type-only. Only act on entries tagged `(unused)` — the lint sweep catches those anyway (`BulkOperationsService`'s four unused service imports, `regenerate` route's unused `ContentIngestionService`, `ElevenLabsAdapter`'s `ToolError`).

## Spec-truth corrections to apply during Phase 3

1. `ai-admin` requirements/design/tasks: the editor abstraction (`lib/ai/editors/`) is claimed as implemented but was **never wired** — annotate Already-implemented now ("files exist, unwired — resolution at task 4.3"); final wire-or-delete decision belongs to task 4.3 (cross-reference §2). The extension architecture (`lib/ai/extensions/`) has no spec support at all — delete in Phase 3.
2. `admin-cms` design §5: shared admin table/form/action patterns exist as files but are **not adopted** — either adopt during Phase 3 UI touch or delete the claim with the files.
3. `ai-assistant`: conversation replay is real but lives inside `conversation-management.tsx`; the standalone `conversation-replay.tsx` is a dead twin (no spec change needed — D49's replay work should build on the mounted component).
