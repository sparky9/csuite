# Encryption Key Rotation Runbook (Phase 7)

This runbook captures the Phase 7 key-rotation flow for the csuite-pivot stack. Follow these steps whenever a new master key is promoted, either as part of scheduled rotation or emergency response.

## Prerequisites

- `.env` for `apps/api` must include the promoted key via `MASTER_ENCRYPTION_KEY` and its version in `MASTER_ENCRYPTION_KEY_VERSION`. Legacy keys belong in `MASTER_ENCRYPTION_PREVIOUS_KEYS` as a JSON map, for example `{ "1": "oldKeyMaterial" }`.
- Database connectivity verified; migrations run so `encryption_key_version` columns exist in `knowledge_entries`, `knowledge_sources`, and connector tables.
- BullMQ workers paused to avoid concurrent writes while the rotation script executes.
- Recent database snapshot captured so you can roll back if the rotation is interrupted.

## Dry Run (Validation)

1. Ensure the API build compiles: `pnpm --filter api typecheck`.
2. Execute a dry run to surface affected rows without mutating secrets:

   ```powershell
   pnpm --filter api encryption:rotate -- --dry-run
   ```

   You can scope the dry run to specific tenants or data domains:

   ```powershell
   # Only rotate connector secrets for a single tenant
   pnpm --filter api encryption:rotate -- --tenant demo-company --only connectors --dry-run

   # Only rotate knowledge entries in batches of 250
   pnpm --filter api encryption:rotate -- --only knowledge --batch-size 250 --dry-run
   ```

3. Review the summary counts. The script reports totals per scope and highlights any rows already on the latest key.

## Production Rotation

1. Confirm `MASTER_ENCRYPTION_KEY_VERSION` references the new key in the registry (and, if needed, supply a specific value with `--target-version`).
2. Run the rotation script without `--dry-run`:

   ```powershell
   pnpm --filter api encryption:rotate
   ```

   Optional flags mirror the dry-run examples if you need to phase the rollout (`--tenant`, `--scope`, `--batch-size`).

3. Monitor the console output. Each batch logs progress and explicitly notes failures; a non-zero exit code indicates un-rotated rows.
4. When finished, re-run the dry run to ensure no legacy key versions remain:

   ```powershell
   pnpm --filter api encryption:rotate -- --dry-run
   ```

## Post-Rotation Checks

- **Knowledge Admin export**: run `GET /knowledge/sources/:id/export` for a rotated tenant and confirm payloads decrypt via the new key version.
- **Connector health checks**: ensure downstream connectors that rely on decrypted secrets can authenticate successfully.
- **Audit logs**: capture the rotation window in the security logbook, including command invocations and operator.
- **Resume workers**: resume BullMQ queues once validation passes.

## Failure Recovery

- If the script aborts mid-run, re-launch with the same flags. Already-rotated rows are detected by version and skipped.
- If data corruption is suspected, restore from the pre-rotation snapshot and investigate the logged failures before retrying.
- File an incident in the security channel with the failure details and remediation timeline.

## Reference

- Rotation script entry point: `apps/api/src/scripts/rotate-encryption-keys.ts`.
- Crypto helper exposing versioned decrypt: `packages/crypto/src/index.ts` (`decryptForTenantWithVersion`).
- Prisma schema fields: see `packages/db/prisma/schema.prisma` for `encryption_key_version` usage.
