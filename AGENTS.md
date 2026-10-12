# AGENTS.md — SignFlow Development Instructions

Shared instructions for every agent (human or AI) working in this repo.

## Project

SignFlow is a sign-shop management platform. Architecture: a **modular
monolith on the existing stack** — React + TypeScript + Vite frontend,
Express + node-postgres backend (decided 2026-10-12, see
`docs/DECISIONS.md` — no NestJS/Prisma migration), PostgreSQL via raw SQL
migrations, Docker-based dev environment, GitHub Actions CI.

"Modular monolith" here means enforcing module boundaries (routes,
services, data access grouped per domain area) within the current
Express/node-postgres code, not a framework swap. See
`docs/ARCHITECTURE.md` for what's actually built.

Full current-state docs: `docs/ARCHITECTURE.md`, `docs/FEATURES.md`,
`docs/API.md`, `docs/VALIDATION.md` (pre-existing, authoritative for what's
actually built), plus `docs/ROADMAP.md`, `docs/DECISIONS.md`,
`docs/HANDOFF.md`, `docs/AGENT_TEAM.md` (added for the agent team).

## Branching

- `main` — approved, working application code only.
- `feature/*` — new functionality.
- `fix/*` — bug fixes (including QA/review correction tasks).
- `chore/*` — maintenance, tooling, setup.
- `docs/*` — documentation-only changes.

Never commit directly to `main`. Every change goes through a branch and a
pull request. Use an isolated **git worktree** per task so parallel
agents never collide in the same working directory:

- **Kanban tasks** are created with `workspace_kind=worktree`. Hermes
  creates `<repo>/.worktrees/<task-id>` on a temporary `wt/<task-id>`
  branch cut from whatever the main checkout currently has checked out.
  Your **first** step in that worktree is to base the work on `main`:
  `git fetch origin && git switch -c feature/<slug> origin/main`
  (or `fix/…`, `chore/…`, `docs/…`). A branch can be checked out in only
  one worktree at a time, and the implementer's worktree keeps the PR
  branch checked out, so QA, review and correction cards work on a
  **detached** copy: `git fetch origin && git switch --detach origin/<branch>`.
  A correction card commits there and publishes with a fast-forward push
  `git push origin HEAD:<branch>` (never `--force`).
- **Manual work** outside Kanban:
  `git worktree add ../signflow-work-<slug> -b feature/<slug> origin/main`.
- `.worktrees/` is git-ignored. When a card completes, Hermes removes its
  worktree only if it is clean and every commit is pushed (it then also
  deletes the temporary `wt/<task-id>` branch — never `feature/*` etc.);
  dirty or unpushed worktrees are preserved. Never delete other tasks'
  worktrees or branches yourself.

## GitHub Free workflow (no required checks)

The repository is on **GitHub Free**. The workflow deliberately does
**not** depend on branch protection, rulesets or GitHub-enforced required
status checks. Instead:

1. Every change is a pull request from a `feature/*`, `fix/*`, `chore/*`
   or `docs/*` branch to `main`.
2. GitHub Actions (`.github/workflows/ci.yml`, job `build-and-test`) runs
   `npm ci`, `npm test` and `npm run build` on every PR to `main` and on
   every push to `main`.
3. QA verifies CI **independently** with `scripts/verify-pr-ci.mjs`
   against the PR's exact head commit. Nobody trusts a PR description, a
   Kanban comment or an agent's claim that tests passed.
4. A human merges. Agents never merge and never deploy.

## Kanban completion contracts — always `local-only`

Every SignFlow Kanban task (backend, frontend, architecture, QA, review,
infrastructure, bug fix, approval) is created with
**`completion_contract: local-only`**. Do not use `OWNER/REPO` or PR-URL
contracts: Hermes' PR-acceptance gate requires repository-required checks,
which this GitHub Free setup intentionally does not configure, so such
cards can never complete.

`local-only` only means the card's worker may complete the card.
**A completed card is not an approved change.** A change is approved only
when all of the following hold:

1. The implementation card is done and its handoff records branch, full
   commit SHA, PR number and PR URL.
2. The QA card is done with a passing `verify-pr-ci.mjs` result for that
   **same** head SHA, plus local test evidence.
3. The review card is done with an explicit approval verdict.
4. The human merges the PR. The approval card stays blocked until then.

## Pipeline — one feature = four linked cards

| Stage | Card | Assignee | Parent | Done means |
|---|---|---|---|---|
| 1 Planning | creates the cards below | `sf-orchestrator` | — | — |
| 2 Implementation | `[impl] <slug>` | `sf-backend` / `sf-frontend` (`sf-architect` for design docs) | — | Branch pushed, PR opened, tests run locally, handoff recorded |
| 3 QA | `[qa] <slug>` | `sf-qa` | impl | Acceptance criteria, local tests and `verify-pr-ci.mjs` all pass on the exact head SHA |
| 4 Review | `[review] <slug>` | `sf-reviewer` | qa | Explicit approval listing what was checked |
| 5 Approval | `[approval] <slug>` | `sf-orchestrator` | review | Evidence summary posted; card **blocked** awaiting the human merge |

The dependencies enforce the order: QA cannot start until the
implementation card is done, review cannot start until QA is done, and the
approval card cannot start until review is done.

### Implementation handoff (required in the completion summary)

- Branch name, full head commit SHA, PR number and PR URL.
- The exact test/build commands run and their results (`npm test`,
  `npm run build`, plus anything task-specific).
- Files changed, and anything deliberately left out of scope.

### QA checks

Acceptance criteria; relevant local tests (`npm ci`, `npm test`,
`npm run build` on the PR head); `verify-pr-ci.mjs` on the exact SHA from
the handoff; reproduction steps for every defect; regression testing of
neighbouring behaviour; database-migration safety (additive, ordered,
re-runnable on a fresh database) whenever `server/migrations/` changes.

### Review checks

Correctness, module boundaries (`docs/ARCHITECTURE.md`), security
(input validation, authz, SQL injection, secrets), maintainability, test
coverage of the new behaviour, and that the QA evidence refers to the
current head SHA.

### Corrections — bounded, never an unlimited loop

If QA or review finds a defect, that worker does **not** complete its own
card. It:

1. Creates a correction card `[fix rN] <slug>` (`N` = 1 or 2) assigned to
   the original implementer: `completion_contract: local-only`,
   `workspace_kind: worktree`, `max_runtime_seconds: 2700`, with the exact
   failures, reproduction steps and the branch/PR to update in the body
   (push new commits to the same branch — never force-push).
2. Links the correction card as a **parent of its own card**
   (`kanban_link(parent_id=<fix card>, child_id=<own card>)`).
3. Blocks its own card with `kind=dependency`; the card returns to `todo`
   and re-runs automatically once the fix card is done.

After **two** correction rounds on the same feature, a further failure is
blocked with `kind=needs_input` for a human decision instead of creating
`[fix r3]`.

## CI verification procedure

```bash
node scripts/verify-pr-ci.mjs <pr-number> --expect-sha <head-sha-from-handoff> --out ci-verify-<pr>.json
# equivalent: npm run verify:pr -- <pr-number> --expect-sha <sha>
```

The script is read-only (GitHub GET requests through `gh api`). It reads
the PR, takes its current head SHA, lists the check runs for exactly that
SHA and requires a `build-and-test` run produced by the `github-actions`
app that is `completed` with conclusion `success`. It re-reads the PR
afterwards and fails if the head moved. Missing, pending, failed,
cancelled, skipped, foreign-app or stale evidence fails. Exit codes: `0`
verified, `1` verification failed, `2` usage/API/auth error. Quote the JSON
in the QA handoff. Write `--out` files outside the repo (or delete them) —
never commit them.

If `gh` is not on PATH in your shell, add it for that shell session only:
`export PATH="$PATH:/c/Program Files/GitHub CLI"` (the script already falls
back to that path). Never make persistent PATH or credential changes.

## Task size and execution limits

- One card = one small, reviewable change: target ≤ 45 minutes of agent
  work and, ideally, under ~300 changed lines. Cards are created with
  `max_runtime_seconds: 2700`.
- At most **one** task runs at a time (`kanban.max_in_progress: 1`).
- A card is auto-blocked after **2** consecutive failed attempts
  (`kanban.failure_limit: 2`).
- No automatic decomposition, no automatic child promotion, no recurring
  schedules, and no unattended dispatch unless the human switches it on.

## Required before "done"

1. Tests pass (`npm test` at minimum; add tests for new behavior).
2. `npm run build` succeeds (TypeScript strict checks).
3. CI verified by QA with `scripts/verify-pr-ci.mjs` on the exact head SHA.
4. A code review verdict is recorded (sf-reviewer, or a human) — approval
   or explicit requested changes. No self-merges.
5. No merge into `main` without explicit human approval. Agents open PRs;
   they do not merge them.

## Resuming after an interruption

1. `hermes kanban --board signflow list` and `hermes kanban --board signflow stats`
   — confirm nothing is `running` before starting anything new.
2. `hermes kanban --board signflow show <id>` — read the comments, events
   and last handoff of the interrupted card.
3. Unfinished work survives: a dirty or unpushed worktree
   (`.worktrees/<id>`) is preserved, and pushed work lives on its branch.
   Continue from them (`git fetch origin && git status`). Never restart
   from scratch and never reset away commits.
4. A card stuck `running` with a dead worker is reclaimed by the
   dispatcher (or `hermes kanban --board signflow reclaim <id>`). Never edit
   the Kanban database directly.
5. Re-run `scripts/verify-pr-ci.mjs` — CI evidence from before the
   interruption is stale if new commits were pushed since.

## Credentials

- Never print, log, paste or commit tokens. GitHub tokens live only in a
  profile's own `.env` (`GH_TOKEN=…`, forwarded to the terminal through
  `terminal.env_passthrough`) or in the `gh` keyring.
- Publishing profiles (`sf-backend`, `sf-frontend`) need push and PR write
  access; verification profiles (`sf-qa`, `sf-reviewer`) only need read
  access. Agents get no production credentials.

## Hard rules for every agent

- No force-push, no branch deletion, no history rewriting.
- No changing repository visibility.
- No automatic/unattended merges and no production deployment.
- Do not close, edit or merge existing PRs (e.g. PR #2) unless the human
  explicitly authorises it.
- Report test/build failures honestly — never mark a task done on an
  unverified claim.
- Keep `docs/DECISIONS.md` updated when you make a non-trivial technical
  choice (framework, library, schema shape, API contract).
