import { z } from 'zod';

/**
 * Schema for the migration configuration file.
 */
const MigrationAuthSchema = z.object({
  type: z.literal('pat'),
  tokenEnvVar: z.string().min(1),
});

const MigrationEndpointSchema = z.object({
  organizationUrl: z.string().url(),
  project: z.string().min(1),
  auth: MigrationAuthSchema,
});

const MigrationExecutionSchema = z
  .object({
    dryRun: z.boolean().default(false),
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    concurrency: z.number().int().min(1).default(1),
  })
  .default({});

export const MigrationConfigSchema = z.object({
  source: MigrationEndpointSchema,
  target: MigrationEndpointSchema,
  execution: MigrationExecutionSchema,
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
