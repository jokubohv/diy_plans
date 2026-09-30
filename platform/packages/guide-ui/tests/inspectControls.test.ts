import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import type { ViewerCapabilities } from '@diyguide/viewer-core';
import { InspectControls } from '../src/InspectControls';
import { createFixture } from './fixture';
import { extractTag, render, textOf } from './render';

const capabilities: ViewerCapabilities = {
  engine: 'test-engine',
  version: '0.0.0',
  picking: true,
  clipping: true,
  xray: true,
  measurement: true,
  animation: true,
  overlays: true,
  canonicalUnit: 'mm',
  viewerFrame: 'test',
};

const baseProps = {
  capabilities,
  sectionPlane: null,
  visibility: { isolatedPartIds: [], xrayPartIds: [], hiddenPartIds: [], showCovered: false },
  measureMode: false,
  measurement: null,
  views: createFixture().views,
  sectionBounds: { min: [0, 0, 0] as [number, number, number], max: [2000, 1000, 2500] as [number, number, number] },
  onSection: () => undefined,
  onIsolate: () => undefined,
  onXray: () => undefined,
  onShowCovered: () => undefined,
  onCameraPreset: () => undefined,
  onMeasureToggle: () => undefined,
  onClearMeasurement: () => undefined,
};

describe('InspectControls', () => {
  it('renders the frozen control testids when capabilities are present', () => {
    const html = render(createElement(InspectControls, baseProps));
    expect(html).toContain('data-testid="section-slider"');
    expect(html).toContain('data-testid="btn-isolate"');
    expect(html).toContain('data-testid="btn-xray"');
    expect(html).toContain('data-testid="btn-show-covered"');
    expect(html).toContain('data-testid="btn-measure"');
    expect(html).not.toContain('disabled');
  });

  it('renders camera presets from compiled views', () => {
    const html = render(createElement(InspectControls, baseProps));
    expect(html).toContain('data-testid="camera-preset-view.iso"');
    expect(html).toContain('data-testid="camera-preset-view.plan"');
    expect(textOf(html)).toContain('Isometric');
  });

  it('disables absent capabilities and explains why in text', () => {
    const partial = { ...capabilities, clipping: false, xray: false };
    const html = render(createElement(InspectControls, { ...baseProps, capabilities: partial }));
    const slider = extractTag(html, 'data-testid="section-slider"');
    expect(slider).toContain('disabled');
    const xrayButton = extractTag(html, 'data-testid="btn-xray"');
    expect(xrayButton).toContain('disabled');
    const measureButton = extractTag(html, 'data-testid="btn-measure"');
    expect(measureButton).not.toContain('disabled');
    const text = textOf(html).toLowerCase();
    expect(text).toContain('does not support');
    expect(text).toContain('section');
    expect(text).toContain('x-ray');
  });

  it('disables every control with an explanation when no capability information exists', () => {
    const html = render(createElement(InspectControls, { ...baseProps, capabilities: null }));
    for (const testid of ['section-slider', 'btn-isolate', 'btn-xray', 'btn-show-covered', 'btn-measure']) {
      expect(extractTag(html, `data-testid="${testid}"`)).toContain('disabled');
    }
    expect(textOf(html).toLowerCase()).toContain('capability information is unavailable');
  });

  it('shows the current measurement result with an approximation note', () => {
    const html = render(
      createElement(InspectControls, {
        ...baseProps,
        measureMode: true,
        measurement: {
          kind: 'distance',
          valueMm: 1234.5,
          valueDeg: null,
          pointsMm: [
            [0, 0, 0],
            [1234.5, 0, 0],
          ],
          approximate: true,
        },
      }),
    );
    expect(html).toContain('data-testid="measurement-result"');
    expect(textOf(html)).toContain('1234.5 mm');
    expect(textOf(html).toLowerCase()).toContain('approximate');
    expect(html).toContain('data-testid="btn-clear-measurement"');
  });
});
