# Admin dashboard connectivity and local debug access

Date: 2026-07-17  
Scope: `src/app/admin`, `src/components/admin`, semantic processing entry points, admin middleware/authentication, and the public-surface context debugger.

## Executive result

The chunking configuration page is correctly placed under **Knowledge Base** and every sidebar destination resolves to a real page. Two defects prevented the semantic dashboard from being fully connected, and both are now fixed:

1. Project scaffold generation retained constructor-time chunking defaults instead of loading the persisted admin configuration. It now resolves the default configuration for every scaffold run, so `targetChunkSize`, `maxSectionSize`, `minSectionSize`, `sectionBoundaryOverlap`, and `splitStrategy` reach the T3 chunker. Commit: `7e3c4ca`.
2. The semantic dashboard's cleanup and export buttons linked to nonexistent pages. They now deep-link to the corresponding tabs on `/admin/semantic/bulk-operations`. Commit: `e9cab44`.

The current client-side `useSession()` gate is the best low-complexity option for manually testing the public-surface context debugger as an admin. It preserves a static root layout and does not turn a UI visibility check into authorization. Sensitive debug APIs remain server-gated.

## Chunking dashboard trace

| Layer | Location | Result |
| --- | --- | --- |
| Admin category | `src/components/admin/admin-sidebar.tsx` | Correctly grouped under **Knowledge Base**. |
| Dashboard | `/admin/semantic` | Linked as **Semantic Dashboard**; metrics, processing, project detail, budget, and bulk-operation actions have real destinations. |
| Configuration | `/admin/semantic/config` | Linked as **Chunking Configuration**; reads and writes `/api/admin/semantic/config`. |
| Persistence | `ChunkingConfigService` / `ChunkingConfig` table | Default configuration is persisted and cache-invalidated on update. |
| Project runtime | `SmartContentGenerator` | Fixed: loads persisted settings at scaffold execution time, avoiding stale service-instance defaults. |
| Document runtime | `StageBasedProcessingService` / `generateDocumentScaffold` | Uses persisted T2, target, and maximum token limits; paragraph-first splitting includes sentence/word/hard-slice fallbacks for oversized paragraphs. |
| Maintenance | `/admin/semantic/bulk-operations` | Cleanup, export/import, and regeneration share one existing maintenance surface; dashboard links select the intended tab. |

Tests added or extended:

- `smart-content-generator-config.test.ts`: persisted values are loaded on every run and explicit call-site overrides still win.
- `semantic-bulk-operations.test.tsx`: deep-link tab selection and invalid-tab fallback.
- `admin-ai-integration.test.tsx`: semantic dashboard and chunking configuration are asserted inside the Knowledge Base group.
- Existing bounded-paragraph tests continue to cover oversized prose and pathological unbroken text.

### Configuration semantics that remain intentionally incomplete or misleading

These are not route disconnections, but they should be resolved before presenting every control as globally effective:

- `minSectionSize` is persisted and passed to `T3HeadingBoundedChunking`, but the chunker currently does not merge undersized sections as the UI help text claims.
- `sectionBoundaryOverlap` affects the pure-token strategy only. Paragraph and sentence strategies do not currently apply overlap, although the UI describes it generically.
- `respectHeadingBoundaries` is persisted but has no visible control, and the T3 implementation is always heading-bounded. If crossing headings is not a supported product behavior, remove this setting rather than implying an unused mode.
- Document sources deliberately use paragraph-first chunking regardless of the project T3 `splitStrategy`. The UI should either label the strategy as project-content-specific or the document pipeline should explicitly define how each strategy applies.

Recommendation: keep paragraph-first document behavior and the strict maximum as the canonical document contract, then make the admin copy scope-specific. Do not weaken the maximum to preserve a paragraph; oversized paragraphs must still split internally.

## Admin navigation inventory

Inventory totals at review time:

- 36 page routes under `src/app/admin` (including login, redirects, dynamic detail routes, and the media stub).
- 29 static sidebar items across 8 task-oriented categories.
- 123 route handlers under `src/app/api/admin`.

All 29 sidebar links have a matching page. No empty sidebar categories or links to missing pages remain.

### Category placement

| Category | Assessment |
| --- | --- |
| Overview | Correct. |
| Site Content | Correct; project detail/edit routes are contextual children rather than top-level entries. |
| Media | Correct for the active upload and provider tools; the separate `/admin/media` stub is disconnected. |
| AI Assistant | Correct for configuration and behavior surfaces. |
| Knowledge Base | Correct home for semantic indexing, chunking, budget, and bulk maintenance. |
| Access & Safety | Correct. |
| Insights & Monitoring | Correct. |
| Developer Tools | Correct. |

### Disconnected or stale pages/items

#### P1 — AI Settings contains a dead Project Indexing card

`src/app/admin/ai/page.tsx` navigates to `/admin/ai/project-indexing`, but no page exists. The active equivalent is `/admin/semantic`, with project-specific management at `/admin/semantic/projects/[id]`.

Recommended fix: point the card to `/admin/semantic` and rename it **Semantic Indexing**, or remove it because Knowledge Base already owns the workflow.

#### P1 — AI Settings marks live features “Coming Soon”

The AI hub disables cards for Conversations and Security even though `/admin/ai/conversations`, `/admin/ai/security`, `/admin/ai/rate-limiting`, and `/admin/ai/abuse-detection` are implemented and linked in the sidebar. This gives the hub a different product map than the sidebar.

Recommended fix: either connect those cards to the live category landing pages or remove the duplicate feature grid and let the sidebar be the single navigation source.

#### P2 — Project media page is orphaned and bypasses standard admin chrome

`/admin/projects/[id]/media` has no in-app link. The editor uses modal-based media selection, while this page renders its own header and omits `AdminLayout`/the sidebar. It appears to be a legacy workflow rather than a deliberate hidden detail route.

Recommended disposition: delete it if modal management superseded it; otherwise add a project action and wrap it in the standard admin layout.

#### P2 — `/admin/media` is a disconnected “Coming Soon” hub

The sidebar's **Media Library** item intentionally goes directly to `/admin/media/upload`; no current navigation reaches `/admin/media`. The page only redirects users onward through buttons.

Recommended disposition: redirect `/admin/media` to `/admin/media/upload` as a compatibility alias, or make it a real media landing page and point the category item there.

#### P2 — Dashboard “View Analytics” is inert

The Overview dashboard renders an enabled **View Analytics** button with no click handler. **Performance Dashboard** immediately beside it is wired to `/admin/performance`.

Recommended fix: connect the button to a defined analytics destination or remove it. An enabled no-op control is worse than an explicitly disabled roadmap item.

#### P3 — Legacy project routes add avoidable hops

`/admin/projects/new` redirects to `/admin/projects/editor`, and `/admin/projects/[id]/edit` redirects to the editor detail route. They are valid compatibility aliases, but the dashboard and some project UI still target them while the sidebar targets the canonical editor route.

Recommended fix: retain aliases for old bookmarks but update all first-party links to canonical `/admin/projects/editor[/id]` destinations.

#### P3 — Access enforcement is correct but inconsistent in form

Middleware gates all `/admin/:path*` and `/api/admin/:path*` requests by JWT role. Pages additionally use a mix of server `getSession()`, client `useSession()`, redirects, or middleware alone. API handlers likewise vary between middleware-only and explicit `requireAdmin()` checks.

This is not currently an access bypass, but the inconsistency makes pages harder to reason about and test.

Recommended fix: add a server `/admin/layout.tsx` role gate for the admin subtree, retain middleware as the early redirect/401 layer, and keep explicit `requireAdmin()` on sensitive mutation/debug APIs for defense in depth. Remove redundant page-level checks as pages migrate.

## Local admin access and client-side context debugging

### Current behavior

`AIInterfaceWrapper` lives in the root layout but is a client component. It obtains the NextAuth session through `useSession()` and renders `HomepageDevVoicePanel` plus `ContextDebugPanel` only when the resolved session has the admin role. This means:

- The root server layout does not call `getServerSession()` and does not force public routes to become request-dynamic.
- A manual local tester can sign in at `/admin/login`, navigate back to `/` on the same origin, and see the debug panels after the client session resolves.
- Hiding the component is presentation gating only. `/api/admin/ai/debug/context-mint` still calls `requireAdmin()`, and middleware protects the whole `/api/admin` namespace.
- `DEV_VERIFICATION=true` currently authorizes selected non-production gateway/dev telemetry. It does **not** create an admin session and does not grant access to `/api/admin` debug data.

For reliable manual local testing, configure `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `NEXTAUTH_SECRET`, sign in once, and use the same hostname throughout. Cookies for `localhost` and `127.0.0.1` are not interchangeable.

The production build in this workspace emitted the gateway's loud `DEV_VERIFICATION=true with NODE_ENV=production` warning because the local environment enables the flag. The build still passed, but deployment environments must leave this flag absent/false; a production-mode build is useful for detecting that configuration hazard.

### Alternatives

| Option | Best use | Trade-offs | Recommendation |
| --- | --- | --- | --- |
| Keep client `useSession()` gate | Manual local and production-owner debugging on public pages | Debug UI appears after hydration/session fetch; requires real login | **Use now.** It is simple and preserves static public rendering. |
| Server `/admin/layout.tsx` role gate | Centralizing access for admin pages | Does not solve a debug overlay rendered on public routes | **Add independently** for admin consistency. Keep the public overlay client-gated. |
| Dev-only debug-capability endpoint | Browser automation without a full admin UI login | Must be rigorously unavailable in production; still needs separate decisions for sensitive admin APIs | Good second choice when local E2E friction justifies it. |
| Short-lived signed HttpOnly debug cookie | Repeatable Cypress/Playwright/local-agent sessions | More implementation and key/expiry handling | Prefer over query parameters or local storage when automation needs a capability. |
| Middleware-only UI decision | Early routing protection | Middleware cannot directly provide a trustworthy React client role and should not become the sole sensitive-API check | Keep middleware for route enforcement, not client display state. |
| `NEXT_PUBLIC_*`, query parameter, or local-storage bypass | Cosmetic developer toggles only | User-controlled and bundled into the client; not authorization | Do not use for admin debug data. |

### Recommended hybrid

1. Keep `useSession()` as the visibility gate for the public-surface context panel.
2. Keep every debug-data API server-authorized; never infer API access from whether the client panel rendered.
3. Add `/admin/layout.tsx` to centralize the admin subtree role check and standardize admin access behavior.
4. If automated local tests cannot conveniently perform NextAuth credential login, add a non-production-only capability bootstrap that issues a short-lived HttpOnly cookie. Have a small client access endpoint return only `{ canViewDebug: boolean }`.
5. Keep sensitive mint-stash data admin-only unless there is a concrete test requirement. If a dev capability must read it, expose a separate `/api/dev/...` route guarded by `NODE_ENV !== 'production'` plus the signed capability; do not weaken `/api/admin` middleware.

## Preventing regressions

- Export the admin navigation model from one module and use it for both rendering and connectivity tests.
- Add a route-connectivity test that verifies every static admin navigation/hub destination maps to a page or an explicitly declared external/compatibility route.
- Treat enabled buttons without handlers and links to nonexistent routes as test failures.
- Keep contextual dynamic routes out of the global sidebar, but require an owning list/detail workflow and standard admin chrome.
- Document configuration scope next to each chunking control so “persisted” cannot be mistaken for “consumed by every pipeline.”
