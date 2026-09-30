import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { ViewerFallback } from '../src/ViewerFallback';
import { createFixture } from './fixture';
import { extractTag, render, textOf } from './render';

describe('ViewerFallback', () => {
  const compiled = createFixture();

  it('renders the frozen testid, the reason and full text instructions for the current step', () => {
    const html = render(
      createElement(ViewerFallback, { reason: 'webgl-unavailable', compiled, stepIndex: 0 }),
    );
    expect(html).toContain('data-testid="viewer-fallback"');
    const text = textOf(html);
    expect(text).toContain('Survey the wall');
    expect(text).toContain('Confirm the framed wall length against the approved dimension.');
    expect(text).toContain('Framed length reads 96 in');
    expect(text.toLowerCase()).toContain('webgl');
  });

  it('keeps 2D source links operable with resolved asset urls', () => {
    const html = render(
      createElement(ViewerFallback, {
        reason: 'viewer-error',
        message: 'context lost',
        compiled,
        stepIndex: 0,
        assetUrlFor: (assetPath) => `/data/${assetPath}`,
      }),
    );
    const link = extractTag(html, 'data-testid="fallback-source-cite.sheet.a"');
    expect(link).toContain('<a');
    expect(link).toContain('href="/data/assets/source-pages/sheet-a.svg"');
    expect(link).toContain('target="_blank"');
    expect(textOf(html)).toContain('context lost');
  });

  it('says so in text when a source has no published asset', () => {
    const html = render(
      createElement(ViewerFallback, {
        reason: 'viewer-error',
        compiled,
        stepIndex: 0,
        assetUrlFor: () => null,
      }),
    );
    expect(html).toContain('data-testid="fallback-source-cite.sheet.a"');
    expect(textOf(html).toLowerCase()).toContain('source not published');
  });

  it('explains the no-host state', () => {
    const html = render(
      createElement(ViewerFallback, {
        reason: 'no-host',
        compiled,
        stepIndex: compiled.steps.findIndex((step) => step.id === 'step.fasten-backing'),
      }),
    );
    const text = textOf(html);
    expect(text).toContain('Fasten the backing band (held)');
    expect(text.toLowerCase()).toContain('no 3d viewer is configured');
  });
});
