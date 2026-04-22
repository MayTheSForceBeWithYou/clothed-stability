import type { Command } from 'commander';
import { loadConfigFromFile, resolveAuth } from '@clothed-stability/core';
import { AdoClient } from '@clothed-stability/ado-client';
import { createLogger } from '@clothed-stability/utils';

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate a migration config file without running a migration')
    .requiredOption('-c, --config <path>', 'Path to the migration config JSON file')
    .action(async (options: { config: string }) => {
      const logger = createLogger({ name: 'cli:validate' });

      // Validate config schema
      let config;
      try {
        config = loadConfigFromFile(options.config);
        logger.info('Config schema is valid');
      } catch (err) {
        logger.error({ err }, 'Config validation failed');
        process.exit(1);
      }

      // Resolve auth tokens
      let sourcePat: string;
      let targetPat: string;
      try {
        sourcePat = resolveAuth(config.source.auth);
        targetPat = resolveAuth(config.target.auth);
      } catch (err) {
        logger.error({ err }, 'Auth resolution failed');
        process.exit(1);
      }

      // Test source connection
      const sourceClient = new AdoClient({
        organizationUrl: config.source.organizationUrl,
        credentials: { pat: sourcePat },
      });
      try {
        const projects = await sourceClient.listProjects();
        const found = projects.some((p) => p.name === config.source.project);
        if (!found) {
          logger.warn(
            { project: config.source.project },
            'Source project not found in organization',
          );
        } else {
          logger.info({ project: config.source.project }, 'Source project found');
        }
      } catch (err) {
        logger.error({ err, url: config.source.organizationUrl }, 'Source connection failed');
        process.exit(1);
      }

      // Test target connection
      const targetClient = new AdoClient({
        organizationUrl: config.target.organizationUrl,
        credentials: { pat: targetPat },
      });
      try {
        const projects = await targetClient.listProjects();
        const found = projects.some((p) => p.name === config.target.project);
        if (!found) {
          logger.warn(
            { project: config.target.project },
            'Target project not found in organization',
          );
        } else {
          logger.info({ project: config.target.project }, 'Target project found');
        }
      } catch (err) {
        logger.error({ err, url: config.target.organizationUrl }, 'Target connection failed');
        process.exit(1);
      }

      logger.info('Validation complete');
    });
}
