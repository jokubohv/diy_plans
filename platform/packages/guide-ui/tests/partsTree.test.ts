import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { PartsTree } from '../src/PartsTree';
import { createFixture } from './fixture';
import { extractTag, render, textOf } from './render';

describe('PartsTree', () => {
  const compiled = createFixture();
  const html = render(
    createElement(PartsTree, {
      compiled,
      stepIndex: compiled.steps.findIndex((step) => step.id === 'step.position-backing'),
      selectedPartId: 'part.wall.backing',
      onSelectPart: () => undefined,
    }),
  );

  it('uses tree roles for keyboard and screen-reader access', () => {
    expect(html).toContain('role="tree"');
    expect(html).toContain('role="treeitem"');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-expanded="true"');
  });

  it('renders every part with the frozen testid contract', () => {
    for (const part of compiled.parts) {
      expect(html).toContain(`data-testid="part-node-${part.id}"`);
    }
  });

  it('groups parts by assembly and then trade', () => {
    const text = textOf(html);
    expect(text).toContain('Wall A framing');
    expect(text).toContain('framing');
    expect(text).toContain('drywall');
    expect(text).toContain('Cabinet envelope');
    expect(text).toContain('cabinetry');
    expect(text).toContain('Demonstration schematic');
    expect(text).toContain('electrical');
  });

  it('marks the selected part and gives it the roving tabindex', () => {
    const selected = extractTag(html, 'data-testid="part-node-part.wall.backing"');
    expect(selected).toContain('aria-selected="true"');
    expect(selected).toContain('tabindex="0"');
    const other = extractTag(html, 'data-testid="part-node-part.wall.stud-1"');
    expect(other).toContain('aria-selected="false"');
    expect(other).toContain('tabindex="-1"');
  });

  it('shows the part state from the step snapshot as text', () => {
    expect(textOf(html)).toContain('positioned');
    expect(textOf(html)).toContain('installed');
  });
});
