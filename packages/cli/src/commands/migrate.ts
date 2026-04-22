import type { Command } from 'commander';
import { loadConfigFromFile, resolveAuth } from '@clothed-stability/core';
import { AdoClient } from '@clothed-stability/ado-client';
import { WorkItemMigrator } from '@clothed-stability/migrators';
import { createLogger } from '@clothed-stability/utils';

export function registerMigrateCommand(program: Command): void {
  program
    .command('migrate')
    .description('Run the full migration from source to target Azure DevOps organization')
    .requiredOption('-c, --config <path>', 'Path to the migration config JSON file')
    .option('--dry-run', 'Perform a dry run without making any changes', false)
    .action(async (options: { config: string; dryRun: boolean }) => {
      const config = loadConfigFromFile(options.config);
      const dryRun = options.dryRun || config.execution.dryRun;

      const logger = createLogger({ name: 'cli:migrate', level: config.execution.logLevel });

      logger.info({ config }, 'Loaded and validated migration config');
      logger.info({ dryRun }, 'Starting migration');

      const sourcePat = resolveAuth(config.source.auth);
      const targetPat = resolveAuth(config.target.auth);

      const sourceClient = new AdoClient({
        organizationUrl: config.source.organizationUrl,
        pat: sourcePat,
      });
      const targetClient = new AdoClient({
        organizationUrl: config.target.organizationUrl,
        pat: targetPat,
      });

      const migrator = new WorkItemMigrator(
        sourceClient,
        config.source.project,
        targetClient,
        config.target.project,
        logger,
        config.execution.concurrency,
      );

      const results = await migrator.run(dryRun);

      const succeeded = results.filter((r) => r.status === 'completed').length;
      const failed = results.filter((r) => r.status === 'failed').length;
      const skipped = results.filter((r) => r.status === 'skipped').length;

      console.log(`\nMigration summary:`);
      console.log(`  Total:     ${results.length}`);
      console.log(`  Succeeded: ${succeeded}`);
      console.log(`  Skipped:   ${skipped}`);
      console.log(`  Failed:    ${failed}`);

      if (failed > 0) {
        process.exit(1);
      }
    });
}
