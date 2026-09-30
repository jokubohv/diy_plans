/**
 * Contract tests: the authored fixture bundle and schema accept/reject behaviour.
 */
import { describe, expect, it } from 'vitest';
import {
  AUTHORED_FILE_NAMES,
  validateAuthoredFile,
  validateCompiledGuide,
  type AuthoredFileName,
} from '@diyguide/schema';
import { compileBundle } from '../../src/index';
import { FIXTURE_DIR, loadFixture, validateFixture } from '../helpers';

describe('authored fixture schema', () => {
  it('validates all 17 authored files with zero blocking errors and zero warnings', () => {
    const load = loadFixture();
    for (const fileName of AUTHORED_FILE_NAMES) {
      const raw = load.rawFiles[fileName];
      expect(raw, `${fileName} parsed`).toBeDefined();
      const result = validateAuthoredFile(fileName, raw);
      expect(result.issues, `${fileName} schema issues`).toEqual([]);
    }
    const report = validateFixture();
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('rejects an authored file that violates the frozen schema', () => {
    const load = loadFixture();
    const parts = structuredClone(load.rawFiles['parts.json']) as Array<Record<string, unknown>>;
    parts[0]!['geometry'] = { shape: 'box', sizeMm: [1, 2] };
    const result = validateAuthoredFile('parts.json', parts);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('rejects an unknown authored file name', () => {
    expect(() => validateAuthoredFile('not-a-file.json' as AuthoredFileName, {})).toThrow();
  });

  it('compiles the fixture into a schema-valid compiled guide', () => {
    const load = loadFixture();
    const { compiled, report } = compileBundle({
      bundle: load.bundle,
      files: load.files,
      rawFiles: load.rawFiles,
      bundleDir: FIXTURE_DIR,
    });
    expect(report.ok).toBe(true);
    expect(compiled).not.toBeNull();
    const validation = validateCompiledGuide(compiled);
    expect(validation.issues).toEqual([]);
    expect(compiled!.schema).toBe('diy-guide-compiled');
    expect(compiled!.parts).toHaveLength(32);
  });
});
