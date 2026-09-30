import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { CatalogEntry } from './data';
import { projectTypeLabel, shortHash } from './format';

export type LibraryState = 'loading' | 'ready' | 'empty' | 'unavailable';

export type ScopeFilter = 'all' | 'concept' | 'build_guide';

export interface LibraryFilters {
  query: string;
  type: string;
  scope: ScopeFilter;
}

export interface LibraryPageProps {
  entries: readonly CatalogEntry[];
  /** Overrides the derived state; by default `entries.length === 0` means empty. */
  state?: LibraryState;
  errorMessage?: string | null;
  initialQuery?: string;
  initialType?: string;
  initialScope?: ScopeFilter;
  /** Resolve the thumbnail URL for an entry; entries without one show a text placeholder. */
  thumbnailUrlFor?: (entry: CatalogEntry) => string | null;
  routeFor?: (entry: CatalogEntry) => string;
  onOpenEntry?: (entry: CatalogEntry) => void;
  onRetry?: () => void;
  className?: string;
}

/** Pure filter used by the library page (search over title/summary/slug, type and scope). */
export function filterCatalogEntries(
  entries: readonly CatalogEntry[],
  filters: LibraryFilters,
): CatalogEntry[] {
  const needle = filters.query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filters.type !== 'all' && (entry.projectType ?? 'other') !== filters.type) return false;
    if (filters.scope !== 'all' && entry.scope !== filters.scope) return false;
    if (needle.length === 0) return true;
    const haystack = `${entry.title} ${entry.summary} ${entry.slug}`.toLowerCase();
    return haystack.includes(needle);
  });
}

function scopeBadgeText(scope: CatalogEntry['scope']): string {
  if (scope === 'build_guide') return 'Build guide';
  if (scope === 'concept') return 'Concept';
  return 'Scope not recorded';
}

/**
 * Catalogue grid with client-side search and type/scope filters, plus explicit loading, empty,
 * no-results and catalogue-unavailable states (all with text, never colour-only).
 */
export function LibraryPage({
  entries,
  state,
  errorMessage = null,
  initialQuery = '',
  initialType = 'all',
  initialScope = 'all',
  thumbnailUrlFor,
  routeFor,
  onOpenEntry,
  onRetry,
  className,
}: LibraryPageProps): ReactElement {
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState(initialType);
  const [scope, setScope] = useState<ScopeFilter>(initialScope);
  const effectiveState: LibraryState = state ?? (entries.length > 0 ? 'ready' : 'empty');

  const typeOptions = useMemo(() => {
    const found = new Set<string>();
    for (const entry of entries) {
      if (entry.projectType) found.add(entry.projectType);
    }
    return [...found].sort();
  }, [entries]);

  const filtered = useMemo(
    () => filterCatalogEntries(entries, { query, type, scope }),
    [entries, query, type, scope],
  );

  const classes = ['library-page', className].filter(Boolean).join(' ');

  function clearFilters(): void {
    setQuery('');
    setType('all');
    setScope('all');
  }

  return (
    <main className={classes} data-testid="library-page">
      <header className="library-header">
        <h1>Plan library</h1>
        <p className="library-intro">
          Reviewed, step-by-step 3D build guides. Each plan states its scope and its release status
          before you open it.
        </p>
      </header>

      {effectiveState === 'loading' ? (
        <div className="library-loading" data-testid="catalog-loading" role="status">
          Loading plans…
        </div>
      ) : null}

      {effectiveState === 'unavailable' ? (
        <div className="library-unavailable" data-testid="catalog-error" role="alert">
          <h2>Plan catalogue unavailable</h2>
          <p>{errorMessage ?? 'The catalogue could not be loaded.'}</p>
          {onRetry ? (
            <button type="button" data-testid="catalog-retry" onClick={onRetry}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {effectiveState === 'empty' ? (
        <div className="library-empty" data-testid="catalog-empty" role="status">
          <h2>No plans published yet</h2>
          <p>Build the data set to publish a plan.</p>
        </div>
      ) : null}

      {effectiveState === 'ready' ? (
        <>
          <div className="library-filters" role="search">
            <label className="library-search-label">
              Search plans
              <input
                type="search"
                data-testid="library-search"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search by title, summary or slug"
              />
            </label>
            <label className="library-filter-label">
              Type
              <select
                data-testid="library-filter-type"
                value={type}
                onChange={(event) => setType(event.currentTarget.value)}
              >
                <option value="all">All types</option>
                {typeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="library-filter-label">
              Scope
              <select
                data-testid="library-filter-scope"
                value={scope}
                onChange={(event) => setScope(event.currentTarget.value as ScopeFilter)}
              >
                <option value="all">All scopes</option>
                <option value="concept">Concept</option>
                <option value="build_guide">Build guide</option>
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <div className="library-no-results" data-testid="catalog-no-results" role="status">
              <p>No plans match the current search or filters.</p>
              <button type="button" data-testid="catalog-clear-filters" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="catalog-grid">
              {filtered.map((entry) => {
                const thumbnail = thumbnailUrlFor?.(entry) ?? null;
                const href = routeFor?.(entry) ?? `/plans/${entry.slug}`;
                const statusSummary = entry.statusSummary;
                return (
                  <li key={entry.slug}>
                    <article className="catalog-card" data-testid={`catalog-card-${entry.slug}`}>
                      <a
                        className="catalog-card-link"
                        href={href}
                        onClick={(event) => {
                          if (onOpenEntry) {
                            event.preventDefault();
                            onOpenEntry(entry);
                          }
                        }}
                      >
                        <div className="catalog-card-thumbnail">
                          {thumbnail ? (
                            <img src={thumbnail} alt={`${entry.title} thumbnail`} />
                          ) : (
                            <div
                              className="catalog-card-no-thumbnail"
                              role="img"
                              aria-label="No thumbnail published"
                            >
                              No preview
                            </div>
                          )}
                        </div>
                        <div className="catalog-card-heading">
                          <h2 className="catalog-card-title">{entry.title}</h2>
                          <p className="catalog-card-summary">{entry.summary}</p>
                        </div>
                      </a>
                      <div className="catalog-card-flags">
                        <span
                          className={`catalog-card-scope catalog-card-scope-${entry.scope ?? 'unknown'}`}
                          data-testid={`catalog-scope-${entry.slug}`}
                        >
                          {scopeBadgeText(entry.scope)}
                        </span>
                        {statusSummary && statusSummary.held > 0 ? (
                          <span className="catalog-flag catalog-flag-held">
                            {statusSummary.held} held
                          </span>
                        ) : null}
                        {statusSummary && statusSummary.conditional > 0 ? (
                          <span className="catalog-flag catalog-flag-conditional">
                            {statusSummary.conditional} conditional
                          </span>
                        ) : null}
                        {entry.openIssueCount != null && entry.openIssueCount > 0 ? (
                          <span className="catalog-card-issues">
                            {entry.openIssueCount} open issue{entry.openIssueCount === 1 ? '' : 's'}
                          </span>
                        ) : null}
                      </div>
                      <details className="catalog-card-details">
                        <summary>Plan details</summary>
                        <dl className="catalog-card-detail-list">
                          <div>
                            <dt>Type</dt>
                            <dd data-testid={`catalog-type-${entry.slug}`}>
                              {projectTypeLabel(entry.projectType)}
                            </dd>
                          </div>
                          <div>
                            <dt>Steps</dt>
                            <dd>
                              {statusSummary
                                ? `${statusSummary.ready} ready · ${statusSummary.conditional} conditional · ${statusSummary.held} held`
                                : 'Status summary unavailable'}
                            </dd>
                          </div>
                          {entry.revision ? (
                            <div>
                              <dt>Revision</dt>
                              <dd className="catalog-card-revision">{entry.revision}</dd>
                            </div>
                          ) : null}
                          {entry.updated ? (
                            <div>
                              <dt>Updated</dt>
                              <dd className="catalog-card-updated">{entry.updated}</dd>
                            </div>
                          ) : null}
                          <div>
                            <dt>Release</dt>
                            <dd>
                              <code title={entry.releaseId}>{shortHash(entry.releaseId)}</code>
                            </dd>
                          </div>
                          <div>
                            <dt>Slug</dt>
                            <dd>
                              <code>{entry.slug}</code>
                            </dd>
                          </div>
                        </dl>
                      </details>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </main>
  );
}
