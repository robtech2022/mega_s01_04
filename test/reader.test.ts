import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-runs-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function night(name: string, lines: string[]): string {
  writeFileSync(join(tmp, `${name}.jsonl`), lines.join('\n'));
  return name;
}

describe('readNight on runs/2026-10-28.jsonl', () => {
  const result = readNight('runs', '2026-10-28');

  it('has 5 jobs, sorted, and 1 bad line', () => {
    expect(result).not.toBeNull();
    expect(result!.night).toBe('2026-10-28');
    expect(result!.badLines).toBe(1);
    expect(result!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('builds each row from its lines, times as written', () => {
    const byJob = Object.fromEntries(result!.rows.map((r) => [r.job, r]));
    expect(byJob['fixtures/refresh']).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(byJob['lane/sync']).toMatchObject({
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
    expect(byJob['notes/backup']).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(byJob['digest/render']).toMatchObject({ owner: null, runs: 1, lastError: null });
  });
});

describe('readNight edge cases', () => {
  it('returns null for a night with no file', () => {
    expect(readNight(tmp, '2001-01-01')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    night('x', []);
    expect(readNight(tmp, 'x')).toBeNull();
    expect(readNight(tmp, '../runs/2026-10-28')).toBeNull();
    expect(readNight('runs', '2026-10-28/../2026-10-27')).toBeNull();
  });

  it('gives no rows for an empty file', () => {
    expect(readNight(tmp, night('2026-01-01', []))).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('ignores blank lines and counts bad JSON and wrong shapes', () => {
    const n = night('2026-01-02', [
      '',
      '   ',
      '{"at":"2026-01-02T01:00:00+02:00","job":"a","status":"ok","owner":"x"}',
      'not json',
      '[1,2]',
      '{"at":"2026-01-02T01:00:00+02:00","job":"a","status":"weird","owner":"x"}',
      '{"at":"2026-01-02T01:00:00+02:00","job":"a","status":"ok"}',
      '{"at":"2026-01-02T01:00:00+02:00","job":"a","status":"ok","owner":5}',
      '',
    ]);
    const r = readNight(tmp, n)!;
    expect(r.badLines).toBe(5);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.firstAt).toBe('2026-01-02T01:00:00+02:00');
  });

  it('takes lastError from the latest line with one, in file order', () => {
    const n = night('2026-01-03', [
      '{"at":"2026-01-03T05:00:00-05:00","job":"b","status":"retry","owner":null,"error":"first"}',
      '{"at":"2026-01-03T04:00:00-05:00","job":"b","status":"fail","owner":null,"error":"second"}',
      '{"at":"2026-01-03T03:00:00-05:00","job":"b","status":"ok","owner":null}',
    ]);
    const [row] = readNight(tmp, n)!.rows;
    expect(row).toEqual({
      job: 'b',
      owner: null,
      runs: 3,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'second',
      firstAt: '2026-01-03T05:00:00-05:00',
      lastAt: '2026-01-03T03:00:00-05:00',
    });
  });
});
