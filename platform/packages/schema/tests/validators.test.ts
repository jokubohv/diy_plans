/**
 * Direct validator tests for the schema package (review finding 11: the package was only
 * exercised indirectly through compiler tests).
 */
import { describe, expect, it } from 'vitest';
import {
  AUTHORED_FILE_NAMES,
  findUnsupportedCapabilities,
  validateAuthoredFile,
  validateCompiledGuide,
} from '../src/index';

const validManifest = {
  schema: 'diy-guide',
  schemaVersion: '0.1.0',
  contentVersion: 'TEST',
  packageRevision: 1,
  minimumBuilderVersion: '0.1.0',
  capabilities: [],
};

describe('authored file validators', () => {
  it('accepts a valid manifest and rejects a missing field with a path', () => {
    expect(validateAuthoredFile('manifest.json', validManifest).valid).toBe(true);
    const result = validateAuthoredFile('manifest.json', { schema: 'diy-guide' });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.instancePath === '$')).toBe(true);
  });

  it('exposes every authored file name and a validator for each', () => {
    expect(AUTHORED_FILE_NAMES).toHaveLength(17);
    for (const file of AUTHORED_FILE_NAMES) {
      const result = validateAuthoredFile(file, file.endsWith('.json') ? {} : null);
      expect(result.valid, `${file} must reject an empty document`).toBe(false);
    }
  });

  it('enforces the discriminated operation parameter contract', () => {
    const fastenOperation = {
      id: 'op.x',
      title: 'x',
      kind: 'fasten',
      targetPartIds: [],
      dependencyOperationIds: [],
      citationIds: [],
      declaredReleaseStatus: 'held',
      stateEffects: [],
      view: { highlightPartIds: [], hiddenPartIds: [], recipe: {} },
      parameters: {},
    };
    expect(validateAuthoredFile('operations.json', [fastenOperation]).valid).toBe(false);
    expect(
      validateAuthoredFile('operations.json', [
        { ...fastenOperation, parameters: { connectionIds: ['connection.x'], proposed: true } },
      ]).valid,
    ).toBe(true);
  });

  it('validates a minimal compiled guide shape strictly', () => {
    const result = validateCompiledGuide({ schema: 'diy-guide-compiled', schemaVersion: '0.1.0' });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.keyword === 'required')).toBe(true);
  });

  it('rejects unknown authored files instead of passing silently', () => {
    expect(() => validateAuthoredFile('nope.json' as never, {})).toThrow(/Unknown authored file/);
  });
});

describe('capability support', () => {
  it('flags required capabilities that the builder does not provide', () => {
    expect(findUnsupportedCapabilities([{ name: 'woodFraming', version: 1 }], [{ name: 'woodFraming', version: 1 }])).toEqual([]);
    expect(findUnsupportedCapabilities([{ name: 'woodFraming', version: 2 }], [{ name: 'woodFraming', version: 1 }])).toHaveLength(1);
    expect(findUnsupportedCapabilities([{ name: 'unknown', version: 1 }], [])).toHaveLength(1);
  });
});
