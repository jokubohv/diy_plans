import { describe, expect, it } from 'vitest';
import {
  GuideDataError,
  guideDataUrl,
  loadCatalog,
  loadGuide,
  resolveGuideAssetUrl,
} from '../src/data';
import type { FetchLike, FetchResponse } from '../src/data';

interface FakeResponse extends FetchResponse {
  readonly url?: string;
}

function response(data: unknown, status = 200): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

function fetchFrom(routes: Record<string, FakeResponse | Error>): FetchLike {
  return async (url: string) => {
    const hit = routes[url];
    if (!hit) throw new Error(`test fetch: unexpected url ${url}`);
    if (hit instanceof Error) throw hit;
    return hit;
  };
}

function validEntry(): Record<string, unknown> {
  return {
    slug: 'ui-fixture',
    title: 'UI Fixture (test)',
    summary: 'Synthetic entry',
    projectType: 'fixture_demo',
    scope: 'concept',
    revision: '0.1.0',
    updated: '2026-09-29',
    releaseId: 'sha256:aaa',
  };
}

function minimalCompiled(): Record<string, unknown> {
  return {
    schema: 'diy-guide-compiled',
    schemaVersion: '0.1.0',
    meta: {},
    project: {},
    datums: [],
    sources: [],
    citations: [],
    measurements: [],
    assemblies: [],
    parts: [],
    materials: [],
    tools: [],
    systems: [],
    connections: [],
    fastenerSpecs: [],
    operations: [],
    steps: [],
    views: [],
    issues: [],
    overlays: [],
    stepStates: [],
    stats: {},
    idMap: {},
  };
}

describe('loadCatalog', () => {
  it('loads and validates the default catalogue url', async () => {
    const urls: string[] = [];
    const fetchFn: FetchLike = async (url) => {
      urls.push(url);
      return response({ catalogVersion: 1, entries: [validEntry()] });
    };
    const catalog = await loadCatalog(fetchFn);
    expect(urls).toEqual(['/data/catalog.json']);
    expect(catalog.entries).toHaveLength(1);
    expect(catalog.entries[0]!.slug).toBe('ui-fixture');
  });

  it('maps a 404 to a typed not_found error', async () => {
    const fetchFn = fetchFrom({ '/data/catalog.json': response(null, 404) });
    await expect(loadCatalog(fetchFn)).rejects.toMatchObject({
      name: 'GuideDataError',
      kind: 'not_found',
      status: 404,
    });
  });

  it('maps invalid JSON to a typed malformed error', async () => {
    const fetchFn: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    });
    await expect(loadCatalog(fetchFn)).rejects.toBeInstanceOf(GuideDataError);
    await expect(loadCatalog(fetchFn)).rejects.toMatchObject({ kind: 'malformed' });
  });

  it('maps a structurally invalid catalogue to a typed malformed error', async () => {
    const fetchFn = fetchFrom({
      '/data/catalog.json': response({ catalogVersion: 1, entries: [{ title: 'no slug' }] }),
    });
    await expect(loadCatalog(fetchFn)).rejects.toMatchObject({ kind: 'malformed' });
  });

  it('maps fetch rejections to a typed network error', async () => {
    const fetchFn = fetchFrom({ '/data/catalog.json': new TypeError('fetch failed') });
    await expect(loadCatalog(fetchFn)).rejects.toMatchObject({ kind: 'network' });
  });

  it('maps other non-ok responses to a typed server error', async () => {
    const fetchFn = fetchFrom({ '/data/catalog.json': response(null, 500) });
    await expect(loadCatalog(fetchFn)).rejects.toMatchObject({ kind: 'server', status: 500 });
  });
});

describe('loadGuide', () => {
  it('builds the release data url from the base path (colon stays literal)', async () => {
    const urls: string[] = [];
    const fetchFn: FetchLike = async (url) => {
      urls.push(url);
      return response(minimalCompiled());
    };
    const guide = await loadGuide('/data', 'ui-fixture', 'sha256:aaa', fetchFn);
    expect(urls).toEqual(['/data/releases/ui-fixture/sha256:aaa/guide.compiled.json']);
    expect(guide.schema).toBe('diy-guide-compiled');
  });

  it('tolerates a trailing slash on the base path', async () => {
    const urls: string[] = [];
    const fetchFn: FetchLike = async (url) => {
      urls.push(url);
      return response(minimalCompiled());
    };
    await loadGuide('/data/', 'ui-fixture', 'r1', fetchFn);
    expect(urls).toEqual(['/data/releases/ui-fixture/r1/guide.compiled.json']);
  });

  it('maps a 404 to not_found', async () => {
    const fetchFn = fetchFrom({
      '/data/releases/ui-fixture/r1/guide.compiled.json': response(null, 404),
    });
    await expect(loadGuide('/data', 'ui-fixture', 'r1', fetchFn)).rejects.toMatchObject({
      kind: 'not_found',
    });
  });

  it('rejects a JSON document that is not a compiled guide', async () => {
    const fetchFn = fetchFrom({
      '/data/releases/ui-fixture/r1/guide.compiled.json': response({ hello: 'world' }),
    });
    await expect(loadGuide('/data', 'ui-fixture', 'r1', fetchFn)).rejects.toMatchObject({
      kind: 'malformed',
    });
  });

  it('rejects a compiled guide missing required collections', async () => {
    const broken = minimalCompiled();
    delete broken.steps;
    const fetchFn = fetchFrom({
      '/data/releases/ui-fixture/r1/guide.compiled.json': response(broken),
    });
    await expect(loadGuide('/data', 'ui-fixture', 'r1', fetchFn)).rejects.toMatchObject({
      kind: 'malformed',
    });
  });
});

describe('guideDataUrl', () => {
  it('joins base path, slug and releaseId, keeping the releaseId colon literal', () => {
    expect(guideDataUrl('/data', 'p0-fixture', 'sha256:abc')).toBe(
      '/data/releases/p0-fixture/sha256:abc/guide.compiled.json',
    );
  });

  it('still percent-encodes characters that are unsafe in a path segment', () => {
    expect(guideDataUrl('/data', 'a b', 'r/1')).toBe(
      '/data/releases/a%20b/r%2F1/guide.compiled.json',
    );
  });
});

describe('resolveGuideAssetUrl', () => {
  const guideUrl = '/data/releases/p0-fixture/sha256:abc/guide.compiled.json';

  it('resolves asset paths next to the compiled guide', () => {
    expect(resolveGuideAssetUrl(guideUrl, 'assets/source-pages/sheet-a.svg')).toBe(
      '/data/releases/p0-fixture/sha256:abc/assets/source-pages/sheet-a.svg',
    );
  });

  it('returns null for missing or empty asset paths', () => {
    expect(resolveGuideAssetUrl(guideUrl, null)).toBeNull();
    expect(resolveGuideAssetUrl(guideUrl, undefined)).toBeNull();
    expect(resolveGuideAssetUrl(guideUrl, '')).toBeNull();
  });

  it('refuses absolute urls and escaping paths', () => {
    expect(resolveGuideAssetUrl(guideUrl, 'https://example.com/a.svg')).toBeNull();
    expect(resolveGuideAssetUrl(guideUrl, 'data:image/svg+xml;base64,AAAA')).toBeNull();
    expect(resolveGuideAssetUrl(guideUrl, '/etc/passwd')).toBeNull();
    expect(resolveGuideAssetUrl(guideUrl, '../secret.svg')).toBeNull();
    expect(resolveGuideAssetUrl(guideUrl, 'assets/../../secret.svg')).toBeNull();
  });
});
