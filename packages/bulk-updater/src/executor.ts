import type { IAdoClient } from '@clothed-stability/ado-client';
import type { Logger } from '@clothed-stability/utils';
import type { UpdatePlan, UpdateResult } from './types.js';

export interface ExecuteOptions {
  dryRun: boolean;
  concurrency: number;
  continueOnError: boolean;
}

export async function executeUpdates(
  client: IAdoClient,
  project: string,
  plans: UpdatePlan[],
  opts: ExecuteOptions,
  logger: Logger,
): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];

  await runWithConcurrency(plans, opts.concurrency, async (plan) => {
    const item = plan.workItem;

    if (plan.status === 'skipped') {
      const result: UpdateResult = { id: item.id, title: item.title, type: item.type, status: 'skipped' };
      if (plan.skipReason !== undefined) result.skipReason = plan.skipReason;
      results.push(result);
      return;
    }

    if (opts.dryRun) {
      logger.info({ id: item.id, title: item.title }, '[dry-run] Would update work item');
      results.push({ id: item.id, title: item.title, type: item.type, status: 'updated' });
      return;
    }

    try {
      const fields = buildFieldsFromChange(plan);
      await client.updateWorkItem(project, item.id, fields);
      logger.info({ id: item.id, title: item.title }, 'Updated work item');
      results.push({ id: item.id, title: item.title, type: item.type, status: 'updated' });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error({ id: item.id, error }, 'Failed to update work item');

      if (!opts.continueOnError) {
        throw err;
      }

      results.push({ id: item.id, title: item.title, type: item.type, status: 'failed', error });
    }
  });

  return results;
}

function buildFieldsFromChange(
  plan: UpdatePlan,
): Record<string, string | number | boolean | null> {
  const fields: Record<string, string | number | boolean | null> = {};
  const change = plan.change;

  if (change.setFields) {
    Object.assign(fields, change.setFields);
  }

  if (change.clearFields) {
    for (const key of change.clearFields) {
      fields[key] = null;
    }
  }

  const hastagsToAdd = change.tagsToAdd && change.tagsToAdd.length > 0;
  const hasTagsToRemove = change.tagsToRemove && change.tagsToRemove.length > 0;

  if (hastagsToAdd || hasTagsToRemove) {
    const existing = (plan.workItem.tags ?? []).map((t) => t.trim()).filter(Boolean);
    const removeLower = new Set((change.tagsToRemove ?? []).map((t) => t.toLowerCase()));
    const merged = existing.filter((t) => !removeLower.has(t.toLowerCase()));
    for (const tag of change.tagsToAdd ?? []) {
      const trimmed = tag.trim();
      if (trimmed && !merged.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
        merged.push(trimmed);
      }
    }
    fields['System.Tags'] = merged.join('; ');
  }

  return fields;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const item = items[index++];
      if (item === undefined) break;
      await fn(item);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
}
