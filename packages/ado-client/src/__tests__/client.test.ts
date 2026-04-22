import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdoClient } from '../client.js';

const options = {
  organizationUrl: 'https://dev.azure.com/test-org',
  credentials: { pat: 'test-pat' },
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
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('can be instantiated', () => {
    const client = new AdoClient(options);
    expect(client).toBeInstanceOf(AdoClient);
  });

  describe('listProjects', () => {
    it('returns mapped projects', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetch({
          value: [{ id: 'proj-1', name: 'MyProject', url: 'https://...', description: 'Desc' }],
        }),
      );
      const client = new AdoClient(options);
      const projects = await client.listProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0]!.name).toBe('MyProject');
    });

    it('throws on API error', async () => {
      vi.stubGlobal('fetch', makeFetch({ message: 'Unauthorized' }, 401));
      const client = new AdoClient(options);
      await expect(client.listProjects()).rejects.toThrow('401');
    });
  });

  describe('queryWorkItems', () => {
    it('returns empty array when no work items', async () => {
      vi.stubGlobal('fetch', makeFetch({ workItems: [] }));
      const client = new AdoClient(options);
      const items = await client.queryWorkItems('MyProject', 'SELECT [System.Id] FROM WorkItems');
      expect(items).toEqual([]);
    });

    it('fetches work item details after WIQL query', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ workItems: [{ id: 42, url: '...' }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ value: [sampleWorkItemDetail] }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const client = new AdoClient(options);
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
      vi.stubGlobal('fetch', makeFetch(sampleWorkItemDetail));
      const client = new AdoClient(options);
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
        json: () => Promise.resolve({ value: [sampleWorkItemDetail] }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const client = new AdoClient(options);
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
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ value: batch1 }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ value: batch2 }) });
      vi.stubGlobal('fetch', fetchMock);

      const client = new AdoClient(options);
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
      vi.stubGlobal('fetch', fetchMock);

      const client = new AdoClient(options);
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
      vi.stubGlobal('fetch', fetchMock);

      const client = new AdoClient(options);
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
});
