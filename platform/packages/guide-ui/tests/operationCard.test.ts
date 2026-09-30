import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { OperationCard } from '../src/OperationCard';
import {
  createFixture,
  createReleasedFastenFixture,
  CUT_NOTE,
  DRYWALL_MATERIAL_NOTE,
  FASTEN_HOLD_REASON,
  FASTEN_QUALITY_CHECK,
  FASTEN_STOP_CONDITION,
  HELD_PATTERN_EDGE_MM,
  HELD_PATTERN_SPACING_MM,
  PREPARE_INSTRUCTION,
  PREPARE_NOTE,
  RELEASED_PATTERN_SPACING_MM,
} from './fixture';
import { render, textOf } from './render';

function stepOf(compiled: ReturnType<typeof createFixture>, stepId: string) {
  const step = compiled.steps.find((candidate) => candidate.id === stepId);
  if (!step) throw new Error(`fixture step missing: ${stepId}`);
  return step;
}

function prepareOperationOf(compiled: ReturnType<typeof createFixture>) {
  const operation = compiled.operations.find((candidate) => candidate.id === 'op.prepare-backing');
  if (!operation || operation.kind !== 'prepare') {
    throw new Error('fixture prepare operation missing');
  }
  return operation;
}

describe('OperationCard for a held step', () => {
  const compiled = createFixture();
  const html = render(
    createElement(OperationCard, { step: stepOf(compiled, 'step.fasten-backing'), compiled }),
  );
  const text = textOf(html);

  it('shows the hold reason and proposed-placeholder wording', () => {
    expect(text).toContain(FASTEN_HOLD_REASON);
    expect(text.toLowerCase()).toContain('proposed connection location');
    expect(text.toLowerCase()).toContain('not released');
    expect(html).toContain('data-status="held"');
  });

  it('never invents fastener quantities, patterns or specs for a held step', () => {
    expect(text).not.toContain(`${HELD_PATTERN_SPACING_MM} mm`);
    expect(text).not.toContain(`${HELD_PATTERN_EDGE_MM} mm`);
    expect(text).not.toContain('12 fasteners');
    expect(text).not.toContain('#10 x 75 mm structural screw (test)');
    // "12" may not appear as a free-standing number anywhere on the card (pattern count)
    expect(text).not.toMatch(/\b12\b/);
  });

  it('renders quality checks, stop conditions and citations from the compiled data', () => {
    expect(text).toContain(FASTEN_QUALITY_CHECK);
    expect(text).toContain(FASTEN_STOP_CONDITION);
    expect(html).toContain('data-testid="citation-link-cite.sheet.b"');
    expect(html).toContain('data-testid="citation-link-cite.private.note"');
  });

  it('shows the release scope and status of the operation', () => {
    expect(text).toContain('Demonstration only');
    expect(text).toContain('Held');
  });
});

describe('OperationCard for a released step', () => {
  const compiled = createReleasedFastenFixture();
  const html = render(
    createElement(OperationCard, { step: stepOf(compiled, 'step.fasten-backing'), compiled }),
  );
  const text = textOf(html);

  it('shows quantity and pattern when the connection is released', () => {
    expect(text).toContain('4 fasteners');
    expect(text).toContain(`${RELEASED_PATTERN_SPACING_MM} mm`);
    expect(text).toContain('#10 x 75 mm structural screw (test)');
  });

  it('drops the held wording once the operation is released', () => {
    expect(text).not.toContain(FASTEN_HOLD_REASON);
  });
});

describe('OperationCard for a prepare step', () => {
  const compiled = createFixture();
  const html = render(
    createElement(OperationCard, { step: stepOf(compiled, 'step.prepare-backing'), compiled }),
  );
  const text = textOf(html);

  it('shows the gather action line, the instruction and the merged tool list', () => {
    expect(text).toContain('Gather materials and tools');
    expect(text).toContain(PREPARE_INSTRUCTION);
    expect(text).toContain(PREPARE_NOTE);
    expect(text).toContain('Spirit level, Impact driver');
  });

  it('lists the bill of materials in materialIds order with size, quantity, spare and note', () => {
    expect(html).toContain('data-testid="prepare-bom"');
    const drywallRow = html.indexOf('data-testid="prepare-bom-row-material.panel.drywall"');
    const studRow = html.indexOf('data-testid="prepare-bom-row-material.lumber.stud"');
    expect(drywallRow).toBeGreaterThan(-1);
    expect(studRow).toBeGreaterThan(drywallRow);
    expect(text).toContain('1/2 in gypsum panel (test)');
    expect(text).toContain('2 sheets');
    expect(text).toContain('1 spare');
    expect(text).toContain(DRYWALL_MATERIAL_NOTE);
    expect(text).toContain('2x4x8 stud (test)');
    expect(text).toContain('2x4x8');
    expect(text).toContain('3 each');
  });

  it('takes the quantities and spares from the compiled materials, never from fixed strings', () => {
    const guide = createFixture();
    const material = guide.materials.find((candidate) => candidate.id === 'material.lumber.stud');
    if (!material) throw new Error('fixture material missing');
    material.quantityProposed = 7;
    material.spareQuantity = 2;
    const changedText = textOf(
      render(
        createElement(OperationCard, {
          step: stepOf(guide, 'step.prepare-backing'),
          compiled: guide,
        }),
      ),
    );
    expect(changedText).toContain('7 each');
    expect(changedText).toContain('2 spare');
    expect(changedText).not.toContain('3 each');
  });

  it('renders one cut-list row per cut with part name, display-unit length and note', () => {
    expect(html).toContain('data-testid="step-cut-plan"');
    expect(text).toContain('Before you cut');
    expect(text).toContain('Use this stock and cut only the highlighted parts');
    expect(text).toContain(PREPARE_NOTE);
    expect(html).toContain('data-testid="prepare-cut-list"');
    const backingCut = html.indexOf(
      'data-testid="prepare-cut-row-op.cut-backing-part.wall.backing"',
    );
    const coverCut = html.indexOf('data-testid="prepare-cut-row-op.cut-backing-part.wall.cover"');
    expect(backingCut).toBeGreaterThan(-1);
    expect(coverCut).toBeGreaterThan(backingCut);
    expect(text).toContain('Backing band');
    // 1066.800 mm -> 42 in and 2438.400 mm -> 96 in at the fixture display precision.
    expect(text).toContain('42 in');
    expect(text).toContain('Cover panel');
    expect(text).toContain('96 in');
    expect(text).toContain(CUT_NOTE);
  });

  it('keeps the standard parts, tools, release and citation sections', () => {
    expect(text).toContain('Backing band, Cover panel');
    expect(text).toContain('Spirit level, Impact driver');
    expect(text).toContain('release.demo');
    expect(html).toContain('data-testid="citation-link-cite.sheet.a"');
  });

  it('hides the cut list when cutOperationIds is absent', () => {
    const guide = createFixture();
    delete prepareOperationOf(guide).parameters.cutOperationIds;
    const withoutCuts = render(
      createElement(OperationCard, {
        step: stepOf(guide, 'step.prepare-backing'),
        compiled: guide,
      }),
    );
    expect(withoutCuts).toContain('data-testid="prepare-bom"');
    expect(withoutCuts).not.toContain('data-testid="prepare-cut-list"');
  });

  it('keeps an explicit row when a referenced cut operation is missing from the guide', () => {
    const guide = createFixture();
    prepareOperationOf(guide).parameters.cutOperationIds = ['op.not-in-guide'];
    const changed = render(
      createElement(OperationCard, {
        step: stepOf(guide, 'step.prepare-backing'),
        compiled: guide,
      }),
    );
    expect(changed).toContain('data-testid="prepare-cut-list"');
    const changedText = textOf(changed);
    expect(changedText).toContain('op.not-in-guide');
    expect(changedText.toLowerCase()).toContain('not recorded');
  });
});

describe('OperationCard for a conditional position step', () => {
  const compiled = createFixture();
  const html = render(
    createElement(OperationCard, { step: stepOf(compiled, 'step.position-backing'), compiled }),
  );
  const text = textOf(html);

  it('renders the datum note, offsets, tool and the conditional preview wording', () => {
    expect(text).toContain('Band centre 1066.8 mm above the finished floor');
    expect(text).toContain('1066.8');
    expect(text).toContain('Spirit level');
    expect(text.toLowerCase()).toContain('conditional preview');
  });

  it('merges step-level quality checks with operation-level checks', () => {
    expect(text).toContain('Confirm the band is level before fastening.');
  });
});
