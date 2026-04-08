import type { Command } from 'commander';
import { createLogger } from '@clothed-stability/utils';

const logger = createLogger({ name: 'cli:dry-run' });

export function registerDryRunCommand(program: Command): void {
  program
    .command('dry-run')
    .description('Preview what a migration would do without making any changes')
    .requiredOption('-c, --config <path>', 'Path to the migration config JSON file')
    .action((_options: { config: string }) => {
      logger.info('dry-run command is not implemented yet');
    });
}
