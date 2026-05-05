import type { Command } from 'commander';
import { MigrationJournal } from '@clothed-stability/core';
import type { MigrationMapping } from '@clothed-stability/core';

export function registerJournalCommand(program: Command): void {
  const journalCmd = program
    .command('journal')
    .description('Manage the migration journal');

  journalCmd
    .command('inspect')
    .description('Print a summary of the migration journal')
    .option(
      '-f, --file <path>',
      'Path to the migration journal JSON file',
      './output/migration-journal.json',
    )
    .option('--list', 'List all individual mappings', false)
    .action((options: { file: string; list: boolean }) => {
      const journal = new MigrationJournal(options.file);

      try {
        journal.load();
      } catch (err) {
        console.error(`Error loading journal: ${String(err)}`);
        process.exit(1);
      }

      const mappings = journal.getAllMappings();

      console.log('\nMigration Journal');
      console.log(`  File:  ${options.file}`);
      console.log(`  Total: ${String(mappings.length)}`);

      if (mappings.length > 0) {
        const byStatus = mappings.reduce<Record<string, number>>((acc, m: MigrationMapping) => {
          acc[m.status] = (acc[m.status] ?? 0) + 1;
          return acc;
        }, {});

        console.log('\nBy status:');
        for (const [status, count] of Object.entries(byStatus).sort()) {
          console.log(`  ${status}: ${String(count)}`);
        }
      }

      if (options.list && mappings.length > 0) {
        console.log('\nMappings (sorted by sourceId):');
        for (const m of mappings) {
          console.log(
            `  ${String(m.sourceId).padStart(6)} → ${String(m.targetId).padEnd(6)}  [${m.type}]  ${m.status}  ${m.migratedAt}`,
          );
        }
      }
    });
}
