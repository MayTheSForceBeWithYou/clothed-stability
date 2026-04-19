import type { Command } from 'commander';
import { loadConfigFromFile } from '@clothed-stability/core';
import { createAdoClient } from '@clothed-stability/ado-client';
import { createLogger } from '@clothed-stability/utils';

const logger = createLogger({ name: 'cli:validate' });

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate a migration config file without running a migration')
    .requiredOption('-c, --config <path>', 'Path to the migration config JSON file')
    .action(async (options: { config: string }) => {
      const config = loadConfigFromFile(options.config);
      logger.info({ configPath: options.config }, 'Loaded and validated migration config');

      await validateEndpointConnection(
        'source',
        config.source.organizationUrl,
        config.source.auth.tokenEnvVar,
      );
      await validateEndpointConnection(
        'target',
        config.target.organizationUrl,
        config.target.auth.tokenEnvVar,
      );

      logger.info('Source and target Azure DevOps connections are valid');
    });
}

async function validateEndpointConnection(
  endpoint: 'source' | 'target',
  organizationUrl: string,
  patEnvVar: string,
): Promise<void> {
  const client = createAdoClient({
    organizationUrl,
    patEnvVar,
  });

  try {
    await client.validateConnection();
    logger.info({ endpoint, organizationUrl }, 'Azure DevOps connection validated');
  } catch (error: unknown) {
    logger.error(
      {
        endpoint,
        organizationUrl,
        error: error instanceof Error ? error.message : String(error),
      },
      'Azure DevOps connection validation failed',
    );
    throw error;
  }
}
