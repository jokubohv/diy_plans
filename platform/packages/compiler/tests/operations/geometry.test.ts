/**
 * Owner geometry review: invariants for the corrected frame.
 *
 * Covers the missed contradictions: doubled 2x6 header assembly vs. BOM, stock yields with kerf,
 * the continuous-sole-plate sequence, anchors on permanent plate segments only, the split between
 * in-plane racking bracing and out-of-plane plumb propping, flush end studs, and fastener points
 * landing on the members they claim.
 */
import { describe, expect, it } from 'vitest';
import type { Bounds, CompiledGuide, Vec3 } from '@diyguide/schema';
import { compileBundle } from '../../src/index';
import { FIXTURE_DIR, loadFixture } from '../helpers';

const KERF_MM = 3;
const BOARD_MM = 2438.4; // 8 ft

function compiledFixture(): CompiledGuide {
  const load = loadFixture();
  const { compiled, report } = compileBundle({
    bundle: load.bundle,
    files: load.files,
    rawFiles: load.rawFiles,
    bundleDir: FIXTURE_DIR,
  });
  if (!compiled || !report.ok) throw new Error('fixture did not compile');
  return compiled;
}

const compiled = compiledFixture();
const part = (id: string) => {
  const found = compiled.parts.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing part ${id}`);
  return found;
};
const bounds = (id: string): Bounds => part(id).boundsMm;
const size = (id: string): Vec3 => {
  const box = bounds(id);
  return [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]];
};

function axisOverlap(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
}
function boxesOverlap(a: Bounds, b: Bounds, tolerance = 1): boolean {
  return (
    axisOverlap(a.min[0], a.max[0], b.min[0], b.max[0]) > tolerance &&
    axisOverlap(a.min[1], a.max[1], b.min[1], b.max[1]) > tolerance &&
    axisOverlap(a.min[2], a.max[2], b.min[2], b.max[2]) > tolerance
  );
}
const pointInBox = (point: Vec3, box: Bounds, tolerance = 0.001): boolean =>
  point[0] >= box.min[0] - tolerance && point[0] <= box.max[0] + tolerance &&
  point[1] >= box.min[1] - tolerance && point[1] <= box.max[1] + tolerance &&
  point[2] >= box.min[2] - tolerance && point[2] <= box.max[2] + tolerance;

const FRAME_MEMBERS = [
  'part.wall-a.bottom-plate',
  'part.wall-a.top-plate',
  'part.wall-a.stud-1',
  'part.wall-a.stud-2',
  'part.wall-a.stud-3',
  'part.wall-a.stud-4',
  'part.wall-a.king-left',
  'part.wall-a.king-right',
  'part.wall-a.jack-left',
  'part.wall-a.jack-right',
  'part.wall-a.header-ply-a',
  'part.wall-a.header-ply-b',
  'part.wall-a.header-spacer',
  'part.wall-a.cripple-1',
  'part.wall-a.cripple-2',
];
const FRAME_ORIGIN_X = 347;
const CLEAR_SPAN: [number, number] = [FRAME_ORIGIN_X + 1244.6, FRAME_ORIGIN_X + 2197.1];
const CLEAR_HEIGHT = 2070.1;

describe('doubled header assembly', () => {
  it('models two 2x6 plies and a 1/2 in spacer that fill the wall thickness', () => {
    const plyA = bounds('part.wall-a.header-ply-a');
    const plyB = bounds('part.wall-a.header-ply-b');
    const spacer = bounds('part.wall-a.header-spacer');
    const wall = bounds('part.wall-a.stud-1');
    for (const [name, box] of [['ply A', plyA], ['ply B', plyB]] as const) {
      const [x, y, z] = [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]];
      expect(x, `${name} length`).toBeCloseTo(1104.9, 3);
      expect(y, `${name} thickness is a true 2x6 (38.1)`).toBeCloseTo(38.1, 3);
      expect(z, `${name} depth is a true 2x6 (139.7)`).toBeCloseTo(139.7, 3);
    }
    expect(spacer.max[1] - spacer.min[1]).toBeCloseTo(12.7, 3);
    // Total header depth equals the wall depth: 38.1 + 12.7 + 38.1 = 88.9.
    expect(plyA.min[1]).toBeCloseTo(wall.min[1], 3);
    expect(plyB.max[1]).toBeCloseTo(wall.max[1], 3);
    expect(spacer.min[1]).toBeCloseTo(plyA.max[1], 3);
    expect(spacer.max[1]).toBeCloseTo(plyB.min[1], 3);
    expect(plyA.max[1] - plyA.min[1] + (spacer.max[1] - spacer.min[1]) + (plyB.max[1] - plyB.min[1])).toBeCloseTo(
      wall.max[1] - wall.min[1],
      3,
    );
  });
});

describe('stock yields and kerf', () => {
  const boardYields: Array<[string, number[], number]> = [
    ['material.lumber.stud (full-height)', [2362.2], BOARD_MM],
    ['material.lumber.stud (jack + cripple)', [2032, 190.5], BOARD_MM],
    ['material.lumber.header (two plies)', [1104.9, 1104.9], BOARD_MM],
    ['material.lumber.brace (racking)', [1336.2], BOARD_MM],
    ['material.lumber.prop (plumb)', [2425.9], BOARD_MM],
    ['material.lumber.block (two blocks)', [368.3, 336.6], BOARD_MM],
    ['material.panel.header-spacer', [1104.9], BOARD_MM],
  ];

  it('never claims more length than the stock plus kerf allows', () => {
    for (const [label, cuts, board] of boardYields) {
      const total = cuts.reduce((sum, value) => sum + value, 0) + KERF_MM * cuts.length;
      expect(total, `${label}: ${cuts.join(' + ')} + kerf <= ${board}`).toBeLessThanOrEqual(board);
    }
  });

  it('does not claim that one 2x4x8 board yields both 2032 mm jack studs', () => {
    expect(2032 * 2 + KERF_MM).toBeGreaterThan(BOARD_MM);
    const studStock = compiled.materials.find((material) => material.id === 'material.lumber.stud')!;
    // 6 full-height studs (one board each) + 2 jack boards = 8 boards.
    expect(studStock.quantityProposed).toBe(8);
    expect(studStock.notes).toContain('Kerf convention: one 3 mm kerf per claimed cut');
  });

  it('sizes the backing block stock as 2x6 (not 2x4)', () => {
    const block = compiled.materials.find((material) => material.id === 'material.lumber.block')!;
    expect(block.sizeLabel).toBe('2x6x8');
    expect(block.name.toLowerCase()).toContain('2x6');
    expect(block.quantityProposed).toBe(1);
    const blocks = ['part.wall-a.backing-a', 'part.wall-a.backing-b'].map((id) => size(id)[2]);
    for (const depth of blocks) expect(depth).toBeCloseTo(139.7, 3);
  });
});

describe('frame geometry invariants', () => {
  it('lays the temporary protection panel flat only as a viewer pose', () => {
    const panel = bounds('part.demo.temp-panel');
    expect(panel.max[2] - panel.min[2], 'canonical panel geometry is unchanged').toBeCloseTo(2438.4, 3);
    expect(panel.min[2], 'panel rests on the slab top').toBeCloseTo(0, 3);
    const survey = compiled.operations.find((operation) => operation.id === 'op.survey-wall');
    const pose = survey?.view.recipe.boxTransforms?.find(
      (transform) => transform.partId === 'part.demo.temp-panel',
    );
    expect(pose?.offsetMm).toEqual([0, 0, -1209.675]);
    expect(pose?.scale).toEqual([1, 128, 0.0078125]);
  });

  it('shows a labeled planned frame and doorway context before cutting without changing state', () => {
    for (const operationId of ['op.survey-wall', 'op.prepare-frame', 'op.remove-temp']) {
      const operation = compiled.operations.find((candidate) => candidate.id === operationId);
      expect(operation?.view.recipe.reveal, `${operationId} planned context`).toContain(
        'part.wall-a.opening',
      );
      const firstStepState = compiled.stepStates[0]!.after.find(
        (entry) => entry.partId === 'part.wall-a.opening',
      );
      expect(firstStepState?.state).toBe('absent');
    }
    const cut = compiled.operations.find((candidate) => candidate.id === 'op.cut-frame');
    expect(cut?.view.recipe.reveal).toEqual(['part.wall-a.opening']);
    expect(cut?.view.highlightPartIds).toEqual([]);
  });

  it('keeps every wall member inside the wall extents', () => {
    const wallMin: Vec3 = [FRAME_ORIGIN_X - 1, 82 - 45, -1];
    const wallMax: Vec3 = [FRAME_ORIGIN_X + 2438.4 + 1, 82 + 88.9 + 1, 2438.4 + 1];
    for (const id of FRAME_MEMBERS) {
      const box = bounds(id);
      expect(box.min[0], `${id} x min`).toBeGreaterThanOrEqual(wallMin[0]);
      expect(box.max[0], `${id} x max`).toBeLessThanOrEqual(wallMax[0]);
      expect(box.min[1], `${id} y min`).toBeGreaterThanOrEqual(wallMin[1]);
      expect(box.max[1], `${id} y max`).toBeLessThanOrEqual(wallMax[1]);
      expect(box.min[2], `${id} z min`).toBeGreaterThanOrEqual(wallMin[2]);
      expect(box.max[2], `${id} z max`).toBeLessThanOrEqual(wallMax[2]);
    }
  });

  it('models flush end studs and a conventional 16/32 in field-stud module', () => {
    const flushLeft = bounds('part.wall-a.stud-1');
    const flushRight = bounds('part.wall-a.stud-4');
    expect(flushLeft.min[0], 'left end stud is flush with the plate end').toBeCloseTo(FRAME_ORIGIN_X, 3);
    expect(flushRight.max[0], 'right end stud is flush with the plate end').toBeCloseTo(FRAME_ORIGIN_X + 2438.4, 3);
    // Field studs sit on the 16 in (406.4 mm) module from the wall origin, not at stale coordinates.
    expect(part('part.wall-a.stud-2').placement!.translationMm[0]).toBeCloseTo(406.4, 3);
    expect(part('part.wall-a.stud-3').placement!.translationMm[0]).toBeCloseTo(812.8, 3);
  });

  it('keeps the door rough opening clear of members below the header', () => {
    const clear: Bounds = { min: [CLEAR_SPAN[0], 82, 38.1], max: [CLEAR_SPAN[1], 82 + 88.9, 38.1 + 2032] };
    for (const id of FRAME_MEMBERS) {
      expect(boxesOverlap(bounds(id), clear, 1), `${id} must not block the clear opening`).toBe(false);
    }
  });

  it('bears both header plies on both jack studs', () => {
    const jackLeft = bounds('part.wall-a.jack-left');
    const jackRight = bounds('part.wall-a.jack-right');
    expect(jackLeft.max[2]).toBeCloseTo(38.1 + 2032, 3);
    for (const plyId of ['part.wall-a.header-ply-a', 'part.wall-a.header-ply-b']) {
      const ply = bounds(plyId);
      expect(ply.min[2], `${plyId} bottom equals the jack top`).toBeCloseTo(jackLeft.max[2], 3);
      expect(axisOverlap(jackLeft.min[0], jackLeft.max[0], ply.min[0], ply.max[0])).toBeGreaterThan(30);
      expect(axisOverlap(jackRight.min[0], jackRight.max[0], ply.min[0], ply.max[0])).toBeGreaterThan(30);
      expect(axisOverlap(jackLeft.min[1], jackLeft.max[1], ply.min[1], ply.max[1])).toBeGreaterThan(30);
    }
  });

  it('fits the backing blocks inside their stud bays without touching the studs', () => {
    const blockA = bounds('part.wall-a.backing-a');
    const blockB = bounds('part.wall-a.backing-b');
    const stud2 = bounds('part.wall-a.stud-2');
    const stud3 = bounds('part.wall-a.stud-3');
    const kingLeft = bounds('part.wall-a.king-left');
    expect(blockA.min[0]).toBeGreaterThanOrEqual(stud2.max[0] - 0.001);
    expect(blockA.max[0]).toBeLessThanOrEqual(stud3.min[0] + 0.001);
    expect(blockB.min[0]).toBeGreaterThanOrEqual(stud3.max[0] - 0.001);
    expect(blockB.max[0]).toBeLessThanOrEqual(kingLeft.min[0] + 0.001);
    for (const [block, stud] of [
      [blockA, stud2],
      [blockA, stud3],
      [blockB, stud3],
      [blockB, kingLeft],
    ] as const) {
      expect(boxesOverlap(block, stud, 0.5)).toBe(false);
    }
    expect(blockA.max[1]).toBeCloseTo(82, 1);
    const cabinet = bounds('part.cabinet.envelope');
    expect(blockA.min[2]).toBeGreaterThan(cabinet.min[2]);
    expect(blockA.max[2]).toBeLessThan(cabinet.max[2]);
  });

  it('models the continuous sole plate and the post-cut segments truthfully', () => {
    const finalState = compiled.stepStates[compiled.stepStates.length - 1]!;
    const stateOf = (partId: string) => finalState.after.find((entry) => entry.partId === partId)?.state ?? null;

    // Pre-cut representation: one continuous plate, no pre-cut segment parts installed early.
    expect(stateOf('part.wall-a.bottom-plate')).toBe('removed'); // removed after the doorway cut
    expect(stateOf('part.wall-a.bottom-plate-left')).toBe('installed');
    expect(stateOf('part.wall-a.bottom-plate-right')).toBe('installed');
    expect(stateOf('part.demo.temp-racking-brace')).toBe('removed');
    expect(stateOf('part.demo.temp-plumb-prop')).toBe('removed');

    // The remaining segments cover exactly the permanent plate regions.
    const left = bounds('part.wall-a.bottom-plate-left');
    const right = bounds('part.wall-a.bottom-plate-right');
    expect(left.max[0]).toBeCloseTo(CLEAR_SPAN[0], 3);
    expect(right.min[0]).toBeCloseTo(CLEAR_SPAN[1], 3);
    // Nothing installed crosses the final clear door span at floor level (the void itself is the
    // doorway and is checked separately by the clear-opening test).
    for (const id of ['part.wall-a.bottom-plate-left', 'part.wall-a.bottom-plate-right']) {
      const box = bounds(id);
      expect(
        axisOverlap(box.min[0], box.max[0], CLEAR_SPAN[0], CLEAR_SPAN[1]),
        `${id} clear of the doorway`,
      ).toBeLessThan(1);
    }
  });

  it('anchors only on permanent plate segments, never inside the door opening', () => {
    const anchor = compiled.operations.find((operation) => operation.id === 'op.anchor-frame');
    if (!anchor || anchor.kind !== 'fasten') throw new Error('op.anchor-frame missing');
    const points = anchor.parameters.pointsMm ?? [];
    expect(points).toHaveLength(3);
    const plate = bounds('part.wall-a.bottom-plate');
    for (const point of points) {
      expect(pointInBox(point, plate), `anchor ${JSON.stringify(point)} on the plate`).toBe(true);
      const insideClear = point[0] > CLEAR_SPAN[0] && point[0] < CLEAR_SPAN[1] && point[2] < CLEAR_HEIGHT;
      expect(insideClear, `anchor ${JSON.stringify(point)} must not sit inside the final door opening`).toBe(false);
    }
    // No fastener overlay may sit inside the final clear span below the header.
    for (const overlay of compiled.overlays) {
      if (!overlay.positionMm || overlay.kind !== 'fastener_point') continue;
      const [x, , z] = overlay.positionMm;
      const insideClear = x > CLEAR_SPAN[0] && x < CLEAR_SPAN[1] && z < CLEAR_HEIGHT;
      expect(insideClear, `overlay ${overlay.id} must not sit inside the final door opening`).toBe(false);
    }
  });

  it('uses in-plane racking bracing and a separate out-of-plane plumb prop', () => {
    const racking = bounds('part.demo.temp-racking-brace');
    const prop = bounds('part.demo.temp-plumb-prop');
    // Racking brace: flat against the framing face, rising in the wall plane (large x AND z extents,
    // small y extents).
    expect(racking.max[1] - racking.min[1]).toBeCloseTo(38.1, 3);
    expect(racking.max[0] - racking.min[0]).toBeGreaterThan(500);
    expect(racking.max[2] - racking.min[2]).toBeGreaterThan(900);
    // Plumb prop: leans out of the wall plane (large y extent) and reaches the floor.
    expect(prop.max[1] - prop.min[1]).toBeGreaterThan(500);
    expect(prop.min[2]).toBeLessThan(5);
    expect(prop.max[2]).toBeGreaterThan(2200);
    // Neither temporary member blocks the door opening.
    const clear: Bounds = { min: [CLEAR_SPAN[0], 0, 0], max: [CLEAR_SPAN[1], 250, CLEAR_HEIGHT] };
    expect(boxesOverlap(racking, clear, 1), 'racking brace must not block the doorway').toBe(false);
    expect(boxesOverlap(prop, clear, 1), 'plumb prop must not block the doorway').toBe(false);
    // Their removal operations exist and end in the stored state.
    for (const operationId of ['op.remove-brace', 'op.remove-plumb-prop']) {
      const operation = compiled.operations.find((candidate) => candidate.id === operationId);
      expect(operation, operationId).toBeDefined();
      expect(operation!.kind).toBe('remove');
      expect(operation!.stateEffects.some((effect) => effect.toState === 'removed')).toBe(true);
    }
  });
  it('never shows the temporary supports installed before the raise step', () => {
    const tempIds = ['part.demo.temp-racking-brace', 'part.demo.temp-plumb-prop'];
    const byId = new Map(compiled.operations.map((operation) => [operation.id, operation]));
    const raiseIndex = compiled.steps.findIndex((step) => step.id === 'step.raise-frame');
    expect(raiseIndex).toBeGreaterThan(0);

    for (const [index, step] of compiled.steps.entries()) {
      const operations = step.operationIds.map((operationId) => byId.get(operationId)!);
      const stateAfter = compiled.stepStates[index]!.after;
      for (const tempId of tempIds) {
        const state = stateAfter.find((entry) => entry.partId === tempId)?.state;
        const visibleState = state !== 'absent' && state !== 'removed';
        if (index < raiseIndex) {
          // Before the raise step the supports are only stock: absent or cut, never installed.
          expect(['absent', 'cut'], `${tempId} is not installed before the raise step`).toContain(state);
          if (visibleState) {
            // A cut member has renderable geometry in its final pose, so the step must hide it.
            expect(
              operations.some((operation) => operation.view.hiddenPartIds.includes(tempId)),
              `${step.id} must hide ${tempId} while it is not installed`,
            ).toBe(true);
          }
        }
      }
    }
    // The raise step installs both and shows them (no hiding).
    const raiseStep = compiled.steps[raiseIndex]!;
    const raiseOperations = raiseStep.operationIds.map((operationId) => byId.get(operationId)!);
    for (const tempId of tempIds) {
      const state = compiled.stepStates[raiseIndex]!.after.find((entry) => entry.partId === tempId)?.state;
      expect(state, `${tempId} installed at the raise step`).toBe('installed');
      expect(
        raiseOperations.some((operation) => operation.view.hiddenPartIds.includes(tempId)),
        `${tempId} must be visible once installed`,
      ).toBe(false);
    }
  });

  it('states the same kerf convention that the yield invariant applies (one kerf per cut)', () => {
    const notes = (id: string) => compiled.materials.find((material) => material.id === id)!.notes ?? '';
    // Exact totals the invariant computes with one 3 mm kerf per claimed cut.
    expect(notes('material.lumber.header')).toContain((2 * 1104.9 + 2 * 3).toFixed(1)); // 2215.8
    expect(notes('material.lumber.block')).toContain((368.3 + 336.55 + 2 * 3).toFixed(2)); // 710.85
    expect(notes('material.lumber.stud')).toContain((2362.2 + 3).toFixed(1)); // 2365.2
    expect(notes('material.lumber.stud')).toContain((2032 + 190.5 + 2 * 3).toFixed(1)); // 2228.5
    expect(notes('material.lumber.brace')).toContain((1336.2 + 3).toFixed(1)); // 1339.2
    expect(notes('material.lumber.prop')).toContain((2425.9 + 3).toFixed(1)); // 2428.9
    for (const id of ['material.lumber.header', 'material.lumber.block']) {
      expect(notes(id)).toContain('2 x 3 mm kerf');
    }
  });
});

describe('fastener points land on the members they claim', () => {
  it('places every released frame screw point on a frame member', () => {
    const assemble = compiled.operations.find((operation) => operation.id === 'op.assemble-frame');
    if (!assemble || assemble.kind !== 'fasten') throw new Error('op.assemble-frame missing');
    const points = assemble.parameters.pointsMm ?? [];
    expect(points).toHaveLength(40);
    const memberBoxes = FRAME_MEMBERS.map((id) => bounds(id));
    for (const point of points) {
      expect(
        memberBoxes.some((box) => pointInBox(point, box)),
        `screw point ${JSON.stringify(point)} lands on a member`,
      ).toBe(true);
    }
  });

  it('keeps the BOM, connection pattern and authored points consistent', () => {
    const screwMaterial = compiled.materials.find((material) => material.id === 'material.fastener.frame-screw')!;
    const anchorMaterial = compiled.materials.find((material) => material.id === 'material.fastener.frame-anchor')!;
    const assemble = compiled.operations.find((operation) => operation.id === 'op.assemble-frame');
    const anchor = compiled.operations.find((operation) => operation.id === 'op.anchor-frame');
    if (!assemble || assemble.kind !== 'fasten' || !anchor || anchor.kind !== 'fasten') {
      throw new Error('fasten operations missing');
    }
    const screwConnection = compiled.connections.find((candidate) => candidate.id === 'connection.frame.plate-to-stud')!;
    const anchorConnection = compiled.connections.find((candidate) => candidate.id === 'connection.frame.plate-to-slab')!;
    expect(screwConnection.pattern?.count).toBe(2);
    expect(screwMaterial.quantityProposed).toBe((assemble.parameters.pointsMm ?? []).length);
    expect(anchorConnection.pattern?.count).toBe(3);
    expect(anchorMaterial.quantityProposed).toBe((anchor.parameters.pointsMm ?? []).length);
  });
});
