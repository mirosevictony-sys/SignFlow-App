# AGENTS.md — SignFlow Development Instructions

Shared instructions for every agent (human or AI) working in this repo.

## Project

SignFlow is a sign-shop management platform. Target architecture: modular
monolith, React + TypeScript + Vite frontend, NestJS backend, PostgreSQL via
Prisma, Docker-based dev environment, GitHub Actions CI.

**Current reality (read before touching the backend):** the existing
scaffold under `server/` is Express + raw `node-postgres` with hand-written
SQL migrations (`server/migrations/`) — not NestJS/Prisma yet. This is an
open architectural decision, not an oversight. See `docs/DECISIONS.md`
("NestJS/Prisma migration") before starting backend work that assumes one
or the other. Don't silently pick a side.

Full current-state docs: `docs/ARCHITECTURE.md`, `docs/FEATURES.md`,
`docs/API.md`, `docs/VALIDATION.md` (pre-existing, authoritative for what's
actually built), plus `docs/ROADMAP.md`, `docs/DECISIONS.md`,
`docs/HANDOFF.md`, `docs/AGENT_TEAM.md` (added for the agent team).

## Branching

- `main` — approved, working application code only.
- `feature/*` — new functionality.
- `fix/*` — bug fixes.
- `chore/*` — maintenance, tooling, setup.

Never commit directly to `main`. Every change goes through a branch and a
pull request. Use an isolated **git worktree** per task
(`git worktree add ../signflow-work-<slug> -b feature/<slug>`) so parallel
agents never collide in the same working directory.

## Required before "done"

1. Tests pass (`npm test` at minimum; add tests for new behavior).
2. `npm run build` succeeds (TypeScript strict checks).
3. A code review verdict is recorded (sf-reviewer, or a human) — approval
   or explicit requested changes. No self-merges.
4. No merge into `main` without explicit human approval. Agents open PRs;
   they do not merge them.

## Hard rules for every agent

- No force-push, no branch deletion, no history rewriting.
- No changing repository visibility.
- No automatic/unattended merges.
- Report test/build failures honestly — never mark a task done on an
  unverified claim.
- Keep `docs/DECISIONS.md` updated when you make a non-trivial technical
  choice (framework, library, schema shape, API contract).
