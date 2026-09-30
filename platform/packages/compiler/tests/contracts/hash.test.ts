/**
 * Contract tests: hash contract (architecture.md §4).
 *
 * Canonical JSON, file digests, source-set hash determinism, content-hash exclusions and
 * byte-identical repeated compilation.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  compileBundle,
  contentHashOfCompiled,
  fileSha256,
  sha256Hex,
  sha256Prefixed,
  sourceSetHashFor,
} from '../../src/index';
import { FIXTURE_DIR, loadFixture, makeTempDir } from '../helpers';

describe('canonicalJson', () => {
  it('sorts object keys recursively and preserves array order', () => {
    expect(canonicalJson({ b: 1, a: { z: 1, y: [3, 1, 2] } })).toBe('{"a":{"y":[3,1,2],"z":1},"b":1}');
    expect(canonicalJson([{ b: 1, a: 2 }, 'x'])).toBe('[{"a":2,"b":1},"x"]');
  });

  it('drops undefined object properties and encodes scalars with JSON.stringify', () => {
    expect(canonicalJson({ b: undefined, a: 'x' })).toBe('{"a":"x"}');
    expect(canonicalJson({ a: null, b: true, c: 1.5 })).toBe('{"a":null,"b":true,"c":1.5}');
  });

  it('supports pretty printing with sorted keys', () => {
    expect(canonicalJson({ b: 1, a: 2 }, 2)).toBe('{\n  "a": 2,\n  "b": 1\n}');
  });
});

describe('sha256 helpers', () => {
  it('hashes with the frozen sha256:<hex> form', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Prefixed('')).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('hashes files with byte counts', () => {
    const dir = makeTempDir();
    const path = join(dir, 'x.json');
    writeFileSync(path, 'hello');
    const digest = fileSha256(path);
    expect(digest.bytes).toBe(5);
    expect(digest.sha256).toBe(sha256Prefixed('hello'));
  });
});

describe('compiled hashes', () => {
  it('is deterministic: compiling twice produces byte-identical guide JSON', () => {
    const load = loadFixture();
    const first = compileBundle({ bundle: load.bundle, files: load.files, rawFiles: load.rawFiles, bundleDir: FIXTURE_DIR });
    const second = compileBundle({ bundle: load.bundle, files: load.files, rawFiles: load.rawFiles, bundleDir: FIXTURE_DIR });
    expect(first.compiled).not.toBeNull();
    expect(second.compiled).not.toBeNull();
    const firstBytes = `${canonicalJson(first.compiled, 2)}\n`;
    const secondBytes = `${canonicalJson(second.compiled, 2)}\n`;
    expect(firstBytes).toBe(secondBytes);
    expect(first.compiled!.meta.contentHash).toBe(second.compiled!.meta.contentHash);
    expect(first.compiled!.meta.sourceSetHash).toBe(second.compiled!.meta.sourceSetHash);
  });

  it('excludes meta, stats and idMap from contentHash', () => {
    const load = loadFixture();
    const { compiled } = compileBundle({ bundle: load.bundle, files: load.files, rawFiles: load.rawFiles, bundleDir: FIXTURE_DIR });
    const clone = structuredClone(compiled) as unknown as Record<string, unknown>;
    const baseline = contentHashOfCompiled(clone);
    clone['stats'] = { changed: true };
    clone['idMap'] = { changed: true };
    clone['meta'] = { changed: true };
    expect(contentHashOfCompiled(clone)).toBe(baseline);
    const parts = structuredClone(clone['parts']) as Array<Record<string, unknown>>;
    parts[0]!['name'] = 'changed';
    clone['parts'] = parts;
    expect(contentHashOfCompiled(clone)).not.toBe(baseline);
  });

  it('computes a deterministic source-set hash over authored files and public assets', () => {
    const load = loadFixture();
    const assets = ['assets/source-pages/fixture-sheet-a.svg', 'assets/source-pages/fixture-sheet-c.svg'];
    const first = sourceSetHashFor(FIXTURE_DIR, load.files as Record<string, { path: string; relPath?: string; sha256: string }>, assets);
    const second = sourceSetHashFor(FIXTURE_DIR, load.files as Record<string, { path: string; relPath?: string; sha256: string }>, assets);
    expect(first).toBe(second);
    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/);
    const withExtraAsset = sourceSetHashFor(FIXTURE_DIR, load.files as Record<string, { path: string; relPath?: string; sha256: string }>, [...assets, 'assets/source-pages/fixture-sheet-b.svg']);
    expect(withExtraAsset).not.toBe(first);
  });
});
