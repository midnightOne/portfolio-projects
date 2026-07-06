# Phase 3 dead-code cleanup manifest

**Status:** current — input for the Phase 3 hygiene/consolidation session (D42 hard delete)
**Owner domain:** cross-cutting (execution detail for roadmap 3.x tasks across specs)
**Source:** owner-run reachability tool output, 2026-07-06 (85 orphans, 2 test-only, 124 unused imports, 52 never-instantiated) + spot verification the same day
**Last verified against code:** 2026-07-06 (staging)

**Tool caveat (binding):** the graph's entry roots are the app tree. `scripts/`, `prisma/seed*`, Jest setup, and TypeScript **module augmentation** are invisible to it. Every "orphan" is a *candidate*: before deleting, grep for dynamic `import()`, string-based references, jest `moduleNameMapper`, and script/seed usage. After each batch: `npm run type-check && npm run build && npm test`.

---

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
- Dead UI shims: `components/layout/navigation-bar-skeleton.tsx`, `components/media/cloudinary-image.tsx`, `components/ai/reflink-status-indicator.tsx` (pill uses its own status UI — confirm with one grep)
- Dead barrels after individual confirmation: `components/{admin,ai,projects}/index.ts`, `components/ui/wave-background/index.ts`, `lib/{ai,ui,utils}/index.ts`, `lib/ai/providers/index.ts`
- `lib/utils/context-builder.ts`, `lib/utils/project-utils.ts` (junk drawer)

## C. Wave 2 — conversation/debug cluster (with ai-assistant tasks 1–2)

- **Dead twins (mounted versions exist):** `components/admin/conversations-management.tsx` (plural — dead; the mounted one is `conversation-management.tsx` at `/admin/ai/conversations`, which already includes replay fetching), `components/admin/conversation-replay.tsx`, `components/admin/ConversationTranscripts.tsx`
- **Abandoned parallel debug approach:** `contexts/TranscriptContext.tsx`, `services/TranscriptService.ts` (also resolves the stray `src/services/` folder), `hooks/useContextMonitoring.ts`, `hooks/useToolCallMonitoring.ts`, `hooks/use-floating-ai-interface.ts`, `hooks/useRealtimeSession.ts`, `components/admin/VoiceConnectionTester.tsx`
- **Dies with the Gen-1 stack (task 2):** `hooks/use-unified-conversation.ts`, `hooks/use-conversation-history.ts`, `lib/services/ai/index.ts` (test-only barrel), `__tests__/unified-conversation-system.test.ts`, `__tests__/context-*.test.ts` (rewrite or drop with their subjects)
- **Legacy editors cluster (D10, admin-cms task 1):** `project-editor.tsx`, `unified-project-editor.tsx`, `project-preview-editor.tsx`, `project-display.tsx` — all four confirmed unreachable. Also orphaned admin primitives that the enhanced editor apparently superseded inline: `floating-save-bar.tsx`, `inline-editable.tsx` (+ its test), `admin-table.tsx`, `admin-form.tsx`, `admin-actions.tsx` — **verify `enhanced-project-editor.tsx` truly self-implements these, then delete and correct the admin-cms design §5 claim about shared table/form patterns**

## D. Wave 3 — context layer (+ Phase-2 leftovers)

- `lib/hooks/use-context-manager.ts`, `lib/hooks/use-content-sources.ts` (with context-manager work)
- `lib/services/ai/reflink-session-manager.ts`, `lib/utils/rate-limiting-integration.ts` — superseded by the Phase 2 gateway; confirm no scripts use them, then delete
- `lib/voice/config-validation.ts` (test-only) — fold what the serializers actually need, or delete with its tests
- `lib/voice/connectionDiagnostics.ts` — unmounted support utility; delete (D49 resume flow will build its own detection)

## E. Wave 4 — dies with `ProjectAIIndex` (D37, semantic-content task 3)

`lib/hooks/use-project-indexing.ts`, `components/admin/project-indexing-status.tsx`, `lib/services/project-indexer.ts` (+ its test), `lib/utils/project-indexing-integration.ts`
**Gem from the unused-imports list:** `BackendToolService`'s `projectIndexer` import is already **unused** — its D37 re-pointing is nearly free. Same for `context-manager` (type-only `ProjectIndex`). The hard dependency is the semantic services' write path, as mapped 2026-07-06.

## F. Decision required — unwired abstractions (delete + spec correction recommended)

| Cluster | Finding | Recommendation |
|---|---|---|
| `lib/ai/editors/*` (10 files: adapters, selection-manager, content-parser, …) | **Never wired** — zero imports from any component; the Tiptap AI panel talks to Tiptap directly | Delete; correct `ai-admin` spec ("editor abstraction" moves from Already-implemented to cancelled/backlog). Registry rule: implemented-and-working beats specced |
| `lib/ai/extensions/*` (12 files: function-registry, bulk-operations, functions) | Never wired extension architecture | Delete; `BulkOperationsService` (live, in `lib/content/`) is the real bulk path |
| `lib/content/ContentSearchServiceIntegration.ts`, `lib/content/UIManagerIntegration.ts` | Integration glue never mounted | Delete |
| `components/admin/summary-config.tsx` | Orphaned — the mounted summary config lives elsewhere in `/admin/semantic`; confirm then delete | Delete after grep |
| `hooks/use-undo-redo.ts` | Editor undo comes from Tiptap history | Delete |

## G. Unused imports (124) and never-instantiated (52) — do not hand-edit

- Run an automated sweep: ESLint `unused-imports` plugin + `--fix` (or `organize-imports`), one commit, Phase 3 tail. Phase 5's `strict` + CI lint keeps it fixed.
- The never-instantiated list is mostly **false alarms**: `used as: call` = static-method classes (`AIErrorHandler`, `UIManager`, `AvailabilityChecker`), `used as: type` = type-only. Only act on entries tagged `(unused)` — the lint sweep catches those anyway (`BulkOperationsService`'s four unused service imports, `regenerate` route's unused `ContentIngestionService`, `ElevenLabsAdapter`'s `ToolError`).

## Spec-truth corrections to apply during Phase 3

1. `ai-admin` requirements/design/tasks: editor abstraction (`lib/ai/editors/`) and extension architecture were **never wired** — remove from Already-implemented, mark cancelled (or backlog with a new decision if ever wanted).
2. `admin-cms` design §5: shared admin table/form/action patterns exist as files but are **not adopted** — either adopt during Phase 3 UI touch or delete the claim with the files.
3. `ai-assistant`: conversation replay is real but lives inside `conversation-management.tsx`; the standalone `conversation-replay.tsx` is a dead twin (no spec change needed — D49's replay work should build on the mounted component).
