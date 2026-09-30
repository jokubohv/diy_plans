/**
 * Hash contract (architecture.md §4, frozen).
 *
 * - Canonical JSON: recursively sort object keys, preserve array order, JSON.stringify scalar
 *   encoding. `contentHash`/`sourceSetHash` are `sha256:<64 lowercase hex>`.
 * - `sourceSetHash` = sha256 of the newline-joined, sorted lines
 *   `sha256:<hex of file><two spaces><path relative to the bundle dir>` over every authored file
 *   and every file referenced by a public source `assetPath`. Lines are sorted by path (the
 *   manifest-style ordering); see the P0 evidence notes for this interpretation of the frozen
 *   "sorted lines" wording.
 * - `contentHash` = sha256 of canonical JSON of the semantic subset of the compiled guide
 *   (excludes `meta`, `stats`, `idMap`; no timestamps anywhere).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sep } from 'node:path';
import { resolve } from 'node:path';

/** Recursively key-sorted clone with undefined object properties dropped (JSON semantics). */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const item = source[key];
      if (item === undefined) continue;
      out[key] = normalize(item);
    }
    return out;
  }
  return value;
}

/** Canonical JSON string (recursive key sort, array order preserved). */
export function canonicalJson(value: unknown, space = 0): string {
  const result = JSON.stringify(normalize(value), null, space);
  return result === undefined ? 'null' : result;
}

/** Raw lowercase SHA-256 hex of a string or byte buffer. */
export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** `sha256:<64 hex>` form used throughout the frozen contracts. */
export function sha256Prefixed(data: string | Uint8Array): string {
  return `sha256:${sha256Hex(data)}`;
}

export interface FileDigest {
  /** `sha256:<64 hex>` over the raw file bytes. */
  sha256: string;
  bytes: number;
}

export function fileSha256(path: string): FileDigest {
  const buffer = readFileSync(path);
  return { sha256: sha256Prefixed(buffer), bytes: buffer.byteLength };
}

function toPosixPath(path: string): string {
  return path.split(sep).join('/');
}

/**
 * Compute the source-set hash over the authored files (keys of `fileMap`) plus the given
 * bundle-relative asset paths. Files are hashed from disk at call time.
 */
export function sourceSetHashFor(
  bundleDir: string,
  fileMap: Record<string, { path: string; relPath?: string; sha256: string }>,
  assetPaths: readonly string[],
): string {
  const entries: { sortKey: string; line: string }[] = [];
  for (const file of Object.values(fileMap)) {
    const rel = toPosixPath(file.relPath ?? file.path);
    entries.push({ sortKey: rel, line: `${file.sha256}  ${rel}` });
  }
  const seen = new Set<string>();
  for (const assetPath of assetPaths) {
    const rel = toPosixPath(assetPath);
    if (seen.has(rel)) continue;
    seen.add(rel);
    const digest = fileSha256(resolve(bundleDir, rel));
    entries.push({ sortKey: rel, line: `${digest.sha256}  ${rel}` });
  }
  entries.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  return sha256Prefixed(entries.map((entry) => entry.line).join('\n'));
}

/** Semantic subset keys hashed into `contentHash` (frozen order not significant; sorted on write). */
export const CONTENT_HASH_KEYS = [
  'project',
  'datums',
  'sources',
  'citations',
  'measurements',
  'assemblies',
  'parts',
  'materials',
  'tools',
  'systems',
  'connections',
  'fastenerSpecs',
  'operations',
  'steps',
  'views',
  'issues',
  'overlays',
  'stepStates',
] as const;

/** `contentHash` of a compiled guide: canonical JSON of the semantic subset only. */
export function contentHashOfCompiled(compiled: Record<string, unknown>): string {
  const subset: Record<string, unknown> = {};
  for (const key of CONTENT_HASH_KEYS) subset[key] = compiled[key];
  return sha256Prefixed(canonicalJson(subset));
}
