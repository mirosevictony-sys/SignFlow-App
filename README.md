# SignFlow v0.1

A working first version of Connect Install’s signage production workspace. Dark interface inspired by the earlier Printshop prototype, with lime accents, a production board, touch-friendly job cards and connected fictional sales records. No ecommerce.

## Run with Docker

1. Install and start Docker Desktop (Windows/macOS), or Docker Engine with Compose (Linux).
2. Extract this ZIP and open a terminal in the `signflow` folder, where `compose.yaml` is located.
3. Run:

```sh
docker compose up --build -d
```

4. Open **http://localhost:3000** when startup finishes.

Windows: double-click **start.cmd** after Docker Desktop is running. This avoids PowerShell script-signing issues. Linux/macOS: `sh start.sh` also works.

The first start downloads dependencies/images, builds the app, creates the PostgreSQL schema, and seeds the sample workspace. Subsequent starts preserve your changes. No local Node.js or PostgreSQL installation is needed for Docker.

| Demo account | Email | Password |
| --- | --- | --- |
| Administrator | `tony@signflow.local` | `SignFlow-Demo-2026!` |
| Operator | `operator@signflow.local` | `Operator-Demo-2026!` |

These are public demo credentials. Compose binds the app to your computer’s loopback address and does not expose the database port. This package is for local evaluation, not an internet-facing production deployment.

## What is included

- Dashboard with active work, deadlines, quote value, good output, department counts, machine queues and job activity. Figures are calculated from saved records.
- 12 fictional customers, 14 quotes, 8 sales orders and 16 linked production jobs. Example dates are relative to first initialization.
- Epson SC-9100, Summa S1 D160, cold laminator, and two finishing stations.
- Customer create/edit, search, contact details, payment terms and CSV export.
- Multi-line quote builder; editable drafts; send/accept/decline status; print-to-PDF through the browser; accepted-quote conversion to sales orders.
- Live rectangular roll-yield estimator: mm dimensions, quantities, usable width, bleed, gaps, rotation, material waste, ink, finishing, labour, setup cost, margin and minimum selling price. Finished area and consumed area remain separate.
- Sales orders with approved cost/specification snapshots, customer PO, installation site, deposit flag, and one production job per order line. Repeating conversion or job creation does not duplicate records.
- Production Kanban/list views, filters, job search, priorities, due dates, assignment, printing and CSV export.
- Operator view and job cards with start/pause/resume, hold reasons, recorded time, good/rejected output, partial fulfilment and stage completion.
- Manual artwork version/approval checks; a new version clears approval and holds downstream work. Configurable artwork, material and deposit gates are checked on the server.
- Machine availability, hourly reference rates and notes. A machine cannot start two operations concurrently or be taken offline while work is running.
- Saved company/estimator defaults, release-gate settings, audit records, secure session cookies, password hashing and server-enforced roles/company scope.
- Database migrations, non-destructive initial seed, persistent Docker volume, health checks, typed source, API reference and automated workflow tests.

Read `docs/FEATURES.md` for the implemented/planned checklist and `docs/ARCHITECTURE.md` for engineering decisions. This release does **not** claim ShopVox Pro feature parity.

## First workflow to try

1. Sign in as the administrator. Open **Quotes → Create quote**.
2. Select a sample customer, name the project, set dimensions and quantity, and inspect the live costs. Save the draft. Drafts can be reopened and edited.
3. Open the quote and select **Mark as sent**, then **Accept quote**, then **Create / open order**. “Mark as sent” changes status; it does not send an email.
4. Add a PO/site if needed, then select **Create production jobs**. Each line creates a job in Prepress.
5. Open a job. Approve its artwork version and confirm materials; complete Prepress to release it into Production.
6. Start work. If Epson is already occupied by the seeded running job, pause that job first. Record good and rejected output, with a rejection reason when needed.
7. Complete Production, then Finishing. At Installation, record delivered/installed units before advancing to Ready to Invoice and Completed.

“Completed” closes the operational job only. No invoice or payment is generated. The initial route is fixed and includes Installation for every job; dispatch-specific routes are planned.

## Stop, restart and update

```sh
# Stop services, keeping the database volume
docker compose down

# Start again
docker compose up -d

# Rebuild after source changes
docker compose up --build -d

# Show startup errors and application logs
docker compose logs --tail=100 app

# Show service health
docker compose ps
```

The named volume `signflow_signflow_data` holds PostgreSQL data. `docker compose down` keeps it; `docker compose down -v` deletes it. Do not use `-v` unless deliberately discarding the entire demo database.

## Optional configuration

Compose works with defaults. To customize them, copy `.env.example` to `.env` before the first start.

| Variable | Default / purpose |
| --- | --- |
| `APP_PORT` | `3000`; change if already occupied |
| `POSTGRES_PASSWORD` | Initial database password; keep aligned with the existing volume |
| `ADMIN_EMAIL` | `tony@signflow.local`; initial administrator |
| `ADMIN_PASSWORD` | Initial administrator password, at least 12 characters |
| `OPERATOR_PASSWORD` | Initial operator password, at least 12 characters |
| `SEED_DEMO` | `true`; `false` creates users/company/machines without fictional sales records |
| `COOKIE_SECURE` | `false` for local HTTP; requires HTTPS when `true` |

Initial account passwords and seed options are read only while initializing an empty database. Changing `.env` does not overwrite existing accounts or records. No `.env` file is included in the archive. Seed contact addresses use `example.com` and do not contact real customers. Machine costs and product rates are editable demo assumptions, not verified supplier or equipment costs.

## Backup and restore check

The following works from a terminal, including PowerShell. Create a `backups` folder first. The database writes the binary dump in its container; `docker compose cp` copies it without PowerShell binary-redirection issues.

```sh
docker compose exec -T db pg_dump -U signflow -d signflow -Fc -f /tmp/signflow.dump
docker compose cp db:/tmp/signflow.dump backups/signflow.dump
```

Verify a backup in a **separate database** so the working database is unaffected:

```sh
docker compose cp backups/signflow.dump db:/tmp/restore-check.dump
docker compose exec -T db createdb -U signflow signflow_restore_check
docker compose exec -T db pg_restore -U signflow -d signflow_restore_check --no-owner --exit-on-error /tmp/restore-check.dump
docker compose exec -T db psql -U signflow -d signflow_restore_check -c "SELECT count(*) AS jobs FROM jobs;"
```

The restore check database name must be unused. Keep dated backup copies outside Docker’s volume. Restore-to-live operations should be planned separately after validating the backup. These Docker backup commands are documented but were not executable in the build environment because Docker was unavailable.

## Development without Docker

Requires Node.js 22.12+ and npm. Install dependencies and start:

```sh
npm ci
npm run dev
```

Open **http://localhost:4173**. For convenience, development uses PGlite, an embedded PostgreSQL engine, when no `DATABASE_URL` or `PGHOST` is supplied. Its data lives in `.data/postgres`, separate from Docker data. This optional development adapter is never enabled in production mode. To use a real PostgreSQL database in development, set `DATABASE_URL` (or the standard `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` variables) in the shell first. `.env` is consumed by Docker Compose, not automatically by the standalone Node backend.

```sh
npm run build  # Type checks + server compilation + browser build
npm test       # Costing, API/domain workflow and persistence tests
npm run check  # TypeScript checks only
```

`npm start` runs the compiled production-style server and expects a PostgreSQL connection. The `dev:web` script uses the same Vite development API middleware as `dev`.

## Validation and known limits

The production build and automated tests have been run. Tests use the real SQL schema against PGlite and exercise Express handlers through mocked HTTP request/response objects. They cover costing, login/roles, redaction, tenant isolation, quote editing/conversion, duplicate requests, release gates, machine conflicts, partial output, concurrent stale updates, delivery, artwork changes, audit records and persisted database reopen.

Docker itself and native PostgreSQL containers could not be started in the build environment. Browser visual/interaction QA was unavailable because the supervised preview failed during embedded database initialization. Optional WebMCP tools are included but could not be validated in a supported browser context. Container smoke testing and visual acceptance on your machine remain necessary before using live jobs.

This is a local pilot foundation. Inventory, purchasing, advanced scheduling, uploads/proofs, configurable routes, external integrations, invoicing and customer portals are deliberately marked as planned. No actions send messages, control machines or place purchase orders.

Implementation references: [Docker Compose startup and health checks](https://docs.docker.com/compose/gettingstarted/), [node-postgres transactions](https://node-postgres.com/features/transactions), [Vite guide](https://vite.dev/guide/).
