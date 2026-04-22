import { z } from 'zod';

const AuthSchema = z.object({
  type: z.literal('pat'),
  tokenEnvVar: z.string().min(1),
});

const OrgSchema = z.object({
  organizationUrl: z.string().url(),
  project: z.string().min(1),
  auth: AuthSchema,
});

export const MigrationConfigSchema = z.object({
  source: OrgSchema,
  target: OrgSchema,
  execution: z
    .object({
      dryRun: z.boolean().default(false),
      logLevel: z
        .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
        .default('info'),
      concurrency: z.number().int().min(1).max(10).default(2),
    })
    .default({}),
});

export type AuthConfig = z.infer<typeof AuthSchema>;
export type OrgConfig = z.infer<typeof OrgSchema>;
export type MigrationConfig = z.infer<typeof MigrationConfigSchema>;

export function parseMigrationConfig(raw: unknown): MigrationConfig {
  return MigrationConfigSchema.parse(raw);
}

export function resolveAuth(auth: AuthConfig): string {
  const token = process.env[auth.tokenEnvVar];
  if (!token) throw new Error(`Missing env var: ${auth.tokenEnvVar}`);
  return token;
}
