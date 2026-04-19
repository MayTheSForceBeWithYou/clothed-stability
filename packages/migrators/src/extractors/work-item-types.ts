import type { IAdoClient } from '@clothed-stability/ado-client';
import type { WorkItemType } from '@clothed-stability/core';
import type { IExtractor } from '../types.js';

export interface WorkItemTypeExtractorOptions {
  adoClient: IAdoClient;
  projectName: string;
}

export class WorkItemTypeExtractor implements IExtractor<WorkItemType> {
  readonly name = 'work-item-types';
  private readonly adoClient: IAdoClient;
  private readonly projectName: string;

  constructor(options: WorkItemTypeExtractorOptions) {
    this.adoClient = options.adoClient;
    this.projectName = options.projectName;
  }

  extract(): Promise<WorkItemType[]> {
    return this.adoClient.listWorkItemTypes(this.projectName);
  }
}
