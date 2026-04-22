import { writeFile } from 'fs/promises';
import type { Logger } from '@clothed-stability/utils';
import type { BulkUpdateSpec } from './spec.js';
import type { UpdateResult, BulkUpdateReport, BulkUpdateSummary } from './types.js';

export function buildReport(
  spec: BulkUpdateSpec,
  dryRun: boolean,
  results: UpdateResult[],
  startedAt: Date,
  completedAt: Date,
): BulkUpdateReport {
  const summary: BulkUpdateSummary = {
    totalMatched: results.length,
    totalPlanned: results.filter((r) => r.status !== 'skipped').length,
    totalUpdated: results.filter((r) => r.status === 'updated').length,
    totalSkipped: results.filter((r) => r.status === 'skipped').length,
    totalFailed: results.filter((r) => r.status === 'failed').length,
  };

  return {
    spec,
    dryRun,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    summary,
    items: results,
  };
}

export function printSummary(report: BulkUpdateReport, logger: Logger): void {
  const { summary, dryRun } = report;
  logger.info(
    {
      dryRun,
      totalMatched: summary.totalMatched,
      totalPlanned: summary.totalPlanned,
      totalUpdated: summary.totalUpdated,
      totalSkipped: summary.totalSkipped,
      totalFailed: summary.totalFailed,
    },
    'Bulk update complete',
  );
}

export async function writeReport(report: BulkUpdateReport, path: string): Promise<void> {
  await writeFile(path, JSON.stringify(report, null, 2), 'utf-8');
}
