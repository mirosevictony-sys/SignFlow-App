// Type declarations for scripts/verify-pr-ci.mjs (lets strict TypeScript tests import it).

export interface CheckRunLike {
  id?: number;
  name: string;
  status: string;
  conclusion: string | null;
  head_sha: string;
  app?: { slug?: string } | null;
  started_at?: string | null;
  completed_at?: string | null;
  html_url?: string;
}

export interface PullLike {
  state: string;
  merged_at?: string | null;
  head: { sha: string; ref?: string };
  base?: { ref?: string };
  html_url?: string;
}

export interface Verdict {
  ok: boolean;
  head_sha: string | null;
  check: {
    name: string;
    id?: number;
    status: string;
    conclusion: string | null;
    head_sha: string;
    app: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    url?: string;
  } | null;
  other_check_runs?: Array<{ name: string; status: string; conclusion: string | null; app: string | null; head_sha: string }>;
  reasons: string[];
}

export const DEFAULT_CHECK: string;
export const DEFAULT_APP: string;
export function latestRun<T extends CheckRunLike>(runs: T[]): T | undefined;
export function evaluate(input: {
  prBefore: PullLike | null;
  prAfter?: PullLike | null;
  checkRuns: CheckRunLike[];
  checkName?: string;
  appSlug?: string;
  expectSha?: string | null;
}): Verdict;
export function main(argv?: string[]): Promise<number>;
