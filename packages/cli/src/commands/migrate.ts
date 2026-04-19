import type { Command } from 'commander';
import { loadConfigFromFile } from '@clothed-stability/core';
import { createLogger } from '@clothed-stability/utils';

const logger = createLogger({ name: 'cli:migrate' });

export function registerMigrateCommand(program: Command): void {
  program
    .command('migrate')
    .description('Run the full migration from source to target Azure DevOps organization')
    .requiredOption('-c, --config <path>', 'Path to the migration config JSON file')
    .option('--dry-run', 'Perform a dry run without making any changes', false)
    .action((options: { config: string; dryRun: boolean }) => {
      const loadedConfig = loadConfigFromFile(options.config);
      const config =
        options.dryRun
          ? {
              ...loadedConfig,
              execution: {
                ...loadedConfig.execution,
                dryRun: true,
              },
            }
          : loadedConfig;
      logger.info({ config }, 'Loaded and validated migration config');
      logger.info('migrate command is not implemented yet');
    });
}
