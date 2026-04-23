import { describe, it, expect } from 'vitest';
import type { WorkItem } from '@clothed-stability/core';
import { planUpdates } from '../planner.js';
import type { BulkUpdateSpec } from '../spec.js';

function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 1,
    title: 'Test Item',
    type: 'Task',
    state: 'Active',
    ...overrides,
  };
}

function makeSpec(overrides: Partial<BulkUpdateSpec> = {}): BulkUpdateSpec {
  return {
    project: 'MyProject',
    selection: { ids: [1] },
    operations: { setFields: { 'System.Priority': 2 } },
    options: {
      dryRun: true,
      skipClosedItems: true,
      continueOnError: true,
      batchSize: 25,
    },
    ...overrides,
  };
}

describe('planUpdates', () => {
  it('skips closed item when skipClosedItems is true', () => {
    const item = makeItem({ state: 'Closed' });
    const [plan] = planUpdates([item], makeSpec());
    expect(plan?.status).toBe('skipped');
    expect(plan?.skipReason).toBe('closed');
  });

  it('does NOT skip closed item when skipClosedItems is false', () => {
    const item = makeItem({ state: 'Done' });
    const [plan] = planUpdates(
      [item],
      makeSpec({ options: { dryRun: true, skipClosedItems: false, continueOnError: true, batchSize: 25 } }),
    );
    expect(plan?.status).toBe('planned');
  });

  it('skips as no-op when field already has requested value', () => {
    const item = { ...makeItem(), 'System.Priority': 2 } as unknown as WorkItem;
    const spec = makeSpec({ operations: { setFields: { 'System.Priority': 2 } } });
    const [plan] = planUpdates([item], spec);
    expect(plan?.status).toBe('skipped');
    expect(plan?.skipReason).toBe('no-op');
  });

  it('skips tag add if tag already present', () => {
    const item = makeItem({ tags: ['important', 'review'] });
    const spec = makeSpec({ operations: { addTags: ['important'] } });
    const [plan] = planUpdates([item], spec);
    expect(plan?.status).toBe('skipped');
    expect(plan?.skipReason).toBe('no-op');
  });

  it('skips tag remove if tag not present', () => {
    const item = makeItem({ tags: ['alpha'] });
    const spec = makeSpec({ operations: { removeTags: ['beta'] } });
    const [plan] = planUpdates([item], spec);
    expect(plan?.status).toBe('skipped');
  });

  it('produces planned status for effective change', () => {
    const item = makeItem({ tags: ['old'] });
    const spec = makeSpec({ operations: { addTags: ['new-tag'] } });
    const [plan] = planUpdates([item], spec);
    expect(plan?.status).toBe('planned');
    expect(plan?.change.tagsToAdd).toContain('new-tag');
  });

  it('markerTag always causes a change even if no other ops match', () => {
    const item = makeItem({ tags: [] });
    const specWithMarker: BulkUpdateSpec = {
      project: 'MyProject',
      selection: { ids: [1] },
      operations: { addTags: ['placeholder'] },
      options: {
        dryRun: true,
        skipClosedItems: true,
        continueOnError: true,
        batchSize: 25,
        markerTag: 'bulk-run',
      },
    };
    const [plan] = planUpdates([item], specWithMarker);
    expect(plan?.status).toBe('planned');
    expect(plan?.change.tagsToAdd).toContain('bulk-run');
  });

  it('markerTag not added if already present', () => {
    const item = makeItem({ tags: ['bulk-run'] });
    const specWithMarker: BulkUpdateSpec = {
      project: 'MyProject',
      selection: { ids: [1] },
      operations: { setFields: { 'System.Priority': 99 } },
      options: {
        dryRun: true,
        skipClosedItems: true,
        continueOnError: true,
        batchSize: 25,
        markerTag: 'bulk-run',
      },
    };
    const [plan] = planUpdates([item], specWithMarker);
    expect(plan?.change.tagsToAdd).toBeUndefined();
  });

  it('handles Done, Removed, Resolved as closed states', () => {
    for (const state of ['Done', 'Removed', 'Resolved']) {
      const item = makeItem({ state });
      const [plan] = planUpdates([item], makeSpec());
      expect(plan?.status).toBe('skipped');
    }
  });

  it('clearFields skips fields already null/undefined', () => {
    const item = makeItem(); // no 'description' field
    const spec = makeSpec({ operations: { clearFields: ['description'] } });
    const [plan] = planUpdates([item], spec);
    expect(plan?.status).toBe('skipped');
  });
});
