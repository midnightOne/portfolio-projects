# rich-content — Design

**Status:** current — describes implemented system
**Owner domain:** Tiptap editor, custom blocks, content schema, rendering
**Last verified against code:** 2026-07-02 (`e2d75b4`)

---

## 1. Architecture

```
src/components/tiptap/        # editor (TiptapEditorWithAI), extensions, block components
src/components/rich-content/  # shared render components (ImageCarousel, DownloadButton, InteractiveEmbed)
```

One component tree serves both modes: editor = interactive Tiptap instance; public view = read-only render of the same JSON through the same block components. This is what guarantees the edit-view parity that `admin-cms` Requirement 3 depends on.

## 2. Content schema

`ArticleContent.jsonContent` holds the Tiptap document (JSON). Custom nodes carry references, not copies:

| Node | References |
|---|---|
| `image` | `MediaItem.id` |
| `carousel` | `MediaCarousel` → ordered `CarouselImage[]` (each → `MediaItem`, per-slide description) |
| `download` | `DownloadableFile.id` |
| `interactive` | `InteractiveExample` (iframe src / canvas / WebXR config) |
| `projectLink` | `ProjectReference` → target project slug |

The plain-string `ArticleContent.content` is derived/legacy — never authored directly. Semantic ingestion (`semantic-content`) reads `jsonContent` and heading structure from it.

## 3. Editor integration

- `TiptapEditorWithAI` wraps the Tiptap instance with the AI panel bridge: selection state (range + surrounding context) is exposed to `ai-admin` endpoints; structured responses are applied as targeted transactions (selection-only replacement), keeping history for undo.
- Slash-command menu registers the custom blocks; each block edit UI validates config before commit.
- Save serializes the document and hands it to the `admin-cms` save path (D8) — this spec owns the format, not the endpoint.

## 4. Security

Interactive embeds: iframe `sandbox` attributes, allowlist-based `src` validation, no `allow-same-origin` + `allow-scripts` combination, CSP-compatible. WebXR assets served from trusted storage only. Fallback content on load failure.

## 5. Explicitly out (see requirements)

No `/api/content/*` routes (D8). No versioning UI/API (D9 — `ContentVersion` dormant). No collaboration features.
