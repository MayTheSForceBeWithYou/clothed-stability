import pino from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LoggerOptions {
  level?: LogLevel;
  name?: string;
  pretty?: boolean;
}

/**
 * Creates a structured pino logger instance.
 */
export function createLogger(options: LoggerOptions = {}): pino.Logger {
  const { level = 'info', name, pretty = false } = options;

  const baseOptions: pino.LoggerOptions = { level };
  if (name !== undefined) {
    baseOptions.name = name;
  }

  if (pretty) {
    baseOptions.transport = {
      target: 'pino-pretty',
      options: { colorize: true },
    };
  }

  return pino(baseOptions);
}

export type Logger = pino.Logger;
