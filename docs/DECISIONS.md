# Technical Decision History

Format: date, decision, reasoning, alternatives considered, status.

## 2026-10-12 — Repo relocated and git-initialized

- **Decision:** Moved the existing unversioned scaffold from
  `Desktop\SignFlow-v0.1\signflow` to `C:\Users\Tony\projects\SignFlow-App`,
  ran `git init`, added `origin` = the (pre-existing, empty) private GitHub
  repo `mirosevictony-sys/SignFlow-App`, committed the scaffold as-is to
  `main`, pushed.
- **Reasoning:** No git repo existed anywhere for SignFlow; the only
  remote was an empty GitHub repo with no connection to the code. User
  chose "move to a clean path, then init + push" over in-place init or
  leaving code disconnected.
- **Status:** Done. `main` now has one commit (`chore: import existing
  SignFlow scaffold`).

## 2026-10-12 — DECIDED: Keep Express/node-postgres; no NestJS/Prisma migration now

- **Context:** Previously open — see history below. The agent-team setup
  brief had assumed NestJS + Prisma as the target; the actual working
  v0.1 scaffold is Express + raw `node-postgres` with hand-written SQL
  migrations and already has 14 passing tests (`docs/VALIDATION.md`).
- **Decision:** Keep the existing Express + node-postgres backend for
  SignFlow v0.1. **Do not migrate to NestJS or Prisma at this stage.**
  Maintain existing application functionality and gradually establish a
  modular monolith *within* the current stack — i.e. enforce module
  boundaries (routes/services/data access per domain area) in plain
  TypeScript/Express, not via a framework swap.
- **Reasoning:** The v0.1 prototype works and is tested; a framework
  migration now would be pure risk with no product value. Modularity is
  a code-organization property, not something that requires NestJS.
- **Status:** Decided 2026-10-12 by the user. Superseded the "OPEN"
  entry below, which is left for history. All docs referencing
  NestJS/Prisma as current or near-term target have been corrected
  (`AGENTS.md`, `docs/ROADMAP.md`, `docs/AGENT_TEAM.md`).

## 2026-10-12 — (superseded) OPEN: NestJS/Prisma vs. existing Express/node-postgres

- **Context:** The agent-team setup brief specifies NestJS + Prisma as
  the target backend stack. The actual existing scaffold
  (`server/app.ts`, `server/db.ts`, `server/migrations/*.sql`) is Express
  + raw `node-postgres` with hand-written SQL migrations and already has
  a working v0.1 prototype (14 passing tests per `docs/VALIDATION.md`).
- **Options:**
  1. Keep Express/node-postgres, update target docs to match reality.
  2. Migrate incrementally to NestJS/Prisma (new modules in Nest, legacy
     routes stay Express until ported, Prisma introduced alongside raw
     SQL migrations with a transition plan).
  3. Full rewrite onto NestJS/Prisma before further feature work.
- **Status:** Superseded above — decision is (1), with "modular
  monolith" achieved by organization, not by framework change.

## 2026-10-12 — Agent team and Kanban setup

- **Decision:** Created six Hermes profiles (sf-architect, sf-backend,
  sf-frontend, sf-qa, sf-reviewer, sf-orchestrator) cloned from the
  authenticated `default` profile (same model: claude-sonnet-5 /
  Anthropic), each scoped to this repo via `terminal.cwd`, with
  role-appropriate toolsets. Created Kanban board `signflow`
  ("SignFlow Development") with `max_in_progress=1`, `auto_decompose`
  and `dispatch_in_gateway` both off, `failure_limit=2`.
- **Reasoning:** Matches the requested setup brief; dispatch is left off
  until the human explicitly approves starting work.
- **Status:** Done, pending human approval to flip `dispatch_in_gateway`
  back on.
