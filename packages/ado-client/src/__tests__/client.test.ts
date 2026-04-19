import { describe, it, expect } from 'vitest';
import { AdoClient } from '../client.js';

describe('AdoClient', () => {
  const options = {
    organizationUrl: 'https://dev.azure.com/test-org',
    credentials: { pat: 'test-pat' },
  };

  it('can be instantiated', () => {
    const client = new AdoClient(options);
    expect(client).toBeInstanceOf(AdoClient);
  });

  it('listProjects throws not-implemented', async () => {
    const client = new AdoClient(options);
    await expect(client.listProjects()).rejects.toThrow('Not implemented');
  });

  it('getWorkItem throws not-implemented', async () => {
    const client = new AdoClient(options);
    await expect(client.getWorkItem('my-project', 1)).rejects.toThrow('Not implemented');
  });

  it('queryWorkItems throws not-implemented', async () => {
    const client = new AdoClient(options);
    await expect(client.queryWorkItems('my-project', 'SELECT * FROM WorkItems')).rejects.toThrow(
      'Not implemented',
    );
  });
});
