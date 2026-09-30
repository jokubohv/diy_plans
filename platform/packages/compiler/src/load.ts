/**
 * Authored bundle loading.
 *
 * `loadAuthoredBundle` reads the 17 authored files, hashes their raw bytes and parses them.
 * Missing or unparsable files are reported as GuideError objects for the validation flow; the
 * loader itself does not throw for those conditions.
 */
import {
  AUTHORED_FILE_NAMES,
  type AuthoredBundle,
  type AuthoredFileName,
  type Acceptance,
  type Assembly,
  type BundleManifest,
  type ConnectionsFile,
  type Datum,
  type Issue,
  type Listing,
  type Material,
  type Measurement,
  type Operation,
  type Part,
  type Project,
  type SourcesFile,
  type Step,
  type System,
  type Tool,
  type ViewPreset,
} from '@diyguide/schema';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { guideError, type GuideError } from './errors';
import { sha256Prefixed } from './hash';

export interface LoadedFile {
  /** Absolute path on disk. */
  path: string;
  /** Path relative to the bundle directory (POSIX separators). */
  relPath: string;
  /** `sha256:<64 hex>` of the raw file bytes. */
  sha256: string;
  bytes: number;
}

export interface LoadResult {
  /** Null when any authored file is missing or unparsable. */
  bundle: AuthoredBundle | null;
  files: Partial<Record<AuthoredFileName, LoadedFile>>;
  rawFiles: Partial<Record<AuthoredFileName, unknown>>;
  errors: GuideError[];
}

const BUNDLE_KEYS: Record<AuthoredFileName, keyof AuthoredBundle> = {
  'manifest.json': 'manifest',
  'project.json': 'project',
  'datums.json': 'datums',
  'measurements.json': 'measurements',
  'sources.json': 'sources',
  'assemblies.json': 'assemblies',
  'parts.json': 'parts',
  'connections.json': 'connections',
  'materials.json': 'materials',
  'tools.json': 'tools',
  'systems.json': 'systems',
  'operations.json': 'operations',
  'steps.json': 'steps',
  'views.json': 'views',
  'issues.json': 'issues',
  'acceptance.json': 'acceptance',
  'listing.json': 'listing',
};

/** Read + hash + parse a single authored JSON file; errors are returned, never thrown. */
export function loadAuthoredFile(bundleDir: string, fileName: AuthoredFileName): { file: LoadedFile; data: unknown } | { error: GuideError } {
  const path = join(bundleDir, fileName);
  let buffer: Buffer;
  try {
    if (!existsSync(path) || !statSync(path).isFile()) {
      return {
        error: guideError({
          code: 'MISSING_FILE',
          file: fileName,
          jsonPath: '$',
          objectId: null,
          expected: 'authored file exists in the bundle directory',
          actual: 'missing',
        }),
      };
    }
    buffer = readFileSync(path);
  } catch (cause) {
    return {
      error: guideError({
        code: 'MISSING_FILE',
        file: fileName,
        jsonPath: '$',
        objectId: null,
        expected: 'authored file readable from the bundle directory',
        actual: `read failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
    };
  }
  let data: unknown;
  try {
    data = JSON.parse(buffer.toString('utf8'));
  } catch (cause) {
    return {
      error: guideError({
        code: 'SCHEMA_INVALID',
        file: fileName,
        jsonPath: '$',
        objectId: null,
        expected: 'valid JSON document',
        actual: `JSON parse failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
    };
  }
  return {
    file: { path, relPath: fileName, sha256: sha256Prefixed(buffer), bytes: buffer.byteLength },
    data,
  };
}

/** Load every authored file of a bundle directory. */
export function loadAuthoredBundle(bundleDir: string): LoadResult {
  const files: Partial<Record<AuthoredFileName, LoadedFile>> = {};
  const rawFiles: Partial<Record<AuthoredFileName, unknown>> = {};
  const errors: GuideError[] = [];
  for (const fileName of AUTHORED_FILE_NAMES) {
    const result = loadAuthoredFile(bundleDir, fileName);
    if ('error' in result) {
      errors.push(result.error);
      continue;
    }
    files[fileName] = result.file;
    rawFiles[fileName] = result.data;
  }
  if (errors.length > 0) return { bundle: null, files, rawFiles, errors };

  const raw = rawFiles as Record<AuthoredFileName, unknown>;
  const bundle: AuthoredBundle = {
    manifest: raw['manifest.json'] as BundleManifest,
    project: raw['project.json'] as Project,
    datums: raw['datums.json'] as Datum[],
    measurements: raw['measurements.json'] as Measurement[],
    sources: raw['sources.json'] as SourcesFile,
    assemblies: raw['assemblies.json'] as Assembly[],
    parts: raw['parts.json'] as Part[],
    connections: raw['connections.json'] as ConnectionsFile,
    materials: raw['materials.json'] as Material[],
    tools: raw['tools.json'] as Tool[],
    systems: raw['systems.json'] as System[],
    operations: raw['operations.json'] as Operation[],
    steps: raw['steps.json'] as Step[],
    views: raw['views.json'] as ViewPreset[],
    issues: raw['issues.json'] as Issue[],
    acceptance: raw['acceptance.json'] as Acceptance,
    listing: raw['listing.json'] as Listing,
  };
  return { bundle, files, rawFiles, errors };
}

/** Re-derive the raw-file map from a typed bundle (used for in-memory validation flows). */
export function toRawFiles(bundle: AuthoredBundle): Record<AuthoredFileName, unknown> {
  const raw = {} as Record<AuthoredFileName, unknown>;
  for (const fileName of AUTHORED_FILE_NAMES) {
    raw[fileName] = bundle[BUNDLE_KEYS[fileName]];
  }
  return raw;
}

export { BUNDLE_KEYS };
