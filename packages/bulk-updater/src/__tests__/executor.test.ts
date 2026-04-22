import { describe, it, expect, vi } from 'vitest';
import type { IAdoClient } from '@clothed-stability/ado-client';
import type { WorkItem } from '@clothed-stability/core';
import type { Logger } from '@clothed-stability/utils';
import { executeUpdates } from '../executor.js';
import type { UpdatePlan } from '../types.js';

function makeItem(id: number): WorkItem {
  return { id, title: `Item ${String(id)}`, type: 'Task', state: 'Active' };
}

function makePlan(id: number, status: UpdatePlan['status'] = 'planned'): UpdatePlan {
  return {
    workItem: makeItem(id),
    status,
    change: { setFields: { 'System.Priority': 2 } },
  };
}

function makeSkippedPlan(id: number, skipReason = 'closed'): UpdatePlan {
  return {
    workItem: makeItem(id),
    status: 'skipped',
    skipReason,
    change: {},
  };
}

const noopLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

describe('executeUpdates', () => {
  it('dry-run: updateWorkItem is NOT called; planned items return updated', async () => {
    const updateWorkItem = vi.fn().mockResolvedValue(makeItem(1));
    const client = { updateWorkItem } as unknown as IAdoClient;
    const plans = [makePlan(1), makePlan(2)];
    const results = await executeUpdates(client, 'MyProject', plans, {
      dryRun: true,
      concurrency: 2,
      continueOnError: true,
    }, noopLogger);

    expect(updateWorkItem).not.toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'updated')).toBe(true);
  });

  it('live run: updateWorkItem IS called for each planned item', async () => {
    const updateWorkItem = vi.fn().mockResolvedValue(makeItem(1));
    const client = { updateWorkItem } as unknown as IAdoClient;
    const plans = [makePlan(1), makePlan(2)];

    const results = await executeUpdates(client, 'MyProject', plans, {
      dryRun: false,
      concurrency: 2,
      continueOnError: true,
    }, noopLogger);

    expect(updateWorkItem).toHaveBeenCalledTimes(2);
    expect(results.every((r) => r.status === 'updated')).toBe(true);
  });

  it('skipped plans produce skipped results without calling updateWorkItem', async () => {
    const updateWorkItem = vi.fn().mockResolvedValue(makeItem(2));
    const client = { updateWorkItem } as unknown as IAdoClient;
    const plans = [makeSkippedPlan(1, 'closed'), makePlan(2)];

    const results = await executeUpdates(client, 'MyProject', plans, {
      dryRun: false,
      concurrency: 2,
      continueOnError: true,
    }, noopLogger);

    expect(updateWorkItem).toHaveBeenCalledTimes(1);
    const skipped = results.find((r) => r.id === 1);
    expect(skipped).toBeDefined();
    expect(skipped?.status).toBe('skipped');
    expect(skipped?.skipReason).toBe('closed');
  });

  it('failed update with continueOnError: true → status failed, no throw', async () => {
    const updateWorkItem = vi.fn().mockRejectedValue(new Error('API error'));
    const client = { updateWorkItem } as unknown as IAdoClient;
    const plans = [makePlan(1)];

    const results = await executeUpdates(client, 'MyProject', plans, {
      dryRun: false,
      concurrency: 1,
      continueOnError: true,
    }, noopLogger);

    const result = results[0];
    expect(result?.status).toBe('failed');
    expect(result?.error).toContain('API error');
  });

  it('failed update with continueOnError: false → throws', async () => {
    const updateWorkItem = vi.fn().mockRejectedValue(new Error('API error'));
    const client = { updateWorkItem } as unknown as IAdoClient;
    const plans = [makePlan(1)];

    await expect(
      executeUpdates(client, 'MyProject', plans, {
        dryRun: false,
        concurrency: 1,
        continueOnError: false,
      }, noopLogger),
    ).rejects.toThrow('API error');
  });

  it('concurrency respected (max 2 concurrent)', async () => {
    let active = 0;
    let maxActive = 0;

    const updateWorkItem = vi.fn().mockImplementation(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      return makeItem(1);
    });

    const client = { updateWorkItem } as unknown as IAdoClient;
    const plans = [makePlan(1), makePlan(2), makePlan(3), makePlan(4)];

    await executeUpdates(client, 'MyProject', plans, {
      dryRun: false,
      concurrency: 2,
      continueOnError: true,
    }, noopLogger);

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(updateWorkItem).toHaveBeenCalledTimes(4);
  });
});
