/**
 * Canonical (Z-up millimetres) <-> viewer (Y-up metres) frame conversion, exactly the mapping
 * frozen in docs/architecture.md section 2:
 *
 *   viewer  = [x / 1000, z / 1000, -y / 1000]
 *   canonical = [vx * 1000, -vz * 1000, vy * 1000]
 *
 * Pure math only: this module never imports three.js.
 */
import type { Mat4, Vec3 } from '@diyguide/schema';
import type { ProjectCamera, SectionPlane } from '@diyguide/viewer-core';

/** Uniform 1000 mm -> m scale, column-major 4x4. */
const VIEWER_SCALE: Mat4 = [0.001, 0, 0, 0, 0, 0.001, 0, 0, 0, 0, 0.001, 0, 0, 0, 0, 1];

/**
 * Axis map as a column-major 4x4 matrix (no translation): viewer = M * canonical.
 * Columns are the images of the canonical basis vectors: ex -> ex, ey -> -ez, ez -> ey.
 */
const VIEWER_AXIS_MAP: Mat4 = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];

/** Canonical Z-up millimetres to viewer Y-up metres. */
export function canonicalToViewer(pointMm: Vec3): Vec3 {
  return [pointMm[0] / 1000, pointMm[2] / 1000, -pointMm[1] / 1000];
}

/** Viewer Y-up metres back to canonical Z-up millimetres. */
export function viewerToCanonical(pointViewer: Vec3): Vec3 {
  return [pointViewer[0] * 1000, -pointViewer[2] * 1000, pointViewer[1] * 1000];
}

/** Named alias of {@link canonicalToViewer} for point-like values. */
export function canonicalPointToViewer(pointMm: Vec3): Vec3 {
  return canonicalToViewer(pointMm);
}

/** Named alias of {@link viewerToCanonical} for point-like values. */
export function viewerPointToCanonical(pointViewer: Vec3): Vec3 {
  return viewerToCanonical(pointViewer);
}

/**
 * Convert a canonical column-major world matrix (mm, Z-up) to a viewer column-major matrix
 * (m, Y-up): `viewerMatrix = S * M * canonicalMatrix` with S the uniform 0.001 scale and M the
 * axis map above. Composed from explicit matrices, not hand-expanded algebra.
 */
export function canonicalMatrixToViewer(matrix: Mat4): Mat4 {
  return multiplyMat4(multiplyMat4(VIEWER_SCALE, VIEWER_AXIS_MAP), matrix);
}

/** Convert a canonical camera (mm, Z-up) to viewer units (m, Y-up); fov is unchanged. */
export function canonicalCameraToViewer(camera: ProjectCamera): ProjectCamera {
  const viewer: ProjectCamera = {
    positionMm: canonicalPointToViewer(camera.positionMm),
    targetMm: canonicalPointToViewer(camera.targetMm),
  };
  if (camera.upMm) viewer.upMm = normalizeDirection(canonicalDirectionToViewer(camera.upMm));
  if (camera.fov !== undefined) viewer.fov = camera.fov;
  return viewer;
}

export interface ThreePlaneSpec {
  /** Plane normal in the viewer frame (normalized: the axis unit vector maps to a unit vector). */
  normal: Vec3;
  /** `constant` for THREE.Plane semantics `normal . p + constant = 0`. */
  constant: number;
  /** Which side of the canonical axis the plane keeps. */
  keepSide: 'positive' | 'negative';
}

const AXIS_UNITS: Record<SectionPlane['axis'], Vec3> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

/**
 * Convert a canonical section plane `axis = offsetMm` into plane parameters for a three.js
 * `THREE.Plane` (`normal . p + constant = 0`, world space, viewer metres). The normal points
 * towards the canonical positive side of the axis; `flip` negates both normal and constant so
 * the same plane keeps the negative side (three.js clipping keeps `distanceToPoint >= 0`).
 */
export function canonicalSectionToThreePlane(section: SectionPlane): ThreePlaneSpec {
  const unit = AXIS_UNITS[section.axis];
  const constant = -section.offsetMm / 1000;
  if (section.flip) {
    return {
      normal: canonicalDirectionToViewer([-unit[0], -unit[1], -unit[2]]),
      constant: -constant,
      keepSide: 'negative',
    };
  }
  return { normal: canonicalDirectionToViewer(unit), constant, keepSide: 'positive' };
}

/**
 * Canonical direction to viewer direction without the millimetre scale. `+ 0` normalizes IEEE
 * negative zero so axis-aligned directions compare cleanly.
 */
function canonicalDirectionToViewer(direction: Vec3): Vec3 {
  return [direction[0] + 0, direction[2] + 0, -direction[1] + 0];
}

/** Canonical axis unit vector in the viewer frame (rotation only, no scale). */
export function canonicalAxisToViewer(axis: 'x' | 'y' | 'z'): Vec3 {
  return normalizeDirection(canonicalDirectionToViewer(AXIS_UNITS[axis]));
}

/**
 * Viewer-space rotation about an arbitrary unit axis through a pivot, column-major 4x4:
 * `translate(pivot) * R(axis, angle) * translate(-pivot)`. Used for the deterministic
 * "assembled flat" presentation pose; the adapter resets to base matrices on every seek, so
 * forward, backward, direct-link and reduced-motion renders are identical.
 */
export function matrixRotationAboutPivot(
  axisViewer: Vec3,
  angleDeg: number,
  pivotViewer: Vec3,
): Mat4 {
  const [x, y, z] = normalizeDirection(axisViewer);
  const radians = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const oneMinusCos = 1 - cos;
  // Rodrigues rotation, column-major (columns are the images of the basis vectors).
  const rotation: Mat4 = [
    cos + x * x * oneMinusCos,
    y * x * oneMinusCos + z * sin,
    z * x * oneMinusCos - y * sin,
    0,
    x * y * oneMinusCos - z * sin,
    cos + y * y * oneMinusCos,
    z * y * oneMinusCos + x * sin,
    0,
    x * z * oneMinusCos + y * sin,
    y * z * oneMinusCos - x * sin,
    cos + z * z * oneMinusCos,
    0,
    0,
    0,
    0,
    1,
  ];
  const [px, py, pz] = pivotViewer;
  const rotatedPivot: Vec3 = [
    rotation[0]! * px + rotation[4]! * py + rotation[8]! * pz,
    rotation[1]! * px + rotation[5]! * py + rotation[9]! * pz,
    rotation[2]! * px + rotation[6]! * py + rotation[10]! * pz,
  ];
  const result: Mat4 = [...rotation];
  // translate(pivot) * R * translate(-pivot): translation = pivot - R * pivot.
  result[12] = px - rotatedPivot[0];
  result[13] = py - rotatedPivot[1];
  result[14] = pz - rotatedPivot[2];
  return result;
}

function normalizeDirection(vector: Vec3): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length === 0) return [0, 1, 0];
  return [vector[0] / length + 0, vector[1] / length + 0, vector[2] / length + 0];
}

/** Column-vector matrix product `a * b` for column-major 4x4 matrices. */
function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const out: Mat4 = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += a[row + 4 * k]! * b[k + 4 * column]!;
      }
      out[row + 4 * column] = sum;
    }
  }
  return out;
}
