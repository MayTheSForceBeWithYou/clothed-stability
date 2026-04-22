import { describe, it, expect } from 'vitest';
import type { WorkItem } from '@clothed-stability/core';
import { buildPatch } from '../patch-builder.js';
import type { UpdatePlan } from '../types.js';

function makePlan(workItem: Partial<WorkItem>, change: UpdatePlan['change']): UpdatePlan {
  return {
    workItem: {
      id: 1,
      title: 'Test',
      type: 'Task',
      state: 'Active',
      ...workItem,
    },
    status: 'planned',
    change,
  };
}

describe('buildPatch', () => {
  it('setField generates correct op', () => {
    const ops = buildPatch(makePlan({}, { setFields: { 'System.Priority': 2 } }));
    expect(ops).toContainEqual({ op: 'add', path: '/fields/System.Priority', value: 2 });
  });

  it('clearField generates op with null value', () => {
    const ops = buildPatch(makePlan({}, { clearFields: ['System.Description'] }));
    expect(ops).toContainEqual({ op: 'add', path: '/fields/System.Description', value: null });
  });

  it('addTags merges with existing tags and de-duplicates', () => {
    const ops = buildPatch(
      makePlan({ tags: ['alpha', 'beta'] }, { tagsToAdd: ['gamma', 'alpha'] }),
    );
    const tagOp = ops.find((o) => o.path === '/fields/System.Tags');
    expect(tagOp).toBeDefined();
    const tagValue = tagOp?.value;
    expect(typeof tagValue).toBe('string');
    const tags = (tagValue as string).split('; ');
    expect(tags).toContain('alpha');
    expect(tags).toContain('beta');
    expect(tags).toContain('gamma');
    expect(tags.filter((t) => t === 'alpha')).toHaveLength(1);
  });

  it('removeTags removes from existing tags case-insensitively', () => {
    const ops = buildPatch(
      makePlan({ tags: ['Alpha', 'Beta', 'Gamma'] }, { tagsToRemove: ['beta'] }),
    );
    const tagOp = ops.find((o) => o.path === '/fields/System.Tags');
    expect(tagOp).toBeDefined();
    const tags = (tagOp?.value as string).split('; ');
    expect(tags).toContain('Alpha');
    expect(tags).toContain('Gamma');
    expect(tags).not.toContain('Beta');
    expect(tags).not.toContain('beta');
  });

  it('mixed add/remove produces correct merged tags string', () => {
    const ops = buildPatch(
      makePlan(
        { tags: ['keep', 'remove-me'] },
        { tagsToAdd: ['new-tag'], tagsToRemove: ['remove-me'] },
      ),
    );
    const tagOp = ops.find((o) => o.path === '/fields/System.Tags');
    const tags = (tagOp?.value as string).split('; ');
    expect(tags).toContain('keep');
    expect(tags).toContain('new-tag');
    expect(tags).not.toContain('remove-me');
  });

  it('no tag changes → no tags op emitted', () => {
    const ops = buildPatch(makePlan({}, { setFields: { 'System.Priority': 1 } }));
    expect(ops.find((o) => o.path === '/fields/System.Tags')).toBeUndefined();
  });

  it('handles empty existing tags when adding', () => {
    const ops = buildPatch(makePlan({ tags: [] }, { tagsToAdd: ['new'] }));
    const tagOp = ops.find((o) => o.path === '/fields/System.Tags');
    expect(tagOp?.value).toBe('new');
  });

  it('handles undefined existing tags when adding', () => {
    const ops = buildPatch(makePlan({}, { tagsToAdd: ['new'] }));
    const tagOp = ops.find((o) => o.path === '/fields/System.Tags');
    expect(tagOp?.value).toBe('new');
  });
});
