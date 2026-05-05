import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { z } from 'zod';

/**
 * Status of a migrated work item.
 */
export type MappingStatus = 'migrated' | 'pending' | 'failed' | 'skipped';

/**
 * Represents a single source-to-target ID mapping recorded in the journal.
 */
export interface MigrationMapping {
  sourceId: number;
  targetId: number;
  type: string;
  migratedAt: string;
  status: MappingStatus;
}

/**
 * Options for adding a new mapping.
 */
export interface AddMappingOptions {
  type: string;
  status?: MappingStatus;
}

// --- Internal Zod schemas ---

const MappingStatusSchema = z.enum(['migrated', 'pending', 'failed', 'skipped']);

const MigrationMappingSchema = z.object({
  sourceId: z.number().int().positive(),
  targetId: z.number().int().positive(),
  type: z.string().min(1),
  migratedAt: z.string().min(1),
  status: MappingStatusSchema,
});

const JournalDataSchema = z.object({
  version: z.literal(1),
  mappings: z.array(MigrationMappingSchema),
});

type JournalData = z.infer<typeof JournalDataSchema>;

/**
 * Persistent migration journal that tracks source-to-target work item ID mappings.
 *
 * - Stores mappings as a sorted JSON file on disk.
 * - Writes atomically (temp file + rename) to avoid corruption.
 * - Supports idempotent `addMapping` calls: re-adding the same mapping is a no-op.
 * - Rejects conflicting mappings (same sourceId, different targetId).
 */
export class MigrationJournal {
  private readonly filePath: string;
  private mappings: Map<number, MigrationMapping> = new Map();

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
  }

  /**
   * Add a mapping from sourceId to targetId.
   *
   * - If the exact same mapping already exists, returns the existing entry (idempotent).
   * - If a conflicting mapping exists (same sourceId, different targetId), throws.
   */
  addMapping(sourceId: number, targetId: number, options: AddMappingOptions): MigrationMapping {
    const existing = this.mappings.get(sourceId);

    if (existing !== undefined) {
      if (existing.targetId === targetId) {
        // Idempotent: same mapping already recorded.
        return existing;
      }
      throw new Error(
        `Conflicting mapping for sourceId ${String(sourceId)}: ` +
          `existing targetId=${String(existing.targetId)}, new targetId=${String(targetId)}`,
      );
    }

    const mapping: MigrationMapping = {
      sourceId,
      targetId,
      type: options.type,
      migratedAt: new Date().toISOString(),
      status: options.status ?? 'migrated',
    };

    this.mappings.set(sourceId, mapping);
    return mapping;
  }

  /**
   * Return the target ID for the given source ID, or `undefined` if not mapped.
   */
  getTargetId(sourceId: number): number | undefined {
    return this.mappings.get(sourceId)?.targetId;
  }

  /**
   * Return `true` if the source ID already has a mapping.
   */
  hasMapping(sourceId: number): boolean {
    return this.mappings.has(sourceId);
  }

  /**
   * Return the full mapping record for the given source ID, or `undefined`.
   */
  getMapping(sourceId: number): MigrationMapping | undefined {
    return this.mappings.get(sourceId);
  }

  /**
   * Return all mappings sorted deterministically by sourceId.
   */
  getAllMappings(): MigrationMapping[] {
    return [...this.mappings.values()].sort((a, b) => a.sourceId - b.sourceId);
  }

  /**
   * Load mappings from disk.
   *
   * - If the file does not exist, the journal starts empty (no error).
   * - If the file is present but corrupted or invalid, throws a descriptive error.
   */
  load(): void {
    if (!existsSync(this.filePath)) {
      this.mappings = new Map();
      return;
    }

    let content: string;
    try {
      content = readFileSync(this.filePath, 'utf-8');
    } catch (err) {
      throw new Error(
        `Failed to read migration journal from "${this.filePath}": ${String(err)}`,
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(content) as unknown;
    } catch (err) {
      throw new Error(
        `Migration journal at "${this.filePath}" contains invalid JSON: ${String(err)}`,
      );
    }

    let data: JournalData;
    try {
      data = JournalDataSchema.parse(raw);
    } catch (err) {
      throw new Error(
        `Migration journal at "${this.filePath}" has an unexpected structure: ${String(err)}`,
      );
    }

    this.mappings = new Map(data.mappings.map((m) => [m.sourceId, m]));
  }

  /**
   * Persist mappings to disk atomically.
   *
   * Writes to a `.tmp` file first, then renames it to the final path to prevent
   * partial writes from corrupting the journal.
   */
  save(): void {
    const data: JournalData = {
      version: 1,
      mappings: this.getAllMappings(),
    };

    const json = `${JSON.stringify(data, null, 2)}\n`;
    const dir = dirname(this.filePath);
    const tmpPath = `${this.filePath}.tmp`;

    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(tmpPath, json, { encoding: 'utf-8' });
      renameSync(tmpPath, this.filePath);
    } catch (err) {
      throw new Error(
        `Failed to save migration journal to "${this.filePath}": ${String(err)}`,
      );
    }
  }
}
