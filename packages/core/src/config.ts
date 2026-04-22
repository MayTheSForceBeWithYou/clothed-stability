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
    concurrency: z.number().int().min(1).max(10).default(1),
  })
  .default({});

export const MigrationConfigSchema = z.object({
  source: MigrationEndpointSchema,
  target: MigrationEndpointSchema,
  execution: MigrationExecutionSchema,
});

export type AuthConfig = z.infer<typeof MigrationAuthSchema>;
export type OrgConfig = z.infer<typeof MigrationEndpointSchema>;
export type MigrationConfig = z.infer<typeof MigrationConfigSchema>;

export function parseMigrationConfig(raw: unknown): MigrationConfig {
  return MigrationConfigSchema.parse(raw);
}

export function resolveAuth(auth: AuthConfig): string {
  const token = process.env[auth.tokenEnvVar];
  if (!token) throw new Error(`Missing env var: ${auth.tokenEnvVar}`);
  return token;
}
