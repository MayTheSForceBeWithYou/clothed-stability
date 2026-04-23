import type { UpdatePlan } from './types.js';

export interface JsonPatchOp {
  op: 'add';
  path: string;
  value: string | number | boolean | null;
}

export function buildPatch(plan: UpdatePlan): JsonPatchOp[] {
  const ops: JsonPatchOp[] = [];
  const change = plan.change;

  if (change.setFields) {
    for (const [key, value] of Object.entries(change.setFields)) {
      ops.push({ op: 'add', path: `/fields/${key}`, value });
    }
  }

  if (change.clearFields) {
    for (const key of change.clearFields) {
      ops.push({ op: 'add', path: `/fields/${key}`, value: null });
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

    ops.push({ op: 'add', path: '/fields/System.Tags', value: merged.join('; ') });
  }

  return ops;
}
