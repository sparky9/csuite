# Caching Strategy (Phase 7)

The following recommendations improve latency and reduce load on the API once production traffic ramps.

## 1. Persona Prompt Cache
- **Layer**: Redis (`persona:prompt:<persona>`) with TTL 6 hours.
- **Implementation**: Wrap prompt compilation in `apps/api/src/services/persona/prompts.ts` with `getOrSet` helper.
- **Eviction**: Bust cache when persona configuration changes (admin UI save event).

## 2. Knowledge Search Results
- **Layer**: Redis (`tenant:<tenantId>:knowledge:search:<hash>`) TTL 15 minutes.
- **Benefit**: Reduces repeated vector search calls for popular queries.
- **Invalidation**: Clear keys when new knowledge is ingested (`knowledgeEntry.created`).

## 3. Connector Metadata
- **Layer**: In-memory LRU per process (max 500 entries, TTL 10 minutes).
- **Use Case**: Reuse OAuth provider metadata and rate-limit configurations.

## 4. HTTP Response Caching
- Leverage CDN or API gateway caching for read-only endpoints (module catalog, public marketing pages).
- Return `Cache-Control` headers where safe (`max-age=60, stale-while-revalidate=120`).

## 5. Implementation Notes
- Add cache metrics to `@ocsuite/metrics` to monitor hit/miss ratio.
- Tag cache keys with tenant IDs to maintain isolation.
- Document cache configuration in infra repo to support warmup scripts.

## 6. Next Steps
- Prototype persona prompt cache in staging; measure improvement via telemetry dashboard.
- Evaluate Redis memory footprint and adjust TTLs accordingly.
- Extend `docs/testing/performance-baseline.md` to include cache-hit statistics once instrumentation is added.
