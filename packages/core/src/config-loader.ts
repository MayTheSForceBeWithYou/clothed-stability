import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseMigrationConfig } from './config.js';
import type { MigrationConfig } from './config.js';

/**
 * Loads a MigrationConfig from a JSON file on disk.
 *
 * @param filePath  Path to the JSON configuration file.
 * @returns         Validated MigrationConfig.
 */
export function loadConfigFromFile(filePath: string): MigrationConfig {
  const absolutePath = resolve(filePath);
  const raw: unknown = JSON.parse(readFileSync(absolutePath, 'utf-8'));
  return parseMigrationConfig(raw);
}
