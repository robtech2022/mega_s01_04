import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './reader.js';
import type { RunStatus } from './types.js';

export type NightCounts = Record<RunStatus, number>;

// Run lines per status for one night (bad lines are left out; the digest counts those).
// null when there is no file for the night.
export function countNight(runsDir: string, night: string): NightCounts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.replace(/^﻿/, '').split('\n')) {
    const run = raw.trim() === '' ? null : parseLine(raw.trim());
    if (run) counts[run.status]++;
  }
  return counts;
}
