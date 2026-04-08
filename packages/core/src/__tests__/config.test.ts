import { describe, it, expect } from 'vitest';
import { parseMigrationConfig } from '../config.js';

const validConfig = {
  name: 'Test Migration',
  sourceOrganizationUrl: 'https://dev.azure.com/source',
  targetOrganizationUrl: 'https://dev.azure.com/target',
  sourceProject: 'src-project',
  targetProject: 'tgt-project',
};

describe('parseMigrationConfig', () => {
  it('parses a valid config', () => {
    const result = parseMigrationConfig(validConfig);
    expect(result.name).toBe('Test Migration');
    expect(result.dryRun).toBe(false);
  });

  it('applies default dryRun: false', () => {
    const result = parseMigrationConfig(validConfig);
    expect(result.dryRun).toBe(false);
  });

  it('accepts dryRun: true', () => {
    const result = parseMigrationConfig({ ...validConfig, dryRun: true });
    expect(result.dryRun).toBe(true);
  });

  it('accepts optional workItemTypes', () => {
    const result = parseMigrationConfig({ ...validConfig, workItemTypes: ['Bug', 'Task'] });
    expect(result.workItemTypes).toEqual(['Bug', 'Task']);
  });

  it('rejects an invalid URL', () => {
    expect(() =>
      parseMigrationConfig({ ...validConfig, sourceOrganizationUrl: 'not-a-url' }),
    ).toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => parseMigrationConfig({})).toThrow();
  });
});
