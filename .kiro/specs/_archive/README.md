# _archive — Superseded specs and analysis documents

**Status:** archived — nothing in this folder is authoritative. Preserved for provenance only; the live specs are the siblings of this folder, indexed in [`../00-overview/README.md`](../00-overview/README.md).

| Item | Superseded by | Why archived |
|---|---|---|
| `ai-architecture-redesign/` | `../ai-admin/` | Executed in full (env keys, `AIModelConfig`, admin AI settings); historical record |
| `ai-system/` | `../ai-admin/`, `../semantic-content/` | Rewritten; its duplicated Requirements 9–13 (tier system) had already moved to the semantic spec |
| `client-side-ai/` | `../ai-assistant/`, `../access-and-cost/` | 444KB monolith mixing Gen-1 (server-orchestrated, T0–T4, internal "MCP") with Gen-2 (client-direct); Gen-2 content rewritten into ai-assistant, reflink/access material into access-and-cost. Includes analysis docs (`oai_doc.md`, `ELEVENLABS_CLIENT_MIGRATION.md` — migration completed, `existing-*-analysis.md`) |
| `semantic-content-management/` | `../semantic-content/` | Rewritten; `HEADING_BOUNDED_CHUNKING.md` + Batch API docs carried forward live |
| `semantic-system-fixes/` | `../semantic-content/tasks.md` | Open items folded in as Phase 0 verification tasks |
| `portfolio-projects/` | `../portfolio-core/`, `../admin-cms/` | Split and rewritten; Novel/draft-status/mobile-first directives cancelled by registry D6/D7/D14 |
| `media-management-system/` | `../media/` | Trimmed to implemented reality (D11) |
| `rich-content-system/` | `../rich-content/` | Parallel API cancelled (D8), versioning descoped (D9) |
| `ui-system/` | `../ui-system/` | Rewritten; the four reference docs carried forward live |
| `ARCHITECTURE_ALIGNMENT_PROPOSAL.gen1-original.md` / `.gen2-original.md` | `../ARCHITECTURE_ALIGNMENT_PROPOSAL.md` | The two proposal generations merged into the canonical one on 2026-07-02 |
| `old-specs-README.md` | `../00-overview/README.md` | Stale index |

Git note: the former workspace-level spec tree (`Portfolio/.kiro/specs/`) contained two nested standalone git repos; their histories were zipped to `Portfolio/backups/` on 2026-07-02 before the tree was deleted.
