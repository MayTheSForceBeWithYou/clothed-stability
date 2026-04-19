import type { WorkItem, WorkItemType, Project } from '@clothed-stability/core';
import type { IAdoClient, AdoClientOptions, CreateAdoClientOptions } from './types.js';
import type { Logger } from '@clothed-stability/utils';
import { createLogger } from '@clothed-stability/utils';

interface AdoListResponse<T> {
  value: T[];
}

interface AdoWorkItemResponse {
  id: number;
  fields: Record<string, unknown>;
}

interface AdoWorkItemTypeResponse {
  name: string;
  referenceName: string;
  description?: string;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function getRequiredField(fields: Record<string, unknown>, key: string): string {
  const value = fields[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Azure DevOps work item response missing required field: ${key}`);
  }
  return value;
}

function getOptionalField(fields: Record<string, unknown>, key: string): string | undefined {
  const value = fields[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
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
    await this.getJson<AdoListResponse<Project>>('_apis/projects?$top=1&api-version=7.1');
  }

  async listProjects(): Promise<Project[]> {
    const response = await this.getJson<AdoListResponse<Project>>('_apis/projects?api-version=7.1');
    return response.value;
  }

  async getWorkItem(projectName: string, id: number): Promise<WorkItem> {
    const encodedProjectName = encodeURIComponent(projectName);
    const response = await this.getJson<AdoWorkItemResponse>(
      `${encodedProjectName}/_apis/wit/workitems/${String(id)}?api-version=7.1`,
    );

    const workItem: WorkItem = {
      id: response.id,
      title: getRequiredField(response.fields, 'System.Title'),
      type: getRequiredField(response.fields, 'System.WorkItemType'),
      state: getRequiredField(response.fields, 'System.State'),
    };

    const assignedTo = getOptionalField(response.fields, 'System.AssignedTo');
    if (assignedTo !== undefined) {
      workItem.assignedTo = assignedTo;
    }

    const areaPath = getOptionalField(response.fields, 'System.AreaPath');
    if (areaPath !== undefined) {
      workItem.areaPath = areaPath;
    }

    const iterationPath = getOptionalField(response.fields, 'System.IterationPath');
    if (iterationPath !== undefined) {
      workItem.iterationPath = iterationPath;
    }

    const description = getOptionalField(response.fields, 'System.Description');
    if (description !== undefined) {
      workItem.description = description;
    }

    const tags = getOptionalField(response.fields, 'System.Tags')
      ?.split(';')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    if (tags !== undefined) {
      workItem.tags = tags;
    }

    return workItem;
  }

  async listWorkItemTypes(projectName: string): Promise<WorkItemType[]> {
    const encodedProjectName = encodeURIComponent(projectName);
    const response = await this.getJson<AdoListResponse<AdoWorkItemTypeResponse>>(
      `${encodedProjectName}/_apis/wit/workitemtypes?api-version=7.1`,
    );

    return response.value.map((workItemType): WorkItemType => {
      const result: WorkItemType = {
        name: workItemType.name,
        referenceName: workItemType.referenceName,
      };

      if (typeof workItemType.description === 'string' && workItemType.description.length > 0) {
        result.description = workItemType.description;
      }

      return result;
    });
  }

  queryWorkItems(_projectName: string, _wiql: string): Promise<WorkItem[]> {
    return Promise.reject(new Error('queryWorkItems is not supported by the GET-only AdoClient'));
  }

  private async getJson<TResponse>(path: string): Promise<TResponse> {
    const url = new URL(path, this.organizationUrl).toString();
    const method = 'GET';

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: this.authorizationHeader,
        },
      });
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
