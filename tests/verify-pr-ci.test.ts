import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluate, type CheckRunLike} from '../scripts/verify-pr-ci.mjs';

const SHA = '0039e877a3cdd8b8eee6b8a0cbf2d205f2a1325a';
const OLD = '1111111111111111111111111111111111111111';
const pr = (sha = SHA, state = 'open') => ({state, merged_at: null, head: {sha, ref: 'feature/x'}, base: {ref: 'main'}});
const run = (over: Partial<CheckRunLike> = {}): CheckRunLike => ({
  id: 1, name: 'build-and-test', status: 'completed', conclusion: 'success', head_sha: SHA,
  app: {slug: 'github-actions'}, started_at: '2026-10-11T23:41:00Z', completed_at: '2026-10-11T23:41:35Z', ...over,
});

test('passes only for a successful build-and-test run on the exact head SHA', () => {
  const v = evaluate({prBefore: pr(), prAfter: pr(), checkRuns: [run()]});
  assert.equal(v.ok, true, v.reasons.join('; '));
  assert.equal(v.check?.head_sha, SHA);
});

test('rejects missing evidence', () => {
  const v = evaluate({prBefore: pr(), prAfter: pr(), checkRuns: []});
  assert.equal(v.ok, false);
  assert.match(v.reasons.join(), /not found/);
});

test('rejects pending and failed runs', () => {
  assert.match(evaluate({prBefore: pr(), prAfter: pr(), checkRuns: [run({status: 'in_progress', conclusion: null})]}).reasons.join(), /pending/);
  for (const conclusion of ['failure', 'cancelled', 'timed_out', 'skipped', 'neutral', 'action_required']) {
    const v = evaluate({prBefore: pr(), prAfter: pr(), checkRuns: [run({conclusion})]});
    assert.equal(v.ok, false, conclusion);
  }
});

test('rejects stale evidence: run for an older commit, moved head, or mismatched expected SHA', () => {
  assert.match(evaluate({prBefore: pr(), prAfter: pr(), checkRuns: [run({head_sha: OLD})]}).reasons.join(), /stale/);
  assert.match(evaluate({prBefore: pr(), prAfter: pr(OLD), checkRuns: [run()]}).reasons.join(), /moved/);
  assert.match(evaluate({prBefore: pr(), prAfter: pr(), checkRuns: [run()], expectSha: OLD}).reasons.join(), /stale/);
  assert.equal(evaluate({prBefore: pr(), prAfter: pr(), checkRuns: [run()], expectSha: SHA.slice(0, 7)}).ok, true);
});

test('rejects a same-named check from an untrusted app', () => {
  const v = evaluate({prBefore: pr(), prAfter: pr(), checkRuns: [run({app: {slug: 'some-other-app'}})]});
  assert.equal(v.ok, false);
  assert.match(v.reasons.join(), /untrusted/);
});

test('uses the newest re-run when several runs share the name', () => {
  const failedOld = run({id: 1, conclusion: 'failure', started_at: '2026-10-11T23:00:00Z'});
  const passedNew = run({id: 2, conclusion: 'success', started_at: '2026-10-11T23:30:00Z'});
  assert.equal(evaluate({prBefore: pr(), prAfter: pr(), checkRuns: [failedOld, passedNew]}).ok, true);
  const passedOld = run({id: 1, conclusion: 'success', started_at: '2026-10-11T23:00:00Z'});
  const failedNew = run({id: 2, conclusion: 'failure', started_at: '2026-10-11T23:30:00Z'});
  assert.equal(evaluate({prBefore: pr(), prAfter: pr(), checkRuns: [passedOld, failedNew]}).ok, false);
});

test('rejects closed-unmerged PRs and missing metadata', () => {
  assert.equal(evaluate({prBefore: pr(SHA, 'closed'), prAfter: pr(SHA, 'closed'), checkRuns: [run()]}).ok, false);
  assert.equal(evaluate({prBefore: null, checkRuns: []}).ok, false);
});
