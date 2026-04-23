import type { WorkItem } from '@clothed-stability/core';
import type { IAdoClient } from '@clothed-stability/ado-client';
import type { BulkUpdateSpec } from './spec.js';

interface SelectorOverrides {
  limit?: number;
  ids?: number[];
  wiql?: string;
}

export async function selectWorkItems(
  client: IAdoClient,
  project: string,
  selection: BulkUpdateSpec['selection'],
  overrides: SelectorOverrides = {},
): Promise<WorkItem[]> {
  const effectiveIds = overrides.ids ?? selection.ids;
  const effectiveWiql = overrides.wiql ?? selection.wiql;

  const byIdMap = new Map<number, WorkItem>();
  const byWiqlMap = new Map<number, WorkItem>();

  if (effectiveIds && effectiveIds.length > 0) {
    const deduped = [...new Set(effectiveIds)];
    const items = await client.getWorkItemsByIds(project, deduped);
    for (const item of items) {
      byIdMap.set(item.id, item);
    }
  }

  if (effectiveWiql) {
    const items = await client.queryWorkItems(project, effectiveWiql);
    for (const item of items) {
      byWiqlMap.set(item.id, item);
    }
  }

  const merged = new Map<number, WorkItem>([...byIdMap, ...byWiqlMap]);

  let result = [...merged.values()].sort((a, b) => a.id - b.id);

  if (overrides.limit !== undefined && overrides.limit > 0) {
    result = result.slice(0, overrides.limit);
  }

  return result;
}
