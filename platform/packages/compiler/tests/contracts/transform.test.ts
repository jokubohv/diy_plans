/**
 * Contract tests: coordinate contract (architecture.md §2).
 *
 * R = Rz * Ry * Rx applied to column vectors; column-major matrices with translation at 12-14;
 * nested assembly placement; inverse round-trip; fixture control points <= 0.001 mm.
 */
import { describe, expect, it } from 'vitest';
import type { Mat4 } from '@diyguide/schema';
import {
  boxWorldBounds,
  compileBundle,
  identityMat4,
  invertMat4,
  matricesAlmostEqual,
  multiplyMat4,
  placementToMatrix,
  transformPoint,
} from '../../src/index';
import { FIXTURE_DIR, loadFixture } from '../helpers';

const DEG = Math.PI / 180;

describe('placementToMatrix', () => {
  it('places translation at indices 12-14 with bottom row [0,0,0,1]', () => {
    const m = placementToMatrix({ translationMm: [10, 20, 30] });
    expect(m.slice(12, 16)).toEqual([10, 20, 30, 1]);
    expect([m[3], m[7], m[11]]).toEqual([0, 0, 0]);
    expect([m[0], m[5], m[10]]).toEqual([1, 1, 1]);
  });

  it('applies R = Rz * Ry * Rx (X first)', () => {
    const rotZ = placementToMatrix({ translationMm: [0, 0, 0], rotationEulerDeg: [0, 0, 90] });
    const point = transformPoint(rotZ, [1, 0, 0]);
    expect(point[0]).toBeCloseTo(0, 9);
    expect(point[1]).toBeCloseTo(1, 9);

    const rotX = placementToMatrix({ translationMm: [0, 0, 0], rotationEulerDeg: [90, 0, 0] });
    const pointX = transformPoint(rotX, [0, 1, 0]);
    expect(pointX[1]).toBeCloseTo(0, 9);
    expect(pointX[2]).toBeCloseTo(1, 9);

    // Rz*Ry*Rx: rotate X by 90 first (local +Y -> +Z), then Z by 90 (+Z unchanged).
    const both = placementToMatrix({ translationMm: [0, 0, 0], rotationEulerDeg: [90, 0, 90] });
    const composed = transformPoint(both, [0, 1, 0]);
    expect(composed[0]).toBeCloseTo(0, 9);
    expect(composed[1]).toBeCloseTo(0, 9);
    expect(composed[2]).toBeCloseTo(1, 9);
  });

  it('applies scale before rotation', () => {
    const m = placementToMatrix({ translationMm: [0, 0, 0], scale: [2, 3, 4], rotationEulerDeg: [0, 0, 90] });
    const p = transformPoint(m, [1, 1, 1]);
    expect(p[0]).toBeCloseTo(-3, 9);
    expect(p[1]).toBeCloseTo(2, 9);
    expect(p[2]).toBeCloseTo(4, 9);
  });
});

describe('multiply / invert / bounds', () => {
  it('round-trips through the inverse for a rotated, translated, scaled transform', () => {
    const m = multiplyMat4(
      placementToMatrix({ translationMm: [123.5, -45.25, 900] }),
      placementToMatrix({ translationMm: [3, 4, 5], rotationEulerDeg: [12, 34, 56], scale: [1.5, 2, 0.75] }),
    );
    const inverse = invertMat4(m);
    expect(matricesAlmostEqual(multiplyMat4(m, inverse), identityMat4(), 1e-9)).toBe(true);
    const point = transformPoint(m, [7, -3, 11.5]);
    const back = transformPoint(inverse, point);
    expect(back[0]).toBeCloseTo(7, 8);
    expect(back[1]).toBeCloseTo(-3, 8);
    expect(back[2]).toBeCloseTo(11.5, 8);
  });

  it('throws on singular matrices', () => {
    expect(() => invertMat4(placementToMatrix({ translationMm: [0, 0, 0], scale: [1, 0, 1] }))).toThrow();
  });

  it('computes box world bounds over 8 corners', () => {
    const bounds = boxWorldBounds([2, 4, 6], placementToMatrix({ translationMm: [10, 20, 30] }));
    expect(bounds.min).toEqual([9, 18, 27]);
    expect(bounds.max).toEqual([11, 22, 33]);

    const rotated = boxWorldBounds([2, 4, 6], placementToMatrix({ translationMm: [0, 0, 0], rotationEulerDeg: [0, 0, 90] }));
    expect(rotated.min[0]).toBeCloseTo(-2, 9);
    expect(rotated.max[0]).toBeCloseTo(2, 9);
    expect(rotated.min[1]).toBeCloseTo(-1, 9);
    expect(rotated.max[1]).toBeCloseTo(1, 9);
  });
});

describe('fixture world transforms', () => {
  const load = loadFixture();
  const { compiled } = compileBundle({
    bundle: load.bundle,
    files: load.files,
    rawFiles: load.rawFiles,
    bundleDir: FIXTURE_DIR,
  });
  if (!compiled) throw new Error('fixture did not compile');

  const translationOf = (partId: string): [number, number, number] => {
    const part = compiled.parts.find((candidate) => candidate.id === partId);
    if (!part) throw new Error(`missing part ${partId}`);
    const t = part.worldTransform as Mat4;
    return [t[12] ?? Number.NaN, t[13] ?? Number.NaN, t[14] ?? Number.NaN];
  };

  it('matches the frozen control points within 0.001 mm', () => {
    const cases: Array<[string, [number, number, number]]> = [
      ['part.wall-a.stud-1', [366.05, 126.45, 1219.2]],
      ['part.wall-a.header-ply-a', [2067.85, 101.05, 2139.95]],
      ['part.demo.temp-racking-brace', [829.9, 62.95, 619.05]],
      ['part.demo.temp-plumb-prop', [753.4, -219, 1175]],
      ['part.wall-a.cover-panel', [969.3, 75.65, 1219.2]],
      ['part.existing.slab', [1600, 1200, -50]],
    ];
    for (const [partId, expected] of cases) {
      const actual = translationOf(partId);
      for (let axis = 0; axis < 3; axis += 1) {
        expect(Math.abs((actual[axis] ?? 0) - (expected[axis] ?? 0)), `${partId} axis ${axis}`).toBeLessThanOrEqual(0.001);
      }
    }
  });

  it('applies the authored rotations to the racking brace and the plumb prop', () => {
    const column = (matrix: Mat4, index: number): [number, number, number] => [
      matrix[4 * index] ?? 0,
      matrix[4 * index + 1] ?? 0,
      matrix[4 * index + 2] ?? 0,
    ];

    // Racking brace: long axis on X, rotated about Y so it rises in the wall plane from the plate
    // up to stud 3. Its +X end must be high and at the stud; its -X end on the plate.
    const racking = compiled.parts.find((part) => part.id === 'part.demo.temp-racking-brace')!;
    const rackingMatrix = racking.worldTransform as Mat4;
    const rackingAxis = column(rackingMatrix, 0);
    expect(rackingAxis[2], 'brace rises in +z').toBeGreaterThan(0.8);
    const rackingCentre: [number, number, number] = [
      rackingMatrix[12] ?? 0,
      rackingMatrix[13] ?? 0,
      rackingMatrix[14] ?? 0,
    ];
    const half = 1336.2 / 2;
    const topEnd = [0, 1, 2].map((axis) => rackingCentre[axis]! + rackingAxis[axis]! * half);
    const bottomEnd = [0, 1, 2].map((axis) => rackingCentre[axis]! - rackingAxis[axis]! * half);
    expect(topEnd[2], 'top end is high on the frame').toBeGreaterThan(1100);
    expect(bottomEnd[2], 'bottom end bears on the plate').toBeLessThan(45);
    expect(racking.boundsMm.max[1] - racking.boundsMm.min[1], 'flat against the framing face').toBeCloseTo(38.1, 3);

    // Plumb prop: long axis on Z, rotated about X so it leans out of the wall plane from the top
    // of the frame down to the floor.
    const prop = compiled.parts.find((part) => part.id === 'part.demo.temp-plumb-prop')!;
    const propMatrix = prop.worldTransform as Mat4;
    const propAxis = column(propMatrix, 2);
    expect(propAxis[2], 'prop rises along +z').toBeGreaterThan(0.9);
    expect(propAxis[1], 'prop leans toward the wall at the top').toBeGreaterThan(0.1);
    const propCentre: [number, number, number] = [
      propMatrix[12] ?? 0,
      propMatrix[13] ?? 0,
      propMatrix[14] ?? 0,
    ];
    const propHalf = 2425.9 / 2;
    const propTop = [0, 1, 2].map((axis) => propCentre[axis]! + propAxis[axis]! * propHalf);
    const propBottom = [0, 1, 2].map((axis) => propCentre[axis]! - propAxis[axis]! * propHalf);
    expect(propTop[2], 'prop reaches the top of the frame').toBeGreaterThan(2300);
    expect(propBottom[2], 'prop bears on the floor').toBeLessThan(5);
    expect(prop.boundsMm.max[1] - prop.boundsMm.min[1], 'leans well out of the wall plane').toBeGreaterThan(500);
  });

  it('resolves the nested drywall cover assembly through wall-a', () => {
    const cover = compiled.parts.find((part) => part.id === 'part.wall-a.cover-panel');
    expect(cover!.boundsMm.min[2]).toBeCloseTo(0, 6);
    expect(cover!.boundsMm.max[2]).toBeCloseTo(2438.4, 6);
    // y: wall-a offset 82 + local -6.35 ± half thickness 6.35
    expect(cover!.boundsMm.min[1]).toBeCloseTo(69.3, 6);
    expect(cover!.boundsMm.max[1]).toBeCloseTo(82.0, 6);
  });
});
