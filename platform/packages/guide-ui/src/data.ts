/**
 * Typed data loading for the guide site. The loaders are fetch-injectable so unit tests never
 * touch the network, and every failure is mapped to a `GuideDataError` with a kind.
 *
 * Layout served by `diy-guide data` (docs/architecture.md section 7):
 *   <base>/catalog.json
 *   <base>/releases/<slug>/<releaseId>/guide.compiled.json
 *   <base>/releases/<slug>/<releaseId>/assets/...
 */
import type { CompiledGuide } from '@diyguide/schema';

export const DEFAULT_CATALOG_URL = '/data/catalog.json';

export interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (url: string) => Promise<FetchResponse>;

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
  projectType?: string;
  scope?: 'concept' | 'build_guide';
  revision?: string;
  updated?: string;
  releaseId: string;
  contentHash?: string;
  thumbnailPath?: string;
  /** Canonical release route from the catalogue, e.g. `/plans/<slug>/releases/<releaseId>`. */
  route?: string;
  statusSummary?: CatalogStatusSummary;
  openIssueCount?: number;
}

export interface CatalogData {
  catalogVersion: number;
  generatedBy?: { name: string; version: string };
  entries: CatalogEntry[];
}

export type GuideDataErrorKind = 'not_found' | 'malformed' | 'network' | 'server';

export class GuideDataError extends Error {
  readonly kind: GuideDataErrorKind;
  readonly url: string;
  readonly status: number | null;

  constructor(
    kind: GuideDataErrorKind,
    message: string,
    options: { url: string; status?: number | null; cause?: unknown },
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'GuideDataError';
    this.kind = kind;
    this.url = options.url;
    this.status = options.status ?? null;
  }
}

async function fetchJson(fetchFn: FetchLike, url: string): Promise<unknown> {
  let response: FetchResponse;
  try {
    response = await fetchFn(url);
  } catch (error) {
    throw new GuideDataError('network', `Could not reach ${url}`, { url, cause: error });
  }
  if (response.status === 404) {
    throw new GuideDataError('not_found', `Not found: ${url}`, { url, status: 404 });
  }
  if (!response.ok) {
    throw new GuideDataError('server', `Request failed with status ${response.status}: ${url}`, {
      url,
      status: response.status,
    });
  }
  try {
    return await response.json();
  } catch (error) {
    throw new GuideDataError('malformed', `Invalid JSON from ${url}`, {
      url,
      status: response.status,
      cause: error,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertCatalog(data: unknown, url: string): CatalogData {
  if (!isRecord(data) || !Array.isArray(data.entries)) {
    throw new GuideDataError('malformed', `Catalogue is not a valid catalogue document: ${url}`, {
      url,
    });
  }
  const entries: CatalogEntry[] = [];
  for (const raw of data.entries) {
    if (!isRecord(raw) || typeof raw.slug !== 'string' || typeof raw.releaseId !== 'string') {
      throw new GuideDataError('malformed', `Catalogue entry is missing slug/releaseId: ${url}`, {
        url,
      });
    }
    if (typeof raw.title !== 'string') {
      throw new GuideDataError('malformed', `Catalogue entry ${raw.slug} is missing a title`, {
        url,
      });
    }
    if (
      raw.scope !== undefined &&
      raw.scope !== 'concept' &&
      raw.scope !== 'build_guide'
    ) {
      throw new GuideDataError(
        'malformed',
        `Catalogue entry ${raw.slug} has an unknown scope: ${String(raw.scope)}`,
        { url },
      );
    }
    entries.push({
      slug: raw.slug,
      title: raw.title,
      summary: typeof raw.summary === 'string' ? raw.summary : '',
      projectType: typeof raw.projectType === 'string' ? raw.projectType : undefined,
      scope: raw.scope,
      revision: typeof raw.revision === 'string' ? raw.revision : undefined,
      updated: typeof raw.updated === 'string' ? raw.updated : undefined,
      releaseId: raw.releaseId,
      contentHash: typeof raw.contentHash === 'string' ? raw.contentHash : undefined,
      thumbnailPath: typeof raw.thumbnailPath === 'string' ? raw.thumbnailPath : undefined,
      route: typeof raw.route === 'string' ? raw.route : undefined,
      statusSummary: isStatusSummary(raw.statusSummary) ? raw.statusSummary : undefined,
      openIssueCount: typeof raw.openIssueCount === 'number' ? raw.openIssueCount : undefined,
    });
  }
  return {
    catalogVersion: typeof data.catalogVersion === 'number' ? data.catalogVersion : 1,
    generatedBy: isRecord(data.generatedBy)
      ? {
          name: typeof data.generatedBy.name === 'string' ? data.generatedBy.name : 'unknown',
          version: typeof data.generatedBy.version === 'string' ? data.generatedBy.version : '0',
        }
      : undefined,
    entries,
  };
}

function isStatusSummary(value: unknown): value is CatalogStatusSummary {
  return (
    isRecord(value) &&
    typeof value.ready === 'number' &&
    typeof value.conditional === 'number' &&
    typeof value.held === 'number' &&
    typeof value.superseded === 'number'
  );
}

const COMPILED_COLLECTIONS = [
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

function assertCompiled(data: unknown, url: string): CompiledGuide {
  if (!isRecord(data) || data.schema !== 'diy-guide-compiled') {
    throw new GuideDataError('malformed', `Not a compiled guide document: ${url}`, { url });
  }
  for (const key of COMPILED_COLLECTIONS) {
    if (!Array.isArray(data[key])) {
      throw new GuideDataError('malformed', `Compiled guide is missing the "${key}" collection: ${url}`, {
        url,
      });
    }
  }
  for (const key of ['project', 'meta', 'stats', 'idMap'] as const) {
    if (!isRecord(data[key])) {
      throw new GuideDataError('malformed', `Compiled guide is missing "${key}": ${url}`, { url });
    }
  }
  return data as unknown as CompiledGuide;
}

/** Load and validate the plan catalogue. */
export async function loadCatalog(
  fetchFn: FetchLike,
  catalogUrl: string = DEFAULT_CATALOG_URL,
): Promise<CatalogData> {
  const data = await fetchJson(fetchFn, catalogUrl);
  return assertCatalog(data, catalogUrl);
}

function trimSlashes(path: string): string {
  return path.replace(/\/+$/, '');
}

/**
 * Encode a path segment. `:` stays literal: it is a legal RFC 3986 path character and static
 * file servers (verified with `vite preview`) do not decode `%3A` before filesystem lookup,
 * which would break `sha256:` release ids.
 */
function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/%3A/gi, ':');
}

/** Data URL of one compiled release. */
export function guideDataUrl(basePath: string, slug: string, releaseId: string): string {
  return `${trimSlashes(basePath)}/releases/${encodePathSegment(slug)}/${encodePathSegment(releaseId)}/guide.compiled.json`;
}

/** Load and validate one compiled release. */
export async function loadGuide(
  basePath: string,
  slug: string,
  releaseId: string,
  fetchFn: FetchLike,
): Promise<CompiledGuide> {
  const url = guideDataUrl(basePath, slug, releaseId);
  const data = await fetchJson(fetchFn, url);
  return assertCompiled(data, url);
}

/**
 * Resolve an authored asset path against the directory of the compiled guide file (e.g.
 * `/data/releases/<slug>/<releaseId>/guide.compiled.json` -> `/data/releases/<slug>/<releaseId>/`).
 * Absolute URLs, leading slashes and paths escaping the guide directory are refused (null).
 */
export function resolveGuideAssetUrl(
  guideUrl: string,
  assetPath: string | null | undefined,
): string | null {
  if (typeof assetPath !== 'string' || assetPath.length === 0) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(assetPath)) return null;
  if (assetPath.startsWith('/') || assetPath.startsWith('\\')) return null;
  const segments = assetPath.split(/[\\/]+/);
  if (segments.some((segment) => segment === '..' || segment.length === 0)) return null;
  const trimmed = guideUrl.replace(/\/+$/, '');
  const lastSlash = trimmed.lastIndexOf('/');
  const base = lastSlash > 0 ? trimmed.slice(0, lastSlash) : trimmed;
  return `${base}/${segments.join('/')}`;
}
