import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { CitationLink } from '../src/CitationLink';
import { SourceViewer, regionViewBox } from '../src/SourceViewer';
import { createFixture } from './fixture';
import { extractTag, render, textOf } from './render';

const compiled = createFixture();
const citationA = compiled.citations.find((candidate) => candidate.id === 'cite.sheet.a')!;
const sourceA = compiled.sources.find((candidate) => candidate.id === citationA.sourceId)!;
const sourceB = compiled.sources.find((candidate) => candidate.id === 'source.sheet-b')!;
const citationB = compiled.citations.find((candidate) => candidate.id === 'cite.sheet.b')!;
const citationPrivate = compiled.citations.find((candidate) => candidate.id === 'cite.private.note')!;
const privateSource = compiled.sources.find(
  (candidate) => candidate.id === citationPrivate.sourceId,
)!;

describe('CitationLink', () => {
  it('renders the frozen testid, the citation label and the source title', () => {
    const html = render(createElement(CitationLink, { citation: citationA, source: sourceA }));
    expect(html).toContain('data-testid="citation-link-cite.sheet.a"');
    expect(textOf(html)).toContain(citationA.label);
    expect(textOf(html)).toContain(sourceA.title);
  });

  it('exposes its active state for the source viewer selection', () => {
    const html = render(
      createElement(CitationLink, { citation: citationA, source: sourceA, active: true }),
    );
    expect(html).toContain('aria-pressed="true"');
  });
});

describe('SourceViewer', () => {
  it('renders the source page with a highlighted citation region', () => {
    const html = render(
      createElement(SourceViewer, {
        citation: citationA,
        source: sourceA,
        assetUrl: '/data/releases/ui-fixture/sha256:aaa/assets/source-pages/sheet-a.svg',
        viewBox: { width: 1000, height: 700 },
      }),
    );
    expect(html).toContain('data-testid="source-viewer"');
    // The viewer zooms to the authored region (with padding) instead of showing the whole sheet.
    expect(html).toContain('viewBox="0 0 571.2 391.2"');
    expect(html).toContain('/data/releases/ui-fixture/sha256:aaa/assets/source-pages/sheet-a.svg');
    const region = extractTag(html, 'data-testid="source-viewer-region"');
    expect(region).not.toBe('');
    expect(region).toContain('x="60"');
    expect(region).toContain('y="60"');
    expect(region).toContain('width="420"');
    expect(region).toContain('height="240"');
    // A toggle back to the full sheet keeps context available; the default is the focused crop.
    expect(extractTag(html, 'data-testid="source-viewer-toggle"')).toContain('aria-pressed="false"');
  });

  it('shows an explicit source-unavailable state when the asset cannot be resolved', () => {
    const html = render(
      createElement(SourceViewer, { citation: citationB, source: sourceB, assetUrl: null }),
    );
    expect(html).toContain('data-testid="source-viewer"');
    expect(html).not.toContain('data-testid="source-viewer-region"');
    expect(textOf(html).toLowerCase()).toContain('source unavailable');
  });

  it('marks private sources unavailable', () => {
    const html = render(
      createElement(SourceViewer, {
        citation: citationPrivate,
        source: privateSource,
        assetUrl: '/data/whatever.svg',
      }),
    );
    expect(textOf(html).toLowerCase()).toContain('source unavailable');
    expect(html).not.toContain('data-testid="source-viewer-region"');
  });

  it('marks a missing source record unavailable', () => {
    const html = render(
      createElement(SourceViewer, { citation: citationA, source: null, assetUrl: '/data/x.svg' }),
    );
    expect(textOf(html).toLowerCase()).toContain('source unavailable');
  });
});

describe('regionViewBox', () => {
  const sheet = { width: 1000, height: 700 };

  it('pads the region proportionally on all sides', () => {
    // Region away from the sheet edges: no clamping, pure padding.
    const box = regionViewBox({ x: 300, y: 250, width: 420, height: 240 }, sheet);
    expect(box.x).toBeCloseTo(300 - 75.6, 3);
    expect(box.y).toBeCloseTo(250 - 75.6, 3);
    expect(box.width).toBeCloseTo(420 + 151.2, 3);
    expect(box.height).toBeCloseTo(240 + 151.2, 3);
  });

  it('clamps the crop to the sheet edges', () => {
    const topLeft = regionViewBox({ x: 0, y: 0, width: 420, height: 240 }, sheet);
    expect(topLeft.x).toBe(0);
    expect(topLeft.y).toBe(0);
    const bottomRight = regionViewBox({ x: 860, y: 560, width: 140, height: 140 }, sheet);
    expect(bottomRight.x + bottomRight.width).toBeLessThanOrEqual(sheet.width);
    expect(bottomRight.y + bottomRight.height).toBeLessThanOrEqual(sheet.height);
  });

  it('always includes the authored region itself', () => {
    const region = { x: 60, y: 60, width: 420, height: 240 };
    const box = regionViewBox(region, sheet);
    expect(box.x).toBeLessThanOrEqual(region.x);
    expect(box.y).toBeLessThanOrEqual(region.y);
    expect(box.x + box.width).toBeGreaterThanOrEqual(region.x + region.width);
    expect(box.y + box.height).toBeGreaterThanOrEqual(region.y + region.height);
  });
});
