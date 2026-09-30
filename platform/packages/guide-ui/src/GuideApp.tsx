import type { ReactElement } from 'react';
import type { CompiledGuide } from '@diyguide/schema';
import type { ViewerCapabilities } from '@diyguide/viewer-core';
import type { CatalogData, CatalogEntry } from './data';
import { GuideLayout } from './GuideLayout';
import type { GuideVariant, ViewerHostFactory } from './GuideLayout';
import { LibraryPage } from './LibraryPage';
import type { LibraryState } from './LibraryPage';
import { ProjectPage } from './ProjectPage';
import { guideHref, projectHref } from './router';
import type { GuideMode, GuideRoute } from './router';
import type { ViewerFallbackReason } from './ViewerFallback';

export interface GuideAppProps {
  catalogEntry?: CatalogEntry | null;
  compiled?: CompiledGuide | null;
  hostFactory?: ViewerHostFactory | null;
  /** Defaults to the project overview route. */
  route?: GuideRoute;
  catalog?: CatalogData | null;
  catalogState?: LibraryState;
  catalogErrorMessage?: string | null;
  initialMode?: GuideMode;
  initialStepIndex?: number;
  initialSelectedPartId?: string | null;
  reducedMotion?: boolean;
  viewerCapabilities?: ViewerCapabilities | null;
  viewerFallbackReason?: ViewerFallbackReason | null;
  thumbnailUrlFor?: (entry: CatalogEntry) => string | null;
  assetUrlFor?: (assetPath: string) => string | null;
  onNavigate?: (href: string) => void;
  onRetryCatalog?: () => void;
  className?: string;
}

function defaultNavigate(href: string): void {
  if (typeof window !== 'undefined') window.location.assign(href);
}

/** Shared chrome for the site routes (library / project / guide); the embed route stays bare. */
function AppChrome({
  children,
  onNavigate,
  current,
}: {
  children: ReactElement;
  onNavigate: (href: string) => void;
  current: 'library' | 'plan';
}): ReactElement {
  return (
    <div className="app-shell">
      <header className="app-bar">
        <button type="button" className="app-brand" onClick={() => onNavigate('/')}>
          <span className="app-brand-mark" aria-hidden="true">
            ▚
          </span>
          <span className="app-brand-text">
            DIY Guide Platform
            <span className="app-brand-sub">reviewed 3D build guides</span>
          </span>
        </button>
        <div className="app-bar-actions">
          <span className="app-bar-badge">P0 local preview</span>
          {current !== 'library' ? (
            <button type="button" className="app-bar-link" onClick={() => onNavigate('/')}>
              Plan library
            </button>
          ) : null}
        </div>
      </header>
      <div className="app-body">{children}</div>
    </div>
  );
}

function GuideMessage({
  title,
  message,
  onBackToLibrary,
  className,
}: {
  title: string;
  message: string;
  onBackToLibrary?: () => void;
  className?: string;
}): ReactElement {
  return (
    <div className={['guide-message', className].filter(Boolean).join(' ')} data-testid="guide-message">
      <h1>{title}</h1>
      <p>{message}</p>
      {onBackToLibrary ? (
        <button type="button" onClick={onBackToLibrary}>
          Back to the plan library
        </button>
      ) : null}
    </div>
  );
}

/**
 * Composition root: takes the resolved catalogue entry, the compiled guide and a host factory,
 * and renders the library / project / build / inspect / embed layouts for the current route.
 */
export function GuideApp(props: GuideAppProps): ReactElement {
  const { onNavigate, className } = props;
  const route: GuideRoute =
    props.route ??
    (props.catalogEntry
      ? { kind: 'project', slug: props.catalogEntry.slug }
      : { kind: 'library' });
  const navigate = onNavigate ?? defaultNavigate;

  switch (route.kind) {
    case 'library':
      return (
        <AppChrome onNavigate={navigate} current="library">
          <LibraryPage
            entries={props.catalog?.entries ?? []}
            state={props.catalogState ?? (props.catalog ? 'ready' : 'loading')}
            errorMessage={props.catalogErrorMessage ?? null}
            thumbnailUrlFor={props.thumbnailUrlFor}
            routeFor={(entry) => projectHref(entry.slug)}
            onOpenEntry={(entry) => navigate(projectHref(entry.slug))}
            onRetry={props.onRetryCatalog}
            className={className}
          />
        </AppChrome>
      );

    case 'project': {
      const entry = props.catalogEntry ?? null;
      const compiled = props.compiled ?? null;
      if (!entry || !compiled) {
        return (
          <GuideMessage
            className={className}
            title="Plan unavailable"
            message="The plan overview could not be loaded. It may not be published yet."
            onBackToLibrary={() => navigate('/')}
          />
        );
      }
      return (
        <AppChrome onNavigate={navigate} current="plan">
          <ProjectPage
            catalogEntry={entry}
            compiled={compiled}
            thumbnailUrl={props.thumbnailUrlFor?.(entry) ?? null}
            onOpenGuide={(mode) => navigate(guideHref(entry.slug, entry.releaseId, mode))}
            className={className}
          />
        </AppChrome>
      );
    }

    case 'guide':
    case 'embed': {
      const entry = props.catalogEntry ?? null;
      const compiled = props.compiled ?? null;
      if (!entry || !compiled) {
        return (
          <GuideMessage
            className={className}
            title="Plan unavailable"
            message="The compiled guide could not be loaded. It may not be published yet."
            onBackToLibrary={() => navigate('/')}
          />
        );
      }
      const variant: GuideVariant = route.kind === 'embed' ? 'embed' : props.initialMode ?? 'build';
      const layout = (
        <GuideLayout
          variant={variant}
          catalogEntry={entry}
          compiled={compiled}
          hostFactory={props.hostFactory}
          viewerCapabilities={props.viewerCapabilities}
          reducedMotion={props.reducedMotion}
          initialStepIndex={props.initialStepIndex}
          initialSelectedPartId={props.initialSelectedPartId}
          fallbackReason={props.viewerFallbackReason}
          assetUrlFor={props.assetUrlFor}
          onExit={route.kind === 'embed' ? undefined : () => navigate(projectHref(entry.slug))}
          onChangeMode={
            route.kind === 'embed'
              ? undefined
              : (mode) => navigate(guideHref(entry.slug, entry.releaseId, mode))
          }
          className={className}
        />
      );
      if (route.kind === 'embed') return layout;
      return (
        <AppChrome onNavigate={navigate} current="plan">
          {layout}
        </AppChrome>
      );
    }

    case 'not_found':
      return (
        <GuideMessage
          className={className}
          title="Page not found"
          message={`No route matches ${route.path}.`}
          onBackToLibrary={() => navigate('/')}
        />
      );
  }
}
