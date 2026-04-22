import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { info, mockRun, MockWorkItemMigrator, MockAdoClient } = vi.hoisted(() => {
  const mockRun = vi.fn().mockResolvedValue([]);
  const MockWorkItemMigrator = vi.fn().mockImplementation(() => ({ run: mockRun }));
  const MockAdoClient = vi.fn().mockImplementation(() => ({}));
  return { info: vi.fn(), mockRun, MockWorkItemMigrator, MockAdoClient };
});

vi.mock('@clothed-stability/utils', () => ({
  createLogger: (): { info: typeof info } => ({
    info,
  }),
}));

vi.mock('@clothed-stability/ado-client', () => ({
  AdoClient: MockAdoClient,
}));

vi.mock('@clothed-stability/migrators', () => ({
  WorkItemMigrator: MockWorkItemMigrator,
}));

import { registerMigrateCommand } from '../commands/migrate.js';

function createProgram(): Command {
  const program = new Command();
  program.name('ado-migrate').exitOverride();
  registerMigrateCommand(program);
  return program;
}

function writeConfig(content: string): { dir: string; filePath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'cli-config-test-'));
  const filePath = join(dir, 'config.json');
  writeFileSync(filePath, content, 'utf-8');
  return { dir, filePath };
}

afterEach(() => {
  info.mockReset();
  mockRun.mockReset();
  mockRun.mockResolvedValue([]);
});

describe('migrate command config integration', () => {
  beforeEach(() => {
    process.env['ADO_SOURCE_PAT'] = 'fake-source-pat';
    process.env['ADO_TARGET_PAT'] = 'fake-target-pat';
  });

  afterEach(() => {
    delete process.env['ADO_SOURCE_PAT'];
    delete process.env['ADO_TARGET_PAT'];
  });

  it('loads and validates config from --config', async () => {
    const { dir, filePath } = writeConfig(
      JSON.stringify({
        source: {
          organizationUrl: 'https://dev.azure.com/example-source',
          project: 'SourceProject',
          auth: {
            type: 'pat',
            tokenEnvVar: 'ADO_SOURCE_PAT',
          },
        },
        target: {
          organizationUrl: 'https://dev.azure.com/example-target',
          project: 'TargetProject',
          auth: {
            type: 'pat',
            tokenEnvVar: 'ADO_TARGET_PAT',
          },
        },
      }),
    );

    try {
      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'ado-migrate', 'migrate', '--config', filePath], {
          from: 'node',
        }),
      ).resolves.toBe(program);

      expect(info).toHaveBeenCalledWith(
        {
          config: {
            source: {
              organizationUrl: 'https://dev.azure.com/example-source',
              project: 'SourceProject',
              auth: {
                type: 'pat',
                tokenEnvVar: 'ADO_SOURCE_PAT',
              },
            },
            target: {
              organizationUrl: 'https://dev.azure.com/example-target',
              project: 'TargetProject',
              auth: {
                type: 'pat',
                tokenEnvVar: 'ADO_TARGET_PAT',
              },
            },
            execution: {
              dryRun: false,
              logLevel: 'info',
              concurrency: 1,
            },
          },
        },
        'Loaded and validated migration config',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails when config is invalid', async () => {
    const { dir, filePath } = writeConfig(
      JSON.stringify({
        source: {
          organizationUrl: 'not-a-url',
          project: 'SourceProject',
          auth: {
            type: 'pat',
            tokenEnvVar: 'ADO_SOURCE_PAT',
          },
        },
        target: {
          organizationUrl: 'https://dev.azure.com/example-target',
          project: 'TargetProject',
          auth: {
            type: 'pat',
            tokenEnvVar: 'ADO_TARGET_PAT',
          },
        },
      }),
    );

    try {
      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'ado-migrate', 'migrate', '--config', filePath], {
          from: 'node',
        }),
      ).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
