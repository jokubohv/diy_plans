/**
 * R35 determinism test: compiling the same authored bundle twice yields byte-identical
 * guide.compiled.json output, and the R35 contentHash is stable.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson, compileBundle, writeCompiled } from '../../src/index';
import { makeTempDir } from '../helpers';
import { compileR35, loadR35, R35_DIR } from './helpers';

describe('R35 deterministic compilation', () => {
  it('compiles twice to identical canonical JSON and a stable contentHash', () => {
    const loadOne = loadR35();
    const first = compileBundle({
      bundle: loadOne.bundle,
      files: loadOne.files,
      rawFiles: loadOne.rawFiles,
      loadErrors: loadOne.errors,
      bundleDir: R35_DIR,
    });
    const loadTwo = loadR35();
    const second = compileBundle({
      bundle: loadTwo.bundle,
      files: loadTwo.files,
      rawFiles: loadTwo.rawFiles,
      loadErrors: loadTwo.errors,
      bundleDir: R35_DIR,
    });
    expect(first.compiled).not.toBeNull();
    expect(second.compiled).not.toBeNull();
    expect(canonicalJson(first.compiled)).toBe(canonicalJson(second.compiled));
    expect(first.compiled?.meta.contentHash).toBe(second.compiled?.meta.contentHash);
    expect(first.compiled?.meta.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(first.compiled?.meta.sourceSetHash).toBe(second.compiled?.meta.sourceSetHash);
  });

  it('writes byte-identical compiled artifacts across separate output directories', async () => {
    const one = makeTempDir();
    const two = makeTempDir();
    const load = loadR35();
    const { compiled, report } = compileBundle({
      bundle: load.bundle,
      files: load.files,
      rawFiles: load.rawFiles,
      loadErrors: load.errors,
      bundleDir: R35_DIR,
    });
    if (!compiled) throw new Error('R35 did not compile');
    const first = writeCompiled(one, compiled, report);
    const second = writeCompiled(two, compiled, report);
    for (const [a, b] of [
      [first.compiledPath, second.compiledPath],
      [first.reportPath, second.reportPath],
      [first.idMapPath, second.idMapPath],
    ] as const) {
      expect(readFileSync(a, 'utf8')).toBe(readFileSync(b, 'utf8'));
    }
    const written = JSON.parse(readFileSync(join(one, 'compiled', 'guide.compiled.json'), 'utf8')) as { meta: { contentHash: string } };
    expect(written.meta.contentHash).toBe(compiled.meta.contentHash);
  });

  it('reports the expected catalogue counts for the R35 project', () => {
    const { compiled } = compileR35();
    expect(compiled.stats.operationCount).toBe(47);
    expect(compiled.stats.stepCount).toBe(26);
    expect(compiled.stats.readyOperationCount).toBe(9);
    expect(compiled.stats.conditionalOperationCount).toBe(3);
    expect(compiled.stats.heldOperationCount).toBe(35);
    expect(compiled.stats.partCount).toBe(89);
    expect(compiled.stats.takeoffPartCount).toBe(58);
    expect(compiled.stats.openIssueCount).toBeGreaterThanOrEqual(30);
  });
});
