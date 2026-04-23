import { describe, it, expect } from 'vitest';
import { parseBulkUpdateSpec } from '../spec.js';

const validBase = {
  project: 'MyProject',
  selection: { ids: [1, 2, 3] },
  operations: { setFields: { 'System.Title': 'Updated' } },
};

describe('parseBulkUpdateSpec', () => {
  it('accepts a valid full spec', () => {
    const spec = parseBulkUpdateSpec({
      project: 'MyProject',
      selection: { ids: [1, 2], wiql: 'SELECT [System.Id] FROM WorkItems' },
      operations: {
        setFields: { 'System.Priority': 2 },
        clearFields: ['System.Description'],
        addTags: ['important'],
        removeTags: ['obsolete'],
      },
      options: {
        dryRun: false,
        skipClosedItems: false,
        continueOnError: false,
        batchSize: 50,
        markerTag: 'bulk-updated',
      },
    });
    expect(spec.project).toBe('MyProject');
    expect(spec.options.dryRun).toBe(false);
    expect(spec.options.batchSize).toBe(50);
  });

  it('accepts spec with only ids selection', () => {
    const spec = parseBulkUpdateSpec({ ...validBase });
    expect(spec.selection.ids).toEqual([1, 2, 3]);
  });

  it('accepts spec with only wiql selection', () => {
    const spec = parseBulkUpdateSpec({
      project: 'MyProject',
      selection: { wiql: 'SELECT [System.Id] FROM WorkItems' },
      operations: { addTags: ['test'] },
    });
    expect(spec.selection.wiql).toBeDefined();
  });

  it('rejects spec with neither ids nor wiql', () => {
    expect(() =>
      parseBulkUpdateSpec({
        project: 'MyProject',
        selection: {},
        operations: { setFields: { 'System.Title': 'x' } },
      }),
    ).toThrow();
  });

  it('rejects spec with no operations', () => {
    expect(() =>
      parseBulkUpdateSpec({
        project: 'MyProject',
        selection: { ids: [1] },
        operations: {},
      }),
    ).toThrow();
  });

  it('rejects empty project string', () => {
    expect(() =>
      parseBulkUpdateSpec({ ...validBase, project: '' }),
    ).toThrow();
  });

  it('rejects batchSize of 0', () => {
    expect(() =>
      parseBulkUpdateSpec({
        ...validBase,
        options: { batchSize: 0 },
      }),
    ).toThrow();
  });

  it('rejects batchSize of 201', () => {
    expect(() =>
      parseBulkUpdateSpec({
        ...validBase,
        options: { batchSize: 201 },
      }),
    ).toThrow();
  });

  it('applies defaults for options', () => {
    const spec = parseBulkUpdateSpec(validBase);
    expect(spec.options.dryRun).toBe(true);
    expect(spec.options.skipClosedItems).toBe(true);
    expect(spec.options.continueOnError).toBe(true);
    expect(spec.options.batchSize).toBe(25);
    expect(spec.options.markerTag).toBeUndefined();
  });
});
