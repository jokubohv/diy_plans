import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { LibraryPage } from '../src/LibraryPage';
import { createCatalogEntry, createSecondCatalogEntry } from './fixture';
import { render, textOf } from './render';

const entries = [createCatalogEntry(), createSecondCatalogEntry()];

describe('LibraryPage states', () => {
  it('shows a text loading state', () => {
    const html = render(createElement(LibraryPage, { entries: [], state: 'loading' }));
    expect(html).toContain('data-testid="catalog-loading"');
    expect(textOf(html).toLowerCase()).toContain('loading');
  });

  it('shows a text empty state when the catalogue has no entries', () => {
    const html = render(createElement(LibraryPage, { entries: [], state: 'empty' }));
    expect(html).toContain('data-testid="catalog-empty"');
    expect(html).not.toContain('data-testid="catalog-card-');
    expect(textOf(html).toLowerCase()).toContain('no plans');
  });

  it('shows a text no-results state when filters exclude everything', () => {
    const html = render(
      createElement(LibraryPage, { entries, initialQuery: 'zzz-nothing-matches' }),
    );
    expect(html).toContain('data-testid="catalog-no-results"');
    expect(html).not.toContain('data-testid="catalog-card-');
    expect(textOf(html).toLowerCase()).toContain('no plans match');
  });

  it('shows a text unavailable state with the error message and a retry action', () => {
    const html = render(
      createElement(LibraryPage, {
        entries: [],
        state: 'unavailable',
        errorMessage: 'catalogue service offline',
        onRetry: () => undefined,
      }),
    );
    expect(html).toContain('data-testid="catalog-error"');
    expect(html).toContain('catalogue service offline');
    expect(html).toContain('data-testid="catalog-retry"');
    expect(textOf(html).toLowerCase()).toContain('unavailable');
  });
});

describe('LibraryPage cards and filters', () => {
  it('renders one card per entry with title, summary, revision and scope badge', () => {
    const html = render(createElement(LibraryPage, { entries }));
    expect(html).toContain('data-testid="library-page"');
    expect(html).toContain('data-testid="catalog-card-ui-fixture"');
    expect(html).toContain('data-testid="catalog-card-second-plan"');
    expect(html).toContain('UI Fixture Project (test)');
    expect(html).toContain('Synthetic plan used by guide-ui unit tests only.');
    expect(html).toContain('0.1.0');
    expect(html).toContain('Concept');
    expect(html).toContain('Build guide');
  });

  it('renders a thumbnail image only when a thumbnail url is resolvable', () => {
    const html = render(
      createElement(LibraryPage, {
        entries: [createCatalogEntry()],
        thumbnailUrlFor: (entry) => `/data/${entry.thumbnailPath}`,
      }),
    );
    expect(html).toContain('src="/data/releases/ui-fixture/');
    expect(html).toContain('alt="UI Fixture Project (test) thumbnail"');

    const noThumb = render(createElement(LibraryPage, { entries: [createCatalogEntry()] }));
    expect(noThumb).not.toContain('<img');
    expect(textOf(noThumb).toLowerCase()).toContain('no preview');
  });

  it('filters by free-text search over title and summary', () => {
    const html = render(createElement(LibraryPage, { entries, initialQuery: 'second' }));
    expect(html).toContain('data-testid="catalog-card-second-plan"');
    expect(html).not.toContain('data-testid="catalog-card-ui-fixture"');
  });

  it('filters by project type', () => {
    const html = render(createElement(LibraryPage, { entries, initialType: 'cabinet' }));
    expect(html).toContain('data-testid="catalog-card-second-plan"');
    expect(html).not.toContain('data-testid="catalog-card-ui-fixture"');
  });

  it('filters by publication scope', () => {
    const buildOnly = render(createElement(LibraryPage, { entries, initialScope: 'build_guide' }));
    expect(buildOnly).toContain('data-testid="catalog-card-second-plan"');
    expect(buildOnly).not.toContain('data-testid="catalog-card-ui-fixture"');

    const conceptOnly = render(createElement(LibraryPage, { entries, initialScope: 'concept' }));
    expect(conceptOnly).toContain('data-testid="catalog-card-ui-fixture"');
    expect(conceptOnly).not.toContain('data-testid="catalog-card-second-plan"');
  });

  it('surfaces held and conditional step counts from the entry status summary', () => {
    const html = render(createElement(LibraryPage, { entries: [createCatalogEntry()] }));
    const text = textOf(html);
    expect(text).toContain('2 held');
    expect(text).toContain('1 conditional');
    expect(text).toContain('1 open issue');
  });
});
