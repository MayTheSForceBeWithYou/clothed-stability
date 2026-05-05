import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MigrationJournal } from '../journal.js';
import type { MigrationMapping } from '../journal.js';

let tmpDir: string;
let journalPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'migration-journal-test-'));
  journalPath = join(tmpDir, 'migration-journal.json');
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// addMapping
// ---------------------------------------------------------------------------

describe('addMapping', () => {
  it('adds a new mapping and returns it', () => {
    const journal = new MigrationJournal(journalPath);
    const mapping = journal.addMapping(123, 987, { type: 'User Story' });

    expect(mapping.sourceId).toBe(123);
    expect(mapping.targetId).toBe(987);
    expect(mapping.type).toBe('User Story');
    expect(mapping.status).toBe('migrated');
    expect(mapping.migratedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('defaults status to "migrated" when not provided', () => {
    const journal = new MigrationJournal(journalPath);
    const mapping = journal.addMapping(1, 2, { type: 'Bug' });
    expect(mapping.status).toBe('migrated');
  });

  it('accepts an explicit status', () => {
    const journal = new MigrationJournal(journalPath);
    const mapping = journal.addMapping(1, 2, { type: 'Task', status: 'skipped' });
    expect(mapping.status).toBe('skipped');
  });

  it('is idempotent: re-adding the same mapping returns the existing entry', () => {
    const journal = new MigrationJournal(journalPath);
    const first = journal.addMapping(10, 20, { type: 'Epic' });
    const second = journal.addMapping(10, 20, { type: 'Epic' });

    expect(second).toBe(first); // same object reference
    expect(journal.getAllMappings()).toHaveLength(1);
  });

  it('throws on conflicting mapping (same sourceId, different targetId)', () => {
    const journal = new MigrationJournal(journalPath);
    journal.addMapping(5, 50, { type: 'Feature' });

    expect(() => { journal.addMapping(5, 99, { type: 'Feature' }); }).toThrow(
      /Conflicting mapping for sourceId 5/,
    );
  });
});

// ---------------------------------------------------------------------------
// getTargetId / hasMapping / getMapping
// ---------------------------------------------------------------------------

describe('getTargetId', () => {
  it('returns the target ID for a known source', () => {
    const journal = new MigrationJournal(journalPath);
    journal.addMapping(100, 200, { type: 'Bug' });
    expect(journal.getTargetId(100)).toBe(200);
  });

  it('returns undefined for an unknown source', () => {
    const journal = new MigrationJournal(journalPath);
    expect(journal.getTargetId(999)).toBeUndefined();
  });
});

describe('hasMapping', () => {
  it('returns true for a known source', () => {
    const journal = new MigrationJournal(journalPath);
    journal.addMapping(7, 77, { type: 'Task' });
    expect(journal.hasMapping(7)).toBe(true);
  });

  it('returns false for an unknown source', () => {
    const journal = new MigrationJournal(journalPath);
    expect(journal.hasMapping(7)).toBe(false);
  });
});

describe('getMapping', () => {
  it('returns the full mapping record', () => {
    const journal = new MigrationJournal(journalPath);
    journal.addMapping(42, 84, { type: 'Epic', status: 'pending' });
    const m = journal.getMapping(42);
    expect(m?.sourceId).toBe(42);
    expect(m?.targetId).toBe(84);
    expect(m?.type).toBe('Epic');
    expect(m?.status).toBe('pending');
  });

  it('returns undefined when not found', () => {
    const journal = new MigrationJournal(journalPath);
    expect(journal.getMapping(999)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getAllMappings – deterministic order
// ---------------------------------------------------------------------------

describe('getAllMappings', () => {
  it('returns all mappings sorted by sourceId', () => {
    const journal = new MigrationJournal(journalPath);
    journal.addMapping(30, 300, { type: 'A' });
    journal.addMapping(10, 100, { type: 'B' });
    journal.addMapping(20, 200, { type: 'C' });

    const ids = journal.getAllMappings().map((m: MigrationMapping) => m.sourceId);
    expect(ids).toEqual([10, 20, 30]);
  });

  it('returns an empty array when no mappings exist', () => {
    const journal = new MigrationJournal(journalPath);
    expect(journal.getAllMappings()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// save + load (persistence)
// ---------------------------------------------------------------------------

describe('save and load', () => {
  it('persists mappings to disk and reloads them correctly', () => {
    const writer = new MigrationJournal(journalPath);
    writer.addMapping(1, 11, { type: 'Epic', status: 'migrated' });
    writer.addMapping(2, 22, { type: 'Feature', status: 'migrated' });
    writer.save();

    const reader = new MigrationJournal(journalPath);
    reader.load();

    expect(reader.getAllMappings()).toHaveLength(2);
    expect(reader.getTargetId(1)).toBe(11);
    expect(reader.getTargetId(2)).toBe(22);
  });

  it('starts empty when the journal file does not exist', () => {
    const journal = new MigrationJournal(journalPath);
    journal.load(); // file doesn't exist yet
    expect(journal.getAllMappings()).toHaveLength(0);
  });

  it('creates the output directory if it does not exist', () => {
    const nestedPath = join(tmpDir, 'nested', 'deep', 'journal.json');
    const journal = new MigrationJournal(nestedPath);
    journal.addMapping(3, 33, { type: 'Task' });
    expect(() => { journal.save(); }).not.toThrow();

    const reader = new MigrationJournal(nestedPath);
    reader.load();
    expect(reader.getTargetId(3)).toBe(33);
  });

  it('preserves mapping order (sorted by sourceId) after round-trip', () => {
    const writer = new MigrationJournal(journalPath);
    writer.addMapping(50, 500, { type: 'X' });
    writer.addMapping(10, 100, { type: 'Y' });
    writer.addMapping(30, 300, { type: 'Z' });
    writer.save();

    const reader = new MigrationJournal(journalPath);
    reader.load();
    const ids = reader.getAllMappings().map((m: MigrationMapping) => m.sourceId);
    expect(ids).toEqual([10, 30, 50]);
  });
});

// ---------------------------------------------------------------------------
// Idempotency across save + load cycles
// ---------------------------------------------------------------------------

describe('idempotency', () => {
  it('does not create a duplicate when the same mapping is added after a reload', () => {
    const writer = new MigrationJournal(journalPath);
    writer.addMapping(55, 555, { type: 'Bug' });
    writer.save();

    const reloader = new MigrationJournal(journalPath);
    reloader.load();
    // same mapping again – must be idempotent
    const result = reloader.addMapping(55, 555, { type: 'Bug' });
    expect(result.targetId).toBe(555);
    expect(reloader.getAllMappings()).toHaveLength(1);
  });

  it('still rejects a conflicting mapping after reload', () => {
    const writer = new MigrationJournal(journalPath);
    writer.addMapping(77, 770, { type: 'Task' });
    writer.save();

    const reloader = new MigrationJournal(journalPath);
    reloader.load();
    expect(() => { reloader.addMapping(77, 999, { type: 'Task' }); }).toThrow(
      /Conflicting mapping for sourceId 77/,
    );
  });
});

// ---------------------------------------------------------------------------
// Error handling – corrupted file
// ---------------------------------------------------------------------------

describe('corrupted file handling', () => {
  it('throws a descriptive error when the file contains invalid JSON', () => {
    writeFileSync(journalPath, '{ this is not valid json }', 'utf-8');
    const journal = new MigrationJournal(journalPath);
    expect(() => { journal.load(); }).toThrow(/invalid JSON/);
  });

  it('throws a descriptive error when the JSON structure is invalid', () => {
    writeFileSync(journalPath, JSON.stringify({ unexpected: true }), 'utf-8');
    const journal = new MigrationJournal(journalPath);
    expect(() => { journal.load(); }).toThrow(/unexpected structure/);
  });

  it('throws a descriptive error when mappings contain invalid entries', () => {
    const badData = {
      version: 1,
      mappings: [{ sourceId: 'not-a-number', targetId: 1, type: 'Bug', migratedAt: 'x', status: 'migrated' }],
    };
    writeFileSync(journalPath, JSON.stringify(badData), 'utf-8');
    const journal = new MigrationJournal(journalPath);
    expect(() => { journal.load(); }).toThrow(/unexpected structure/);
  });

  it('throws a descriptive error when the file cannot be read', () => {
    // Point to a directory instead of a file so readFileSync throws EISDIR.
    mkdirSync(journalPath);
    const journal = new MigrationJournal(journalPath);
    expect(() => { journal.load(); }).toThrow(/Failed to read/);
  });
});
