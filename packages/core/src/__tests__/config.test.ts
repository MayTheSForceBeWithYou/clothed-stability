import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseMigrationConfig, resolveAuth } from '../config.js';

const validConfig = {
  source: {
    organizationUrl: 'https://dev.azure.com/source',
    project: 'SourceProject',
    auth: {
      type: 'pat' as const,
      tokenEnvVar: 'ADO_SOURCE_PAT',
    },
  },
  target: {
    organizationUrl: 'https://dev.azure.com/target',
    project: 'TargetProject',
    auth: {
      type: 'pat' as const,
      tokenEnvVar: 'ADO_TARGET_PAT',
    },
  },
  execution: {
    dryRun: true,
    logLevel: 'debug' as const,
    concurrency: 2,
  },
};

describe('parseMigrationConfig', () => {
  it('parses a valid config', () => {
    const result = parseMigrationConfig(validConfig);
    expect(result.source.project).toBe('SourceProject');
    expect(result.target.project).toBe('TargetProject');
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

  it('accepts explicit execution options', () => {
    const result = parseMigrationConfig({
      ...validConfig,
      execution: { dryRun: true, logLevel: 'debug', concurrency: 5 },
    });
    expect(result.execution.dryRun).toBe(true);
    expect(result.execution.logLevel).toBe('debug');
    expect(result.execution.concurrency).toBe(5);
  });

  it('rejects an invalid organization URL', () => {
    expect(() =>
      parseMigrationConfig({
        ...validConfig,
        source: { ...validConfig.source, organizationUrl: 'not-a-url' },
      }),
    ).toThrow();
  });

  it('rejects an invalid log level', () => {
    expect(() =>
      parseMigrationConfig({
        ...validConfig,
        execution: {
          ...validConfig.execution,
          logLevel: 'invalid',
        },
      }),
    ).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => parseMigrationConfig({})).toThrow();
  });

  it('rejects invalid auth type', () => {
    expect(() =>
      parseMigrationConfig({
        ...validConfig,
        source: { ...validConfig.source, auth: { type: 'oauth', tokenEnvVar: 'X' } },
      }),
    ).toThrow();
  });

  it('rejects concurrency out of range', () => {
    expect(() =>
      parseMigrationConfig({
        ...validConfig,
        execution: { concurrency: 0 },
      }),
    ).toThrow();
  });
});

describe('resolveAuth', () => {
  beforeEach(() => {
    process.env['TEST_PAT'] = 'my-secret-token';
  });

  afterEach(() => {
    delete process.env['TEST_PAT'];
  });

  it('returns token from env var', () => {
    const token = resolveAuth({ type: 'pat', tokenEnvVar: 'TEST_PAT' });
    expect(token).toBe('my-secret-token');
  });

  it('throws when env var is missing', () => {
    expect(() => resolveAuth({ type: 'pat', tokenEnvVar: 'MISSING_VAR' })).toThrow(
      'Missing env var: MISSING_VAR',
    );
  });
});
