import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { StepRail } from '../src/StepRail';
import { createFixture } from './fixture';
import { extractTag, render, textOf } from './render';

describe('StepRail', () => {
  const compiled = createFixture();
  const fastenIndex = compiled.steps.findIndex((step) => step.id === 'step.fasten-backing');
  const html = render(
    createElement(StepRail, { compiled, currentIndex: fastenIndex, onSelectStep: () => undefined }),
  );

  it('renders every step in order with the frozen testid contract', () => {
    expect(html).toContain('data-testid="step-rail"');
    for (const step of compiled.steps) {
      expect(html).toContain(`data-testid="step-rail-item-${step.id}"`);
    }
    const first = html.indexOf('data-testid="step-rail-item-step.survey-wall"');
    const last = html.indexOf('data-testid="step-rail-item-step.route-cable"');
    expect(first).toBeGreaterThan(-1);
    expect(last).toBeGreaterThan(first);
  });

  it('uses listbox semantics and marks exactly one current step', () => {
    expect(html).toContain('role="listbox"');
    expect(html).toContain('role="option"');
    const current = extractTag(html, 'data-testid="step-rail-item-step.fasten-backing"');
    expect(current).toContain('aria-selected="true"');
    expect(current).toContain('data-current="true"');
    const other = extractTag(html, 'data-testid="step-rail-item-step.survey-wall"');
    expect(other).toContain('aria-selected="false"');
  });

  it('shows the effective status of every step as text', () => {
    const text = textOf(html);
    expect(text).toContain('Held');
    expect(text).toContain('Conditional');
    expect(text).toContain('Ready');
  });

  it('renders one phase header per phase, in order, before the phase steps', () => {
    const wallHeader = html.indexOf('data-testid="phase-header-wall-frame"');
    const survey = html.indexOf('data-testid="step-rail-item-step.survey-wall"');
    const backingHeader = html.indexOf('data-testid="phase-header-cabinet-backing"');
    const prepare = html.indexOf('data-testid="step-rail-item-step.prepare-backing"');
    const inspect = html.indexOf('data-testid="step-rail-item-step.inspect-backing"');
    const servicesHeader = html.indexOf('data-testid="phase-header-services-finish"');
    const route = html.indexOf('data-testid="step-rail-item-step.route-cable"');

    expect(wallHeader).toBeGreaterThan(-1);
    expect(survey).toBeGreaterThan(wallHeader);
    expect(backingHeader).toBeGreaterThan(survey);
    expect(prepare).toBeGreaterThan(backingHeader);
    expect(servicesHeader).toBeGreaterThan(inspect);
    expect(route).toBeGreaterThan(servicesHeader);
  });

  it('renders each phase header exactly once with its label and step count', () => {
    for (const testid of [
      'phase-header-wall-frame',
      'phase-header-cabinet-backing',
      'phase-header-services-finish',
    ]) {
      expect(html.split(`data-testid="${testid}"`).length - 1).toBe(1);
    }
    const backingHeader = html.slice(
      html.indexOf('data-testid="phase-header-cabinet-backing"'),
      html.indexOf('data-testid="step-rail-item-step.prepare-backing"'),
    );
    expect(backingHeader).toContain('Cabinet backing');
    expect(backingHeader).toContain('5 steps');
    const wallHeader = html.slice(
      html.indexOf('data-testid="phase-header-wall-frame"'),
      html.indexOf('data-testid="step-rail-item-step.survey-wall"'),
    );
    expect(wallHeader).toContain('Wall frame');
    expect(wallHeader).toContain('1 step');
  });

  it('keeps the option order aligned with the step indexes for keyboard selection', () => {
    const optionIds = [...html.matchAll(/data-testid="step-rail-item-([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(optionIds).toEqual(compiled.steps.map((step) => step.id));
    // The header rows are not options: no role, no tab stop, hidden from the accessibility tree
    // so arrow-key selection keeps operating on step options only.
    const header = extractTag(html, 'data-testid="phase-header-cabinet-backing"');
    expect(header).toContain('aria-hidden="true"');
    expect(header).not.toContain('role=');
    expect(header).not.toContain('tabindex');
  });
});
