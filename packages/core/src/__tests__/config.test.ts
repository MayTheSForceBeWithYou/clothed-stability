import { describe, it, expect } from 'vitest';
import { parseMigrationConfig } from '../config.js';

const validConfig = {
  source: {
    organizationUrl: 'https://dev.azure.com/source',
    project: 'SourceProject',
    auth: {
      type: 'pat',
      tokenEnvVar: 'ADO_SOURCE_PAT',
    },
  },
  target: {
    organizationUrl: 'https://dev.azure.com/target',
    project: 'TargetProject',
    auth: {
      type: 'pat',
      tokenEnvVar: 'ADO_TARGET_PAT',
    },
  },
  execution: {
    dryRun: true,
    logLevel: 'debug',
    concurrency: 2,
  },
};

describe('parseMigrationConfig', () => {
  it('parses a valid config', () => {
    const result = parseMigrationConfig(validConfig);
    expect(result.source.project).toBe('SourceProject');
    expect(result.execution.logLevel).toBe('debug');
  });

  it('applies execution defaults', () => {
    const result = parseMigrationConfig({
      source: validConfig.source,
      target: validConfig.target,
    });
    expect(result.execution).toEqual({
      dryRun: false,
      logLevel: 'info',
      concurrency: 1,
    });
  });

  it('rejects an invalid URL', () => {
    expect(() =>
      parseMigrationConfig({
        ...validConfig,
        source: {
          ...validConfig.source,
          organizationUrl: 'not-a-url',
        },
      }),
    ).toThrow();
  });

  it('rejects an invalid log level', () => {
    expect(() =>
      parseMigrationConfig({
        ...validConfig,
        execution: {
          ...validConfig.execution,
          logLevel: 'verbose',
        },
      }),
    ).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => parseMigrationConfig({})).toThrow();
  });
});
