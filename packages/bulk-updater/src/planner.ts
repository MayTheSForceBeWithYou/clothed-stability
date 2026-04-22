import type { WorkItem } from '@clothed-stability/core';
import type { BulkUpdateSpec } from './spec.js';
import type { UpdatePlan, UpdateChange } from './types.js';

const CLOSED_STATES = ['Closed', 'Done', 'Removed', 'Resolved'];

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
}

export function planUpdates(items: WorkItem[], spec: BulkUpdateSpec): UpdatePlan[] {
  const ops = spec.operations;
  const opts = spec.options;

  return items.map((item): UpdatePlan => {
    if (opts.skipClosedItems && CLOSED_STATES.includes(item.state)) {
      return { workItem: item, status: 'skipped', skipReason: 'closed', change: {} };
    }

    const change: UpdateChange = {};

    // Compute setFields — only those whose value differs from current
    if (ops.setFields && Object.keys(ops.setFields).length > 0) {
      const effectiveSet: Record<string, string | number | boolean | null> = {};
      const itemAsMap = item as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(ops.setFields)) {
        const currentValue = itemAsMap[key];
        if (currentValue !== value) {
          effectiveSet[key] = value;
        }
      }
      if (Object.keys(effectiveSet).length > 0) {
        change.setFields = effectiveSet;
      }
    }

    // Compute clearFields — only those not already null/undefined
    if (ops.clearFields && ops.clearFields.length > 0) {
      const itemAsMap = item as unknown as Record<string, unknown>;
      const effectiveClear = ops.clearFields.filter((key) => {
        const currentValue = itemAsMap[key];
        return currentValue !== null && currentValue !== undefined;
      });
      if (effectiveClear.length > 0) {
        change.clearFields = effectiveClear;
      }
    }

    // Compute tag changes
    const existingTags = normalizeTags(item.tags);
    const existingLower = existingTags.map((t) => t.toLowerCase());

    let tagsToAdd: string[] = [];
    let tagsToRemove: string[] = [];

    if (ops.addTags && ops.addTags.length > 0) {
      tagsToAdd = normalizeTags(ops.addTags).filter(
        (t) => !existingLower.includes(t.toLowerCase()),
      );
    }

    if (ops.removeTags && ops.removeTags.length > 0) {
      tagsToRemove = normalizeTags(ops.removeTags).filter((t) =>
        existingLower.includes(t.toLowerCase()),
      );
    }

    // markerTag always produces a change
    if (opts.markerTag) {
      const marker = opts.markerTag.trim();
      if (marker && !existingLower.includes(marker.toLowerCase())) {
        tagsToAdd = [...new Set([...tagsToAdd, marker])];
      }
    }

    if (tagsToAdd.length > 0) change.tagsToAdd = tagsToAdd;
    if (tagsToRemove.length > 0) change.tagsToRemove = tagsToRemove;

    const hasChanges =
      (change.setFields && Object.keys(change.setFields).length > 0) ||
      (change.clearFields && change.clearFields.length > 0) ||
      (change.tagsToAdd && change.tagsToAdd.length > 0) ||
      (change.tagsToRemove && change.tagsToRemove.length > 0);

    if (!hasChanges) {
      return { workItem: item, status: 'skipped', skipReason: 'no-op', change: {} };
    }

    return { workItem: item, status: 'planned', change };
  });
}
