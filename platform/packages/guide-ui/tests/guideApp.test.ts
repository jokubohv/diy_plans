import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import type { CompiledGuide } from '@diyguide/schema';
import { createRecordingHost } from '@diyguide/viewer-core';
import { GuideApp } from '../src/GuideApp';
import { FASTEN_HOLD_REASON, createCatalog, createCatalogEntry, createFixture } from './fixture';
import { extractTag, render, textOf } from './render';

const entry = createCatalogEntry();
const compiled = createFixture();

describe('GuideApp routing', () => {
  it('renders the library route with catalogue data', () => {
    const html = render(
      createElement(GuideApp, {
        route: { kind: 'library' },
        catalog: createCatalog(),
        catalogState: 'ready',
      }),
    );
    expect(html).toContain('data-testid="library-page"');
    expect(html).toContain('data-testid="catalog-card-ui-fixture"');
  });

  it('renders the project route with the mode switch', () => {
    const html = render(
      createElement(GuideApp, {
        route: { kind: 'project', slug: entry.slug },
        catalogEntry: entry,
        compiled,
      }),
    );
    expect(html).toContain('data-testid="project-page"');
    expect(html).toContain('data-testid="mode-build"');
    expect(html).toContain('data-testid="mode-inspect"');
  });

  it('renders the build guide with rail, current title, banners, step nav and viewer canvas', () => {
    const html = render(
      createElement(GuideApp, {
        route: { kind: 'guide', slug: entry.slug, releaseId: entry.releaseId },
        catalogEntry: entry,
        compiled,
        hostFactory: (guide: CompiledGuide) => createRecordingHost(guide),
        initialStepIndex: compiled.steps.findIndex((step) => step.id === 'step.fasten-backing'),
      }),
    );
    expect(html).toContain('data-testid="step-rail"');
    expect(html).toContain('data-testid="viewer-canvas"');
    expect(html).toContain('data-testid="step-current-title"');
    expect(html).toContain('data-testid="held-banner"');
    expect(html).toContain('data-testid="prev-step"');
    expect(html).toContain('data-testid="next-step"');
    expect(html).toContain('data-testid="btn-measure"');
    expect(html).toContain('data-testid="operation-card-step.fasten-backing"');
    expect(textOf(html)).toContain(FASTEN_HOLD_REASON);
  });

  it('opens on the first step (the survey) without auto-jumping', () => {
    const html = render(
      createElement(GuideApp, {
        route: { kind: 'guide', slug: entry.slug, releaseId: entry.releaseId },
        catalogEntry: entry,
        compiled,
        hostFactory: (guide: CompiledGuide) => createRecordingHost(guide),
      }),
    );
    expect(html).toContain('data-testid="operation-card-step.survey-wall"');
    expect(textOf(html)).toContain(`Step 1 of ${compiled.steps.length}`);
    expect(extractTag(html, 'data-testid="step-rail-item-step.survey-wall"')).toContain(
      'data-current="true"',
    );
  });

  it('shows the conditional banner for a conditional step instead of the held banner', () => {
    const html = render(
      createElement(GuideApp, {
        route: { kind: 'guide', slug: entry.slug, releaseId: entry.releaseId },
        catalogEntry: entry,
        compiled,
        hostFactory: (guide: CompiledGuide) => createRecordingHost(guide),
        initialStepIndex: compiled.steps.findIndex((step) => step.id === 'step.position-backing'),
      }),
    );
    expect(html).toContain('data-testid="conditional-banner"');
    expect(html).not.toContain('data-testid="held-banner"');
  });

  it('renders the inspect layout with parts tree, part properties and inspect controls', () => {
    const html = render(
      createElement(GuideApp, {
        route: { kind: 'guide', slug: entry.slug, releaseId: entry.releaseId },
        catalogEntry: entry,
        compiled,
        hostFactory: (guide: CompiledGuide) => createRecordingHost(guide),
        initialMode: 'inspect',
        initialSelectedPartId: 'part.wall.backing',
      }),
    );
    expect(html).toContain('data-testid="part-node-part.wall.backing"');
    expect(html).toContain('data-testid="part-properties"');
    expect(html).toContain('data-testid="section-slider"');
    expect(html).not.toContain('data-testid="step-rail"');
  });

  it('renders the embed layout under its frozen testid', () => {
    const html = render(
      createElement(GuideApp, {
        route: { kind: 'embed', slug: entry.slug, releaseId: entry.releaseId },
        catalogEntry: entry,
        compiled,
        hostFactory: (guide: CompiledGuide) => createRecordingHost(guide),
      }),
    );
    expect(html).toContain('data-testid="embed-root"');
    expect(html).toContain('data-testid="viewer-canvas"');
    expect(html).toContain('data-testid="next-step"');
  });

  it('falls back to the text/2D view when no viewer host factory is configured', () => {
    const html = render(
      createElement(GuideApp, {
        route: { kind: 'guide', slug: entry.slug, releaseId: entry.releaseId },
        catalogEntry: entry,
        compiled,
        hostFactory: null,
      }),
    );
    expect(html).toContain('data-testid="viewer-fallback"');
    expect(html).not.toContain('data-testid="viewer-canvas"');
  });

  it('shows the fallback when the environment reports no WebGL', () => {
    const html = render(
      createElement(GuideApp, {
        route: { kind: 'guide', slug: entry.slug, releaseId: entry.releaseId },
        catalogEntry: entry,
        compiled,
        hostFactory: (guide: CompiledGuide) => createRecordingHost(guide),
        viewerFallbackReason: 'webgl-unavailable',
      }),
    );
    expect(html).toContain('data-testid="viewer-fallback"');
    expect(html).not.toContain('data-testid="viewer-canvas"');
  });

  it('shows a message page when the route cannot be resolved', () => {
    const html = render(
      createElement(GuideApp, { route: { kind: 'not_found', path: '/nope' } }),
    );
    expect(html).toContain('data-testid="guide-message"');
    expect(textOf(html).toLowerCase()).toContain('not found');
  });
});
