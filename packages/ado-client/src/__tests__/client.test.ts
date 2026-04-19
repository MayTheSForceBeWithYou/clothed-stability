import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AzureDevOpsClient, createAzureDevOpsClient } from '../client.js';

describe('AzureDevOpsClient', () => {
  const organizationUrl = 'https://dev.azure.com/test-org';

  beforeEach(() => {
    delete process.env['ADO_TEST_PAT'];
  });

  it('fails when PAT env var is missing', () => {
    expect(() =>
      createAzureDevOpsClient({
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

    const client = createAzureDevOpsClient({
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

    const client = new AzureDevOpsClient({
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

  it('handles network errors and non-2xx responses', async () => {
    const networkFailureFetch = vi.fn<typeof fetch>();
    networkFailureFetch.mockRejectedValue(new Error('socket hang up'));

    const networkClient = new AzureDevOpsClient({
      organizationUrl,
      pat: 'pat',
      fetchFn: networkFailureFetch as unknown as typeof fetch,
    });

    await expect(networkClient.listProjects()).rejects.toThrow('Network error during GET');

    const nonSuccessFetch = vi.fn<typeof fetch>();
    nonSuccessFetch.mockResolvedValue(new Response('Unauthorized', { status: 401 }));

    const nonSuccessClient = new AzureDevOpsClient({
      organizationUrl,
      pat: 'pat',
      fetchFn: nonSuccessFetch as unknown as typeof fetch,
    });

    await expect(nonSuccessClient.listProjects()).rejects.toThrow(
      'Azure DevOps request failed with status 401',
    );
  });
});
