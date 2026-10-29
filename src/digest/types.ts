// Plan morning-digest § 1. The contract every part of § 2 starts against: commit this first.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string; // ISO 8601 with the log's own offset: keep it, never convert to UTC
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night.
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as `—`
  runs: number; // lines for this job
  retries: number; // lines with status `retry`
  lastStatus: RunStatus; // status of the job's latest line
  lastError: string | null; // error of the job's latest line that had one
  firstAt: string; // `at` of the job's first line, as written
  lastAt: string; // `at` of the job's latest line, as written
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job
  badLines: number; // non-blank lines that didn't parse: counted, never thrown
};

// Reads runs/<night>.jsonl. Returns null when there is no file for that night (or `night` is
// not YYYY-MM-DD). An empty file gives { rows: [], badLines: 0 }.
export type ReadNight = (runsDir: string, night: string) => Night | null;
