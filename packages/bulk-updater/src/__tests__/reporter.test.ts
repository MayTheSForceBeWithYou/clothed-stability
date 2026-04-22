import { describe, it, expect } from 'vitest';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildReport, writeReport } from '../reporter.js';
import type { UpdateResult } from '../types.js';
import type { BulkUpdateSpec } from '../spec.js';

const spec: BulkUpdateSpec = {
  project: 'MyProject',
  selection: { ids: [1, 2, 3] },
  operations: { setFields: { 'System.Priority': 2 } },
  options: { dryRun: true, skipClosedItems: true, continueOnError: true, batchSize: 25 },
};

const results: UpdateResult[] = [
  { id: 1, title: 'Item 1', type: 'Task', status: 'updated' },
  { id: 2, title: 'Item 2', type: 'Task', status: 'skipped', skipReason: 'closed' },
  { id: 3, title: 'Item 3', type: 'Task', status: 'failed', error: 'API error' },
];

describe('buildReport', () => {
  it('computes correct summary counts', () => {
    const startedAt = new Date('2024-01-01T00:00:00.000Z');
    const completedAt = new Date('2024-01-01T00:00:05.000Z');
    const report = buildReport(spec, true, results, startedAt, completedAt);

    expect(report.summary.totalMatched).toBe(3);
    expect(report.summary.totalUpdated).toBe(1);
    expect(report.summary.totalSkipped).toBe(1);
    expect(report.summary.totalFailed).toBe(1);
    expect(report.summary.totalPlanned).toBe(2);
  });

  it('includes spec and timing', () => {
    const startedAt = new Date('2024-01-01T00:00:00.000Z');
    const completedAt = new Date('2024-01-01T00:00:05.000Z');
    const report = buildReport(spec, false, results, startedAt, completedAt);

    expect(report.spec).toBe(spec);
    expect(report.dryRun).toBe(false);
    expect(report.startedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(report.completedAt).toBe('2024-01-01T00:00:05.000Z');
    expect(report.durationMs).toBe(5000);
  });
});

interface ReportJson {
  spec: { project: string };
  summary: { totalMatched: number };
}

describe('writeReport', () => {
  it('writes valid JSON to a temp path', async () => {
    const timestamp = Date.now().toString();
    const path = join(tmpdir(), `bulk-update-test-${timestamp}.json`);
    const startedAt = new Date();
    const completedAt = new Date();
    const report = buildReport(spec, true, results, startedAt, completedAt);

    await writeReport(report, path);

    const content = await readFile(path, 'utf-8');
    const parsed = JSON.parse(content) as ReportJson;
    expect(parsed.spec.project).toBe('MyProject');
    expect(parsed.summary.totalMatched).toBe(3);

    await unlink(path);
  });
});
