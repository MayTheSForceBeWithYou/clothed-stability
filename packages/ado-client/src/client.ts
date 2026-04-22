import type { WorkItem, Project } from '@clothed-stability/core';
import type { IAdoClient, AdoConnectionOptions } from './types.js';
import type { Logger } from '@clothed-stability/utils';
import { createLogger } from '@clothed-stability/utils';

const API_VERSION = '7.1';
const BATCH_SIZE = 200;

interface AdoWorkItemRef {
  id: number;
  url: string;
}

interface AdoWiqlResponse {
  workItems: AdoWorkItemRef[];
}

interface AdoWorkItemFields {
  'System.Id': number;
  'System.Title': string;
  'System.WorkItemType': string;
  'System.State': string;
  'System.AssignedTo'?: { displayName: string } | string;
  'System.AreaPath'?: string;
  'System.IterationPath'?: string;
  'System.Description'?: string;
  'System.Tags'?: string;
}

interface AdoWorkItemDetail {
  id: number;
  fields: AdoWorkItemFields;
}

interface AdoBatchResponse {
  value: AdoWorkItemDetail[];
}

interface AdoProjectDetail {
  id: string;
  name: string;
  description?: string;
  url: string;
}

interface AdoProjectsResponse {
  value: AdoProjectDetail[];
}

export class AdoClient implements IAdoClient {
  private readonly logger: Logger;
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(private readonly options: AdoConnectionOptions) {
    this.logger = createLogger({ name: 'ado-client' });
    this.baseUrl = options.organizationUrl.replace(/\/$/, '');
    const encoded = Buffer.from(`:${options.credentials.pat}`).toString('base64');
    this.authHeader = `Basic ${encoded}`;
    this.logger.info({ organizationUrl: options.organizationUrl }, 'AdoClient initialized');
  }

  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    contentType = 'application/json',
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: 'application/json',
      'Content-Type': contentType,
    };

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    this.logger.debug({ method, url }, 'ADO API request');
    const response = await fetch(url, init);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`ADO API error ${response.status} ${response.statusText}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async listProjects(): Promise<Project[]> {
    const url = `${this.baseUrl}/_apis/projects?api-version=${API_VERSION}`;
    const data = await this.request<AdoProjectsResponse>('GET', url);
    return data.value.map((p) => {
      const project: Project = { id: p.id, name: p.name, url: p.url };
      if (p.description !== undefined) project.description = p.description;
      return project;
    });
  }

  async getWorkItem(projectName: string, id: number): Promise<WorkItem> {
    const url = `${this.baseUrl}/${encodeURIComponent(projectName)}/_apis/wit/workitems/${id}?$expand=all&api-version=${API_VERSION}`;
    const item = await this.request<AdoWorkItemDetail>('GET', url);
    return mapFields(item);
  }

  async getWorkItemsByIds(projectName: string, ids: number[]): Promise<WorkItem[]> {
    if (ids.length === 0) return [];
    this.logger.info({ count: ids.length }, 'Fetching work items by IDs');
    return this._fetchBatch(projectName, ids);
  }

  async queryWorkItems(projectName: string, wiql: string): Promise<WorkItem[]> {
    const url = `${this.baseUrl}/${encodeURIComponent(projectName)}/_apis/wit/wiql?api-version=${API_VERSION}`;
    const wiqlResponse = await this.request<AdoWiqlResponse>('POST', url, { query: wiql });

    const ids = wiqlResponse.workItems.map((w) => w.id);
    if (ids.length === 0) return [];

    this.logger.info({ count: ids.length }, 'Fetching work item details');
    return this._fetchBatch(projectName, ids);
  }

  private async _fetchBatch(projectName: string, ids: number[]): Promise<WorkItem[]> {
    const workItems: WorkItem[] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const batchUrl = `${this.baseUrl}/${encodeURIComponent(projectName)}/_apis/wit/workitems?ids=${batch.join(',')}&$expand=all&api-version=${API_VERSION}`;
      const batchData = await this.request<AdoBatchResponse>('GET', batchUrl);
      workItems.push(...batchData.value.map(mapFields));
    }
    return workItems;
  }

  async createWorkItem(
    projectName: string,
    type: string,
    fields: Record<string, unknown>,
  ): Promise<WorkItem> {
    const url = `${this.baseUrl}/${encodeURIComponent(projectName)}/_apis/wit/workitems/$${encodeURIComponent(type)}?api-version=${API_VERSION}`;

    const patch = Object.entries(fields).map(([key, value]) => ({
      op: 'add',
      path: `/fields/${key}`,
      value,
    }));

    const item = await this.request<AdoWorkItemDetail>(
      'POST',
      url,
      patch,
      'application/json-patch+json',
    );
    return mapFields(item);
  }

  async updateWorkItem(
    projectName: string,
    id: number,
    fields: Record<string, string | number | boolean | null>,
  ): Promise<WorkItem> {
    const url = `${this.baseUrl}/${encodeURIComponent(projectName)}/_apis/wit/workitems/${id}?api-version=${API_VERSION}`;

    const patch = Object.entries(fields).map(([key, value]) => ({
      op: 'add',
      path: `/fields/${key}`,
      value,
    }));

    const item = await this.request<AdoWorkItemDetail>(
      'PATCH',
      url,
      patch,
      'application/json-patch+json',
    );
    return mapFields(item);
  }
}

function mapFields(item: AdoWorkItemDetail): WorkItem {
  const f = item.fields;
  const assignedTo = f['System.AssignedTo'];
  const assignedToStr =
    typeof assignedTo === 'object' && assignedTo !== null
      ? assignedTo.displayName
      : (assignedTo as string | undefined);

  const tagsRaw = f['System.Tags'];
  const tags = tagsRaw
    ? tagsRaw
        .split(';')
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;

  const result: WorkItem = {
    id: item.id,
    title: f['System.Title'],
    type: f['System.WorkItemType'],
    state: f['System.State'],
  };

  if (assignedToStr !== undefined) result.assignedTo = assignedToStr;
  if (f['System.AreaPath'] !== undefined) result.areaPath = f['System.AreaPath'];
  if (f['System.IterationPath'] !== undefined) result.iterationPath = f['System.IterationPath'];
  if (f['System.Description'] !== undefined) result.description = f['System.Description'];
  if (tags !== undefined) result.tags = tags;

  return result;
}
