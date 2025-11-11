# Hosted Pivot · Slice 5 Build Brief (For Sonnet 4.5)

## Objective

Empower tenants to tailor the AI board with their own knowledge while preserving strict isolation and offering control over storage and retention policies.

## Scope Overview

- Build ingestion pipelines for tenant knowledge (docs, notes, structured data) feeding RAG contexts per persona.
- Enable company-wide "HQ" knowledge accessible only to internal operators.
- Provide UI for managing sources, monitoring freshness, and removing sensitive information.

## Deliverables

### 1. Knowledge Ingestion Framework

- New ingest service (`apps/api/src/services/knowledge-ingest.ts`) handling:
  - File uploads (PDF, DOCX, Markdown)
  - Cloud sources (Google Drive folders, Notion pages) via connectors
  - Manual notes entered in UI
- Create `KnowledgeSource` Prisma model (id, tenantId, type, provider, status, lastSyncedAt, retentionPolicy).
- Update `KnowledgeEntry` to include sourceId, checksum, and embeddings metadata.
- Implement chunking + embedding pipeline using pgvector (batch insert, store chunk size, tokens).

### 2. Storage Options & Policies

- Allow tenants to pick storage location:
  - Default: hosted Postgres (encrypted)
  - Optional: bring-your-own S3 bucket (store encrypted objects, keep metadata in Postgres)
- Add retention policy settings (retain until deleted, 90-day rolling window, manual purge)
- Background job to enforce retention (delete entries + embeddings, log outcome)

### 3. Knowledge Management UI

- New route `apps/web/src/app/(dashboard)/knowledge/page.tsx` with:
  - Source overview cards (status, last sync, items indexed)
  - Table of documents with filters (type, owner, freshness)
  - Detail panel showing chunk preview + metadata + delete option
  - Upload wizard supporting drag/drop + large file progress indicator
- Provide per-persona knowledge toggle (e.g., CFO persona can access finance docs only)

### 4. Company HQ Knowledge

- Separate schema/tenant `company_hq` for internal knowledge (admin accessible only)
- Admin UI (restricted) to manage HQ docs and share selected entries with specific tenants (read-only)
- Update prompt builder (from Slice 3) to merge tenant knowledge + optional HQ segments based on persona

### 5. Privacy & Security Enhancements

- Encrypt stored documents at rest using tenant keys (streams through `@ocsuite/crypto`)
- Audit log entry for every upload/delete/export event
- Provide export function to download all tenant knowledge (zip) with access check

### 6. Testing & Reliability

- Unit tests for ingestion pipeline (chunker, embedding generator mocks)
- Integration tests covering connector-driven sync (stub Google Drive/Notion APIs)
- RLS tests for `KnowledgeSource` and additional columns on `KnowledgeEntry`
- Load test blueprint ensuring ingestion scales to large corpuses (documented, not automated yet)

### 7. Documentation & DX

- Create `docs/knowledge-management.md` covering ingestion sources, retention, and troubleshooting
- Update onboarding guide to highlight knowledge customization
- Seed script `pnpm seed:slice5` adding sample documents and HQ knowledge for demo

## Acceptance Criteria

1. From fresh seed, tenant user can upload docs, see them indexed, and confirm they influence persona responses
2. Tenants can review/delete sources and confirm removal (entries disappear from search/context)
3. Company HQ admin can share a doc with a tenant and see it appear in prompts
4. Tests + lint/typecheck pass

## Risks & Open Questions

- Handling large files and rate-limits from external sources
- Balancing encryption with vector similarity search performance
- BYO storage UX (credentials management) — might need to integrate with secrets manager

## Next Steps

1. Decide on max upload size + storage pricing implications
2. Coordinate with security team on encryption approach (KMS vs application-level keys)
3. Gather product feedback on desired knowledge dashboards and visualizations
4. Schedule Sonnet kickoff after Slice 4 completion
