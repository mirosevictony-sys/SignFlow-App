# Handoff — Current Project Status

_Last updated: 2026-10-12, by the multi-agent GitHub Free workflow setup pass._

## Where things stand

- **Code:** v0.1 prototype exists and passes its test suite and build
  (re-verified 2026-10-12 on Node 26.7 / npm 11: `npm ci`, `npm test` —
  21/21 tests including the new verifier tests — and `npm run build`).
  Not yet verified against a real Docker/Postgres stack or in a browser.
- **Repo:** `C:\Users\Tony\projects\SignFlow-App`, remote
  `https://github.com/mirosevictony-sys/SignFlow-App`. **GitHub reported
  the repository as PUBLIC on 2026-10-12**, although earlier docs said
  private — the owner should confirm the intended visibility (agents never
  change it). `main` is unprotected (GitHub Free workflow; no required
  checks).
- **Open PRs (none merged yet):**
  - #1 `chore/setup` — agent-team docs.
  - #2 `feature/ci-workflow` — `.github/workflows/ci.yml` (job
    `build-and-test`: Node 22, `npm ci`, `npm test`, `npm run build`, on PRs
    to `main` and pushes to `main`). CI green on head `0039e87`.
  - #3 `fix/source-map-js-ghsa-68fv` — dependency advisory fix.
  - Setup PR `chore/multi-agent-github-free-workflow` — this workflow
    (AGENTS.md, docs, `scripts/verify-pr-ci.mjs` + tests, `.gitignore`).
    Branched from `chore/setup`, so it also contains PR #1's commits until
    #1 is merged.
- **Architecture decision:** keep Express + node-postgres, no
  NestJS/Prisma (see `docs/DECISIONS.md`).
- **Agent team:** six profiles with verified tool permissions (see
  `docs/AGENT_TEAM.md`). Every new card uses `completion_contract:
  local-only`; the pipeline is impl → QA → review → approval (`AGENTS.md`).
- **Kanban:** board `signflow`, dispatch **disabled**,
  `max_in_progress=1`, `failure_limit=2`, no auto-decompose/auto-promote.
  A one-off local-only smoke card (`t_7ef6d6a7`, sf-qa, read-only) was run
  by a single manual `hermes kanban dispatch --max 1`: it ran in
  `.worktrees/t_7ef6d6a7` on `wt/t_7ef6d6a7`, read PR #2 via `gh`, made no
  changes, and reached `done` in 50 s with no GitHub acceptance gate
  (Hermes then removed the clean worktree and its temporary branch).
- **Pre-existing cards left untouched:** `t_f7a81d89` (ready, PR-URL
  contract — cannot complete under GitHub Free), `t_09fdb563` QA and
  `t_2d099d2d` review (todo, children of it), and five `ready` per-profile
  smoke tests from an earlier pass. They were not restored, unblocked or
  recreated. **If dispatch is enabled they will run** — archive or block
  them first if they are no longer wanted.

## What still needs manual/human setup

1. Merge order: PR #1 → PR #2 → setup PR (→ PR #3 whenever ready). Until
   PR #2 is merged, `main` has no workflow, so new PRs get no CI and QA
   cannot verify them.
2. Optional credential separation (never paste tokens into chat):
   - `sf-qa` and `sf-reviewer`: create a fine-grained token for
     `mirosevictony-sys/SignFlow-App` with **read-only** Metadata,
     Contents, Pull requests, Checks, Commit statuses and Actions, and add
     `GH_TOKEN=<token>` to
     `C:\Users\Tony\AppData\Local\hermes\profiles\sf-qa\.env` and
     `...\profiles\sf-reviewer\.env`.
   - `sf-frontend`: a publishing token (Contents + Pull requests: Read and
     write) in `...\profiles\sf-frontend\.env`.
   - Until then those profiles use the `gh` keyring login (full repo
     access). `terminal.env_passthrough: [GH_TOKEN]` is already configured
     so a token in the profile `.env` takes effect at the next worker spawn.
3. Restart Hermes Desktop and the gateway (only when no card is
   `running`) so their PATH picks up `C:\Program Files\GitHub CLI`;
   the current processes started before `gh` was installed.
4. Decide what to do with the pre-existing `ready` cards (above), then
   enable dispatch: `hermes config set kanban.dispatch_in_gateway true`.
5. Docker/Postgres and browser QA from `docs/VALIDATION.md` are still
   outstanding.

## How to resume after an interruption

See `AGENTS.md` → "Resuming after an interruption": check
`hermes kanban --board signflow list`/`stats` for running cards, read the
card with `show`, continue from the preserved worktree/branch, re-run
`scripts/verify-pr-ci.mjs` because earlier CI evidence may be stale.

## Suggested first task

A small, low-risk task to validate the whole pipeline end-to-end:
**"Stand up the Docker Compose dev environment and confirm `docs/VALIDATION.md`'s
"Not executed here" items (Docker build, Compose startup, Postgres
container) actually pass."** Assign to sf-backend, require sf-qa to
verify, sf-reviewer to sign off. It's small, it's real, and it proves the
Kanban/branch/review loop works before anything bigger is queued. Have
sf-orchestrator create it as the standard four linked `local-only` cards.
