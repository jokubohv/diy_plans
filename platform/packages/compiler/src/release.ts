/**
 * Release output (architecture.md §7).
 *
 * `writeCompiled` writes the compiled artifacts inside the bundle directory:
 *   <bundleDir>/compiled/guide.compiled.json
 *   <bundleDir>/compiled/validation-report.json
 *   <bundleDir>/model/id-map.json
 *
 * `buildDataTree` writes a deterministic static data tree:
 *   <outDir>/catalog.json
 *   <outDir>/releases/<slug>/<releaseId>/{guide.compiled.json, release-manifest.json, id-map.json, assets/...}
 *
 * `releaseId` is the hash of `release-manifest.json` with its own `releaseId` field removed.
 * Only public/excerpt source assets and the listing thumbnail are copied; private sources are
 * never copied; unsafe paths are reported as UNSAFE_PATH. No timestamps are added anywhere.
 */
import type { AuthoredBundle, CompiledGuide, ReleaseStatus } from '@diyguide/schema';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import type { GuideError } from './errors';
import { COMPILER_NAME, COMPILER_VERSION, type ValidationReport } from './validate';
import { compileBundle } from './compile';
import { canonicalJson, sha256Prefixed } from './hash';
import { loadAuthoredBundle, type LoadedFile } from './load';
import type { AuthoredFileName } from '@diyguide/schema';

export interface WriteCompiledResult {
  compiledPath: string;
  reportPath: string;
  idMapPath: string;
}

/** File names the release writer owns; an asset may never collide with them. */
export const RESERVED_RELEASE_FILES = new Set([
  'guide.compiled.json',
  'id-map.json',
  'release-manifest.json',
]);

function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${canonicalJson(value, 2)}\n`);
}

/** Write compiled guide, validation report and id-map inside the bundle directory. */
export function writeCompiled(bundleDir: string, compiled: CompiledGuide, report: ValidationReport): WriteCompiledResult {
  const compiledPath = join(bundleDir, 'compiled', 'guide.compiled.json');
  const reportPath = join(bundleDir, 'compiled', 'validation-report.json');
  const idMapPath = join(bundleDir, 'model', 'id-map.json');
  writeJsonFile(compiledPath, compiled);
  writeJsonFile(reportPath, report);
  writeJsonFile(idMapPath, compiled.idMap);
  return { compiledPath, reportPath, idMapPath };
}

export interface CatalogStatusSummary {
  ready: number;
  conditional: number;
  held: number;
  superseded: number;
}

export interface CatalogEntry {
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
  statusSummary: CatalogStatusSummary;
  openIssueCount: number;
}

export interface CatalogFile {
  catalogVersion: 1;
  generatedBy: { name: string; version: string };
  entries: CatalogEntry[];
}

export interface ReleaseBuildRecord {
  slug: string;
  revision: string;
  releaseId: string | null;
  releaseDir: string | null;
  publishable: boolean;
  errors: GuideError[];
  warnings: GuideError[];
}

export interface BuildDataTreeResult {
  catalogPath: string;
  entries: CatalogEntry[];
  releases: ReleaseBuildRecord[];
  ok: boolean;
}

export interface BuildDataTreeInput {
  projectsDir: string;
  outDir: string;
  slug?: string | null;
}

interface ProjectRef {
  slug: string;
  revision: string;
  dir: string;
}

function discoverProjects(projectsDir: string, slugFilter: string | null): ProjectRef[] {
  const projects: ProjectRef[] = [];
  if (!existsSync(projectsDir)) return projects;
  for (const slugEntry of readdirSync(projectsDir, { withFileTypes: true })) {
    if (!slugEntry.isDirectory() || slugEntry.name.startsWith('.')) continue;
    if (slugFilter && slugEntry.name !== slugFilter) continue;
    const slugDir = join(projectsDir, slugEntry.name);
    for (const revisionEntry of readdirSync(slugDir, { withFileTypes: true })) {
      if (!revisionEntry.isDirectory() || revisionEntry.name.startsWith('.')) continue;
      const dir = join(slugDir, revisionEntry.name);
      if (existsSync(join(dir, 'manifest.json'))) {
        projects.push({ slug: slugEntry.name, revision: revisionEntry.name, dir });
      }
    }
  }
  projects.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : a.revision < b.revision ? -1 : 1));
  return projects;
}

function isUnsafeAssetPath(assetPath: string): boolean {
  if (assetPath.length === 0) return true;
  if (isAbsolute(assetPath)) return true;
  if (assetPath.includes('\\')) return true;
  return assetPath.split('/').some((segment) => segment === '..' || segment.length === 0);
}

/** Public/excerpt source assets plus the listing thumbnail, sorted and deduplicated. */
export function collectReleaseAssetPaths(bundle: AuthoredBundle): string[] {
  const paths = new Set<string>();
  for (const source of bundle.sources?.sources ?? []) {
    if (source.privacy !== 'public' && source.privacy !== 'excerpt_only') continue;
    if (typeof source.assetPath === 'string' && source.assetPath.length > 0) paths.add(source.assetPath);
  }
  if (typeof bundle.listing?.thumbnailAssetPath === 'string' && bundle.listing.thumbnailAssetPath.length > 0) {
    paths.add(bundle.listing.thumbnailAssetPath);
  }
  return [...paths].sort();
}

export function buildDataTree(input: BuildDataTreeInput): BuildDataTreeResult {
  const projectsDir = resolve(input.projectsDir);
  const outDir = resolve(input.outDir);
  const projects = discoverProjects(projectsDir, input.slug ?? null);

  mkdirSync(outDir, { recursive: true });
  rmSync(join(outDir, 'releases'), { recursive: true, force: true });
  rmSync(join(outDir, 'catalog.json'), { force: true });

  const entries: CatalogEntry[] = [];
  const releases: ReleaseBuildRecord[] = [];

  for (const project of projects) {
    const load = loadAuthoredBundle(project.dir);
    const { compiled, report } = compileBundle({
      bundle: load.bundle,
      files: load.files,
      rawFiles: load.rawFiles,
      loadErrors: load.errors,
      bundleDir: project.dir,
    });
    if (!compiled || !load.bundle) {
      releases.push({
        slug: project.slug,
        revision: project.revision,
        releaseId: null,
        releaseDir: null,
        publishable: false,
        errors: report.errors,
        warnings: report.warnings,
      });
      continue;
    }

    const bundle = load.bundle;
    const contentHash = compiled.meta.contentHash;

    // Emit guide + id-map in canonical (key-sorted) form so repeated builds are byte-identical.
    const emitted = new Map<string, Buffer>();
    emitted.set('guide.compiled.json', Buffer.from(`${canonicalJson(compiled, 2)}\n`));
    emitted.set('id-map.json', Buffer.from(`${canonicalJson(compiled.idMap, 2)}\n`));

    for (const assetPath of collectReleaseAssetPaths(bundle)) {
      const root = resolve(project.dir);
      const abs = resolve(root, assetPath);
      const reserved = RESERVED_RELEASE_FILES.has(assetPath) || RESERVED_RELEASE_FILES.has(assetPath.split('/').pop() ?? '');
      if (reserved || isUnsafeAssetPath(assetPath) || (abs !== root && !abs.startsWith(`${root}${sep}`)) || !existsSync(abs) || !statSync(abs).isFile()) {
        report.errors.push({
          code: reserved || isUnsafeAssetPath(assetPath) ? 'UNSAFE_PATH' : 'MISSING_FILE',
          file: 'sources.json',
          jsonPath: '$.sources.sources',
          objectId: null,
          expected: reserved
            ? `bundle-relative asset path that does not collide with a reserved release file (${[...RESERVED_RELEASE_FILES].join(', ')})`
            : 'existing bundle-relative public asset',
          actual: assetPath,
          sourceRefIds: [],
          severity: 'blocking',
        });
        continue;
      }
      // Containment is lexical; assets inside the bundle are trusted (architecture.md §7).
      emitted.set(assetPath, readFileSync(abs));
    }

    const files = [...emitted.entries()]
      .map(([path, data]) => ({ path, sha256: sha256Prefixed(data), bytes: data.byteLength }))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

    const listing = bundle.listing;
    const publishable = report.errors.length === 0;
    const manifestBase = {
      slug: project.slug,
      contentVersion: bundle.manifest.contentVersion,
      packageRevision: bundle.manifest.packageRevision,
      contentHash,
      schemaVersion: bundle.manifest.schemaVersion,
      builder: { name: COMPILER_NAME, version: COMPILER_VERSION },
      acceptanceStatus: bundle.acceptance.status,
      publicationScope: listing.scope,
      publishable,
      privateSourcesExcluded: true,
      files,
      listing,
    };
    const releaseId = sha256Prefixed(canonicalJson(manifestBase));
    const manifest = { releaseId, ...manifestBase };
    const releaseDir = join(outDir, 'releases', project.slug, releaseId);

    for (const [path, data] of emitted.entries()) {
      const target = join(releaseDir, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, data);
    }
    writeJsonFile(join(releaseDir, 'release-manifest.json'), manifest);

    const statusSummary: CatalogStatusSummary = { ready: 0, conditional: 0, held: 0, superseded: 0 };
    for (const operation of compiled.operations) {
      const status = operation.effectiveReleaseStatus as ReleaseStatus;
      if (status === 'ready' || status === 'conditional' || status === 'held' || status === 'superseded') {
        statusSummary[status] += 1;
      }
    }
    entries.push({
      slug: project.slug,
      title: listing.title,
      summary: listing.summary,
      projectType: listing.projectType,
      scope: listing.scope,
      revision: listing.revision,
      updated: listing.updated,
      releaseId,
      contentHash,
      thumbnailPath: `releases/${project.slug}/${releaseId}/${listing.thumbnailAssetPath}`,
      route: `/plans/${project.slug}/releases/${releaseId}`,
      statusSummary,
      openIssueCount: compiled.issues.filter((issue) => issue.status === 'open').length,
    });
    releases.push({
      slug: project.slug,
      revision: project.revision,
      releaseId,
      releaseDir,
      publishable,
      errors: report.errors,
      warnings: report.warnings,
    });
  }

  entries.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : a.revision < b.revision ? -1 : 1));
  const catalog: CatalogFile = {
    catalogVersion: 1,
    generatedBy: { name: COMPILER_NAME, version: COMPILER_VERSION },
    entries,
  };
  const catalogPath = join(outDir, 'catalog.json');
  writeJsonFile(catalogPath, catalog);

  return {
    catalogPath,
    entries,
    releases,
    ok: releases.every((release) => release.publishable),
  };
}
