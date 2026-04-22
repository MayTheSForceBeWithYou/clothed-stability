import type { Command } from 'commander';
import { loadConfigFromFile, resolveAuth } from '@clothed-stability/core';
import { AdoClient } from '@clothed-stability/ado-client';
import {
  loadSpecFromFile,
  selectWorkItems,
  planUpdates,
  executeUpdates,
  buildReport,
  printSummary,
  writeReport,
} from '@clothed-stability/bulk-updater';
import { createLogger } from '@clothed-stability/utils';

export function registerBulkUpdateCommand(program: Command): void {
  program
    .command('bulk-update')
    .description('Bulk update work items in place within an Azure DevOps project')
    .requiredOption('-c, --config <path>', 'Path to the migration config JSON file')
    .requiredOption('-s, --spec <path>', 'Path to the bulk update spec JSON file')
    .option('--dry-run', 'Force dry-run (overrides spec setting)', false)
    .option('--limit <n>', 'Maximum number of work items to process', parseInt)
    .option('--ids <ids>', 'Comma-separated work item IDs override')
    .option('--query <wiql>', 'WIQL query override')
    .option('--report <path>', 'Output report path', './bulk-update-report.json')
    .action(
      async (options: {
        config: string;
        spec: string;
        dryRun: boolean;
        limit?: number;
        ids?: string;
        query?: string;
        report: string;
      }) => {
        const config = loadConfigFromFile(options.config);
        const spec = loadSpecFromFile(options.spec);

        const logger = createLogger({ name: 'cli:bulk-update', level: config.execution.logLevel });

        const dryRun = options.dryRun || spec.options.dryRun;

        logger.info({ spec: options.spec, dryRun }, 'Starting bulk update');

        const pat = resolveAuth(config.source.auth);
        const client = new AdoClient({
          organizationUrl: config.source.organizationUrl,
          credentials: { pat },
        });

        const overrides: { limit?: number; ids?: number[]; wiql?: string } = {};
        if (options.limit !== undefined) overrides.limit = options.limit;
        if (options.ids) overrides.ids = options.ids.split(',').map((s) => parseInt(s.trim(), 10));
        if (options.query) overrides.wiql = options.query;

        const startedAt = new Date();

        const workItems = await selectWorkItems(client, spec.project, spec.selection, overrides);
        logger.info({ count: workItems.length }, 'Selected work items');

        const plans = planUpdates(workItems, spec);
        const plannedCount = plans.filter((p) => p.status === 'planned').length;
        const skippedCount = plans.filter((p) => p.status === 'skipped').length;
        logger.info({ planned: plannedCount, skipped: skippedCount }, 'Update plan computed');

        const results = await executeUpdates(
          client,
          spec.project,
          plans,
          {
            dryRun,
            concurrency: spec.options.batchSize,
            continueOnError: spec.options.continueOnError,
          },
          logger,
        );

        const completedAt = new Date();
        const report = buildReport(spec, dryRun, results, startedAt, completedAt);
        printSummary(report, logger);

        await writeReport(report, options.report);
        logger.info({ path: options.report }, 'Report written');

        if (report.summary.totalFailed > 0) {
          process.exit(1);
        }
      },
    );
}
