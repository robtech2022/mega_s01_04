import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { countNight, type NightCounts } from './digest/counts.js';
import { readNight } from './digest/reader.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightRow[];
};

export type NightRow = { night: string; counts: NightCounts | null };

function countsFor(runsDir: string, night: string): NightCounts | null {
  try {
    const n = readNight(runsDir, night);
    return n ? countNight(n) : null;
  } catch {
    return null;
  }
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => ({ night, counts: countsFor(config.runsDir, night) })),
  };
}
