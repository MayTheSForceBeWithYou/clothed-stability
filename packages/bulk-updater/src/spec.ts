import { z } from 'zod';
import { readFileSync } from 'fs';

export const BulkUpdateSpecSchema = z.object({
  project: z.string().min(1),
  selection: z
    .object({
      ids: z.array(z.number().int().min(1)).optional(),
      wiql: z.string().optional(),
    })
    .refine((s) => s.ids !== undefined || s.wiql !== undefined, {
      message: 'At least one of ids or wiql must be provided',
    }),
  operations: z
    .object({
      setFields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
      clearFields: z.array(z.string()).optional(),
      addTags: z.array(z.string()).optional(),
      removeTags: z.array(z.string()).optional(),
    })
    .refine(
      (o) =>
        (o.setFields !== undefined && Object.keys(o.setFields).length > 0) ||
        (o.clearFields !== undefined && o.clearFields.length > 0) ||
        (o.addTags !== undefined && o.addTags.length > 0) ||
        (o.removeTags !== undefined && o.removeTags.length > 0),
      { message: 'At least one operation must be specified' },
    ),
  options: z
    .object({
      dryRun: z.boolean().default(true),
      skipClosedItems: z.boolean().default(true),
      continueOnError: z.boolean().default(true),
      batchSize: z.number().int().min(1).max(200).default(25),
      markerTag: z.string().optional(),
    })
    .default({}),
});

export type BulkUpdateSpec = z.infer<typeof BulkUpdateSpecSchema>;
export type BulkUpdateOptions = NonNullable<BulkUpdateSpec['options']>;

export function parseBulkUpdateSpec(raw: unknown): BulkUpdateSpec {
  return BulkUpdateSpecSchema.parse(raw);
}

export function loadSpecFromFile(path: string): BulkUpdateSpec {
  const content = readFileSync(path, 'utf-8');
  return parseBulkUpdateSpec(JSON.parse(content));
}
