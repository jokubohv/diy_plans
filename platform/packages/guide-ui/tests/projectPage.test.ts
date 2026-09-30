import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { ProjectPage } from '../src/ProjectPage';
import { createCatalogEntry, createFixture, PHASE_WALL_FRAME } from './fixture';
import { extractTag, render, textOf } from './render';

describe('ProjectPage', () => {
  const entry = createCatalogEntry();
  const compiled = createFixture();
  const html = render(createElement(ProjectPage, { catalogEntry: entry, compiled }));
  const text = textOf(html);

  it('renders the project overview with description and revision metadata', () => {
    expect(html).toContain('data-testid="project-page"');
    expect(text).toContain('UI Fixture Project (test)');
    expect(text).toContain('Synthetic project used by guide-ui unit tests');
    expect(text).toContain('0.1.0');
    // Project types are shown as user-facing labels, not internal enum values (UX requirement).
    expect(text).toContain('Demonstration');
    expect(text).not.toContain('fixture_demo');
    expect(text).toContain('Concept');
  });

  it('summarises dimensions from compiled measurements in the display unit and precision', () => {
    // 2438.400 mm -> 96 in at a 0.125 in precision step
    expect(text).toContain('96 in');
    // 952.500 mm -> 37.5 in
    expect(text).toContain('37.5 in');
    expect(text).toContain('Wall A framed length');
    expect(text).toContain('Door rough opening width');
    expect(text).toContain('Sheet dimension 952.5 mm disagrees with the field note value 965 mm.');
  });

  it('shows held and conditional step counts from compiled step data', () => {
    expect(text).toContain('4 ready');
    expect(text).toContain('1 conditional');
    expect(text).toContain('2 held');
    expect(text).toContain('1 open issue');
  });

  it('renders plan-level held and conditional banners', () => {
    expect(html).toContain('data-testid="held-banner"');
    expect(html).toContain('data-testid="conditional-banner"');
  });

  it('shows the acceptance status from compiled meta', () => {
    expect(text).toContain('accepted');
  });

  it('exposes the build and inspect entry points and the release pinning note', () => {
    expect(html).toContain('data-testid="mode-build"');
    expect(html).toContain('data-testid="mode-inspect"');
    expect(html).toContain('data-testid="release-pin-note"');
    expect(html).toContain(entry.releaseId);
    expect(html).toContain(entry.revision);
  });

  it('lists the build sequence phases in published order with the frame phase first', () => {
    expect(html).toContain('data-testid="build-sequence"');
    const frame = html.indexOf('data-testid="phase-wall-frame"');
    const backing = html.indexOf('data-testid="phase-cabinet-backing"');
    const services = html.indexOf('data-testid="phase-services-finish"');
    expect(frame).toBeGreaterThan(-1);
    expect(backing).toBeGreaterThan(frame);
    expect(services).toBeGreaterThan(backing);
    expect(html).toContain(PHASE_WALL_FRAME);
    expect(html).toContain('Cabinet backing');
    // React escapes the ampersand in the rendered label.
    expect(html).toContain('Services &amp; finish');
  });

  it('shows the number of steps in each phase', () => {
    const frame = html.indexOf('data-testid="phase-wall-frame"');
    const backing = html.indexOf('data-testid="phase-cabinet-backing"');
    const services = html.indexOf('data-testid="phase-services-finish"');
    expect(html.slice(frame, backing)).toContain('1 step');
    expect(html.slice(backing, services)).toContain('5 steps');
    expect(html.slice(services)).toContain('1 step');
  });

  it('rolls up the worst step status per phase and never reads a held phase as ready', () => {
    expect(extractTag(html, 'data-testid="phase-wall-frame"')).toContain('data-status="ready"');
    expect(extractTag(html, 'data-testid="phase-cabinet-backing"')).toContain('data-status="held"');
    expect(extractTag(html, 'data-testid="phase-services-finish"')).toContain(
      'data-status="ready"',
    );
  });

  it('lists every phase step with its own status chip', () => {
    const backing = html.indexOf('data-testid="phase-cabinet-backing"');
    const services = html.indexOf('data-testid="phase-services-finish"');
    const backingBlock = html.slice(backing, services);
    expect(backingBlock).toContain('Prepare the backing materials');
    expect(backingBlock).toContain('Cut the backing and cover parts');
    expect(backingBlock).toContain('Position the backing band');
    expect(backingBlock).toContain('Fasten the backing band (held)');
    expect(backingBlock).toContain('Inspect the backing band');
    expect(backingBlock).toContain('data-status="conditional"');
    expect(backingBlock).toContain('data-status="held"');
  });

  it('omits the build sequence when the guide has no steps', () => {
    const empty = createFixture();
    empty.steps = [];
    empty.stepStates = [];
    const emptyHtml = render(createElement(ProjectPage, { catalogEntry: entry, compiled: empty }));
    expect(emptyHtml).toContain('data-testid="project-page"');
    expect(emptyHtml).not.toContain('data-testid="build-sequence"');
  });
});
