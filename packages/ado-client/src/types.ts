import type { WorkItem, WorkItemType, Project } from '@clothed-stability/core';
import type { Logger } from '@clothed-stability/utils';

export interface AdoCredentials {
  pat: string;
}

export interface AdoConnectionOptions {
  organizationUrl: string;
  credentials: AdoCredentials;
}

export interface AdoClientOptions {
  organizationUrl: string;
  pat: string;
  fetchFn?: typeof fetch;
  logger?: Logger;
}

export interface CreateAdoClientOptions {
  organizationUrl: string;
  patEnvVar: string;
  fetchFn?: typeof fetch;
  logger?: Logger;
}

/**
 * Interface for the Azure DevOps client.
 * All ADO API interactions must go through this interface.
 */
export interface IAdoClient {
  listProjects(): Promise<Project[]>;
  getWorkItem(projectName: string, id: number): Promise<WorkItem>;
  getWorkItemsByIds(projectName: string, ids: number[]): Promise<WorkItem[]>;

  /** Lists work item types in a project */
  listWorkItemTypes(projectName: string): Promise<WorkItemType[]>;

  /** Lists work items matching a WIQL query */
  queryWorkItems(projectName: string, wiql: string): Promise<WorkItem[]>;
  createWorkItem(
    projectName: string,
    type: string,
    fields: Record<string, unknown>,
  ): Promise<WorkItem>;
  updateWorkItem(
    projectName: string,
    id: number,
    fields: Record<string, string | number | boolean | null>,
  ): Promise<WorkItem>;
}
