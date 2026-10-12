#!/usr/bin/env node
// verify-pr-ci.mjs — deterministic, READ-ONLY verification that a pull
// request's exact current head commit has a successful `build-and-test`
// GitHub Actions check run.
//
// It never trusts a PR description, a Kanban comment, or an agent's claim.
// It reads GitHub directly (GET requests only, via the GitHub CLI) and
// rejects missing, pending, failed, cancelled, skipped, foreign-app or
// stale evidence.
//
// Usage:
//   node scripts/verify-pr-ci.mjs <pr-number> [options]
//
// Options:
//   --repo OWNER/NAME     Repository (default: GH_REPO env, else parsed from
//                         `git remote get-url origin`)
//   --check NAME          Required check-run name (default: build-and-test)
//   --app SLUG            Required GitHub App that produced the check
//                         (default: github-actions)
//   --expect-sha SHA      Fail unless the PR head is exactly this commit
//                         (use the SHA recorded in the implementer handoff)
//   --out FILE            Also write the JSON result to FILE
//
// Output: one JSON object on stdout ({ ok, reasons, pr, check, ... }).
// Exit codes: 0 = verified, 1 = verification failed, 2 = usage/API error.
//
// Authentication: whatever `gh` is logged in as (GH_TOKEN env or the gh
// keyring). A read-only token is sufficient: Pull requests, Checks,
// Commit statuses, Contents and Metadata — all Read.

import { execFile } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const DEFAULT_CHECK = 'build-and-test';
export const DEFAULT_APP = 'github-actions';

/** Pick the newest check run (re-runs create additional runs with the same name). */
export function latestRun(runs) {
  return [...runs].sort((a, b) => {
    const ta = Date.parse(a.started_at || a.completed_at || 0) || 0;
    const tb = Date.parse(b.started_at || b.completed_at || 0) || 0;
    return tb - ta || (b.id || 0) - (a.id || 0);
  })[0];
}

/**
 * Pure decision function. Given the PR as read before and after fetching
 * check runs, plus the check runs for the head SHA, decide pass/fail.
 */
export function evaluate({ prBefore, prAfter, checkRuns, checkName = DEFAULT_CHECK, appSlug = DEFAULT_APP, expectSha = null }) {
  const reasons = [];
  const headSha = prBefore?.head?.sha ?? null;

  if (!prBefore || !headSha) {
    return { ok: false, head_sha: null, check: null, reasons: ['PR metadata or head SHA missing'] };
  }
  if (prBefore.state !== 'open' && !prBefore.merged_at) {
    reasons.push(`PR is ${prBefore.state} and not merged`);
  }
  if (expectSha && !/^[0-9a-f]{7,40}$/i.test(expectSha)) {
    reasons.push(`expected SHA "${expectSha}" is not a 7-40 character hex commit id`);
  } else if (expectSha && !headSha.startsWith(expectSha.toLowerCase())) {
    reasons.push(`PR head ${headSha} does not match expected SHA ${expectSha} (claimed evidence is stale)`);
  }
  if (prAfter && prAfter.head?.sha !== headSha) {
    reasons.push(`PR head moved during verification (${headSha} -> ${prAfter.head?.sha}); re-run when CI for the new head completes`);
  }

  const named = (checkRuns || []).filter((r) => r.name === checkName);
  const fromApp = named.filter((r) => (r.app?.slug ?? null) === appSlug);
  const forHead = fromApp.filter((r) => r.head_sha === headSha);

  if (named.length === 0) {
    reasons.push(`required check "${checkName}" not found for head ${headSha}`);
  } else if (fromApp.length === 0) {
    reasons.push(`check "${checkName}" exists but was not produced by app "${appSlug}" (untrusted source)`);
  } else if (forHead.length === 0) {
    reasons.push(`check "${checkName}" does not belong to head ${headSha} (stale evidence)`);
  }

  const run = forHead.length ? latestRun(forHead) : null;
  if (run) {
    if (run.status !== 'completed') {
      reasons.push(`check "${checkName}" is ${run.status} (pending), not completed`);
    } else if (run.conclusion !== 'success') {
      reasons.push(`check "${checkName}" concluded "${run.conclusion}", not "success"`);
    }
  }

  const others = (checkRuns || [])
    .filter((r) => r !== run)
    .map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion, app: r.app?.slug ?? null, head_sha: r.head_sha }));

  return {
    ok: reasons.length === 0,
    head_sha: headSha,
    check: run
      ? {
          name: run.name,
          id: run.id,
          status: run.status,
          conclusion: run.conclusion,
          head_sha: run.head_sha,
          app: run.app?.slug ?? null,
          started_at: run.started_at,
          completed_at: run.completed_at,
          url: run.html_url,
        }
      : null,
    other_check_runs: others,
    reasons,
  };
}

function parseArgs(argv) {
  const opts = { check: DEFAULT_CHECK, app: DEFAULT_APP, repo: null, expectSha: null, out: null, pr: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${a}`);
      return v;
    };
    if (a === '--repo') opts.repo = next();
    else if (a === '--check') opts.check = next();
    else if (a === '--app') opts.app = next();
    else if (a === '--expect-sha') opts.expectSha = next();
    else if (a === '--out') opts.out = next();
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (/^\d+$/.test(a) && opts.pr === null) opts.pr = Number(a);
    else throw new Error(`unexpected argument: ${a}`);
  }
  return opts;
}

function resolveGh() {
  if (process.env.GH_PATH) return process.env.GH_PATH;
  if (process.platform === 'win32') {
    const std = 'C:\\Program Files\\GitHub CLI\\gh.exe';
    if (existsSync(std)) return std;
  }
  return 'gh';
}

async function ghGet(gh, path) {
  // Explicit GET: this script must never mutate GitHub state.
  const { stdout } = await execFileAsync(gh, ['api', '-X', 'GET', '-H', 'Accept: application/vnd.github+json', path], {
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  return JSON.parse(stdout);
}

async function inferRepo() {
  if (process.env.GH_REPO) return process.env.GH_REPO;
  const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], { windowsHide: true });
  const m = stdout.trim().match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  if (!m) throw new Error(`cannot parse GitHub repo from origin URL: ${stdout.trim()}`);
  return `${m[1]}/${m[2]}`;
}

async function fetchCheckRuns(gh, repo, sha) {
  const runs = [];
  for (let page = 1; page <= 20; page++) {
    const data = await ghGet(gh, `repos/${repo}/commits/${sha}/check-runs?per_page=100&page=${page}&filter=all`);
    runs.push(...(data.check_runs || []));
    if (!data.check_runs || data.check_runs.length < 100) break;
  }
  return runs;
}

function emit(result, out) {
  const text = JSON.stringify(result, null, 2);
  process.stdout.write(text + '\n');
  if (!out) return true;
  try {
    writeFileSync(out, text + '\n');
    return true;
  } catch (e) {
    process.stderr.write(`error: could not write --out file: ${e.message}\n`);
    return false;
  }
}

export async function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    return 2;
  }
  if (opts.help || opts.pr === null) {
    process.stderr.write('usage: node scripts/verify-pr-ci.mjs <pr-number> [--repo OWNER/NAME] [--check NAME] [--app SLUG] [--expect-sha SHA] [--out FILE]\n');
    return opts.help ? 0 : 2;
  }

  const base = { verifier: 'scripts/verify-pr-ci.mjs', verified_at: new Date().toISOString(), pr: opts.pr, repo: null, required_check: opts.check, required_app: opts.app };
  let result;
  let code;
  try {
    const gh = resolveGh();
    const repo = opts.repo || (await inferRepo());
    base.repo = repo;
    const prBefore = await ghGet(gh, `repos/${repo}/pulls/${opts.pr}`);
    const checkRuns = prBefore?.head?.sha ? await fetchCheckRuns(gh, repo, prBefore.head.sha) : [];
    const prAfter = await ghGet(gh, `repos/${repo}/pulls/${opts.pr}`);
    const verdict = evaluate({ prBefore, prAfter, checkRuns, checkName: opts.check, appSlug: opts.app, expectSha: opts.expectSha });
    result = {
      ok: verdict.ok,
      ...base,
      pr_url: prBefore.html_url,
      pr_state: prBefore.state,
      pr_merged: Boolean(prBefore.merged_at),
      head_ref: prBefore.head?.ref,
      base_ref: prBefore.base?.ref,
      head_sha: verdict.head_sha,
      expected_sha: opts.expectSha,
      check: verdict.check,
      other_check_runs: verdict.other_check_runs,
      reasons: verdict.reasons,
    };
    code = verdict.ok ? 0 : 1;
  } catch (e) {
    const msg = String(e?.stderr || e?.message || e).trim().split('\n').slice(0, 5).join(' | ');
    result = { ok: false, ...base, error: msg, reasons: [`GitHub API/CLI error: ${msg}`] };
    code = 2;
  }
  // An unwritable --out file is a usage error, never a pass.
  return emit(result, opts.out) ? code : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
