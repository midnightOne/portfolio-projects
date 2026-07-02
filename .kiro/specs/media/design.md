# media — Design

**Status:** current — describes implemented system
**Owner domain:** media storage, upload pipeline, library UI, picker, providers
**Last verified against code:** 2026-07-02 (`e2d75b4`)

---

## 1. Architecture

```
src/lib/media/            # provider abstraction + upload pipeline
src/components/media/     # library UI, picker modal, upload widgets
src/app/admin/media/      # library page (inside admin shell)
src/app/api/media/        # API routes
```

Upload flow: client → `POST /api/media/upload` (validation, provider dispatch) → provider (Cloudinary primary) → `MediaItem` row (URL, thumbnail, metadata) → immediate availability in library/picker.

## 2. Data model

`MediaItem` (see `prisma/schema.prisma`) is canonical (D11): id, url, thumbnail, type, filename, size, dimensions, alt/description, project association, timestamps. Do **not** add spec-only fields (`storageProvider`, `optimizedUrls`, `usageCount`) without a registry decision.

## 3. API surface

| Endpoint | Behavior |
|---|---|
| `GET /api/media` | Paginated list with type/search filters |
| `GET/PATCH/DELETE /api/media/[id]` | Read / metadata edit / delete (provider object included) |
| `POST /api/media/upload` | Multipart upload → provider → `MediaItem` |
| `POST /api/media/batch-delete` | Bulk delete with confirmation contract |
| `POST /api/media/sync` | Reconcile DB ↔ provider state |

`/api/media/test-cloudinary` is a diagnostic route — delete in Phase 3 hygiene (D42).

## 4. Picker contract

The picker modal accepts a context (`images | files | any`, single/multi) and resolves with selected `MediaItem[]`. Consumers: `rich-content` blocks (carousel, image, download), `admin-cms` `ClickableMediaUpload`. The picker embeds the upload widget for gap-filling.

## 5. Provider abstraction

A provider interface (upload, delete, URL generation, limits) with Cloudinary as the active implementation; additional providers register behind the same interface. Provider config from environment variables (D3). Optimization (compression, format, responsive variants) is delegated to the provider's URL transforms rather than local processing.
