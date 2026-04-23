import { describe, it, expect, vi } from 'vitest';
import type { IAdoClient } from '@clothed-stability/ado-client';
import type { WorkItem } from '@clothed-stability/core';
import { selectWorkItems } from '../selector.js';

function makeItem(id: number): WorkItem {
  return { id, title: `Item ${String(id)}`, type: 'Task', state: 'Active' };
}

describe('selectWorkItems', () => {
  it('fetches by IDs and returns sorted items', async () => {
    const getWorkItemsByIds = vi.fn().mockResolvedValue([makeItem(3), makeItem(1), makeItem(2)]);
    const client = { getWorkItemsByIds } as unknown as IAdoClient;
    const items = await selectWorkItems(client, 'MyProject', { ids: [3, 1, 2] });
    expect(items.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(getWorkItemsByIds).toHaveBeenCalledWith('MyProject', [3, 1, 2]);
  });

  it('fetches by WIQL selection', async () => {
    const wiql = 'SELECT [System.Id] FROM WorkItems';
    const queryWorkItems = vi.fn().mockResolvedValue([makeItem(10), makeItem(5)]);
    const client = { queryWorkItems } as unknown as IAdoClient;
    const items = await selectWorkItems(client, 'MyProject', { wiql });
    expect(items.map((i) => i.id)).toEqual([5, 10]);
    expect(queryWorkItems).toHaveBeenCalledWith('MyProject', wiql);
  });

  it('unions IDs and WIQL results, de-duplicating', async () => {
    const getWorkItemsByIds = vi.fn().mockResolvedValue([makeItem(1), makeItem(2)]);
    const queryWorkItems = vi.fn().mockResolvedValue([makeItem(2), makeItem(3)]);
    const client = { getWorkItemsByIds, queryWorkItems } as unknown as IAdoClient;
    const items = await selectWorkItems(client, 'MyProject', {
      ids: [1, 2],
      wiql: 'SELECT ...',
    });
    expect(items.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('de-duplicates duplicate IDs in selection', async () => {
    const getWorkItemsByIds = vi.fn().mockResolvedValue([makeItem(5)]);
    const client = { getWorkItemsByIds } as unknown as IAdoClient;
    await selectWorkItems(client, 'MyProject', { ids: [5, 5, 5] });
    expect(getWorkItemsByIds).toHaveBeenCalledWith('MyProject', [5]);
  });

  it('applies limit override', async () => {
    const getWorkItemsByIds = vi.fn().mockResolvedValue([makeItem(1), makeItem(2), makeItem(3)]);
    const client = { getWorkItemsByIds } as unknown as IAdoClient;
    const items = await selectWorkItems(client, 'MyProject', { ids: [1, 2, 3] }, { limit: 2 });
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.id)).toEqual([1, 2]);
  });

  it('CLI ids override takes precedence over spec ids', async () => {
    const getWorkItemsByIds = vi.fn().mockResolvedValue([makeItem(99)]);
    const client = { getWorkItemsByIds } as unknown as IAdoClient;
    const items = await selectWorkItems(client, 'MyProject', { ids: [1, 2] }, { ids: [99] });
    expect(items.map((i) => i.id)).toEqual([99]);
    expect(getWorkItemsByIds).toHaveBeenCalledWith('MyProject', [99]);
  });

  it('sorting is deterministic ascending by ID', async () => {
    const queryWorkItems = vi.fn().mockResolvedValue([makeItem(100), makeItem(5), makeItem(50)]);
    const client = { queryWorkItems } as unknown as IAdoClient;
    const items = await selectWorkItems(client, 'MyProject', { wiql: 'SELECT ...' });
    expect(items.map((i) => i.id)).toEqual([5, 50, 100]);
  });
});
