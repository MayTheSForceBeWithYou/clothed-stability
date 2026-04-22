import type { WorkItem, Project } from '@clothed-stability/core';

export interface AdoCredentials {
  pat: string;
}

export interface AdoConnectionOptions {
  organizationUrl: string;
  credentials: AdoCredentials;
}

export interface IAdoClient {
  listProjects(): Promise<Project[]>;
  getWorkItem(projectName: string, id: number): Promise<WorkItem>;
  getWorkItemsByIds(projectName: string, ids: number[]): Promise<WorkItem[]>;
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
