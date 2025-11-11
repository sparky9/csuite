# Knowledge Management (Phase 5)

This guide explains how the Knowledge Management features are wired across the API, web dashboard, and supporting tooling so you can demo Phase 5, extend the workflows, or troubleshoot issues quickly.

## Feature Overview

- **Knowledge sources dashboard** for uploading documents, capturing manual notes, filtering by persona, searching snippets, and inspecting chunk previews.
- **Tenant-scoped knowledge APIs** that enforce row-level security, support configurable preview limits, export packaged archives, and surface persona/tag statistics.
- **Clipboard-friendly search experience** with highlight state, load-more controls, and automatic retry at the maximum preview window when a highlighted chunk is outside the default limit.
- **Retention metadata** on each source plus per-entry expiration timestamps ready for automated enforcement.

## Demo-Ready Seed Data

Populate a demo tenant with curated sources, entries, and persona coverage:

```powershell
pnpm seed:slice5
```

This wraps `pnpm --filter @ocsuite/db seed:slice5` and will:

- Ensure the `demo-company` tenant, founder, and operations lead exist.
- Reset existing knowledge data for that tenant.
- Create three representative sources (playbook upload, weekly finance digest, competitive battlecards) covering different retention policies and providers.
- Seed chunk-level metadata (personas, tags, sections, chunk indexes) so UI filters and stat cards light up immediately.

Run the command anytime you need to restore the canonical Phase 5 dataset.

## API Surface

All routes live under `apps/api/src/routes/knowledge.routes.ts`:

- `GET /knowledge/sources` – list sources plus aggregate stats.
- `GET /knowledge/sources/:id?limit=50` – fetch metadata and recent chunks with adjustable preview limits (1–200).
- `POST /knowledge/upload` – ingest base64 file uploads with persona/retention/storage options.
- `POST /knowledge/notes` – save manual notes.
- `DELETE /knowledge/sources/:id` – remove a source and associated entries.
- `POST /knowledge/sources/:id/export` – stream a ZIP archive (JSZip) bundling metadata and entries.
- `POST /knowledge/search` – RAG-style chunk search with persona/source filters.

All handlers require tenant context via `requireAuth` + `resolveTenant`, and type-safe payload validation is handled with Zod schemas.

## Web Dashboard Highlights

`apps/web/src/app/(dashboard)/knowledge/page.tsx` implements the admin UI:

- Metric cards summarize source count, entry volume, token usage, and persona coverage.
- Upload and manual-note dialogs capture retention + storage settings and parse optional JSON metadata.
- Table view supports type/persona filtering.
- Detail pane shows metadata, chunk previews, and provides load-more/reset controls for preview limits.
- Search panel lets admins copy snippets to the clipboard, open the associated source, and auto-scroll to highlighted chunks.

## Encryption Key Awareness

- Knowledge entries now persist an `encryptionKeyVersion` that aligns with the master key registry introduced in Phase 7.
- Admin exports and preview APIs use `decryptForTenantWithVersion`, so rotated data remains accessible even while older entries are re-encrypted.
- When the security team performs a key rotation, no dashboard changes are required, but expect transient dry-run operations in logs.
- Operators should follow the runbook in `docs/security/encryption-key-rotation.md` to execute rotations safely.

## Testing & Quality Gates

- Run `pnpm --filter web lint` to validate the dashboard and Next.js code.
- Run `pnpm --filter api lint` to check backend routes and services.
- Run `pnpm --filter @ocsuite/db test` to execute Prisma row-level security tests, including the new `rls-phase5.test.ts` coverage.

The row-level security suite (`packages/db/tests/rls-phase5.test.ts`) ensures both `knowledge_sources` and `knowledge_entries` are tenant-isolated for read/write operations.

## Next Steps

- **Retention enforcement worker**: implement a scheduled job that purges entries whose `retentionExpiresAt` has passed for `rolling_90_days` policies.
- **Audit trail extension**: persist upload/delete/export audits in a dedicated table for compliance reporting.
- **Documentation hand-off**: embed excerpts of this guide (or a shortened version) in customer-facing enablement materials once the worker/audit features land.
