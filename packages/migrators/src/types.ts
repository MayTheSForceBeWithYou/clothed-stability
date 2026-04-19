import type { MigrationResult } from '@clothed-stability/core';

/**
 * Interface that all migrator implementations must satisfy.
 */
export interface IMigrator {
  /** Human-readable name of this migrator */
  readonly name: string;

  /**
   * Run the migration.
   * @param dryRun  When true, no writes are performed.
   */
  run(dryRun: boolean): Promise<MigrationResult[]>;
}
