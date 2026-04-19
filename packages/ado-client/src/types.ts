import type { WorkItem, Project } from '@clothed-stability/core';
import type { Logger } from '@clothed-stability/utils';

/**
 * Credentials used to authenticate with Azure DevOps.
 */
export interface AdoCredentials {
  /** Personal Access Token */
  pat: string;
}

/**
 * Connection parameters for a specific Azure DevOps organization.
 */
export interface AdoConnectionOptions {
  organizationUrl: string;
  credentials: AdoCredentials;
}

export interface AzureDevOpsClientOptions {
  organizationUrl: string;
  pat: string;
  fetchFn?: typeof fetch;
  logger?: Logger;
}

export interface CreateAzureDevOpsClientOptions {
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
  /** Lists all projects in the organization */
  listProjects(): Promise<Project[]>;

  /** Gets a single work item by ID */
  getWorkItem(projectName: string, id: number): Promise<WorkItem>;

  /** Lists work items matching a WIQL query */
  queryWorkItems(projectName: string, wiql: string): Promise<WorkItem[]>;
}
