# Agent Team — Roles and Responsibilities

Six Hermes profiles, all cloned from the authenticated `default` profile
(model: `claude-sonnet-5` / Anthropic), all scoped to this repo via
`terminal.cwd = C:/Users/Tony/projects/SignFlow-App`.

| Profile | Role | Codes features? | Can merge to main? | Notes |
|---|---|---|---|---|
| `sf-architect` | Software Architect | No (docs/stubs only) | No | Owns `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, module boundaries, shared contracts. |
| `sf-backend` | Backend Developer | Yes | No | NestJS/Prisma target; existing code is Express/node-postgres — see open decision. |
| `sf-frontend` | Frontend Developer | Yes | No | React/TS/Vite UI, design-system components, forms. |
| `sf-qa` | QA Engineer | Tests only | No | Reproduces bugs, writes regression tests, verifies fixes. |
| `sf-reviewer` | Code Reviewer | No | No | Independent review: security, architecture fit, tests, acceptance criteria. Verdict only, never merges. |
| `sf-orchestrator` | Development Orchestrator | No | No | Decomposes/assigns Kanban tasks, tracks dependencies, enforces review+test gates. Not a coding agent. Kanban + delegation toolsets enabled; terminal/code_execution/browser disabled. |

All six profiles: never force-push, never delete branches, never rewrite
history, never change repo visibility, never auto-merge a PR. Work
happens on `feature/*`, `fix/*`, `chore/*` branches via isolated git
worktrees, per `AGENTS.md`.

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
workdir = this repo. Settings: `max_in_progress=1`,
`auto_decompose=false`, `dispatch_in_gateway=false` (until human
approval), `failure_limit=2` (max retries per task),
`orchestrator_profile=sf-orchestrator`. No global "require review" or
"default task runtime target" config keys exist in this Hermes build
(verified against `kanban.*` config schema) — those two policies from the
setup brief are enforced procedurally (SOUL.md instructions + workflow
convention: request-review before complete), not by a hard toggle.
