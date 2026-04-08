import { describe, it, expect } from 'vitest';
import { createLogger } from '../logger.js';

describe('createLogger', () => {
  it('creates a logger with default options', () => {
    const logger = createLogger();
    expect(logger).toBeDefined();
    expect(logger.level).toBe('info');
  });

  it('creates a logger with custom level', () => {
    const logger = createLogger({ level: 'debug' });
    expect(logger.level).toBe('debug');
  });

  it('creates a named logger', () => {
    const logger = createLogger({ name: 'test-logger' });
    expect(logger.bindings()).toMatchObject({ name: 'test-logger' });
  });
});
