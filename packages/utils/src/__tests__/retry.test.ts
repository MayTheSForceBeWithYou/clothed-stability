import { describe, it, expect, vi } from 'vitest';
import { withRetry, createThrottle } from '../retry.js';

describe('withRetry', () => {
  it('returns value on first attempt', async () => {
    const fn = vi.fn().mockResolvedValueOnce('ok');
    const result = await withRetry(fn, { baseDelayMs: 0 });
    expect(result.value).toBe('ok');
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 });

    expect(result.value).toBe('success');
    expect(result.attempts).toBe(2);
  });

  it('throws after exhausting all attempts', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('always fails'))
      .mockRejectedValueOnce(new Error('always fails'))
      .mockRejectedValueOnce(new Error('always fails'));

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry when isRetryable returns false', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('non-retryable'));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 0, isRetryable: () => false }),
    ).rejects.toThrow('non-retryable');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects maxAttempts setting', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { maxAttempts: 5, baseDelayMs: 0 });
    expect(result.attempts).toBe(3);
  });
});

describe('createThrottle', () => {
  it('limits concurrent executions', async () => {
    const throttle = createThrottle(2);
    let active = 0;
    let maxActive = 0;

    const task = (): Promise<void> =>
      throttle(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((r) => setTimeout(r, 10));
        active--;
      });

    await Promise.all([task(), task(), task(), task()]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
