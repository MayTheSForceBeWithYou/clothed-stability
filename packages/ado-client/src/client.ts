import type { WorkItem, WorkItemType, Project } from '@clothed-stability/core';
import type { IAdoClient, AdoClientOptions, CreateAdoClientOptions } from './types.js';
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

interface AdoListResponse<T> {
  value: T[];
}

interface AdoWorkItemTypeResponse {
  name: string;
  referenceName: string;
  description?: string;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function readResponseBody(response: Response): Promise<string | undefined> {
  try {
    const body = await response.text();
    return body.length > 0 ? body : undefined;
  } catch {
    return undefined;
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

/**
 * Azure DevOps REST API client using PAT authentication.
 */
export class AdoClient implements IAdoClient {
  private readonly logger: Logger;
  private readonly fetchFn: typeof fetch;
  private readonly organizationUrl: string;
  private readonly authorizationHeader: string;

  constructor(options: AdoClientOptions) {
    this.logger = options.logger ?? createLogger({ name: 'ado-client' });
    this.fetchFn = options.fetchFn ?? fetch;
    this.organizationUrl = ensureTrailingSlash(options.organizationUrl);
    this.authorizationHeader = `Basic ${Buffer.from(`:${options.pat}`).toString('base64')}`;

    this.logger.info(
      { organizationUrl: this.organizationUrl },
      'AdoClient initialized',
    );
  }

  async validateConnection(): Promise<void> {
    await this.request<AdoListResponse<Project>>('GET', `_apis/projects?$top=1&api-version=${API_VERSION}`);
  }

  async listProjects(): Promise<Project[]> {
    const response = await this.request<AdoListResponse<Project>>('GET', `_apis/projects?api-version=${API_VERSION}`);
    return response.value;
  }

  async getWorkItem(projectName: string, id: number): Promise<WorkItem> {
    const enc = encodeURIComponent(projectName);
    const item = await this.request<AdoWorkItemDetail>(
      'GET',
      `${enc}/_apis/wit/workitems/${String(id)}?$expand=all&api-version=${API_VERSION}`,
    );
    return mapFields(item);
  }

  async getWorkItemsByIds(projectName: string, ids: number[]): Promise<WorkItem[]> {
    if (ids.length === 0) return [];
    this.logger.info({ count: ids.length }, 'Fetching work items by IDs');
    const enc = encodeURIComponent(projectName);
    const workItems: WorkItem[] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const data = await this.request<AdoBatchResponse>(
        'GET',
        `${enc}/_apis/wit/workitems?ids=${batch.join(',')}&$expand=all&api-version=${API_VERSION}`,
      );
      workItems.push(...data.value.map(mapFields));
    }
    return workItems;
  }

  async listWorkItemTypes(projectName: string): Promise<WorkItemType[]> {
    const enc = encodeURIComponent(projectName);
    const response = await this.request<AdoListResponse<AdoWorkItemTypeResponse>>(
      'GET',
      `${enc}/_apis/wit/workitemtypes?api-version=${API_VERSION}`,
    );

    return response.value.map((wit): WorkItemType => {
      const result: WorkItemType = {
        name: wit.name,
        referenceName: wit.referenceName,
      };
      if (typeof wit.description === 'string' && wit.description.length > 0) {
        result.description = wit.description;
      }
      return result;
    });
  }

  async queryWorkItems(projectName: string, wiql: string): Promise<WorkItem[]> {
    const enc = encodeURIComponent(projectName);
    const wiqlResponse = await this.request<AdoWiqlResponse>(
      'POST',
      `${enc}/_apis/wit/wiql?api-version=${API_VERSION}`,
      { query: wiql },
    );

    const ids = wiqlResponse.workItems.map((w) => w.id);
    if (ids.length === 0) return [];

    this.logger.info({ count: ids.length }, 'Fetching work item details');
    return this.getWorkItemsByIds(projectName, ids);
  }

  async createWorkItem(
    projectName: string,
    type: string,
    fields: Record<string, unknown>,
  ): Promise<WorkItem> {
    const enc = encodeURIComponent(projectName);
    const patch = Object.entries(fields).map(([key, value]) => ({
      op: 'add',
      path: `/fields/${key}`,
      value,
    }));

    const item = await this.request<AdoWorkItemDetail>(
      'POST',
      `${enc}/_apis/wit/workitems/$${encodeURIComponent(type)}?api-version=${API_VERSION}`,
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
    const enc = encodeURIComponent(projectName);
    const patch = Object.entries(fields).map(([key, value]) => ({
      op: 'add',
      path: `/fields/${key}`,
      value,
    }));

    const item = await this.request<AdoWorkItemDetail>(
      'PATCH',
      `${enc}/_apis/wit/workitems/${String(id)}?api-version=${API_VERSION}`,
      patch,
      'application/json-patch+json',
    );
    return mapFields(item);
  }

  private async request<TResponse>(
    method: string,
    path: string,
    body?: unknown,
    contentType = 'application/json',
  ): Promise<TResponse> {
    const url = new URL(path, this.organizationUrl).toString();

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: this.authorizationHeader,
    };
    if (body !== undefined) {
      headers['Content-Type'] = contentType;
    }

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    this.logger.debug({ method, url }, 'ADO API request');

    let response: Response;
    try {
      response = await this.fetchFn(url, init);
    } catch (error: unknown) {
      this.logger.error({ method, url }, 'Azure DevOps request failed');
      throw new Error(`Network error during ${method} ${url}: ${formatErrorMessage(error)}`);
    }

    this.logger.info({ method, url, status: response.status }, 'Azure DevOps request completed');

    if (!response.ok) {
      const responseBody = await readResponseBody(response);
      const responseSuffix = responseBody === undefined ? '' : `: ${responseBody}`;
      throw new Error(
        `Azure DevOps request failed with status ${String(response.status)} during ${method} ${url}${responseSuffix}`,
      );
    }

    try {
      return (await response.json()) as TResponse;
    } catch {
      throw new Error(`Invalid JSON in Azure DevOps response for ${method} ${url}`);
    }
  }
}

export function createAdoClient(options: CreateAdoClientOptions): AdoClient {
  const pat = process.env[options.patEnvVar];
  if (typeof pat !== 'string' || pat.length === 0) {
    throw new Error(`Missing required PAT environment variable: ${options.patEnvVar}`);
  }

  const clientOptions: AdoClientOptions = {
    organizationUrl: options.organizationUrl,
    pat,
  };

  if (options.fetchFn !== undefined) {
    clientOptions.fetchFn = options.fetchFn;
  }

  if (options.logger !== undefined) {
    clientOptions.logger = options.logger;
  }

  return new AdoClient(clientOptions);
}
