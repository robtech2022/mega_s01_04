import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

let runsDir: string;
let app: ReturnType<typeof createApp>;

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

beforeAll(() => {
  runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-digest-'));
  // Jobs deliberately written out of order: rows must come back sorted by job.
  fs.writeFileSync(
    path.join(runsDir, '2026-01-01.jsonl'),
    [
      line('2026-01-01T02:00:00+01:00', 'zeta-sync', 'ok', 'ana'),
      line('2026-01-01T02:10:00+01:00', 'alpha-backup', 'retry', 'bob', 'timeout'),
      line('2026-01-01T02:20:00+01:00', 'alpha-backup', 'ok', 'bob'),
      line('2026-01-01T03:00:00+01:00', 'mid-report', 'fail', null, 'boom'),
    ].join('\n') + '\n',
  );
  fs.writeFileSync(path.join(runsDir, '2026-01-02.jsonl'), '');
  fs.writeFileSync(
    path.join(runsDir, '2026-01-03.jsonl'),
    [
      line('2026-01-03T02:00:00+01:00', 'zeta-sync', 'ok', 'ana'),
      'this is not json',
      line('2026-01-03T02:30:00+01:00', 'alpha-backup', 'ok', 'bob'),
    ].join('\n') + '\n',
  );
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => {
  fs.rmSync(runsDir, { recursive: true, force: true });
});

type Body = { night: string; rows: DigestRow[]; badLines: number };

describe('GET /digest/:night', () => {
  it('renders the job rows', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of ['alpha-backup', 'mid-report', 'zeta-sync']) expect(html).toContain(job);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app.request('/digest/2025-12-31');
    expect(res.status).toBe(404);
  });

  it('renders "nothing ran" for an empty night', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders 200 with the good jobs when a line is bad', async () => {
    const res = await app.request('/digest/2026-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('alpha-backup');
    expect(html).toContain('zeta-sync');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns night, rows sorted by job, and badLines', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.night).toBe('2026-01-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha-backup', 'mid-report', 'zeta-sync']);
    const alpha = body.rows[0];
    expect(alpha).toMatchObject({ owner: 'bob', runs: 2, retries: 1, lastStatus: 'ok' });
    expect(body.rows[1]).toMatchObject({ owner: null, lastStatus: 'fail', lastError: 'boom' });
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2025-12-31');
    expect(res.status).toBe(404);
  });

  it('returns empty rows for an empty night', async () => {
    const res = await app.request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts a bad line and keeps the good rows', async () => {
    const res = await app.request('/api/digest/2026-01-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Body;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha-backup', 'zeta-sync']);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    const body = (await (await app.request('/api/digest/2026-01-01')).json()) as Body;
    const jobs = body.rows.map((r) => r.job);
    const positions = jobs.map((j) => html.indexOf(j));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
