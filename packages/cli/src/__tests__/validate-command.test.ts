import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

const { info, error, validateConnection, createAdoClient } = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  validateConnection: vi.fn(() => Promise.resolve()),
  createAdoClient: vi.fn(),
}));

vi.mock('@clothed-stability/utils', () => ({
  createLogger: (): { info: typeof info; error: typeof error } => ({
    info,
    error,
  }),
}));

vi.mock('@clothed-stability/ado-client', () => ({
  createAdoClient,
}));

import { registerValidateCommand } from '../commands/validate.js';

function writeConfig(content: string): { dir: string; filePath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'cli-validate-test-'));
  const filePath = join(dir, 'config.json');
  writeFileSync(filePath, content, 'utf-8');
  return { dir, filePath };
}

function createProgram(): Command {
  const program = new Command();
  program.name('ado-migrate').exitOverride();
  registerValidateCommand(program);
  return program;
}

beforeEach(() => {
  info.mockReset();
  error.mockReset();
  validateConnection.mockReset();
  createAdoClient.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('validate command', () => {
  it('loads config and validates source and target connections', async () => {
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
      validateConnection.mockResolvedValue(undefined);
      createAdoClient.mockReturnValue({ validateConnection });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'ado-migrate', 'validate', '--config', filePath], {
          from: 'node',
        }),
      ).resolves.toBe(program);

      expect(createAdoClient).toHaveBeenCalledTimes(2);
      expect(validateConnection).toHaveBeenCalledTimes(2);
      expect(info).toHaveBeenCalledWith('Source and target Azure DevOps connections are valid');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails when PAT env var is missing', async () => {
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
      createAdoClient
        .mockReturnValueOnce({ validateConnection: vi.fn().mockResolvedValue(undefined) })
        .mockImplementationOnce(() => {
          throw new Error('Missing required PAT environment variable: ADO_TARGET_PAT');
        });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'ado-migrate', 'validate', '--config', filePath], {
          from: 'node',
        }),
      ).rejects.toThrow('Missing required PAT environment variable: ADO_TARGET_PAT');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
