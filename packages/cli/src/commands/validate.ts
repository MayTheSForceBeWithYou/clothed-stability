import type { Command } from 'commander';
import { createLogger } from '@clothed-stability/utils';

const logger = createLogger({ name: 'cli:validate' });

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate a migration config file without running a migration')
    .requiredOption('-c, --config <path>', 'Path to the migration config JSON file')
    .action((_options: { config: string }) => {
      logger.info('validate command is not implemented yet');
    });
}
