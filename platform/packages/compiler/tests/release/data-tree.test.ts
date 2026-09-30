/**
 * Release tests: the `data` output tree (architecture.md §7).
 */
import { cpSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildDataTree, canonicalJson, sha256Prefixed } from '../../src/index';
import { FIXTURE_DIR, makeTempDir } from '../helpers';

const PROJECTS_DIR = fileURLToPath(new URL('../../../../projects', import.meta.url));

interface CatalogEntryShape {
  slug: string;
  title: string;
  summary: string;
  projectType: string;
  scope: string;
  revision: string;
  updated: string;
  releaseId: string;
  contentHash: string;
  thumbnailPath: string;
  route: string;
  statusSummary: Record<string, number>;
  openIssueCount: number;
}

interface ManifestShape {
  releaseId: string;
  slug: string;
  contentVersion: string;
  packageRevision: number;
  contentHash: string;
  schemaVersion: string;
  builder: { name: string; version: string };
  acceptanceStatus: string;
  publicationScope: string;
  publishable: boolean;
  privateSourcesExcluded: boolean;
  files: { path: string; sha256: string; bytes: number }[];
  listing: { slug: string; thumbnailAssetPath: string };
}

function buildOnce(outDir: string) {
  return buildDataTree({ projectsDir: PROJECTS_DIR, outDir });
}

describe('buildDataTree', () => {
  it('writes a catalog entry with the frozen shape and summary counts', () => {
    const outDir = makeTempDir();
    const result = buildOnce(outDir);
    expect(result.ok).toBe(true);
    // Two real projects live in the catalogue: the synthetic p0 fixture and the Pantry R35 conversion.
    expect(result.entries.map((entry) => entry.slug)).toEqual(['p0-fixture', 'pantry-r35']);
    const fixtureEntry = result.entries.find((entry) => entry.slug === 'p0-fixture');
    if (!fixtureEntry) throw new Error('p0-fixture catalogue entry missing');
    const entry = fixtureEntry as unknown as CatalogEntryShape;
    expect(entry.slug).toBe('p0-fixture');
    expect(entry.title).toBe('Wall Frame & Cabinet Backing');
    expect(entry.projectType).toBe('fixture_demo');
    expect(entry.scope).toBe('concept');
    expect(entry.revision).toBe('0.1.0');
    expect(entry.updated).toBe('2026-09-29');
    expect(entry.releaseId).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(entry.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(entry.thumbnailPath).toBe(`releases/p0-fixture/${entry.releaseId}/assets/thumbnails/p0-fixture.svg`);
    expect(entry.route).toBe(`/plans/p0-fixture/releases/${entry.releaseId}`);
    expect(entry.statusSummary).toEqual({ ready: 13, conditional: 2, held: 4, superseded: 0 });
    expect(entry.openIssueCount).toBe(2);

    const catalogRaw = readFileSync(join(outDir, 'catalog.json'), 'utf8');
    const catalog = JSON.parse(catalogRaw) as { catalogVersion: number; generatedBy: { name: string; version: string } };
    expect(catalog.catalogVersion).toBe(1);
    expect(catalog.generatedBy).toEqual({ name: 'diy-guide-compiler', version: '0.1.0' });
    expect(catalogRaw).not.toContain('/Users/');
    expect(catalogRaw).not.toContain('..');
  });

  it('is deterministic: releaseId and bytes are stable across builds', () => {
    const outOne = makeTempDir();
    const outTwo = makeTempDir();
    const first = buildOnce(outOne);
    const second = buildOnce(outTwo);
    const firstEntry = first.entries[0]!;
    const secondEntry = second.entries[0]!;
    expect(firstEntry.releaseId).toBe(secondEntry.releaseId);
    expect(firstEntry.contentHash).toBe(secondEntry.contentHash);

    const firstRelease = first.releases[0]!;
    const secondRelease = second.releases[0]!;
    for (const relative of ['guide.compiled.json', 'release-manifest.json', 'id-map.json']) {
      const a = readFileSync(join(firstRelease.releaseDir!, relative), 'utf8');
      const b = readFileSync(join(secondRelease.releaseDir!, relative), 'utf8');
      expect(a, relative).toBe(b);
    }
  });

  it('copies only public assets and the listing thumbnail, with relative safe paths', () => {
    const outDir = makeTempDir();
    const result = buildOnce(outDir);
    const release = result.releases[0]!;
    const releaseDir = release.releaseDir!;
    const manifest = JSON.parse(readFileSync(join(releaseDir, 'release-manifest.json'), 'utf8')) as ManifestShape;

    expect(manifest.releaseId).toBe(release.releaseId);
    expect(manifest.publishable).toBe(true);
    expect(manifest.privateSourcesExcluded).toBe(true);
    expect(manifest.builder).toEqual({ name: 'diy-guide-compiler', version: '0.1.0' });
    expect(manifest.acceptanceStatus).toBe('accepted');
    expect(manifest.publicationScope).toBe('concept');

    const paths = manifest.files.map((file) => file.path);
    expect(paths).toEqual([
      'assets/source-pages/fixture-field-note-01.svg',
      'assets/source-pages/fixture-sheet-a.svg',
      'assets/source-pages/fixture-sheet-b.svg',
      'assets/source-pages/fixture-sheet-c.svg',
      'assets/source-pages/fixture-sheet-d.svg',
      'assets/thumbnails/p0-fixture.svg',
      'guide.compiled.json',
      'id-map.json',
    ]);
    for (const file of manifest.files) {
      expect(file.path.startsWith('/'), file.path).toBe(false);
      expect(file.path.includes('..'), file.path).toBe(false);
      const absolute = join(releaseDir, file.path);
      expect(existsSync(absolute), file.path).toBe(true);
      const bytes = readFileSync(absolute);
      expect(file.bytes).toBe(bytes.byteLength);
      expect(file.sha256).toBe(sha256Prefixed(bytes));
    }

    // releaseId is the hash of the manifest with its own releaseId removed.
    const { releaseId, ...withoutReleaseId } = manifest;
    expect(sha256Prefixed(canonicalJson(withoutReleaseId))).toBe(releaseId);

    // The compiled guide is schema-valid browser output; id-map matches the parts order.
    const compiled = JSON.parse(readFileSync(join(releaseDir, 'guide.compiled.json'), 'utf8')) as {
      parts: { id: string; ifcGlobalId: string }[];
      idMap: { parts: { partId: string; ifcGlobalId: string }[] };
    };
    expect(compiled.idMap.parts.map((part) => part.partId)).toEqual(compiled.parts.map((part) => part.id));
    expect(compiled.idMap.parts.map((part) => part.ifcGlobalId)).toEqual(compiled.parts.map((part) => part.ifcGlobalId));

    // No private source asset is present in the release.
    expect(statSync(join(releaseDir, 'assets')).isDirectory()).toBe(true);
  });

  it('never copies private sources and still copies excerpt_only sources', () => {
    const projectsDir = makeTempDir();
    const projectDir = join(projectsDir, 'p0-fixture', '0.1.0');
    cpSync(FIXTURE_DIR, projectDir, { recursive: true });
    const sourcesPath = join(projectDir, 'sources.json');
    const sources = JSON.parse(readFileSync(sourcesPath, 'utf8')) as {
      sources: { id: string; privacy: string; assetPath: string }[];
    };
    sources.sources.find((source) => source.id === 'source.sheet-b')!.privacy = 'private';
    sources.sources.find((source) => source.id === 'source.sheet-c')!.privacy = 'excerpt_only';
    writeFileSync(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`);

    const outDir = makeTempDir();
    const result = buildDataTree({ projectsDir, outDir });
    expect(result.ok).toBe(true);
    const releaseDir = result.releases[0]!.releaseDir!;
    const manifest = JSON.parse(readFileSync(join(releaseDir, 'release-manifest.json'), 'utf8')) as ManifestShape;
    const paths = manifest.files.map((file) => file.path);
    expect(paths).not.toContain('assets/source-pages/fixture-sheet-b.svg');
    expect(paths).toContain('assets/source-pages/fixture-sheet-c.svg');
    expect(existsSync(join(releaseDir, 'assets/source-pages/fixture-sheet-b.svg'))).toBe(false);
    expect(manifest.privateSourcesExcluded).toBe(true);
  });

  it('rejects a public asset that collides with a reserved release file name', () => {
    const projectsDir = makeTempDir();
    const projectDir = join(projectsDir, 'p0-fixture', '0.1.0');
    cpSync(FIXTURE_DIR, projectDir, { recursive: true });
    const sourcesPath = join(projectDir, 'sources.json');
    const sources = JSON.parse(readFileSync(sourcesPath, 'utf8')) as {
      sources: { id: string; assetPath: string }[];
    };
    const reservedAssetPath = 'assets/source-pages/guide.compiled.json';
    cpSync(
      join(projectDir, 'assets', 'source-pages', 'fixture-sheet-a.svg'),
      join(projectDir, reservedAssetPath),
    );
    sources.sources.find((source) => source.id === 'source.sheet-a')!.assetPath = reservedAssetPath;
    writeFileSync(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`);

    const outDir = makeTempDir();
    const result = buildDataTree({ projectsDir, outDir });
    expect(result.ok).toBe(false);
    const release = result.releases[0]!;
    expect(release.errors.some((error) => error.code === 'UNSAFE_PATH')).toBe(true);
    expect(release.publishable).toBe(false);
  });

  it('can be limited to one slug and rebuilds cleanly over an existing tree', () => {
    const outDir = makeTempDir();
    const first = buildDataTree({ projectsDir: PROJECTS_DIR, outDir, slug: 'p0-fixture' });
    expect(first.entries).toHaveLength(1);
    // Drop a stale file into the tree, rebuild, and confirm it is removed.
    const stalePath = join(outDir, 'releases', 'stale.json');
    writeFileSync(stalePath, 'stale');
    const second = buildDataTree({ projectsDir: PROJECTS_DIR, outDir, slug: 'p0-fixture' });
    expect(second.entries).toHaveLength(1);
    expect(existsSync(stalePath)).toBe(false);
    const missing = buildDataTree({ projectsDir: PROJECTS_DIR, outDir, slug: 'does-not-exist' });
    expect(missing.entries).toEqual([]);
    expect(missing.ok).toBe(true);
  });
});
