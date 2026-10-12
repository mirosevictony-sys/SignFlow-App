# Agent Team — Roles and Responsibilities

Six Hermes profiles, all cloned from the authenticated `default` profile
(model: `claude-sonnet-5` / Anthropic), all scoped to this repo via
`terminal.cwd = C:/Users/Tony/projects/SignFlow-App`.

| Profile | Role | Codes features? | Can merge to main? | Notes |
|---|---|---|---|---|
| `sf-architect` | Software Architect | No (docs/stubs only) | No | Owns `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, module boundaries, shared contracts. |
| `sf-backend` | Backend Developer | Yes | No | Express + node-postgres (decided stack, `docs/DECISIONS.md`) — no NestJS/Prisma. Gradually enforces modular boundaries within it. |
| `sf-frontend` | Frontend Developer | Yes | No | React/TS/Vite UI, design-system components, forms. |
| `sf-qa` | QA Engineer | Tests only | No | Reproduces bugs, writes regression tests, verifies fixes, verifies CI with `scripts/verify-pr-ci.mjs`. |
| `sf-reviewer` | Code Reviewer | No | No | Independent review: security, architecture fit, tests, acceptance criteria, QA evidence. Verdict only, never merges. |
| `sf-orchestrator` | Development Orchestrator | No | No | Creates and links Kanban cards, tracks dependencies, enforces QA + review gates, reports for human approval. Not a coding agent. |

All six profiles: never force-push, never delete branches, never rewrite
history, never change repo visibility, never auto-merge a PR. Work
happens on `feature/*`, `fix/*`, `chore/*`, `docs/*` branches via isolated
git worktrees, per `AGENTS.md`.

## Tool permissions (CLI platform, verified with `hermes -p <name> tools list` on 2026-10-12)

| Profile | Enabled toolsets | Deliberately disabled |
|---|---|---|
| `sf-orchestrator` | kanban, delegation, file, web, skills, todo, memory, session_search, clarify, connections | terminal, code_execution, browser, **cronjob** (no recurring autonomous schedules) |
| `sf-architect` | terminal, file, code_execution, web, browser, vision, skills, todo, memory, session_search, clarify, delegation | kanban (worker kanban tools are injected per task), cronjob |
| `sf-backend` | terminal, file, code_execution, web, browser, vision, skills, todo, memory, session_search, clarify, delegation | kanban, cronjob |
| `sf-frontend` | terminal, file, code_execution, web, browser, vision, skills, todo, memory, session_search, clarify, delegation | kanban, cronjob |
| `sf-qa` | terminal, file, code_execution, web, browser, vision, skills, todo, memory, session_search, clarify, delegation | kanban, cronjob |
| `sf-reviewer` | terminal, file, code_execution, web, browser, vision, **kanban**, skills, todo, memory, session_search, clarify, delegation | cronjob |

Notes:

- Every dispatcher-spawned worker automatically receives the task-scoped
  Kanban tools (`kanban_show`, `kanban_complete`, `kanban_block`,
  `kanban_comment`, `kanban_create`, `kanban_link`,
  `kanban_request_review`, `kanban_request_changes`, …) regardless of the
  `kanban` toolset flag. The flag only matters in ordinary chat sessions.
- Git, `gh` (GitHub CLI), npm and the test suite are used through the
  `terminal` toolset. Browser testing uses the Hermes `browser` toolset;
  Playwright is **not** a project dependency yet (adding it is a separate
  feature task because it changes `package.json`/`package-lock.json`).
- Database work uses the existing SQL migrations under `server/migrations/`
  and the PGlite-backed test suite; agents get no production database
  credentials.

## GitHub credentials

- `gh` is installed at `C:\Program Files\GitHub CLI\gh.exe` and logged in
  via the Windows keyring as `mirosevictony-sys` (scopes: repo, workflow,
  read:org, gist). Any profile without its own token falls back to this
  login.
- `sf-backend`, `sf-frontend`, `sf-qa` and `sf-reviewer` have
  `terminal.env_passthrough: [GH_TOKEN]`, so a `GH_TOKEN` placed in that
  profile's own `.env` overrides the keyring inside its terminal. Hermes
  strips `GH_TOKEN` from terminal subprocesses unless it is listed there.
- `sf-backend` has its own classic PAT (`repo` scope, no `workflow`
  scope) in its `.env`.
- Recommended separation (manual, see `docs/HANDOFF.md`): give `sf-qa` and
  `sf-reviewer` a fine-grained **read-only** token (Metadata, Contents,
  Pull requests, Checks, Commit statuses, Actions — all Read) and
  `sf-frontend` its own publishing token (Contents + Pull requests Read &
  write).

## Orchestrator card templates

The orchestrator creates every card with `kanban_create` using these
fields (enforced by its SOUL.md):

| Field | Implementation / fix | QA | Review | Approval |
|---|---|---|---|---|
| `assignee` | `sf-backend` / `sf-frontend` / `sf-architect` | `sf-qa` | `sf-reviewer` | `sf-orchestrator` |
| `completion_contract` | `local-only` | `local-only` | `local-only` | `local-only` |
| `workspace_kind` | `worktree` | `worktree` | `worktree` | `scratch` |
| `max_runtime_seconds` | `2700` | `2700` | `2700` | `900` |
| `parents` | — (fix: none) | impl card | QA card | review card |
| `idempotency_key` | `signflow:<slug>:impl` | `signflow:<slug>:qa` | `signflow:<slug>:review` | `signflow:<slug>:approval` |

Every implementation body states: goal, acceptance criteria, technical
boundaries (modules/files in scope), out of scope, dependencies, required
tests, branch name, and the required handoff (branch, SHA, PR URL, tests).

## On the Desktop app Bots roster

These profiles were created via the `hermes profile create` CLI. They
exist fully (config, SOUL.md, auth, skills) and are usable right now via
`hermes -p <name> chat` or the wrapper scripts in `~/.local/bin`. Whether
they automatically appear as selectable Bots in the Hermes **Desktop
app**'s roster depends on that UI's own profile-discovery behavior, which
this setup pass has not verified against the running desktop client — if
they don't show up there, add them manually through the Desktop app's Bot
management screen; the underlying profiles are already fully functional
either way.

## Kanban

Board slug: `signflow`, display name "SignFlow Development", default
workdir = this repo (worktree cards land in `<repo>/.worktrees/<task-id>`).

Settings (set in the `default` home, which hosts the only gateway and the
dispatcher, and mirrored into every `sf-*` profile so no profile can
dispatch on its own):

| Key | Value | Meaning |
|---|---|---|
| `kanban.max_in_progress` | `1` | One running task at a time |
| `kanban.max_in_progress_per_profile` | `1` | One running task per profile |
| `kanban.auto_decompose` | `false` | No automatic decomposition of triage cards |
| `kanban.auto_promote_children` | `false` | Decomposed children stay in `todo` |
| `kanban.dispatch_in_gateway` | `false` | No automatic dispatch until the human enables it |
| `kanban.failure_limit` | `2` | Auto-block after 2 consecutive failed attempts |
| `kanban.orchestrator_profile` | `sf-orchestrator` | |

No board-wide "default runtime" or "require review" key exists in this
Hermes build. Runtime (`max_runtime_seconds: 2700` ≈ 45 min) is applied
per card by the orchestrator, and review is enforced structurally by the
impl → QA → review → approval dependency chain (see `AGENTS.md`).
Completion contracts are always `local-only` (also the Hermes default).
