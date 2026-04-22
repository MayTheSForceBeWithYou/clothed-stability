import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseMigrationConfig, resolveAuth } from '../config.js';

const validAuth = { type: 'pat' as const, tokenEnvVar: 'ADO_PAT' };

const validConfig = {
  source: {
    organizationUrl: 'https://dev.azure.com/source-org',
    project: 'SourceProject',
    auth: validAuth,
  },
  target: {
    organizationUrl: 'https://dev.azure.com/target-org',
    project: 'TargetProject',
    auth: validAuth,
  },
};

describe('parseMigrationConfig', () => {
  it('parses a valid config', () => {
    const result = parseMigrationConfig(validConfig);
    expect(result.source.project).toBe('SourceProject');
    expect(result.target.project).toBe('TargetProject');
  });

  it('applies execution defaults', () => {
    const result = parseMigrationConfig(validConfig);
    expect(result.execution.dryRun).toBe(false);
    expect(result.execution.logLevel).toBe('info');
    expect(result.execution.concurrency).toBe(2);
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
