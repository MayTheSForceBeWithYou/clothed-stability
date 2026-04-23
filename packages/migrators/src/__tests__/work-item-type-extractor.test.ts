import { describe, expect, it, vi } from 'vitest';
import type { IAdoClient } from '@clothed-stability/ado-client';
import { WorkItemTypeExtractor } from '../extractors/work-item-types.js';

describe('WorkItemTypeExtractor', () => {
  it('extracts work item types using IAdoClient', async () => {
    const listWorkItemTypes = vi.fn<IAdoClient['listWorkItemTypes']>().mockResolvedValue([
      {
        name: 'Bug',
        referenceName: 'Microsoft.VSTS.WorkItemTypes.Bug',
      },
    ]);

    const adoClient: IAdoClient = {
      listProjects: vi.fn<IAdoClient['listProjects']>(),
      getWorkItem: vi.fn<IAdoClient['getWorkItem']>(),
      getWorkItemsByIds: vi.fn<IAdoClient['getWorkItemsByIds']>(),
      queryWorkItems: vi.fn<IAdoClient['queryWorkItems']>(),
      listWorkItemTypes,
      createWorkItem: vi.fn<IAdoClient['createWorkItem']>(),
      updateWorkItem: vi.fn<IAdoClient['updateWorkItem']>(),
    };

    const extractor = new WorkItemTypeExtractor({
      adoClient,
      projectName: 'SourceProject',
    });

    await expect(extractor.extract()).resolves.toEqual([
      {
        name: 'Bug',
        referenceName: 'Microsoft.VSTS.WorkItemTypes.Bug',
      },
    ]);
    expect(listWorkItemTypes).toHaveBeenCalledWith('SourceProject');
    expect(extractor.name).toBe('work-item-types');
  });
});
