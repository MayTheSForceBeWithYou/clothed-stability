#!/usr/bin/env node
import { Command } from 'commander';
import { registerMigrateCommand } from './commands/migrate.js';
import { registerValidateCommand } from './commands/validate.js';
import { registerDryRunCommand } from './commands/dry-run.js';
import { registerBulkUpdateCommand } from './commands/bulk-update.js';
import { registerJournalCommand } from './commands/journal.js';

const program = new Command();

program
  .name('ado-migrate')
  .description('Azure DevOps migration tool')
  .version('0.0.1');

registerMigrateCommand(program);
registerValidateCommand(program);
registerDryRunCommand(program);
registerBulkUpdateCommand(program);
registerJournalCommand(program);

program.parse(process.argv);
