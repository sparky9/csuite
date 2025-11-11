# Marketplace & Billing API Notes

This document captures the backend surfaces introduced for the Slice 6 marketplace and billing workstreams.

## Environment Variables

- `INTERNAL_ADMIN_API_KEY` – Optional key required when registering widgets through `/marketplace/widgets`. When set, callers must pass the value via the `x-internal-api-key` header.
- `STRIPE_WEBHOOK_SECRET` – Optional shared secret used to authenticate incoming Stripe-like billing webhooks hitting `/billing/webhook`. When provided, requests must include a matching `stripe-signature` header.

## Marketplace Routes

All marketplace endpoints live under `/marketplace` and require tenant authentication unless noted.

- `GET /marketplace/widgets` – Returns all registered widgets, including tenant install state and serialized settings when present.
- `POST /marketplace/widgets` – Registers or updates a widget definition. Protected by `INTERNAL_ADMIN_API_KEY`.
- `POST /marketplace/widgets/:slug/install` – Installs or re-enables a widget for the current tenant. Accepts optional JSON settings payload.
- `DELETE /marketplace/widgets/:slug/install` – Removes the widget install record for the tenant; silently succeeds if not installed.

Supporting logic lives in `apps/api/src/services/marketplace.ts` and relies on Prisma models `Widget` and `TenantWidget`.

## Billing Routes

Billing endpoints are tenant scoped and authenticated.

- `GET /billing/usage` – Returns a usage summary for the requested date range, including totals and per-day rollups.
- `POST /billing/webhook` – Accepts webhook events (currently treated as Stripe-compatible JSON) and applies usage deltas through `applyBillingUsageDelta`.

The webhook handler records usage deltas, attaches event metadata, and enforces optional signature matching via `STRIPE_WEBHOOK_SECRET`.

## Testing

New Vitest coverage was added in:

- `apps/api/src/services/__tests__/billing.test.ts` – Unit coverage for `applyBillingUsageDelta`.
- `apps/api/tests/integration/billing-webhook.test.ts` – Integration coverage for webhook routing, signature enforcement, and tenant resolution fallbacks.

Run `pnpm --filter api test` to execute the full suite.
