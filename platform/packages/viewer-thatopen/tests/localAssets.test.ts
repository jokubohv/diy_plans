/**
 * Local-asset policy tests. These pin the rule that the harness never lets the candidate
 * library reach out to a CDN: the upstream `getWorker()` / `autoSetWasm` defaults fetch from
 * unpkg.com, so the harness must emit the worker as a local asset and resolve web-ifc's WASM
 * from the local build output.
 */
import { describe, expect, it } from 'vitest';
import {
  assertLocalAssetUrl,
  isRemoteAssetUrl,
  wasmDirectoryFromAssetUrl,
} from '../src/index';

describe('isRemoteAssetUrl', () => {
  it('flags protocol URLs and protocol-relative URLs', () => {
    expect(isRemoteAssetUrl('https://unpkg.com/@thatopen/fragments@3.4.7/worker.mjs')).toBe(true);
    expect(isRemoteAssetUrl('http://localhost:4321/assets/worker.mjs')).toBe(true);
    expect(isRemoteAssetUrl('//cdn.example.com/worker.mjs')).toBe(true);
    expect(isRemoteAssetUrl('data:text/javascript,void 0')).toBe(true);
  });

  it('accepts local build paths', () => {
    expect(isRemoteAssetUrl('/assets/worker-abc123.mjs')).toBe(false);
    expect(isRemoteAssetUrl('./worker.mjs')).toBe(false);
    expect(isRemoteAssetUrl('assets/worker.mjs')).toBe(false);
  });
});

describe('assertLocalAssetUrl', () => {
  it('returns local URLs unchanged', () => {
    expect(assertLocalAssetUrl('/assets/web-ifc-abc.wasm', 'web-ifc wasm')).toBe(
      '/assets/web-ifc-abc.wasm',
    );
  });

  it('throws with context when a remote URL is passed', () => {
    expect(() => assertLocalAssetUrl('https://unpkg.com/web-ifc@0.0.78/', 'web-ifc wasm')).toThrow(
      /web-ifc wasm must be a local asset URL/,
    );
  });
});

describe('wasmDirectoryFromAssetUrl', () => {
  it('returns the directory prefix web-ifc appends file names to', () => {
    expect(wasmDirectoryFromAssetUrl('/assets/web-ifc-abc123.wasm')).toBe('/assets/');
    expect(wasmDirectoryFromAssetUrl('/node_modules/web-ifc/web-ifc.wasm')).toBe(
      '/node_modules/web-ifc/',
    );
  });

  it('throws when there is no directory segment', () => {
    expect(() => wasmDirectoryFromAssetUrl('web-ifc.wasm')).toThrow(/no directory segment/);
  });
});
