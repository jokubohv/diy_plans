/**
 * R35 geometry test: W1/W2 member counts and centres, the 25 blocks inside their bays, the 12
 * panels with faces/ends, EX1 exclusion, the absence of any flat-assembly pose and plan-level
 * collision checks between the new walls, EX1 and the retained context.
 */
import { describe, expect, it } from 'vitest';
import type { Part } from '@diyguide/schema';
import { parseLengthToMm } from '../../src/fraction';
import {
  boxXRange,
  boxYRange,
  boxZRange,
  compileR35,
  findPart,
  inchToMm,
  jsonPointer,
  readManualJson,
  readWorkJson,
  W1_STUD_CENTRE_POINTER,
  W2_FACE_STUDS_POINTER,
} from './helpers';

const OVERLAP_TOLERANCE_MM = 0.1;
const SCENE_SOURCE_X_ORIGIN_MM = inchToMm('149');

/** A3-oriented scene registration: X = 149 in - x_R35. */
function sceneX(sourceX: string | number): number {
  return SCENE_SOURCE_X_ORIGIN_MM - inchToMm(String(sourceX));
}

function overlap(a: [number, number], b: [number, number]): number {
  return Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
}

/** Plan-footprint overlap area proxy: positive only when both axes overlap. */
function footprintOverlap(a: Part, b: Part): number {
  const dx = overlap(boxXRange(a), boxXRange(b));
  const dy = overlap(boxYRange(a), boxYRange(b));
  if (dx <= OVERLAP_TOLERANCE_MM || dy <= OVERLAP_TOLERANCE_MM) return 0;
  return dx * dy;
}

describe('R35 geometry: walls and members', () => {
  const { bundle, compiled } = compileR35();
  const manual = readManualJson();

  it('has 12 W1 studs at the source centres and no header or door opening in W1', () => {
    const centres = jsonPointer<string[]>(manual, W1_STUD_CENTRE_POINTER);
    expect(centres).toHaveLength(12);
    centres.forEach((centre, index) => {
      const id = `part.w1.stud-s${String(index + 1).padStart(2, '0')}`;
      const part = findPart(bundle.parts, id);
      const [cx] = part.placement?.translationMm ?? [0, 0, 0];
      expect(cx, id).toBeCloseTo(sceneX(centre), 3);
      expect(part.materialId).toBe('material.lumber.w1-stud');
    });
    for (const part of bundle.parts) {
      expect(/\bheader\b|\bking\b|\bjack\b|\bcripple\b|opening/i.test(part.id), part.id).toBe(false);
    }
    const w1Parts = bundle.parts.filter((part) => part.assemblyId === 'assembly.w1');
    expect(w1Parts.filter((part) => part.kind === 'opening')).toHaveLength(0);
    const w2Parts = bundle.parts.filter((part) => part.assemblyId === 'assembly.w2');
    expect(w2Parts.filter((part) => part.kind === 'opening')).toHaveLength(0);
  });

  it('has 5 W2 studs at the face-map centres with the last one recorded as a candidate', () => {
    const centres = jsonPointer<string[]>(manual, W2_FACE_STUDS_POINTER);
    expect(centres).toHaveLength(5);
    centres.forEach((centre, index) => {
      const id = `part.w2.stud-s${String(index + 1).padStart(2, '0')}`;
      const part = findPart(bundle.parts, id);
      const [, cy] = part.placement?.translationMm ?? [0, 0, 0];
      const centreMm = centre === '415/8' ? parseLengthToMm('415/8', 'in').mm : parseLengthToMm(centre, 'in').mm;
      expect(cy, id).toBeCloseTo(centreMm, 3);
      expect(part.geometry.shape).toBe('box');
      if (part.geometry.shape === 'box') {
        expect(part.geometry.sizeMm[0]).toBeCloseTo(inchToMm('7.25'), 3);
        expect(part.geometry.sizeMm[1]).toBeCloseTo(inchToMm('1.5'), 3);
      }
    });
    // The fifth CSV centre is blank (field-fit); the value comes from the R34 face map and stays a candidate.
    const w2S05 = findPart(bundle.parts, 'part.w2.stud-s05');
    expect(w2S05.description).toMatch(/candidate only|field-fit/i);
  });

  it('keeps stud/panel heights unresolved while retaining the known top-plate section', () => {
    const unresolved = [
      ...Array.from({ length: 12 }, (_, index) => `part.w1.stud-s${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 5 }, (_, index) => `part.w2.stud-s${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 12 }, (_, index) => {
        const faces = [
          ['W1-P', 4],
          ['W1-R', 4],
          ['W2-P', 2],
          ['W2-R', 2],
        ] as const;
        let remaining = index;
        for (const [face, count] of faces) {
          if (remaining < count) return `part.drywall.${face.toLowerCase()}-0${remaining + 1}`;
          remaining -= count;
        }
        return 'part.drywall.w2-r-02';
      }),
    ];
    for (const id of unresolved) {
      const part = findPart(bundle.parts, id);
      if (part.geometry.shape !== 'box') throw new Error(`${id} must be a box footprint`);
      expect(part.geometry.sizeMm[2], id).toBeLessThanOrEqual(20.001);
      expect(/field-fit|plan footprint|not asserted|unresolved/i.test(part.description), `${id} description states the extent basis`).toBe(true);
    }
    for (const id of ['part.w1.top-plate', 'part.w2.top-plate']) {
      const part = findPart(bundle.parts, id);
      if (part.geometry.shape !== 'box') throw new Error(`${id} must be a box footprint`);
      expect(part.geometry.sizeMm[2], id).toBeCloseTo(inchToMm('1.5'), 3);
      expect(part.description, id).toMatch(/elevation.*held|no elevation.*asserted/i);
    }
    const topPlateOperation = compiled.operations.find(
      (operation) => operation.id === 'op.restrain-top-plates',
    );
    expect(topPlateOperation?.view.cameraPresetId).toBe('view.top-plates');
    expect(topPlateOperation?.view.highlightPartIds).toEqual(
      expect.arrayContaining(['part.w1.top-plate', 'part.w2.top-plate']),
    );
  });

  it('has 25 backing blocks inside their bays without stud intersections', () => {
    const blocks = bundle.parts.filter((part) => part.assemblyId === 'assembly.backing');
    expect(blocks).toHaveLength(25);
    const centresIn = jsonPointer<string[]>(manual, W1_STUD_CENTRE_POINTER);
    const centresMm = centresIn.map((centre) => sceneX(centre));
    const studHalf = inchToMm('0.75');
    const csv = readWorkJson<{ files: { file: string; rows: { id: string; disposition: string; entityIds: string[] }[] }[] }>('reconciliation.json');
    const backingFile = csv.files.find((file) => file.file.endsWith('cabinet-backing-R31-CONCEPT.csv'));
    expect(backingFile?.rows).toHaveLength(25);
    for (const block of blocks) {
      const match = /-b(\d+)$/.exec(block.id);
      if (!match) throw new Error(`Block id ${block.id} has no bay`);
      const bay = Number(match[1]);
      const right = centresMm[bay - 1] as number;
      const left = centresMm[bay] as number;
      const [bx0, bx1] = boxXRange(block);
      expect(bx0, `${block.id} left face`).toBeGreaterThanOrEqual(left + studHalf - OVERLAP_TOLERANCE_MM);
      expect(bx1, `${block.id} right face`).toBeLessThanOrEqual(right - studHalf + OVERLAP_TOLERANCE_MM);
      // The block must not cross either bounding stud footprint.
      expect(overlap([bx0, bx1], [left - studHalf, left + studHalf]), block.id).toBeLessThanOrEqual(1e-9);
      expect(overlap([bx0, bx1], [right - studHalf, right + studHalf]), block.id).toBeLessThanOrEqual(1e-9);
      const [, by1] = boxYRange(block);
      expect(by1, `${block.id} cavity depth`).toBeLessThanOrEqual(inchToMm('-0.5') + OVERLAP_TOLERANCE_MM);
      const [bz0, bz1] = boxZRange(block);
      expect(bz1 - bz0, `${block.id} vertical face`).toBeCloseTo(inchToMm('5.5'), 3);
    }
  });

  it('has 12 drywall panels with the CSV faces and endpoints', () => {
    const panels = bundle.parts.filter((part) => part.assemblyId === 'assembly.drywall');
    expect(panels).toHaveLength(12);
    const facePlane = {
      'W1-P': { axis: 'x' as const, plane: inchToMm('-0.25') },
      'W1-R': { axis: 'x' as const, plane: inchToMm('-4.25') },
      'W2-P': { axis: 'y' as const, plane: sceneX('149.25') },
      'W2-R': { axis: 'y' as const, plane: sceneX('157.0625') },
    };
    const csv = readWorkJson<{ files: { file: string; rows: { id: string; entityIds: string[] }[] }[] }>('reconciliation.json');
    const panelFile = csv.files.find((file) => file.file.endsWith('drywall-panel-schedule-R34-CONCEPT.csv'));
    expect(panelFile?.rows).toHaveLength(12);
    const expected = [
      ['w1-p-01', 'W1-P', 0, 48],
      ['w1-p-02', 'W1-P', 48, 96],
      ['w1-p-03', 'W1-P', 96, 144],
      ['w1-p-04', 'W1-P', 144, 149.5],
      ['w1-r-01', 'W1-R', 0, 16],
      ['w1-r-02', 'W1-R', 16, 64],
      ['w1-r-03', 'W1-R', 64, 112],
      ['w1-r-04', 'W1-R', 112, 157.375],
      ['w2-p-01', 'W2-P', 0, 31.5],
      ['w2-p-02', 'W2-P', 31.5, 52.625],
      ['w2-r-01', 'W2-R', -4, 15.5],
      ['w2-r-02', 'W2-R', 15.5, 52.625],
    ] as const;
    for (const [name, face, start, end] of expected) {
      const part = findPart(bundle.parts, `part.drywall.${name}`);
      const plane = facePlane[face];
      if (plane.axis === 'x') {
        const [x0, x1] = boxXRange(part);
        expect(x0, `${name} scene start`).toBeCloseTo(sceneX(end), 3);
        expect(x1, `${name} scene end`).toBeCloseTo(sceneX(start), 3);
        const [, y] = part.placement?.translationMm ?? [0, 0, 0];
        expect(y, `${name} face plane`).toBeCloseTo(plane.plane, 3);
      } else {
        const [y0, y1] = boxYRange(part);
        expect(y0, `${name} start`).toBeCloseTo(inchToMm(String(start)), 3);
        expect(y1, `${name} end`).toBeCloseTo(inchToMm(String(end)), 3);
        const [x] = part.placement?.translationMm ?? [0, 0, 0];
        expect(x, `${name} face plane`).toBeCloseTo(plane.plane, 3);
      }
      expect(part.description, `${name} core sheet`).toMatch(/core-nest stock .*not a spare/i);
      expect(part.description, `${name} vertical stock orientation`).toMatch(
        /orientation is vertical.*120-in stock direction vertical/i,
      );
      expect(part.description, `${name} unresolved vertical/fastening details`).toMatch(
        /real height stays field-fit.*horizontal top\/bottom plate receiver use.*bottom gap.*top movement joint.*fastening remain held/i,
      );
      expect(part.description, `${name} movement hold`).toMatch(
        /never bridge an intended movement joint.*fastening, tape or adhesive/i,
      );
    }
    expect(findPart(bundle.parts, 'part.drywall.w1-p-01').description).toMatch(/48 in at S04/i);
    expect(findPart(bundle.parts, 'part.drywall.w1-r-02').description).toMatch(
      /16 in at S02.*64 in at S05/i,
    );
    expect(findPart(bundle.parts, 'part.drywall.w2-p-02').description).toMatch(
      /31\.5 in at S03 \/ q=32/i,
    );
    expect(findPart(bundle.parts, 'part.drywall.w2-r-01').description).toMatch(
      /15\.5 in at S02 \/ q=16/i,
    );
    expect(findPart(bundle.parts, 'part.drywall.w1-p-01').description).toMatch(
      /left W1-S01; right W1-S04/i,
    );
    expect(findPart(bundle.parts, 'part.drywall.w1-r-04').description).toMatch(
      /right W1-S12 vicinity.*outside-edge fastening unresolved/i,
    );
    expect(findPart(bundle.parts, 'part.drywall.w2-p-02').description).toMatch(
      /conditional W2-S05\/column termination/i,
    );
    expect(findPart(bundle.parts, 'part.drywall.w2-r-01').description).toMatch(
      /W1-S12 side-face wrap and W2-S01.*right W2-S02/i,
    );
  });

  it('excludes EX1 and the retained context from the takeoff', () => {
    for (const id of ['part.existing.ex1-wall', 'part.existing.kitchen-door', 'part.existing.tile-floor', 'part.existing.slab', 'part.existing.column']) {
      const part = findPart(bundle.parts, id);
      expect(part.takeoff?.include, id).toBe(false);
      expect(part.role, id).toBe('existing');
    }
  });

  it('never uses a flat-assembly, tilt-up or bracing pose for R35', () => {
    for (const operation of compiled.operations) {
      expect(JSON.stringify(operation.view.recipe).includes('layFlat'), operation.id).toBe(false);
    }
    for (const step of compiled.steps) {
      expect(/flat assemb|tilt|raise/i.test(step.title), step.id).toBe(false);
    }
    for (const part of bundle.parts) {
      expect(/temp-racking|temp-plumb|tilt|temporary brace/i.test(part.id), part.id).toBe(false);
    }
  });

  it('keeps canonical wall heights unresolved while declaring the labelled schematic viewer pose', () => {
    const earlyOperations = [
      'op.survey-finished-faces',
      'op.survey-trim',
      'op.protect-route',
    ];
    for (const id of earlyOperations) {
      const operation = compiled.operations.find((candidate) => candidate.id === id);
      const elevation = operation?.view.recipe.schematicElevation;
      expect(elevation, id).toBeDefined();
      expect(elevation?.overallHeightMm, id).toBeCloseTo(inchToMm('111'), 3);
      expect(elevation?.label, id).toMatch(/schematic.*field-fit.*not a cut dimension/i);
      expect(elevation?.panelPartIds, id).toHaveLength(12);
      expect(elevation?.panelPartIds, id).toEqual(
        expect.arrayContaining([
          'part.drywall.w1-p-01',
          'part.drywall.w1-r-04',
          'part.drywall.w2-p-02',
          'part.drywall.w2-r-02',
        ]),
      );
    }
    const survey = compiled.operations.find(
      (operation) => operation.id === 'op.survey-finished-faces',
    );
    expect(survey?.view.recipe.reveal).toContain('part.w1.stud-s01');
    expect(survey?.view.recipe.reveal).toContain('part.w2.stud-s05');
  });

  it('shows absent held targets as labelled previews without applying their canonical state', () => {
    const initiallyAbsent = new Set(
      compiled.parts.filter((part) => part.initialState === 'absent').map((part) => part.id),
    );
    for (const operation of compiled.operations.filter((candidate) =>
      candidate.declaredReleaseStatus === 'held' ||
      candidate.declaredReleaseStatus === 'conditional'
    )) {
      const absentTargets = operation.targetPartIds.filter((partId) => initiallyAbsent.has(partId));
      const revealed = new Set(operation.view.recipe.reveal ?? []);
      for (const partId of absentTargets) {
        expect(revealed.has(partId), `${operation.id} should preview ${partId}`).toBe(true);
      }
    }

    const topPlate = compiled.operations.find(
      (operation) => operation.id === 'op.restrain-top-plates',
    );
    expect(topPlate?.view.recipe.reveal).toEqual(
      expect.arrayContaining([
        'part.w1.bottom-plate',
        'part.w2.bottom-plate',
        'part.w1.top-plate',
        'part.w2.top-plate',
      ]),
    );

    const backing = compiled.operations.find(
      (operation) => operation.id === 'op.fit-backing-blocks',
    );
    const backingReveal = new Set(backing?.view.recipe.reveal ?? []);
    expect([...backingReveal].filter((partId) => partId.startsWith('part.backing.'))).toHaveLength(25);
    expect(backingReveal.has('part.w1.top-plate')).toBe(true);
    expect(backingReveal.has('part.w2.top-plate')).toBe(true);

    const fixtures = compiled.operations.find(
      (operation) => operation.id === 'op.set-counter-uppers-shelves',
    );
    expect(fixtures?.view.recipe.reveal).toEqual(
      expect.arrayContaining([
        'part.w1.top-plate',
        'part.backing.top-b01',
        'part.drywall.w1-p-01',
        'part.fixture.base-row',
        'part.fixture.upper-u1',
        'part.fixture.shelves',
      ]),
    );
  });

  it('assembles the loose 24x24-in practice frame with viewer-only transforms', () => {
    const bottom = findPart(bundle.parts, 'part.practice.plate-a');
    const top = findPart(bundle.parts, 'part.practice.plate-b');
    const [bottomX0, bottomX1] = boxXRange(bottom);
    expect(bottomX0).toBeCloseTo(0, 3);
    expect(bottomX1).toBeCloseTo(inchToMm('24'), 3);
    const [topX0, topX1] = boxXRange(top);
    expect(topX0).toBeCloseTo(-inchToMm('24'), 3);
    expect(topX1).toBeCloseTo(0, 3);
    const [bottomZ0, bottomZ1] = boxZRange(bottom);
    expect(bottomZ0).toBeCloseTo(0, 3);
    expect(bottomZ1).toBeCloseTo(inchToMm('1.5'), 3);
    const [topZ0, topZ1] = boxZRange(top);
    expect(topZ0).toBeCloseTo(0, 3);
    expect(topZ1).toBeCloseTo(inchToMm('1.5'), 3);

    const expectedStudCentres = ['0.75', '12', '23.25'].map(inchToMm);
    for (const [index, centre] of expectedStudCentres.entries()) {
      const stud = findPart(bundle.parts, `part.practice.stud-${['a', 'b', 'c'][index]}`);
      const [x0, x1] = boxXRange(stud);
      expect((x0 + x1) / 2).toBeCloseTo(centre, 3);
      const [z0, z1] = boxZRange(stud);
      expect(z0).toBeCloseTo(inchToMm('0.75'), 3);
      expect(z1).toBeCloseTo(inchToMm('21.75'), 3);
    }

    const fit = compiled.operations.find((operation) => operation.id === 'op.fit-practice-frame');
    const transforms = new Map(
      fit?.view.recipe.boxTransforms?.map((transform) => [transform.partId, transform]) ?? [],
    );
    expect(transforms.get('part.practice.plate-b')?.offsetMm).toEqual([609.6, 0, 571.5]);
    for (const id of ['part.practice.stud-a', 'part.practice.stud-b', 'part.practice.stud-c']) {
      expect(transforms.get(id)?.offsetMm, id).toEqual([0, 250, 19.05]);
    }
  });

  it('keeps W1, W2, EX1 and the context in plan-level contact without solid overlap', () => {
    const w1S12 = findPart(bundle.parts, 'part.w1.stud-s12');
    const w1S11 = findPart(bundle.parts, 'part.w1.stud-s11');
    const w2S01 = findPart(bundle.parts, 'part.w2.stud-s01');
    const w2Plate = findPart(bundle.parts, 'part.w2.bottom-plate');
    const column = findPart(bundle.parts, 'part.existing.column');
    const ex1 = findPart(bundle.parts, 'part.existing.ex1-wall');

    // S11/S12 and W2-S01 butt at the candidate corner (R34 wood junction footprints).
    expect(footprintOverlap(w1S12, w2S01)).toBe(0);
    expect(footprintOverlap(w1S11, w2S01)).toBe(0);
    expect(overlap(boxXRange(w1S11), boxXRange(w2S01))).toBeLessThanOrEqual(OVERLAP_TOLERANCE_MM);
    // W2 stops at the column front; nothing passes through the retained column.
    expect(overlap(boxYRange(w2Plate), boxYRange(column))).toBeLessThanOrEqual(OVERLAP_TOLERANCE_MM);
    expect(findPart(bundle.parts, 'part.w2.stud-s05').description).toMatch(/column contact governs/i);
    // The EX1 wall plane is beyond the W2 run and never intersected.
    expect(footprintOverlap(w2Plate, ex1)).toBe(0);
    expect(overlap(boxYRange(w1S12), boxYRange(ex1))).toBeLessThanOrEqual(0);
    // The practice bench is far away from the house region.
    const practice = bundle.parts.filter((part) => part.assemblyId === 'assembly.practice');
    expect(practice.length).toBeGreaterThan(5);
    const practiceAssembly = bundle.assemblies.find((assembly) => assembly.id === 'assembly.practice');
    const practiceOffsetY = practiceAssembly?.placement?.translationMm[1] ?? 0;
    const houseBoxParts = bundle.parts.filter((part) => part.assemblyId !== 'assembly.practice' && part.geometry.shape === 'box');
    const houseMaxY = Math.max(...houseBoxParts.map((part) => boxYRange(part)[1]));
    for (const part of practice) {
      expect(boxYRange(part)[0] + practiceOffsetY, part.id).toBeGreaterThan(houseMaxY);
    }
  });

  it('keeps the W1/W2 corner member footprints from the R34 drawings', () => {
    const w1S11 = findPart(bundle.parts, 'part.w1.stud-s11');
    const w1S12 = findPart(bundle.parts, 'part.w1.stud-s12');
    // R34 source S11 = 148…149.5 and S12 = 155.25…156.75 in. A3 scene X=149−x.
    expect(boxXRange(w1S11)[0]).toBeCloseTo(sceneX('149.5'), 3);
    expect(boxXRange(w1S11)[1]).toBeCloseTo(sceneX('148'), 3);
    expect(boxXRange(w1S12)[0]).toBeCloseTo(sceneX('156.75'), 3);
    expect(boxXRange(w1S12)[1]).toBeCloseTo(sceneX('155.25'), 3);
    // W2-S01 source x = 149.5…156.75 -> scene X = -7.75…-0.5; y unchanged.
    const w2S01 = findPart(bundle.parts, 'part.w2.stud-s01');
    expect(boxXRange(w2S01)[0]).toBeCloseTo(sceneX('156.75'), 3);
    expect(boxXRange(w2S01)[1]).toBeCloseTo(sceneX('149.5'), 3);
    expect(boxYRange(w2S01)[0]).toBeCloseTo(inchToMm('-0.5'), 3);
    expect(boxYRange(w2S01)[1]).toBeCloseTo(inchToMm('1'), 3);
  });

  it('registers the whole house to the A3 scene instead of moving W2 alone', () => {
    expect(bundle.project.coordinateContract.description).toMatch(
      /origin.*W1 and W2 pantry finished faces.*\+X.*foyer\/W2.*garage\/refrigerator/i,
    );
    expect(bundle.project.coordinateContract.description).toMatch(/X = 149 in - x_R35/i);

    const w1Left = findPart(bundle.parts, 'part.w1.stud-s01');
    const w1Corner = findPart(bundle.parts, 'part.w1.stud-s12');
    const w2 = findPart(bundle.parts, 'part.w2.bottom-plate');
    expect(w1Left.placement?.translationMm[0]).toBeCloseTo(sceneX('0.75'), 3);
    expect(w1Corner.placement?.translationMm[0]).toBeCloseTo(sceneX('156'), 3);
    expect(boxXRange(w2)[0]).toBeCloseTo(sceneX('156.75'), 3);
    expect(boxXRange(w2)[1]).toBeCloseTo(sceneX('149.5'), 3);
    expect(boxYRange(w2)[0]).toBeCloseTo(inchToMm('-0.5'), 3);
    expect(boxYRange(w2)[1]).toBeCloseTo(inchToMm('52.625'), 3);

    const plan = bundle.views.find((view) => view.id === 'view.plan');
    expect(plan?.camera.upMm).toEqual([0, 1, 0]);
    const practice = bundle.assemblies.find((assembly) => assembly.id === 'assembly.practice');
    expect(practice?.placement?.translationMm).toEqual([5200, 4200, 0]);
  });
});
