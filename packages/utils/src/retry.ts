export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /** Base delay in milliseconds before the first retry. Default: 100 */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds. Default: 5000 */
  maxDelayMs?: number;
  /** Jitter factor (0–1). Default: 0.1 */
  jitter?: number;
  /** Optional predicate to determine whether an error is retryable. Default: always retry */
  isRetryable?: (error: unknown) => boolean;
}

export interface RetryResult<T> {
  value: T;
  attempts: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelay(attempt: number, baseDelayMs: number, maxDelayMs: number, jitter: number): number {
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, maxDelayMs);
  const jitterAmount = capped * jitter * Math.random();
  return Math.round(capped + jitterAmount);
}

/**
 * Retries an async operation with exponential back-off and optional jitter.
 *
 * @param fn        The async function to execute.
 * @param options   Retry configuration options.
 * @returns         The result of the operation together with the number of attempts made.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    baseDelayMs = 100,
    maxDelayMs = 5000,
    jitter = 0.1,
    isRetryable = (): boolean => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await fn();
      return { value, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isRetryable(error)) {
        break;
      }
      const delay = computeDelay(attempt, baseDelayMs, maxDelayMs, jitter);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Creates a throttled version of an async function that limits concurrent
 * executions.
 *
 * @param concurrency  Maximum number of simultaneous executions.
 */
export function createThrottle(concurrency: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: Array<() => void> = [];

  function next(): void {
    if (queue.length > 0 && active < concurrency) {
      active++;
      const resolve = queue.shift();
      resolve?.();
    }
  }

  return async function throttle<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      queue.push(resolve);
      next();
    });

    try {
      return await fn();
    } finally {
      active--;
      next();
    }
  };
}
