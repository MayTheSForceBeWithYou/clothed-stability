import type { WorkItem, Project } from '@clothed-stability/core';
import type { IAdoClient, AdoConnectionOptions } from './types.js';
import type { Logger } from '@clothed-stability/utils';
import { createLogger } from '@clothed-stability/utils';

/**
 * Placeholder Azure DevOps client.
 *
 * Real API calls are not implemented yet.  All methods throw a "not implemented"
 * error so that consumers can integrate against the interface today and swap in a
 * real implementation later.
 */
export class AdoClient implements IAdoClient {
  private readonly logger: Logger;

  constructor(private readonly options: AdoConnectionOptions) {
    this.logger = createLogger({ name: 'ado-client' });
    this.logger.info({ organizationUrl: options.organizationUrl }, 'AdoClient initialized');
  }

  listProjects(): Promise<Project[]> {
    this.logger.warn('listProjects is not implemented yet');
    return Promise.reject(new Error('Not implemented: listProjects'));
  }

  getWorkItem(_projectName: string, _id: number): Promise<WorkItem> {
    this.logger.warn('getWorkItem is not implemented yet');
    return Promise.reject(new Error('Not implemented: getWorkItem'));
  }

  queryWorkItems(_projectName: string, _wiql: string): Promise<WorkItem[]> {
    this.logger.warn('queryWorkItems is not implemented yet');
    return Promise.reject(new Error('Not implemented: queryWorkItems'));
  }
}
