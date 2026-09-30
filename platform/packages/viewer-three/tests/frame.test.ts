import { describe, expect, it } from 'vitest';
import { Plane, Vector3 } from 'three';
import type { Mat4, Vec3 } from '@diyguide/schema';
import {
  canonicalAxisToViewer,
  canonicalCameraToViewer,
  canonicalMatrixToViewer,
  canonicalPointToViewer,
  canonicalSectionToThreePlane,
  canonicalToViewer,
  matrixRotationAboutPivot,
  viewerPointToCanonical,
  viewerToCanonical,
} from '../src/index';

/** Control point from the architecture fixture discussion (mm, Z-up). */
const CONTROL_POINT: Vec3 = [404.15, 126.45, 1219.2];
const CONTROL_POINT_VIEWER: Vec3 = [0.40415, 1.2192, -0.12645];

const ROUND_TRIP_POINTS: Vec3[] = [
  CONTROL_POINT,
  [0, 0, 0],
  [-1234.56, 789.01, -234.5],
  [9000, -4500, 2500],
];

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
/** Apply a column-major 4x4 matrix to a point (w = 1). */
function applyMat4(matrix: Mat4, point: Vec3): Vec3 {
  const [x, y, z] = point;
  return [
    matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!,
    matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!,
    matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!,
  ];
}

function axisPoint(axis: 'x' | 'y' | 'z', value: number): Vec3 {
  if (axis === 'x') return [value, 0, 0];
  if (axis === 'y') return [0, value, 0];
  return [0, 0, value];
}

function expectVecClose(actual: Vec3, expected: Vec3, digits: number): void {
  for (let index = 0; index < 3; index += 1) {
    expect(actual[index]).toBeCloseTo(expected[index]!, digits);
  }
}

describe('canonicalToViewer / viewerToCanonical', () => {
  it('maps the control point to the frozen viewer coordinates', () => {
    const viewer = canonicalToViewer(CONTROL_POINT);
    expectVecClose(viewer, CONTROL_POINT_VIEWER, 9);
  });

  it('round-trips within the 0.1 mm error budget', () => {
    for (const point of ROUND_TRIP_POINTS) {
      const roundTripped = viewerToCanonical(canonicalToViewer(point));
      for (let index = 0; index < 3; index += 1) {
        expect(Math.abs(roundTripped[index]! - point[index]!)).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it('exposes the point aliases with identical behaviour', () => {
    expect(canonicalPointToViewer(CONTROL_POINT)).toEqual(canonicalToViewer(CONTROL_POINT));
    expect(viewerPointToCanonical(CONTROL_POINT_VIEWER)).toEqual(
      viewerToCanonical(CONTROL_POINT_VIEWER),
    );
  });

  it('applies the exact inverse formula', () => {
    expect(viewerToCanonical([1, 2, 3])).toEqual([1000, -3000, 2000]);
  });

  it('preserves handedness: canonical +X cross +Y points to canonical +Z', () => {
    const x = canonicalToViewer([1000, 0, 0]);
    const y = canonicalToViewer([0, 1000, 0]);
    const cross: Vec3 = [
      x[1] * y[2] - x[2] * y[1],
      x[2] * y[0] - x[0] * y[2],
      x[0] * y[1] - x[1] * y[0],
    ];
    expectVecClose(cross, canonicalToViewer([0, 0, 1000]), 9);
  });
});

describe('canonicalMatrixToViewer', () => {
  it('maps the identity to the axis map with the 0.001 scale', () => {
    const identity: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    expect(canonicalMatrixToViewer(identity)).toEqual([
      0.001, 0, 0, 0,
      0, 0, -0.001, 0,
      0, 0.001, 0, 0,
      0, 0, 0, 1,
    ]);
  });

  it('keeps the translation consistent with the point mapping', () => {
    const matrix: Mat4 = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      CONTROL_POINT[0], CONTROL_POINT[1], CONTROL_POINT[2], 1,
    ];
    const viewerMatrix = canonicalMatrixToViewer(matrix);
    expect(viewerMatrix[12]).toBeCloseTo(CONTROL_POINT_VIEWER[0], 9);
    expect(viewerMatrix[13]).toBeCloseTo(CONTROL_POINT_VIEWER[1], 9);
    expect(viewerMatrix[14]).toBeCloseTo(CONTROL_POINT_VIEWER[2], 9);
    expectVecClose(applyMat4(viewerMatrix, [0, 0, 0]), CONTROL_POINT_VIEWER, 9);
  });

  it('commutes with arbitrary transforms: viewer(M * p) == map(M * p)', () => {
    const angle = Math.PI / 6;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    // Column-major: Rz(30 deg) * T([1000, 2000, 3000]).
    const matrix: Mat4 = [
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      1000, 2000, 3000, 1,
    ];
    const viewerMatrix = canonicalMatrixToViewer(matrix);
    const localPoints: Vec3[] = [
      [0, 0, 0],
      [500, -250, 1000],
      [-800, 640.5, 120.25],
    ];
    for (const local of localPoints) {
      const canonicalWorld = applyMat4(matrix, local);
      const expected = canonicalToViewer(canonicalWorld);
      const actual = applyMat4(viewerMatrix, local);
      expectVecClose(actual, expected, 9);
    }
  });
});

describe('canonicalSectionToThreePlane', () => {
  const axes = ['x', 'y', 'z'] as const;

  it('pins the sign convention with points on both sides of every axis', () => {
    for (const axis of axes) {
      for (const flip of [false, true]) {
        const spec = canonicalSectionToThreePlane({ axis, offsetMm: 1000, flip });
        expect(spec.keepSide).toBe(flip ? 'negative' : 'positive');
        expect(Math.hypot(spec.normal[0], spec.normal[1], spec.normal[2])).toBeCloseTo(1, 12);

        const above = canonicalToViewer(axisPoint(axis, 1500));
        const below = canonicalToViewer(axisPoint(axis, 500));
        const onPlane = canonicalToViewer(axisPoint(axis, 1000));

        const distanceAbove = dot(spec.normal, above) + spec.constant;
        const distanceBelow = dot(spec.normal, below) + spec.constant;
        expect(dot(spec.normal, onPlane) + spec.constant).toBeCloseTo(0, 12);

        // three.js clipping keeps the region with plane.distanceToPoint >= 0.
        if (!flip) {
          expect(distanceAbove).toBeGreaterThan(0);
          expect(distanceBelow).toBeLessThan(0);
        } else {
          expect(distanceAbove).toBeLessThan(0);
          expect(distanceBelow).toBeGreaterThan(0);
        }
      }
    }
  });

  it('matches THREE.Plane distance semantics', () => {
    const spec = canonicalSectionToThreePlane({ axis: 'z', offsetMm: 1200 });
    const plane = new Plane(new Vector3(...spec.normal), spec.constant);
    const above = new Vector3(...canonicalToViewer([0, 0, 1700]));
    const below = new Vector3(...canonicalToViewer([0, 0, 700]));
    const onPlane = new Vector3(...canonicalToViewer([0, 0, 1200]));
    expect(plane.distanceToPoint(above)).toBeCloseTo(0.5, 9);
    expect(plane.distanceToPoint(below)).toBeCloseTo(-0.5, 9);
    expect(plane.distanceToPoint(onPlane)).toBeCloseTo(0, 9);

    const flipped = canonicalSectionToThreePlane({ axis: 'z', offsetMm: 1200, flip: true });
    const flippedPlane = new Plane(new Vector3(...flipped.normal), flipped.constant);
    expect(flipped.keepSide).toBe('negative');
    expect(flippedPlane.distanceToPoint(above)).toBeCloseTo(-0.5, 9);
    expect(flippedPlane.distanceToPoint(below)).toBeCloseTo(0.5, 9);
  });

  it('keeps a Y-axis section at the same canonical plane for both flip states', () => {
    const normal = canonicalSectionToThreePlane({ axis: 'y', offsetMm: -250 });
    const flipped = canonicalSectionToThreePlane({ axis: 'y', offsetMm: -250, flip: true });
    expect(normal.normal).toEqual([0, 0, -1]);
    expect(normal.constant).toBeCloseTo(0.25, 12);
    expect(flipped.normal).toEqual([0, 0, 1]);
    expect(flipped.constant).toBeCloseTo(-0.25, 12);
  });
});

describe('canonicalCameraToViewer', () => {
  it('converts position, target, up and keeps fov', () => {
    const camera = canonicalCameraToViewer({
      positionMm: CONTROL_POINT,
      targetMm: [0, 0, 1000],
      upMm: [0, 0, 1],
      fov: 50,
    });
    expectVecClose(camera.positionMm, CONTROL_POINT_VIEWER, 9);
    expectVecClose(camera.targetMm, [0, 1, 0], 9);
    expect(camera.upMm).toEqual([0, 1, 0]);
    expect(camera.fov).toBe(50);
  });

  it('omits optional fields that were not provided and normalizes non-unit up', () => {
    const camera = canonicalCameraToViewer({ positionMm: [1000, 0, 0], targetMm: [0, 0, 0] });
    expect(camera.upMm).toBeUndefined();
    expect(camera.fov).toBeUndefined();
    const scaledUp = canonicalCameraToViewer({
      positionMm: [0, 0, 0],
      targetMm: [0, 0, 0],
      upMm: [0, 0, 250],
    });
    expectVecClose(scaledUp.upMm!, [0, 1, 0], 12);
  });
});

describe('layFlat presentation pose (deterministic, presentation-only)', () => {
  it('maps each canonical axis to the correct viewer direction', () => {
    expect(canonicalAxisToViewer('x')).toEqual([1, 0, 0]);
    expect(canonicalAxisToViewer('y')).toEqual([0, 0, -1]);
    expect(canonicalAxisToViewer('z')).toEqual([0, 1, 0]);
  });

  it('lays a wall flat about the canonical x axis through the origin pivot', () => {
    // A wall point 2400 mm up (canonical y = 0) must land 2400 mm into the room (canonical -y),
    // i.e. viewer (x, 0, +2.4) after the +90 deg rotation about the viewer x axis.
    const pose = matrixRotationAboutPivot(canonicalAxisToViewer('x'), 90, [0, 0, 0]);
    const topOfWall = canonicalToViewer([400, 0, 2400]);
    const posed = applyMat4(pose, topOfWall);
    expect(posed[0]).toBeCloseTo(0.4, 9);
    expect(posed[1]).toBeCloseTo(0, 9);
    expect(posed[2]).toBeCloseTo(2.4, 9);

    // The wall base stays on the floor line.
    const baseOfWall = applyMat4(pose, canonicalToViewer([400, 0, 0]));
    expectVecClose(baseOfWall, [0.4, 0, 0], 9);
  });

  it('rotates about a pivot without translating the pivot itself', () => {
    const pivotMm: Vec3 = [1000, 0, 500];
    const pose = matrixRotationAboutPivot(canonicalAxisToViewer('x'), 90, canonicalToViewer(pivotMm));
    const pivotPosed = applyMat4(pose, canonicalToViewer(pivotMm));
    expectVecClose(pivotPosed, canonicalToViewer(pivotMm), 9);
  });

  it('is an involution at 180 degrees and identity at 0 degrees', () => {
    const identity = matrixRotationAboutPivot([1, 0, 0], 0, [0.5, 0.5, 0.5]);
    const point = canonicalToViewer([321, -654, 987]);
    expectVecClose(applyMat4(identity, point), point, 9);

    const half = matrixRotationAboutPivot([1, 0, 0], 180, [0, 0, 0]);
    const twice = applyMat4(half, applyMat4(half, point));
    expectVecClose(twice, point, 9);
  });
});
