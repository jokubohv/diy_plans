/**
 * R35 completeness test (owner addendum): the appliance conflict, cabinet metadata, closet scope,
 * loose-practice yield, nonselected alternatives, drywall stock and the cart timeline.
 */
import { describe, expect, it } from 'vitest';
import {
  compileR35,
  findOperation,
  findPart,
  readWorkJson,
} from './helpers';

describe('R35 completeness: appliance operating-fit warnings', () => {
  const { bundle } = compileR35();

  it('keeps the exact project label and the family-source operating-fit values as warnings', () => {
    const issue = bundle.issues.find((candidate) => candidate.id === 'issue.r35.fridge-operating-fit');
    expect(issue).toBeDefined();
    const detail = issue?.detail ?? '';
    expect(detail).toContain('GSE25GYPHCFS');
    expect(detail).toMatch(/family/i);
    expect(detail).toContain('3.25');
    expect(detail).toContain('14.25');
    expect(detail).toContain('37');
    expect(detail).toContain('26.75');
    expect(detail).toMatch(/\b11\b/);
    expect(detail).toMatch(/none of these proves|not proof|does not prove|not a confirmed|not fit proof/i);
    expect(issue?.affectedIds).toContain('part.fixture.fridge');
    const fridge = findPart(bundle.parts, 'part.fixture.fridge');
    expect(fridge.description).toContain('GSE25GYPHCFS');
    expect(fridge.description).toMatch(/family data source|generic GE family/i);
    expect(fridge.description).toMatch(/unresolved|not prove|nominal/i);
  });

  it('keeps the 37-in bay and the nomials as clearances, never as fit proof', () => {
    const closed = bundle.measurements.find((measurement) => measurement.id === 'measurement.fridge.closed-front-clearance');
    const door90 = bundle.measurements.find((measurement) => measurement.id === 'measurement.fridge.door90-clearance');
    expect(Number(closed?.canonicalMm)).toBeCloseTo(679.45, 6);
    expect(Number(door90?.canonicalMm)).toBeCloseTo(279.4, 6);
    expect(closed?.conflictNote ?? '').toMatch(/not door-sweep proof/i);
    expect(door90?.conflictNote ?? '').toMatch(/neither the closed nor the 90-degree|not prove/i);
    expect(bundle.measurements.find((measurement) => measurement.id === 'measurement.fridge.clear-bay')).toBeDefined();
  });
});

describe('R35 completeness: cabinet metadata', () => {
  const { bundle } = compileR35();

  it('records B1/B2/B3 fronts, combined width and schematic seams', () => {
    const baseRow = findPart(bundle.parts, 'part.fixture.base-row');
    expect(baseRow.description).toContain('B1');
    expect(baseRow.description).toMatch(/one-drawer-over-one-door/);
    expect(baseRow.description).toMatch(/three-drawer/);
    expect(baseRow.description).toMatch(/106 1\/2/);
    expect(baseRow.description).toMatch(/individual measured widths are null/i);
    const combined = bundle.measurements.find((measurement) => measurement.id === 'measurement.cabinets.combined');
    expect(Number(combined?.canonicalMm)).toBeCloseTo(2705.1, 6);
    expect(combined?.conflictNote ?? '').toMatch(/individual widths unknown|not measured widths/i);
  });

  it('records fillers, divider, 108-in row, counter, uppers and shelves', () => {
    expect(findPart(bundle.parts, 'part.fixture.fillers').name).toMatch(/3\/4 in each/);
    const fillerF1 = bundle.measurements.find((measurement) => measurement.id === 'measurement.cabinets.filler-f1');
    const fillerF2 = bundle.measurements.find((measurement) => measurement.id === 'measurement.cabinets.filler-f2');
    expect(Number(fillerF1?.canonicalMm)).toBeCloseTo(19.05, 6);
    expect(Number(fillerF2?.canonicalMm)).toBeCloseTo(19.05, 6);
    const divider = bundle.measurements.find((measurement) => measurement.id === 'measurement.cabinets.divider');
    expect(Number(divider?.canonicalMm)).toBeCloseTo(19.05, 6);
    const row = bundle.measurements.find((measurement) => measurement.id === 'measurement.cabinets.base-row');
    expect(Number(row?.canonicalMm)).toBeCloseTo(2743.2, 6);
    const counter = bundle.measurements.find((measurement) => measurement.id === 'measurement.counter.top-elevation');
    expect(Number(counter?.canonicalMm)).toBeCloseTo(914.4, 6);
    expect(counter?.label ?? '').toMatch(/intended/i);
    const upperBottom = bundle.measurements.find((measurement) => measurement.id === 'measurement.upper.bottom-elevation');
    expect(Number(upperBottom?.canonicalMm)).toBeCloseTo(1574.8, 6);
    const clearance = bundle.measurements.find((measurement) => measurement.id === 'measurement.counter-upper.clearance');
    expect(Number(clearance?.canonicalMm)).toBeCloseTo(660.4, 6);
    expect(findPart(bundle.parts, 'part.fixture.upper-u1').name).toContain('36 x 34');
    expect(findPart(bundle.parts, 'part.fixture.upper-u2').name).toContain('36 x 34');
    expect(findPart(bundle.parts, 'part.fixture.upper-u3').name).toContain('36 x 24');
    expect(findPart(bundle.parts, 'part.fixture.shelves').description).toMatch(/Three 36-in butcher-block shelves/i);
    const shelf = bundle.measurements.find((measurement) => measurement.id === 'measurement.shelves.length');
    expect(Number(shelf?.canonicalMm)).toBeCloseTo(914.4, 6);
  });
});

describe('R35 completeness: existing closet and EX1 scope', () => {
  const { bundle } = compileR35();

  it('keeps 37/23 as survey facts that never define the rough opening', () => {
    for (const id of ['measurement.closet.inside-width', 'measurement.closet.depth']) {
      const measurement = bundle.measurements.find((candidate) => candidate.id === id);
      expect(measurement, id).toBeDefined();
      expect(measurement?.conflictNote ?? '', id).toMatch(/does not define the EX1 rough opening|survey\/reference/i);
    }
    const passage = findOperation(bundle.operations, 'op.open-ex1-passage');
    expect(JSON.stringify(passage.stopConditions)).toMatch(/automatic rough opening/i);
    expect(passage.targetPartIds).toContain('part.existing.ex1-wall');
    const door = findPart(bundle.parts, 'part.existing.kitchen-door');
    expect(door.description).toMatch(/retained/i);
    expect(door.takeoff?.include).toBe(false);
  });

  it('shows the widened 37-in EX1 requirement only as a held presentation preview', () => {
    const requirement = bundle.measurements.find((candidate) => candidate.id === 'measurement.ex1.finished-clear-width-min');
    const span = bundle.measurements.find((candidate) => candidate.id === 'measurement.ex1.plan-column-to-closet-span');
    const shortfall = bundle.measurements.find((candidate) => candidate.id === 'measurement.ex1.plan-shortfall-before-finishes');
    expect(Number(requirement?.canonicalMm)).toBeCloseTo(939.8, 6);
    expect(Number(span?.canonicalMm)).toBeCloseTo(765.175, 6);
    expect(Number(shortfall?.canonicalMm)).toBeCloseTo(174.625, 6);
    expect(requirement?.declaredReleaseStatus).toBe('held');
    expect(shortfall?.conflictNote).toMatch(/not a cut|finish\/jamb/i);

    const passage = findOperation(bundle.operations, 'op.open-ex1-passage');
    const preview = passage.view.recipe.requirementPreview;
    expect(passage.view.cameraPresetId).toBe('view.ex1-opening');
    expect(preview?.measurementIds).toContain('measurement.ex1.finished-clear-width-min');
    expect(preview?.boxes.map((box) => box.id)).toEqual([
      'preview.ex1.door-left-jamb',
      'preview.ex1.door-right-jamb',
      'preview.ex1.door-head',
      'preview.ex1.door-display-baseline',
      'preview.ex1.plan-span-limit',
      'preview.ex1.minimum-extension-zone',
    ]);
    expect(preview?.boxes.find((box) => box.id === 'preview.ex1.door-head')?.centerMm[2]).toBeCloseTo(2012.95, 6);
    expect(preview?.label).toMatch(/37 in minimum finished clear/i);
    expect(preview?.label).toMatch(/DISPLAY HEIGHT: 80 in only/i);
    expect(passage.stateEffects).toEqual([]);
    expect(bundle.parts).toHaveLength(89);
  });
});

describe('R35 completeness: loose practice yield', () => {
  const { bundle } = compileR35();

  it('records the 2x4x10 yield, the mock rectangle and the scrap trial in loose stock only', () => {
    const yieldMeasurement = bundle.measurements.find((measurement) => measurement.id === 'measurement.practice.yield-net');
    expect(Number(yieldMeasurement?.canonicalMm)).toBeCloseTo(2819.4, 6);
    expect(yieldMeasurement?.declaredReleaseStatus).toBe('ready');
    expect(yieldMeasurement?.conflictNote ?? '').toMatch(/never counts as house framing|never enters the installed takeoff/i);
    const cut = findOperation(bundle.operations, 'op.cut-practice');
    if (cut.kind !== 'cut') throw new Error('op.cut-practice must be a cut operation');
    expect(cut.parameters.cuts.map((entry) => entry.finalLengthMm)).toEqual(['609.6', '609.6', '533.4', '533.4', '533.4']);
    const practiceMaterial = bundle.materials.find((material) => material.id === 'material.lumber.practice');
    expect(practiceMaterial?.quantityProposed).toBe(1);
    for (const part of bundle.parts) {
      if (!part.id.startsWith('part.practice.')) {
        expect(part.materialId, part.id).not.toBe('material.lumber.practice');
        continue;
      }
      expect(part.takeoff?.include, part.id).toBe(false);
      expect(part.role, part.id).toBe('loose');
      if (part.id === 'part.practice.angle') {
        expect(part.kind).toBe('connector');
        expect(part.materialId).toBeNull();
      } else {
        expect(part.materialId, part.id).toBe('material.lumber.practice');
      }
    }
    expect(bundle.connections.connections.some((connection) => connection.id === 'connection.practice.angle-scrap')).toBe(true);
  });

  it('surfaces and highlights the released practice cut list before the cutting operation', () => {
    const stage = findOperation(bundle.operations, 'op.stage-tools');
    if (stage.kind !== 'prepare') throw new Error('op.stage-tools must be a prepare operation');
    expect(stage.parameters.cutOperationIds).toEqual(['op.cut-practice']);
    expect(stage.parameters.note ?? '').toMatch(/only released cut list|house plates.*remain.*held/i);
    expect(stage.view.highlightPartIds).toEqual(
      expect.arrayContaining([
        'part.practice.stock',
        'part.practice.plate-a',
        'part.practice.plate-b',
        'part.practice.stud-a',
        'part.practice.stud-b',
        'part.practice.stud-c',
      ]),
    );
    expect(stage.view.recipe.reveal).toEqual(expect.arrayContaining(stage.view.highlightPartIds));
    const practiceStep = bundle.steps.find((step) => step.id === 'step.p13-practice');
    expect(practiceStep?.title).toMatch(/highlighted cut list/i);
  });
});

describe('R35 completeness: nonselected alternatives', () => {
  const { bundle } = compileR35();

  it('keeps A35 6+6 / 3+6, SDWS, mending plates and nail-only ties reference-only', () => {
    const issue = bundle.issues.find((candidate) => candidate.id === 'issue.r35.nonselected-fasteners');
    const detail = issue?.detail ?? '';
    expect(detail).toContain('A35');
    expect(detail).toMatch(/6 \+ 6/);
    expect(detail).toMatch(/3 \+ 6/);
    expect(detail).toContain('SDWS');
    expect(detail).toMatch(/mending plates/i);
    expect(detail).toMatch(/nail-only/i);
    expect(detail).toMatch(/nonselected|not selected/i);
    const ids = [
      ...bundle.parts.map((part) => `${part.id} ${part.name}`),
      ...bundle.materials.map((material) => `${material.id} ${material.name}`),
      ...bundle.connections.fastenerSpecs.map((spec) => `${spec.id} ${spec.name}`),
    ];
    for (const id of ids) {
      expect(/a35|sdws|mending/i.test(id), id).toBe(false);
    }
    expect(bundle.connections.fastenerSpecs).toHaveLength(1);
    expect(bundle.connections.fastenerSpecs[0]?.id).toBe('fastener.sd9112');
  });
});

describe('R35 completeness: drywall stock and spares', () => {
  const { bundle } = compileR35();

  it('distinguishes core sheets from optional spares and keeps EX1 patches out of the nest', () => {
    const half = bundle.materials.find((material) => material.id === 'material.gypsum.half');
    const fiveEighth = bundle.materials.find((material) => material.id === 'material.gypsum.five-eighth');
    expect(half?.quantityProposed).toBe(8);
    expect(half?.spareQuantity).toBe(1);
    expect(fiveEighth?.quantityProposed).toBe(2);
    expect(fiveEighth?.spareQuantity).toBe(1);
    for (const material of [half, fiveEighth]) {
      expect(material?.notes ?? '').toMatch(/never installed/i);
      expect(material?.notes ?? '').toMatch(/EX1 patches/i);
    }
    const plan = findOperation(bundle.operations, 'op.plan-drywall-faces');
    const text = JSON.stringify(plan.parameters);
    expect(text).toMatch(/spares out of the installed nest|EX1 patches separate/i);
    for (const part of bundle.parts) {
      expect(part.id.includes('spare'), part.id).toBe(false);
    }
    expect(bundle.parts.filter((part) => part.assemblyId === 'assembly.drywall')).toHaveLength(12);
  });
});

describe('R35 completeness: architectural anchor reference', () => {
  const { bundle } = compileR35();

  it('records D5/18 spacing without inventing W1/W2 anchor centers or releasing drilling', () => {
    const anchor = bundle.connections.connections.find(
      (connection) => connection.id === 'connection.base.anchor',
    );
    expect(anchor?.declaredReleaseStatus).toBe('held');
    expect(anchor?.pattern).toEqual({
      type: 'line',
      count: null,
      spacingMm: 304.8,
      startOffsetMm: null,
      endOffsetMm: null,
      edgeDistanceMm: null,
    });
    expect(anchor?.proposedPointsMm).toBeNull();
    expect(anchor?.holdReason ?? '').toMatch(/D5\/18.*Hilti X-CF.*12 in o\.c\./i);
    expect(anchor?.holdReason ?? '').toMatch(/no first offset.*W1\/W2 retrofit coordinates/i);
    expect(anchor?.citationIds).toContain('citation.permit.p13.d5-detail-18-base-reference');

    const operation = findOperation(bundle.operations, 'op.anchor-base-plates');
    expect(operation.declaredReleaseStatus).toBe('held');
    expect(operation.holdReason).toMatch(/no first offset or W1\/W2 anchor centers/i);
    if (operation.kind !== 'fasten') throw new Error('op.anchor-base-plates must be a fasten operation');
    expect(operation.parameters.pointsMm).toBeNull();
  });
});

describe('R35 completeness: cart timeline', () => {
  const { bundle } = compileR35();

  it('reconciles the publication-time cart statement with the later cart record', () => {
    const issue = bundle.issues.find((candidate) => candidate.id === 'issue.r35.cart-history');
    const detail = issue?.detail ?? '';
    expect(detail).toContain('49');
    expect(detail).toContain('$657.55');
    expect(detail).toMatch(/no checkout/i);
    expect(detail).toMatch(/already absent/i);
    expect(detail).toMatch(/strips were removed/i);
    expect(detail).toContain('A34Z');
    expect(detail).toContain('SD9112');
    expect(detail).toMatch(/nutsetter/i);
    expect(detail).toMatch(/non-authoritative/i);
    expect(detail).toMatch(/no stale nailer requirement survives/i);

    const carryForward = readWorkJson<{ entries: { id: string; status: string; supersededBy: string | null; reason: string; verifiedFacts?: { checkoutCompleted: boolean; observedFinalUnits: number; merchandiseSubtotalBeforeTax: number; nailerAbsent?: boolean; practiceLines: string[] } }[] }>('carry-forward-map.json');
    const publication = carryForward.entries.find((entry) => entry.id === 'cf.cart.publication-statement');
    const later = carryForward.entries.find((entry) => entry.id === 'cf.cart.later-state');
    const reserve = carryForward.entries.find((entry) => entry.id === 'cf.cart.wood-reserve');
    expect(publication?.status).toBe('historical');
    expect(publication?.supersededBy).toMatch(/change-record/i);
    expect(later?.status).toBe('current');
    expect(later?.reason).toMatch(/no stale nailer requirement/i);
    expect(later?.verifiedFacts?.observedFinalUnits).toBe(49);
    expect(later?.verifiedFacts?.merchandiseSubtotalBeforeTax).toBe(657.55);
    expect(later?.verifiedFacts?.checkoutCompleted).toBe(false);
    expect(later?.verifiedFacts?.nailerAbsent).toBe(true);
    expect(later?.verifiedFacts?.practiceLines.join(' ')).toMatch(/A34Z/);
    expect(reserve?.status).toBe('current');
    expect(reserve?.verifiedFacts?.practiceLines.join(' ')).toMatch(/SD Connector #9/);
    expect(reserve?.verifiedFacts?.checkoutCompleted).toBe(false);

    const stage = findOperation(bundle.operations, 'op.stage-tools');
    expect(JSON.stringify(stage.parameters)).toMatch(/No framing nailer or framing nail strips are required or used/i);
    expect(bundle.tools.some((tool) => /nailer|nail gun|nail strip|framing nail/i.test(tool.name))).toBe(false);
    expect(bundle.materials.some((material) => /nailer|nail gun|nail strip|framing nail/i.test(material.name))).toBe(false);
  });
});
