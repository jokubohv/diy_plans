import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { CompiledGuide } from '@diyguide/schema';
import type { ViewerCapabilities, ViewerHost } from '@diyguide/viewer-core';
import { createRecordingHost } from '@diyguide/viewer-core';import {
  GuideApp,
  createBrowserRouter,
  guideDataUrl,
  loadCatalog,
  loadGuide,
  parseGuideRoute,
  parseModeFromSearch,
  resolveGuideAssetUrl,
} from '@diyguide/guide-ui';
import type {
  BrowserWindowLike,
  CatalogData,
  CatalogEntry,
  GuideRoute,
} from '@diyguide/guide-ui';
import {
  THREE_CAPABILITIES_FALLBACK,
  createThreeHost,
  preloadViewerThree,
  threeViewerVersion,
} from './viewerLoader';
import { detectWebGL, prefersReducedMotion, watchReducedMotion } from './environment';
import { SessionReleasePins } from './releases';

const DATA_BASE = '/data';
const CATALOG_URL = `${DATA_BASE}/catalog.json`;

/**
 * The recording host does not expose its capability object through ViewerHost (frozen contract),
 * so the site mirrors the headless adapter values for the fallback path. Live three.js
 * capabilities come from `THREE_CAPABILITIES_FALLBACK` plus the lazily loaded engine version.
 */
const RECORDING_CAPABILITIES: ViewerCapabilities = {
  engine: 'recording-host',
  version: '0.1.0',
  picking: false,
  clipping: false,
  xray: false,
  measurement: true,
  animation: false,
  overlays: false,
  canonicalUnit: 'mm',
  viewerFrame: 'canonical Z-up mm (headless)',
};

type CatalogState =
  | { status: 'loading' }
  | { status: 'ready'; data: CatalogData }
  | { status: 'empty'; data: CatalogData }
  | { status: 'error'; message: string };

type GuideState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: CompiledGuide }
  | { status: 'error'; message: string };

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function StatusScreen({
  text,
  detail = null,
  error = false,
  onRetry,
  testid,
}: {
  text: string;
  detail?: string | null;
  error?: boolean;
  onRetry?: () => void;
  testid?: string;
}): ReactElement {
  return (
    <div
      className="status-screen"
      data-testid={testid ?? (error ? 'app-error' : 'app-loading')}
      role={error ? 'alert' : 'status'}
    >
      <p>{text}</p>
      {detail ? <p className="status-screen-detail">{detail}</p> : null}
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

/**
 * Site shell: fetch the catalogue, resolve (and pin) the release once per session, load the
 * compiled guide, and render `GuideApp` with a three.js viewer host or the headless recording
 * host when WebGL is unavailable.
 */
export function App(): ReactElement {
  const [location, setLocation] = useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
  }));
  const [catalog, setCatalog] = useState<CatalogState>({ status: 'loading' });
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [guide, setGuide] = useState<GuideState>({ status: 'idle' });
  const [guideAttempt, setGuideAttempt] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => prefersReducedMotion(window));
  const [threeVersion, setThreeVersion] = useState<string>(THREE_CAPABILITIES_FALLBACK.version);

  const pinsRef = useRef(new SessionReleasePins());
  const guideCacheRef = useRef(new Map<string, CompiledGuide>());
  const routerRef = useRef<ReturnType<typeof createBrowserRouter> | null>(null);
  const webgl = useMemo(() => detectWebGL(), []);

  useEffect(() => {
    const router = createBrowserRouter(window as unknown as BrowserWindowLike, (next) =>
      setLocation({ pathname: next.pathname, search: next.search }),
    );
    routerRef.current = router;
    return () => {
      router.dispose();
      routerRef.current = null;
    };
  }, []);

  const navigate = useCallback((href: string) => {
    const router = routerRef.current;
    if (router) {
      router.push(href);
    } else {
      window.history.pushState(null, '', href);
      setLocation({ pathname: window.location.pathname, search: window.location.search });
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setCatalog({ status: 'loading' });
    loadCatalog((url) => window.fetch(url), CATALOG_URL)
      .then((data) => {
        if (!alive) return;
        setCatalog(data.entries.length > 0 ? { status: 'ready', data } : { status: 'empty', data });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setCatalog({ status: 'error', message: describeError(error) });
      });
    return () => {
      alive = false;
    };
  }, [catalogAttempt]);

  useEffect(() => watchReducedMotion(window, setReducedMotion), []);

  useEffect(() => {
    if (!webgl) return;
    let alive = true;
    void threeViewerVersion().then((version) => {
      if (alive) setThreeVersion(version);
    });
    return () => {
      alive = false;
    };
  }, [webgl]);

  const route: GuideRoute = parseGuideRoute(location.pathname);
  const slug =
    route.kind === 'project' || route.kind === 'guide' || route.kind === 'embed'
      ? route.slug
      : null;
  const requestedReleaseId =
    route.kind === 'guide' || route.kind === 'embed' ? route.releaseId : null;
  const catalogEntries =
    catalog.status === 'ready' || catalog.status === 'empty' ? catalog.data.entries : [];
  const resolution = useMemo(
    () =>
      slug && catalogEntries.length > 0
        ? pinsRef.current.resolve(catalogEntries, slug, requestedReleaseId)
        : null,
    [slug, requestedReleaseId, catalogEntries],
  );
  const releaseId = resolution?.releaseId ?? requestedReleaseId;
  const guideUrl = slug && releaseId ? guideDataUrl(DATA_BASE, slug, releaseId) : null;

  useEffect(() => {
    if (!slug || !releaseId) {
      setGuide({ status: 'idle' });
      return;
    }
    const cacheKey = `${slug}|${releaseId}`;
    const cached = guideCacheRef.current.get(cacheKey);
    if (cached) {
      setGuide({ status: 'ready', data: cached });
      return;
    }
    let alive = true;
    setGuide({ status: 'loading' });
    loadGuide(DATA_BASE, slug, releaseId, (url) => window.fetch(url))
      .then((data) => {
        if (!alive) return;
        guideCacheRef.current.set(cacheKey, data);
        setGuide({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setGuide({ status: 'error', message: describeError(error) });
      });
    return () => {
      alive = false;
    };
  }, [slug, releaseId, guideAttempt]);

  const hostFactory = useMemo(
    () =>
      (compiled: CompiledGuide): ViewerHost | Promise<ViewerHost> =>
        webgl ? createThreeHost(compiled) : createRecordingHost(compiled),
    [webgl],
  );

  const liveCapabilities = useMemo(
    () => ({ ...THREE_CAPABILITIES_FALLBACK, version: threeVersion }),
    [threeVersion],
  );

  const catalogData =
    catalog.status === 'ready' || catalog.status === 'empty' ? catalog.data : null;
  const catalogState =
    catalog.status === 'loading'
      ? 'loading'
      : catalog.status === 'empty'
        ? 'empty'
        : catalog.status === 'error'
          ? 'unavailable'
          : 'ready';
  const catalogErrorMessage = catalog.status === 'error' ? catalog.message : null;

  const assetUrlFor = useCallback(
    (assetPath: string) => (guideUrl ? resolveGuideAssetUrl(guideUrl, assetPath) : null),
    [guideUrl],
  );
  const thumbnailUrlFor = useCallback(
    (entry: CatalogEntry) =>
      entry.thumbnailPath ? resolveGuideAssetUrl(CATALOG_URL, entry.thumbnailPath) : null,
    [],
  );

  if (route.kind === 'library') {
    return (
      <GuideApp
        route={route}
        catalog={catalogData}
        catalogState={catalogState}
        catalogErrorMessage={catalogErrorMessage}
        thumbnailUrlFor={thumbnailUrlFor}
        onRetryCatalog={() => setCatalogAttempt((attempt) => attempt + 1)}
        onNavigate={navigate}
      />
    );
  }

  if (catalog.status === 'loading') {
    return <StatusScreen text="Loading plan library…" />;
  }
  if (catalog.status === 'error') {
    return (
      <StatusScreen
        error
        text="Plan catalogue unavailable."
        detail={catalog.message}
        onRetry={() => setCatalogAttempt((attempt) => attempt + 1)}
      />
    );
  }
  if (catalog.status === 'empty') {
    return <StatusScreen text="No plans are published yet." />;
  }
  if (!resolution) {
    return (
      <GuideApp
        route={route}
        catalog={catalogData}
        catalogState={catalogState}
        onNavigate={navigate}
      />
    );
  }
  if (guide.status === 'loading' || guide.status === 'idle') {
    return <StatusScreen text="Loading plan…" />;
  }
  if (guide.status === 'error') {
    return (
      <StatusScreen
        error
        text="The compiled guide could not be loaded."
        detail={guide.message}
        onRetry={() => setGuideAttempt((attempt) => attempt + 1)}
      />
    );
  }

  return (
    <GuideApp
      route={route}
      catalog={catalogData}
      catalogState={catalogState}
      catalogErrorMessage={catalogErrorMessage}
      catalogEntry={resolution.entry}
      compiled={guide.data}
      hostFactory={hostFactory}
      viewerCapabilities={webgl ? liveCapabilities : RECORDING_CAPABILITIES}
      initialMode={parseModeFromSearch(location.search) ?? 'build'}
      reducedMotion={reducedMotion}
      viewerFallbackReason={webgl ? null : 'webgl-unavailable'}
      thumbnailUrlFor={thumbnailUrlFor}
      assetUrlFor={assetUrlFor}
      onNavigate={navigate}
      onRetryCatalog={() => setCatalogAttempt((attempt) => attempt + 1)}
    />
  );
}
