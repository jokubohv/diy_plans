/**
 * Operations tests: the eight negative fixtures from docs/fixture-p0.md.
 *
 * All mutations happen in memory (or in a temp copy for the MISSING_FILE case); invalid bundles
 * are never written into the repository.
 */
import { describe, expect, it } from 'vitest';
import type { Connection, Operation } from '@diyguide/schema';
import { compileBundle, loadAuthoredBundle, validateBundle } from '../../src/index';
import { copyFixtureWithout, errorCodes, FIXTURE_DIR, loadFixture, validateMutation } from '../helpers';

describe('negative fixtures', () => {
  it('1. falsely ready fasten operation with held connections -> MISSING_FASTENER_PATTERN', () => {
    const report = validateMutation((bundle) => {
      const fasten = bundle.operations.find((op) => op.id === 'op.fasten-backing')!;
      fasten.declaredReleaseStatus = 'ready';
    });
    expect(report.ok).toBe(false);
    expect(errorCodes(report)).toEqual(['MISSING_FASTENER_PATTERN']);
  });

  it('2. ready cut with null finalLengthMm -> SCHEMA_INVALID and READY_OP_MISSING_PARAMETERS', () => {
    const report = validateMutation((bundle) => {
      const cut = bundle.operations.find((op) => op.id === 'op.cut-backing') as Operation & {
        parameters: { cuts: { partId: string; finalLengthMm: string | null }[] };
      };
      cut.declaredReleaseStatus = 'ready';
      cut.parameters.cuts[0]!.finalLengthMm = null;
    });
    expect(report.ok).toBe(false);
    expect(errorCodes(report)).toEqual(['READY_OP_MISSING_PARAMETERS', 'SCHEMA_INVALID']);
  });

  it('3. operation without any citation -> MISSING_CITATION', () => {
    const report = validateMutation((bundle) => {
      bundle.operations.find((op) => op.id === 'op.survey-wall')!.citationIds = [];
    });
    expect(report.ok).toBe(false);
    expect(errorCodes(report)).toEqual(['MISSING_CITATION']);
  });

  it('4. operation dependency cycle -> CYCLIC_DEPENDENCY', () => {
    const report = validateMutation((bundle) => {
      bundle.operations.find((op) => op.id === 'op.position-backing')!.dependencyOperationIds = ['op.cover-drywall'];
    });
    expect(report.ok).toBe(false);
    expect(errorCodes(report)).toEqual(['CYCLIC_DEPENDENCY']);
  });

  it('5. required dependency on a superseded connection -> SUPERSEDED_DEPENDENCY', () => {
    const report = validateMutation((bundle) => {
      const connection = bundle.connections.connections.find((candidate) => candidate.id === 'connection.backing-a.stud-2') as Connection;
      connection.declaredReleaseStatus = 'superseded';
    });
    expect(report.ok).toBe(false);
    expect(errorCodes(report)).toEqual(['SUPERSEDED_DEPENDENCY']);
  });

  it('6. cover without inspection in the dependency closure -> COVERAGE_BEFORE_INSPECTION', () => {
    const report = validateMutation((bundle) => {
      bundle.operations.find((op) => op.id === 'op.cover-drywall')!.dependencyOperationIds = [];
    });
    expect(report.ok).toBe(false);
    expect(errorCodes(report)).toEqual(['COVERAGE_BEFORE_INSPECTION']);
  });

  it('7. missing authored file -> MISSING_FILE', () => {
    const copy = copyFixtureWithout('project.json');
    try {
      const load = loadAuthoredBundle(copy.dir);
      expect(load.bundle).toBeNull();
      const report = validateBundle({
        bundle: null,
        files: load.files,
        rawFiles: load.rawFiles,
        loadErrors: load.errors,
        bundleDir: copy.dir,
      });
      expect(report.ok).toBe(false);
      expect(errorCodes(report)).toEqual(['MISSING_FILE']);
      const { compiled } = compileBundle({
        bundle: null,
        files: load.files,
        rawFiles: load.rawFiles,
        loadErrors: load.errors,
        bundleDir: copy.dir,
      });
      expect(compiled).toBeNull();
    } finally {
      copy.cleanup();
    }
  });

  it('8. unsupported required capability -> UNSUPPORTED_CAPABILITY', () => {
    const report = validateMutation((bundle) => {
      bundle.manifest.capabilities.push({ name: 'notReal', version: 1 });
    });
    expect(report.ok).toBe(false);
    expect(errorCodes(report)).toEqual(['UNSUPPORTED_CAPABILITY']);
  });

  it('the unmutated fixture stays clean (control)', () => {
    const load = loadFixture();
    const report = validateBundle({
      bundle: load.bundle,
      files: load.files,
      rawFiles: load.rawFiles,
      bundleDir: FIXTURE_DIR,
    });
    expect(errorCodes(report)).toEqual([]);
  });
});
