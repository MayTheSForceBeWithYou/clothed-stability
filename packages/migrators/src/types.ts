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

/**
 * Interface for read-only extractors.
 */
export interface IExtractor<TResource> {
  /** Human-readable name of this extractor */
  readonly name: string;

  /** Read and return resources from the source system */
  extract(): Promise<TResource[]>;
}
