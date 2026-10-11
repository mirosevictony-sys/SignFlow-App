# Validation record — v0.1

## Passed

- `npm run build`: strict TypeScript checks, Node server compilation and optimized React production build.
- `npm test`: **14 checks passed**, including the parent workflow test and nine domain subtests.
- Shared costing: material yield versus finished area, waste once, bleed/gap layout, rotation limits, margin validation and minimum charge.
- Schema migrations and initial seed can run again without duplicating records.
- Administrator/operator login, authentication failures, role denials, financial redaction and cross-origin mutation rejection.
- Customer create/edit persisted in PostgreSQL tables.
- Quote create/edit, sent/accepted immutability, server-calculated totals, acceptance, order conversion and job creation.
- Concurrent repeated quote conversion and repeated job generation produce the same existing records.
- Artwork, material, deposit and busy-machine release constraints.
- Partial good/rejected output, rejected-output reasons, overproduction limits, stale/concurrent duplicate updates.
- Partial fulfilment limits and completion roll-up to the sales order.
- New artwork version invalidates its approval and blocks downstream work.
- Cross-company record/reference access is denied.
- Audit records, settings changes without historic-cost rewrites, logout revocation.
- On-disk database close/reopen retains edits and sample counts; no reseeding of an existing database.
- Compose YAML and package/archive contents checked statically.

## Not executed here

- Docker image build and Compose startup: Docker is not installed in the authoring environment.
- Native PostgreSQL container/network, health-check timing and `pg_dump` restore: documented for local verification; the automated suite uses PGlite’s PostgreSQL SQL engine.
- Browser visual and interaction QA: the available supervised preview failed during embedded-database initialization. The isolated persistence and domain tests passed afterward; that is not a visual verification.
- Optional WebMCP tools: no supported live page context was available for verification.

The supplied application is an evaluable prototype, not a production acceptance sign-off. Seeded customer records are fictional. Real machine integrations, inventory consumption and accounting writes are absent.
