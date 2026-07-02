# ai-admin — Requirements

**Status:** current — editing AI implemented; model registry + reasoning-adapter layer are the open build
**Owner domain:** AI model registry & role aliases, pricing-as-data, classic/reasoning LLM provider adapters (OpenAI, Anthropic, Google), admin content-editing AI, provider status/diagnostics
**Last verified against code:** 2026-07-02 (`e2d75b4`)
**Registry decisions applied:** D3, D4, D23, D38, D39, D40
**Note:** the old ai-system spec's duplicated Requirements 9–13 (content tiers) were long since moved to `semantic-content` — they are deleted here, not renumbered.
**Contracts:**

| Consumes | From |
|---|---|
| Editor selection bridge (Tiptap adapter) | `rich-content` |
| Admin shell + session gate | `admin-cms`, `portfolio-core` |
| Usage metering (ledger writes for editing/reasoning calls) | `access-and-cost` |

| Provides | To |
|---|---|
| Model registry (`AIModelConfig` + aliases: `default-chat`, `default-cheap`, `default-realtime`, `default-embedding`, `default-reasoning`) | `ai-assistant`, `semantic-content`, `access-and-cost`, `mcp-server` |
| Pricing module (`estimateCost()`, per-model rates) | `semantic-content` budgets, `access-and-cost` ledger |
| Reasoning-model adapter interface + OpenAI/Anthropic/Google adapters | `ai-assistant` deep tools, `mcp-server`, editing AI |
| `/api/admin/ai/edit-content`, `improve-content`, `process-prompt`, `suggest-tags` (D23) | `admin-cms` editor AI panel |
| Provider status/diagnostics endpoints | admin settings UI |

Overview: [`../00-overview/README.md`](../00-overview/README.md)

---

## Requirement 1 — Provider configuration via environment

**User story:** As the owner, I want API keys in environment variables only, so that secrets never live in the database or client.

1. WHEN providers initialize THEN keys SHALL be read from `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` (and provider-specific vars) — never persisted to DB (D3).
2. WHEN keys are missing/invalid THEN the admin UI SHALL show per-provider status (masked key confirmation, actionable errors, docs links) and hide unconfigured providers from selection.
3. WHEN configuration is tested THEN real connection tests SHALL validate keys against the provider API.

## Requirement 2 — Model registry and role aliases (D4)

**User story:** As the owner, I want models managed as data with role aliases, so that no model name is ever frozen into code.

1. WHEN models are managed THEN the system SHALL store available models per provider in the DB (`AIModelConfig` foundation), admin-editable via text input and refreshable from provider model-list APIs.
2. WHEN code needs a model THEN it SHALL resolve a **role alias** — `default-chat`, `default-cheap`, `default-realtime`, `default-embedding`, `default-reasoning` — mapped to concrete models in admin. Hardcoded model IDs in code/enums/serializers are removed.
3. WHEN the reasoning alias changes in admin THEN MCP tools, deep server tools, and the editing AI SHALL use the new model without deploy (D39).
4. WHEN models are listed for selection THEN all configured providers' models SHALL appear in one unified picker.

## Requirement 3 — Pricing as data (D38)

**User story:** As the owner, I want one pricing source, so that cost math is consistent and updatable in one place.

1. WHEN costs are computed THEN a single pricing module/table SHALL map `model → {input, output, embedding?, batchDiscount}` with one `estimateCost()` used by budgets, estimation, regeneration, providers, and ledger writes.
2. WHEN token counts are needed for accounting THEN provider `usage` fields SHALL be preferred; char/4 estimation is allowed only for pre-flight rough estimates.
3. All local pricing constants (10+ files) are deleted in favor of this module.

## Requirement 4 — Reasoning-model adapter layer (D39/D40)

**User story:** As the owner, I want classic-LLM providers behind one interface, so that deep features are provider-portable and the abstraction itself is a showcase.

1. WHEN classic/text LLM calls are made THEN they SHALL go through a common adapter interface (chat, streaming, tool use, structured output, usage reporting) with implementations for **OpenAI, Anthropic, and Google**.
2. The **Anthropic adapter is kept and fixed** (D40): capability table corrected (tool use: yes, vision: yes, JSON via tool-forcing); the frozen `supports: {functionCalling: false, vision: false}` table is deleted.
3. WHEN the adapter layer is built THEN implementation MAY use the Vercel AI SDK underneath if the diff stays contained (proposal §5) — voice adapters remain hand-rolled and separate.
4. Consumers: admin editing AI (this spec), deep server tools and job analysis (`ai-assistant`), MCP deep tools (`mcp-server`), public chat tier (`access-and-cost`, via `default-cheap`).

## Requirement 5 — Content editing AI

**User story:** As the owner, I want AI assistance while editing, so that content improves without losing my voice.

1. WHEN editing THEN the AI panel SHALL offer conversation, quick actions ("Make Professional", "Make Casual", "Suggest Tags", …), and custom prompts via the canonical endpoints `edit-content`, `improve-content`, `process-prompt`, `suggest-tags` (D23).
2. WHEN AI edits apply THEN responses SHALL be structured (changes, reasoning, confidence, warnings), applied through the editor adapter with review-before-apply and undo; selection-targeted edits receive full-document context but modify only the selection.
3. WHEN AI processes content THEN it SHALL preserve intent and never fabricate; model context includes project metadata (tags, existing content) plus the owner's system prompt.
4. WHEN sessions run THEN short-lived conversation history within the editing session is allowed (2026 update — single-shot is the default, not a hard constraint); history clears when the session ends.

## Requirement 6 — Settings, status, diagnostics

**User story:** As the owner, I want AI settings and health in one place, so that I can configure and troubleshoot quickly.

1. WHEN settings are managed THEN `AIGeneralSettings` SHALL cover system prompt, temperature/max tokens, and alias mappings, editable in admin.
2. WHEN AI is used THEN status (provider availability, active models per alias) SHALL be visible in the editor panel and settings page, updating immediately on config change; per-instance status caching is best-effort only (D43).
3. WHEN errors occur THEN messages SHALL be actionable (rate limit vs auth vs network), logged for diagnostics.

## Cancelled / superseded

- Requirements 9–13 (manual tiers, auto-summaries, hybrid organization, change detection, hierarchical consumption) — owned by `semantic-content` since the migration; the duplicated text in the old ai-system spec is deleted (registry Appendix A).
- API-keys-in-DB `AIConfiguration` design (D3).
- Hardcoded model lists in spec text (D4) — the old "gpt-4o, claude-3-5-sonnet-20241022" examples are exactly the fossil D4 forbids.
