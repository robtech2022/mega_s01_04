import type { Night } from './types.js';

export type NightCounts = { ok: number; retry: number; fail: number };

// Derived from the per-job rows (the contract keeps no per-status line totals):
// retry = retry lines (sum of retries); ok / fail = jobs whose latest line ended that way.
export function countNight(night: Night): NightCounts {
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const r of night.rows) {
    counts.retry += r.retries;
    if (r.lastStatus === 'ok') counts.ok += 1;
    else if (r.lastStatus === 'fail') counts.fail += 1;
  }
  return counts;
}
