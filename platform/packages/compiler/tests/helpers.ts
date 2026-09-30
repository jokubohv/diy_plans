/**
 * Shared test helpers for @diyguide/compiler.
 *
 * The fixture lives at platform/projects/p0-fixture/0.1.0; nothing here mutates files on disk
 * (negative fixtures are cloned and mutated in memory; the one MISSING_FILE case uses a temp copy).
 */
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuthoredBundle, AuthoredFileName } from '@diyguide/schema';
import { loadAuthoredBundle, toRawFiles, validateBundle, type LoadResult, type ValidationReport } from '../src/index';

export const FIXTURE_DIR = fileURLToPath(new URL('../../../projects/p0-fixture/0.1.0', import.meta.url));

export function loadFixture(): LoadResult {
  const result = loadAuthoredBundle(FIXTURE_DIR);
  if (!result.bundle) {
    throw new Error(`Fixture bundle failed to load: ${result.errors.map((e) => e.code).join(', ')}`);
  }
  return result;
}

export function validateFixture(): ValidationReport {
  const load = loadFixture();
  return validateBundle({
    bundle: load.bundle,
    files: load.files,
    rawFiles: load.rawFiles,
    bundleDir: FIXTURE_DIR,
  });
}

export function cloneBundle(bundle: AuthoredBundle): AuthoredBundle {
  return structuredClone(bundle);
}

/** Validate an in-memory mutation of the fixture (schema checks included). */
export function validateMutation(mutate: (bundle: AuthoredBundle) => void): ValidationReport {
  const load = loadFixture();
  const mutated = cloneBundle(load.bundle as AuthoredBundle);
  mutate(mutated);
  return validateBundle({
    bundle: mutated,
    rawFiles: toRawFiles(mutated),
    files: {},
    bundleDir: FIXTURE_DIR,
  });
}

export function errorCodes(report: ValidationReport): string[] {
  return [...new Set([...report.errors.map((error) => error.code), ...report.warnings.map((error) => error.code)])].sort();
}

export function makeTempDir(prefix = 'diyguide-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Copy the fixture to a temp directory, optionally dropping one authored file. */
export function copyFixtureWithout(fileToDrop: AuthoredFileName): { dir: string; cleanup: () => void } {
  const dir = makeTempDir('diyguide-missing-');
  cpSync(FIXTURE_DIR, dir, {
    recursive: true,
    filter: (source) => basename(source) !== fileToDrop || source === FIXTURE_DIR,
  });
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
