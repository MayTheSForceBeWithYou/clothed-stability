import type { Command } from 'commander';
import { createLogger } from '@clothed-stability/utils';

const logger = createLogger({ name: 'cli:migrate' });

export function registerMigrateCommand(program: Command): void {
  program
    .command('migrate')
    .description('Run the full migration from source to target Azure DevOps organization')
    .requiredOption('-c, --config <path>', 'Path to the migration config JSON file')
    .option('--dry-run', 'Perform a dry run without making any changes', false)
    .action((_options: { config: string; dryRun: boolean }) => {
      logger.info('migrate command is not implemented yet');
    });
}
