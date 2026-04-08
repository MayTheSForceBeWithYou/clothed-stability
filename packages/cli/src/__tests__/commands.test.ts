import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerMigrateCommand } from '../commands/migrate.js';
import { registerValidateCommand } from '../commands/validate.js';
import { registerDryRunCommand } from '../commands/dry-run.js';

function buildProgram(): Command {
  const program = new Command();
  program.name('ado-migrate').exitOverride();
  registerMigrateCommand(program);
  registerValidateCommand(program);
  registerDryRunCommand(program);
  return program;
}

describe('CLI commands registration', () => {
  it('registers the migrate command', () => {
    const program = buildProgram();
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('migrate');
  });

  it('registers the validate command', () => {
    const program = buildProgram();
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('validate');
  });

  it('registers the dry-run command', () => {
    const program = buildProgram();
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('dry-run');
  });

  it('migrate command has --config option', () => {
    const program = buildProgram();
    const migrate = program.commands.find((c) => c.name() === 'migrate');
    expect(migrate).toBeDefined();
    const optionNames = migrate?.options.map((o) => o.long) ?? [];
    expect(optionNames).toContain('--config');
  });

  it('migrate command has --dry-run option', () => {
    const program = buildProgram();
    const migrate = program.commands.find((c) => c.name() === 'migrate');
    const optionNames = migrate?.options.map((o) => o.long) ?? [];
    expect(optionNames).toContain('--dry-run');
  });
});
