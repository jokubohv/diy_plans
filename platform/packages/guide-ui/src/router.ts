/**
 * Minimal history router for the guide site (no dependency, testable by pure parsing).
 *
 * Routes (frozen by packet C):
 *   `/`                                  library
 *   `/plans/:slug`                       project overview
 *   `/plans/:slug/releases/:releaseId`   guided build / inspect
 *   `/embed/:slug/:releaseId`            embed
 *
 * Query strings and hashes are ignored while parsing; `?mode=build|inspect` is read by
 * `parseModeFromSearch`.
 */

export type GuideMode = 'build' | 'inspect';

export type GuideRoute =
  | { kind: 'library' }
  | { kind: 'project'; slug: string }
  | { kind: 'guide'; slug: string; releaseId: string }
  | { kind: 'embed'; slug: string; releaseId: string }
  | { kind: 'not_found'; path: string };

export interface BrowserLocationLike {
  pathname: string;
  search: string;
}

export interface BrowserWindowLike {
  location: BrowserLocationLike;
  history: {
    pushState(data: unknown, title: string, url?: string | null): void;
    replaceState(data: unknown, title: string, url?: string | null): void;
  };
  addEventListener(type: 'popstate', listener: () => void): void;
  removeEventListener(type: 'popstate', listener: () => void): void;
}

export interface BrowserRouter {
  current(): BrowserLocationLike;
  push(href: string): void;
  replace(href: string): void;
  dispose(): void;
}

/** Parse a pathname into a route. Tolerates trailing slashes and percent-encoded segments. */
export function parseGuideRoute(pathname: string): GuideRoute {
  const withoutHash = pathname.split('#')[0] ?? '';
  const withoutQuery = withoutHash.split('?')[0] ?? '';
  const segments: string[] = [];
  for (const raw of withoutQuery.split('/')) {
    if (raw === '') continue;
    try {
      segments.push(decodeURIComponent(raw));
    } catch {
      return { kind: 'not_found', path: pathname };
    }
  }
  const first = segments[0];
  if (first === undefined) return { kind: 'library' };
  if (first === 'plans') {
    const slug = segments[1];
    if (slug !== undefined && segments.length === 2) return { kind: 'project', slug };
    const releaseId = segments[3];
    if (slug !== undefined && releaseId !== undefined && segments.length === 4 && segments[2] === 'releases') {
      return { kind: 'guide', slug, releaseId };
    }
    return { kind: 'not_found', path: pathname };
  }
  if (first === 'embed') {
    const slug = segments[1];
    const releaseId = segments[2];
    if (slug !== undefined && releaseId !== undefined && segments.length === 3) {
      return { kind: 'embed', slug, releaseId };
    }
    return { kind: 'not_found', path: pathname };
  }
  return { kind: 'not_found', path: pathname };
}

export function parseModeFromSearch(search: string): GuideMode | null {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const mode = new URLSearchParams(query).get('mode');
  return mode === 'build' || mode === 'inspect' ? mode : null;
}

export function projectHref(slug: string): string {
  return `/plans/${encodeURIComponent(slug)}`;
}

export function guideHref(slug: string, releaseId: string, mode?: GuideMode | null): string {
  const base = `/plans/${encodeURIComponent(slug)}/releases/${encodeURIComponent(releaseId)}`;
  return mode ? `${base}?mode=${mode}` : base;
}

export function embedHref(slug: string, releaseId: string): string {
  return `/embed/${encodeURIComponent(slug)}/${encodeURIComponent(releaseId)}`;
}

/** History router over an injected window-like object; returns an unsubscribe handle. */
export function createBrowserRouter(
  win: BrowserWindowLike,
  onChange: (location: BrowserLocationLike) => void,
): BrowserRouter {
  const read = (): BrowserLocationLike => ({
    pathname: win.location.pathname,
    search: win.location.search,
  });
  const handlePopState = (): void => onChange(read());
  win.addEventListener('popstate', handlePopState);
  return {
    current: read,
    push(href: string): void {
      win.history.pushState(null, '', href);
      onChange(read());
    },
    replace(href: string): void {
      win.history.replaceState(null, '', href);
      onChange(read());
    },
    dispose(): void {
      win.removeEventListener('popstate', handlePopState);
    },
  };
}
