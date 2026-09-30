import { describe, expect, it } from 'vitest';
import { parseGuideRoute, parseModeFromSearch, guideHref, projectHref, embedHref } from '@diyguide/guide-ui';
import type { CatalogEntry } from '@diyguide/guide-ui';
import { SessionReleasePins } from '../src/releases';
import { detectWebGL, prefersReducedMotion } from '../src/environment';

describe('parseGuideRoute', () => {
  it('parses the library root, tolerating an empty path or trailing slash', () => {
    expect(parseGuideRoute('/')).toEqual({ kind: 'library' });
    expect(parseGuideRoute('')).toEqual({ kind: 'library' });
  });

  it('parses the project overview route', () => {
    expect(parseGuideRoute('/plans/ui-fixture')).toEqual({ kind: 'project', slug: 'ui-fixture' });
    expect(parseGuideRoute('/plans/ui-fixture/')).toEqual({
      kind: 'project',
      slug: 'ui-fixture',
    });
  });

  it('parses the guide route and decodes the releaseId', () => {
    expect(parseGuideRoute('/plans/ui-fixture/releases/sha256%3Aabc')).toEqual({
      kind: 'guide',
      slug: 'ui-fixture',
      releaseId: 'sha256:abc',
    });
    expect(parseGuideRoute('/plans/ui-fixture/releases/sha256:abc')).toEqual({
      kind: 'guide',
      slug: 'ui-fixture',
      releaseId: 'sha256:abc',
    });
  });

  it('parses the embed route', () => {
    expect(parseGuideRoute('/embed/ui-fixture/sha256:abc')).toEqual({
      kind: 'embed',
      slug: 'ui-fixture',
      releaseId: 'sha256:abc',
    });
  });

  it('returns not_found for unknown or incomplete paths', () => {
    expect(parseGuideRoute('/nope')).toMatchObject({ kind: 'not_found' });
    expect(parseGuideRoute('/plans')).toMatchObject({ kind: 'not_found' });
    expect(parseGuideRoute('/plans/a/b')).toMatchObject({ kind: 'not_found' });
    expect(parseGuideRoute('/plans/a/releases/b/c')).toMatchObject({ kind: 'not_found' });
    expect(parseGuideRoute('/embed/a')).toMatchObject({ kind: 'not_found' });
    expect(parseGuideRoute('/plans/%E0%A4%A')).toMatchObject({ kind: 'not_found' });
  });

  it('ignores query strings and hashes when parsing', () => {
    expect(parseGuideRoute('/plans/ui-fixture?mode=inspect')).toEqual({
      kind: 'project',
      slug: 'ui-fixture',
    });
    expect(parseGuideRoute('/embed/ui-fixture/r1#section')).toEqual({
      kind: 'embed',
      slug: 'ui-fixture',
      releaseId: 'r1',
    });
  });
});

describe('route helpers', () => {
  it('builds hrefs', () => {
    expect(projectHref('ui-fixture')).toBe('/plans/ui-fixture');
    expect(guideHref('ui-fixture', 'r1')).toBe('/plans/ui-fixture/releases/r1');
    expect(guideHref('ui-fixture', 'r1', 'inspect')).toBe('/plans/ui-fixture/releases/r1?mode=inspect');
    expect(embedHref('ui-fixture', 'r1')).toBe('/embed/ui-fixture/r1');
  });

  it('parses the mode query parameter', () => {
    expect(parseModeFromSearch('?mode=inspect')).toBe('inspect');
    expect(parseModeFromSearch('mode=build')).toBe('build');
    expect(parseModeFromSearch('')).toBeNull();
    expect(parseModeFromSearch('?mode=other')).toBeNull();
  });
});

function entry(slug: string, releaseId: string): CatalogEntry {
  return {
    slug,
    title: `${slug} (test)`,
    summary: 'test entry',
    projectType: 'fixture_demo',
    scope: 'concept',
    revision: '0.1.0',
    releaseId,
  };
}

describe('SessionReleasePins', () => {
  it('pins the catalogue release on first resolution', () => {
    const pins = new SessionReleasePins();
    const resolved = pins.resolve([entry('plans-a', 'r1')], 'plans-a', null);
    expect(resolved?.releaseId).toBe('r1');
    expect(resolved?.newlyPinned).toBe(true);
    expect(pins.pinnedReleaseId('plans-a')).toBe('r1');
  });

  it('never switches to a newer catalogue release during the session', () => {
    const pins = new SessionReleasePins();
    pins.resolve([entry('plans-a', 'r1')], 'plans-a', null);
    const again = pins.resolve([entry('plans-a', 'r2')], 'plans-a', null);
    expect(again?.releaseId).toBe('r1');
    expect(again?.newlyPinned).toBe(false);
  });

  it('honours an explicit release id from a direct link', () => {
    const pins = new SessionReleasePins();
    pins.resolve([entry('plans-a', 'r1')], 'plans-a', null);
    const explicit = pins.resolve([entry('plans-a', 'r2')], 'plans-a', 'r2');
    expect(explicit?.releaseId).toBe('r2');
  });

  it('returns null when the slug is unknown', () => {
    const pins = new SessionReleasePins();
    expect(pins.resolve([entry('plans-a', 'r1')], 'other', null)).toBeNull();
  });
});

describe('detectWebGL', () => {
  it('is true when a webgl2 context is available', () => {
    const doc = {
      createElement: () => ({ getContext: (type: string) => (type === 'webgl2' ? {} : null) }),
    };
    expect(detectWebGL(doc as unknown as Pick<Document, 'createElement'>)).toBe(true);
  });

  it('falls back to a webgl1 context', () => {
    const doc = {
      createElement: () => ({ getContext: (type: string) => (type === 'webgl' ? {} : null) }),
    };
    expect(detectWebGL(doc as unknown as Pick<Document, 'createElement'>)).toBe(true);
  });

  it('is false when no context can be created, on throw, or without a document', () => {
    const noContext = { createElement: () => ({ getContext: () => null }) };
    expect(detectWebGL(noContext as unknown as Pick<Document, 'createElement'>)).toBe(false);
    const throwing = {
      createElement: () => {
        throw new Error('blocked');
      },
    };
    expect(detectWebGL(throwing as unknown as Pick<Document, 'createElement'>)).toBe(false);
    expect(detectWebGL(null)).toBe(false);
  });
});

describe('prefersReducedMotion', () => {
  it('reflects the media query', () => {
    const win = { matchMedia: (query: string) => ({ matches: true, media: query }) };
    expect(prefersReducedMotion(win)).toBe(true);
  });

  it('is false without matchMedia support', () => {
    expect(prefersReducedMotion({})).toBe(false);
  });

  it('is false when matchMedia throws', () => {
    const win = {
      matchMedia: () => {
        throw new Error('blocked');
      },
    };
    expect(prefersReducedMotion(win)).toBe(false);
  });
});
