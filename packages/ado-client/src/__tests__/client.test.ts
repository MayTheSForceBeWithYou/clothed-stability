import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdoClient, createAdoClient } from '../client.js';

const options = {
  organizationUrl: 'https://dev.azure.com/test-org',
  pat: 'test-pat',
};

function makeFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

const sampleWorkItemDetail = {
  id: 42,
  fields: {
    'System.Id': 42,
    'System.Title': 'Fix the bug',
    'System.WorkItemType': 'Bug',
    'System.State': 'Active',
    'System.AssignedTo': { displayName: 'Alice' },
    'System.AreaPath': 'MyProject\\Team',
    'System.IterationPath': 'MyProject\\Sprint 1',
    'System.Description': '<p>details</p>',
    'System.Tags': 'tag1; tag2',
  },
};

describe('AdoClient', () => {
  const organizationUrl = 'https://dev.azure.com/test-org';

  beforeEach(() => {
    delete process.env['ADO_TEST_PAT'];
  });

  it('fails when PAT env var is missing', () => {
    expect(() =>
      createAdoClient({
        organizationUrl,
        patEnvVar: 'ADO_TEST_PAT',
      }),
    ).toThrow('Missing required PAT environment variable: ADO_TEST_PAT');
  });

  it('generates Basic auth header from PAT', async () => {
    process.env['ADO_TEST_PAT'] = 'super-secret-pat';
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ value: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = createAdoClient({
      organizationUrl,
      patEnvVar: 'ADO_TEST_PAT',
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    await client.listProjects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const requestInit = firstCall?.[1];
    const headers = requestInit?.headers;

    if (headers instanceof Headers) {
      expect(headers.get('Authorization')).toBe(
        `Basic ${Buffer.from(':super-secret-pat').toString('base64')}`,
      );
      return;
    }

    expect(headers).toEqual(
      expect.objectContaining({
        Authorization: `Basic ${Buffer.from(':super-secret-pat').toString('base64')}`,
      }),
    );
  });

  describe('listProjects', () => {
    it('returns mapped projects', async () => {
      const client = new AdoClient({
        ...options,
        fetchFn: makeFetch({
          value: [{ id: 'proj-1', name: 'MyProject', url: 'https://...', description: 'Desc' }],
        }) as unknown as typeof fetch,
      });
      const projects = await client.listProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0]!.name).toBe('MyProject');
    });

    it('returns parsed JSON from GET request', async () => {
      const fetchMock = vi.fn<typeof fetch>();
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            value: [
              {
                id: 'project-id',
                name: 'Project 1',
                description: 'Desc',
                url: 'https://dev.azure.com/test-org/_apis/projects/project-id',
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );

      const client = new AdoClient({
        organizationUrl,
        pat: 'pat',
        fetchFn: fetchMock as unknown as typeof fetch,
      });

      await expect(client.listProjects()).resolves.toEqual([
        {
          id: 'project-id',
          name: 'Project 1',
          description: 'Desc',
          url: 'https://dev.azure.com/test-org/_apis/projects/project-id',
        },
      ]);
    });

    it('throws on API error', async () => {
      const client = new AdoClient({
        ...options,
        fetchFn: makeFetch({ message: 'Unauthorized' }, 401) as unknown as typeof fetch,
      });
      await expect(client.listProjects()).rejects.toThrow('401');
    });
  });

  describe('listWorkItemTypes', () => {
    it('lists work item types for a project', async () => {
      const fetchMock = vi.fn<typeof fetch>();
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            value: [
              {
                name: 'Bug',
                referenceName: 'Microsoft.VSTS.WorkItemTypes.Bug',
                description: 'Represents a defect',
              },
              {
                name: 'Task',
                referenceName: 'Microsoft.VSTS.WorkItemTypes.Task',
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );

      const client = new AdoClient({
        organizationUrl,
        pat: 'pat',
        fetchFn: fetchMock as unknown as typeof fetch,
      });

      await expect(client.listWorkItemTypes('Project 1')).resolves.toEqual([
        {
          name: 'Bug',
          referenceName: 'Microsoft.VSTS.WorkItemTypes.Bug',
          description: 'Represents a defect',
        },
        {
          name: 'Task',
          referenceName: 'Microsoft.VSTS.WorkItemTypes.Task',
        },
      ]);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://dev.azure.com/test-org/Project%201/_apis/wit/workitemtypes?api-version=7.1',
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });
  });

  describe('queryWorkItems', () => {
    it('returns empty array when no work items', async () => {
      const client = new AdoClient({
        ...options,
        fetchFn: makeFetch({ workItems: [] }) as unknown as typeof fetch,
      });
      const items = await client.queryWorkItems('MyProject', 'SELECT [System.Id] FROM WorkItems');
      expect(items).toEqual([]);
    });

    it('fetches work item details after WIQL query', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ workItems: [{ id: 42, url: '...' }] }),
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ value: [sampleWorkItemDetail] }),
          text: () => Promise.resolve(''),
        });

      const client = new AdoClient({
        ...options,
        fetchFn: fetchMock as unknown as typeof fetch,
      });
      const items = await client.queryWorkItems('MyProject', 'SELECT [System.Id] FROM WorkItems');
      expect(items).toHaveLength(1);
      const first = items[0]!;
      expect(first.id).toBe(42);
      expect(first.title).toBe('Fix the bug');
      expect(first.assignedTo).toBe('Alice');
      expect(first.tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('getWorkItem', () => {
    it('returns mapped work item', async () => {
      const client = new AdoClient({
        ...options,
        fetchFn: makeFetch(sampleWorkItemDetail) as unknown as typeof fetch,
      });
      const item = await client.getWorkItem('MyProject', 42);
      expect(item.id).toBe(42);
      expect(item.type).toBe('Bug');
      expect(item.state).toBe('Active');
    });
  });

  describe('getWorkItemsByIds', () => {
    it('returns items for a single batch', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ value: [sampleWorkItemDetail] }),
        text: () => Promise.resolve(''),
      });

      const client = new AdoClient({
        ...options,
        fetchFn: fetchMock as unknown as typeof fetch,
      });
      const items = await client.getWorkItemsByIds('MyProject', [42]);
      expect(items).toHaveLength(1);
      expect(items[0]!.id).toBe(42);
      const url = fetchMock.mock.calls[0]![0] as string;
      expect(url).toContain('workitems?ids=42');
    });

    it('handles multi-batch (>200 IDs)', async () => {
      const ids = Array.from({ length: 250 }, (_, i) => i + 1);
      const makeDetail = (id: number) => ({
        id,
        fields: {
          'System.Id': id,
          'System.Title': `Item ${id}`,
          'System.WorkItemType': 'Task',
          'System.State': 'Active',
        },
      });
      const batch1 = ids.slice(0, 200).map(makeDetail);
      const batch2 = ids.slice(200).map(makeDetail);
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ value: batch1 }), text: () => Promise.resolve('') })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ value: batch2 }), text: () => Promise.resolve('') });

      const client = new AdoClient({
        ...options,
        fetchFn: fetchMock as unknown as typeof fetch,
      });
      const items = await client.getWorkItemsByIds('MyProject', ids);
      expect(items).toHaveLength(250);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns empty array for empty ids', async () => {
      const client = new AdoClient(options);
      const items = await client.getWorkItemsByIds('MyProject', []);
      expect(items).toEqual([]);
    });
  });

  describe('updateWorkItem', () => {
    it('sends PATCH with correct URL and patch body', async () => {
      const fetchMock = makeFetch(sampleWorkItemDetail);

      const client = new AdoClient({
        ...options,
        fetchFn: fetchMock as unknown as typeof fetch,
      });
      const item = await client.updateWorkItem('MyProject', 42, {
        'System.Title': 'Updated title',
        'System.Tags': null,
      });

      expect(item.id).toBe(42);
      const call = fetchMock.mock.calls[0]!;
      const url = call[0] as string;
      const init = call[1] as RequestInit;
      expect(url).toContain('/workitems/42');
      expect(init.method).toBe('PATCH');
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json-patch+json' });

      const body = JSON.parse(init.body as string) as Array<{ op: string; path: string; value: unknown }>;
      expect(body).toContainEqual({ op: 'add', path: '/fields/System.Title', value: 'Updated title' });
      expect(body).toContainEqual({ op: 'add', path: '/fields/System.Tags', value: null });
    });
  });

  describe('createWorkItem', () => {
    it('posts patch body and returns mapped work item', async () => {
      const fetchMock = makeFetch(sampleWorkItemDetail);

      const client = new AdoClient({
        ...options,
        fetchFn: fetchMock as unknown as typeof fetch,
      });
      const item = await client.createWorkItem('MyProject', 'Bug', {
        'System.Title': 'Fix the bug',
      });

      expect(item.id).toBe(42);
      const call = fetchMock.mock.calls[0]!;
      const url = call[0] as string;
      const init = call[1] as RequestInit;
      expect(url).toContain('workitems/$Bug');
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json-patch+json' });

      const body = JSON.parse(init.body as string) as Array<{ op: string; path: string; value: unknown }>;
      expect(body[0]!).toMatchObject({ op: 'add', path: '/fields/System.Title', value: 'Fix the bug' });
    });
  });

  it('handles network errors and non-2xx responses', async () => {
    const networkFailureFetch = vi.fn<typeof fetch>();
    networkFailureFetch.mockRejectedValue(new Error('socket hang up'));

    const networkClient = new AdoClient({
      organizationUrl,
      pat: 'pat',
      fetchFn: networkFailureFetch as unknown as typeof fetch,
    });

    await expect(networkClient.listProjects()).rejects.toThrow('Network error during GET');

    const nonSuccessFetch = vi.fn<typeof fetch>();
    nonSuccessFetch.mockResolvedValue(new Response('Unauthorized', { status: 401 }));

    const nonSuccessClient = new AdoClient({
      organizationUrl,
      pat: 'pat',
      fetchFn: nonSuccessFetch as unknown as typeof fetch,
    });

    await expect(nonSuccessClient.listProjects()).rejects.toThrow(
      'Azure DevOps request failed with status 401',
    );
  });
});
