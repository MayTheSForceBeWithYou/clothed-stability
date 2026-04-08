import { z } from 'zod';

/**
 * Schema for the migration configuration file.
 */
export const MigrationConfigSchema = z.object({
  /** Display name for this migration run */
  name: z.string().min(1),
  /** Source Azure DevOps organization URL */
  sourceOrganizationUrl: z.string().url(),
  /** Target Azure DevOps organization URL */
  targetOrganizationUrl: z.string().url(),
  /** Source project name */
  sourceProject: z.string().min(1),
  /** Target project name */
  targetProject: z.string().min(1),
  /** Whether to perform a dry run (no writes) */
  dryRun: z.boolean().default(false),
  /** Optional list of work-item types to migrate */
  workItemTypes: z.array(z.string()).optional(),
});

export type MigrationConfig = z.infer<typeof MigrationConfigSchema>;

/**
 * Parses and validates a raw configuration object.
 *
 * @param raw  Unknown input (e.g. parsed JSON).
 * @returns    Validated MigrationConfig.
 * @throws     ZodError if validation fails.
 */
export function parseMigrationConfig(raw: unknown): MigrationConfig {
  return MigrationConfigSchema.parse(raw);
}
