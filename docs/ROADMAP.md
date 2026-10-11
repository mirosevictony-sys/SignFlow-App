# Roadmap — Incremental Development Phases

Status baseline: v0.1 prototype (see `docs/FEATURES.md` for the detailed
checklist). This roadmap sequences the planned product modules into
phases. Each phase should land as small, reviewed, tested increments —
not one big rewrite.

## Phase 0 — Foundations (current)
- Resolve the NestJS/Prisma vs Express/node-postgres decision
  (`docs/DECISIONS.md`).
- Agent team, Kanban board, branching/worktree conventions (this setup).
- Docker dev environment confirmed working end-to-end (currently
  unverified per `docs/VALIDATION.md`).
- GitHub Actions CI: build + test on every PR.

## Phase 1 — Core platform and permissions
- Company/user/role model hardening, full role matrix, session
  management, audit trail (extends existing security boundaries).

## Phase 2 — Customers and CRM
- Dedicated contacts/sites as first-class entities (today flattened text
  fields per `docs/ARCHITECTURE.md`), activities, pipeline.

## Phase 3 — Products, estimating and pricing formulas
- Versioned JSON formula import (safe, sandboxed — no raw client formula
  execution, per existing security boundary).
- Inventory-dependent pricing (ties into Phase 6 inventory).
- Generalize beyond the current rectangular-roll-v1 calculator.

## Phase 4 — Quotes and orders
- Revisions of sent/accepted quotes, discounts, quantity alternatives,
  customer approval links.

## Phase 5 — Jobs and production
- Configurable parallel routing (beyond the current fixed route), batch
  jobs, rework/reprint linkage, barcode scanning.

## Phase 6 — Inventory and purchasing
- Materials catalog, roll/sheet ledger, reservations, consumption,
  supplier purchasing — feeds Phase 3 pricing.

## Phase 7 — Workforce and skill management
- Beyond current assignment/timers: skills, availability, capacity.

## Phase 8 — Scheduling and installations
- Surveys, measured items/photos, crew/vehicle scheduling, sign-off,
  snagging, partial dispatch packs.

## Phase 9 — Fleet and logistics
- Vehicle/crew scheduling integration with Phase 8.

## Phase 10 — ShopVOX CSV import
- One-time/ongoing migration path from ShopVOX exports.

## Phase 11 — Documents and invoicing
- Invoice/payment ledger, VAT, accounting export (none exist today).

## Phase 12 — Reporting and integrations
- Period productivity, waste/cost reconciliation, profitability reports;
  ONYX/NAS, Microsoft 365/SharePoint, ConnectTeam, accounting connectors.

Each phase is decomposed into small Kanban tasks by sf-orchestrator as it
starts, not all upfront — the plan above is sequencing, not a committed
backlog.
