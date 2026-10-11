# Architecture and decisions

## Stack

- React + TypeScript + Vite browser app. Purpose-built CSS, Lucide icons, accessible Radix dialogs. No remote assets or analytics are needed at runtime.
- Node.js 22 + Express API. Shared Zod validation and estimator types. TypeScript compilation produces `dist/server` and `dist/shared`.
- PostgreSQL 17, accessed through parameterized node-postgres queries. SQL migrations, transactions, pessimistic record locks and optimistic job versions.
- One app image serves both the compiled frontend and API on port 3000. The separate database container has a named volume and health check; the app waits for database health.
- PGlite is a development/test-only PostgreSQL adapter. It is a dev dependency and is not present in the production image. `DATABASE_MODE=embedded` explicitly fails under `NODE_ENV=production`.

## Repository

```text
client/src/          UI, forms, formatting and API calls
client/public/       Local favicon
shared/              Costing, validation, constants and record types
server/routes/       Sales and production actions
server/migrations/   Ordered SQL migrations
server/db.ts         PostgreSQL adapter and migration runner
server/security.ts   Passwords, sessions, roles, audit and CSRF checks
server/seed.ts       First-run sample workspace
tests/               Costing, workflow, access and persistence tests
docs/                Scope, API and architecture notes
compose.yaml         App + PostgreSQL
Dockerfile           Build and non-root runtime stages
```

## Domain model

Customer → quote → quote lines → sales order → order lines → production jobs → job events. A company scopes business records, users and machines. A session belongs to a user. Audit records capture successful writes. Quotes and orders remain separate; order lines copy approved specifications/costs, so future estimator-default changes cannot rewrite historic pricing.

For this phase, customer contact/address fields and the order installation site are flattened text fields. Dedicated contacts, sites and projects are planned, not silently represented as fully implemented modules. Each order line has at most one job in v0.1. Ordered, good produced, rejected, delivered and invoiced counts are stored separately. Invoiced is reserved for the later finance integration and remains zero in this prototype.

## Workflow

Fixed route: Design (seed examples) → Prepress → Production → Finishing → Installation → Ready to Invoice → Completed. New order jobs enter Prepress. Task state is separate: Queued, Ready, Running, Paused, Blocked, Complete, Cancelled. V0.1 exposes the active progression path; cancellation management is not yet an interface feature.

Completing a stage stops the timer and queues the next stage. Production requires the full ordered good quantity before progression. Installation requires full delivered/installed quantity before progression. Partial quantity entries are allowed and persisted. Rejects do not reduce ordered quantity and do not count as good output. Reprints need a separate future workflow.

Release gates inspect the job's current artwork version, manual material readiness and the order deposit flag. Approval is metadata only; no file management is claimed. Revising artwork removes approval and blocks downstream work. Machine starts lock the machine record and check for another running job; manual Maintenance/Offline status also blocks start.

## Data integrity

- All API operations derive `company_id` from the authenticated session. Client-supplied ownership identifiers are not accepted.
- Composite foreign keys guard company references where applicable. Mutation routes validate ownership before writing.
- Conversion locks the quote; a unique `orders.quote_id` prevents duplicates. Job generation locks the order; a unique `jobs.order_line_id` prevents duplicate jobs.
- Job changes require an expected version and lock the job. Only one of two concurrent requests using the same version can update quantities.
- Production actions lock the parent order before recomputing its status, avoiding stale cross-job completion roll-ups.
- Successful writes and audit/events share a database transaction. No raw client formula code is executed.
- Migration names are recorded; initialization and seeding are non-destructive and lock their coordination tables. This is a single app-instance local pilot; multi-instance startup/load remains a later verification task.

## Costing

The pure shared calculator packs rectangular pieces into a usable roll width with bleed and inter-piece gaps. It chooses the shorter length among permitted orientations, multiplies full usable width by required length, and applies a material-waste percentage once. Finished area is independent of material consumption. Ink and finishing are charged on finished area; material on consumed area. Labour hours × labour rate and setup cost are separate components. Line selling price is `max(minimum, true_cost / (1 - margin))`, rounded to cents. All rounded component costs are summed before pricing.

The UI calls the same calculation for feedback; the server validates and recalculates before saving. Persisted quote totals are integer euro cents. Snapshot version: `rectangular-roll-v1`. A rigid-panel product label currently uses the same rectangular estimate and explicitly warns that true sheet yield needs manual verification. White ink is a demo rate preset, not a layer-aware production model. Machine hourly rates are reference settings only, so they are not counted again in an estimate's labour/setup costs.

## Security boundaries

Passwords use per-user salted scrypt. Session tokens use cryptographic randomness, are hashed at rest, expire after eight hours and are carried in HttpOnly SameSite=Strict cookies. Same-origin/JSON checks protect mutations. Login is rate-limited in the app process. SQL is parameterized; responses are no-store. Financial values are removed at the server for operators, not only hidden in the UI. The initial company has admin and operator accounts; manager/estimator roles exist in the server but have no user-management interface.

Compose exposes only a loopback app port; database traffic stays inside the Compose network. Internet/LAN rollout requires TLS, unique credentials, user/password administration, trusted proxy configuration, shared rate limiting and wider operational testing. That rollout is outside this local prototype.

## Validation boundaries

Unit and API/domain tests run against PostgreSQL SQL implemented by PGlite. HTTP objects are simulated, so these tests do not substitute for a native PostgreSQL/Docker network smoke test. Persistence is verified with a temporary on-disk database across close/reopen. Production compilation passes. Browser visual QA and Docker execution remain unverified in this environment.

Optional WebMCP features expose a read-only production job list and a job-drawer navigation action. They share current UI data, expose no extra financial fields, validate input and clean up registrations. Unsupported browsers use the normal UI; supported-browser tool verification remains pending.
