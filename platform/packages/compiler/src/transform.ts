/**
 * Coordinate contract (architecture.md §2, frozen).
 *
 * Canonical frame: right-handed, Z-up, millimetres. `translationMm` is the local origin
 * (for a box part: its centre). `rotationEulerDeg` is [rx, ry, rz] degrees applied as
 * R = Rz * Ry * Rx to column vectors. Matrices are column-major 16-number arrays with the
 * translation at indices 12-14 and bottom row [0,0,0,1] (classic OpenGL layout).
 */
import type { Bounds, Mat4, PartGeometry, Placement, Vec3 } from '@diyguide/schema';

const DEG_TO_RAD = Math.PI / 180;

export function identityMat4(): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiplyMat3(a: number[][], b: number[][]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < 3; i += 1) {
    const row: number[] = [];
    for (let j = 0; j < 3; j += 1) {
      row.push((a[i]?.[0] ?? 0) * (b[0]?.[j] ?? 0) + (a[i]?.[1] ?? 0) * (b[1]?.[j] ?? 0) + (a[i]?.[2] ?? 0) * (b[2]?.[j] ?? 0));
    }
    out.push(row);
  }
  return out;
}

/** Local matrix of a placement: M = T * Rz * Ry * Rx * S (column vectors). */
export function placementToMatrix(placement?: Placement | null): Mat4 {
  const t = placement?.translationMm ?? [0, 0, 0];
  const [rx, ry, rz] = placement?.rotationEulerDeg ?? [0, 0, 0];
  const [sx, sy, sz] = placement?.scale ?? [1, 1, 1];

  const cx = Math.cos(rx * DEG_TO_RAD);
  const sxr = Math.sin(rx * DEG_TO_RAD);
  const cy = Math.cos(ry * DEG_TO_RAD);
  const syr = Math.sin(ry * DEG_TO_RAD);
  const cz = Math.cos(rz * DEG_TO_RAD);
  const szr = Math.sin(rz * DEG_TO_RAD);

  const xRot = [
    [1, 0, 0],
    [0, cx, -sxr],
    [0, sxr, cx],
  ];
  const yRot = [
    [cy, 0, syr],
    [0, 1, 0],
    [-syr, 0, cy],
  ];
  const zRot = [
    [cz, -szr, 0],
    [szr, cz, 0],
    [0, 0, 1],
  ];

  const r = multiplyMat3(multiplyMat3(zRot, yRot), xRot);
  const a = [
    [(r[0]?.[0] ?? 1) * sx, (r[0]?.[1] ?? 0) * sy, (r[0]?.[2] ?? 0) * sz],
    [(r[1]?.[0] ?? 0) * sx, (r[1]?.[1] ?? 1) * sy, (r[1]?.[2] ?? 0) * sz],
    [(r[2]?.[0] ?? 0) * sx, (r[2]?.[1] ?? 0) * sy, (r[2]?.[2] ?? 1) * sz],
  ];

  return [
    a[0]?.[0] ?? 1, a[1]?.[0] ?? 0, a[2]?.[0] ?? 0, 0,
    a[0]?.[1] ?? 0, a[1]?.[1] ?? 1, a[2]?.[1] ?? 0, 0,
    a[0]?.[2] ?? 0, a[1]?.[2] ?? 0, a[2]?.[2] ?? 1, 0,
    t[0], t[1], t[2], 1,
  ];
}

/** Column-major matrix product a * b. */
export function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += (a[k * 4 + row] ?? 0) * (b[col * 4 + k] ?? 0);
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/** General 4x4 inverse via Gauss-Jordan with partial pivoting. Throws when singular. */
export function invertMat4(m: Mat4): Mat4 {
  const a: number[][] = [];
  const inv: number[][] = [];
  for (let row = 0; row < 4; row += 1) {
    a.push([m[0 * 4 + row] ?? 0, m[1 * 4 + row] ?? 0, m[2 * 4 + row] ?? 0, m[3 * 4 + row] ?? 0]);
    inv.push(row === 0 ? [1, 0, 0, 0] : row === 1 ? [0, 1, 0, 0] : row === 2 ? [0, 0, 1, 0] : [0, 0, 0, 1]);
  }
  for (let col = 0; col < 4; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 4; row += 1) {
      if (Math.abs(a[row]?.[col] ?? 0) > Math.abs(a[pivot]?.[col] ?? 0)) pivot = row;
    }
    if (Math.abs(a[pivot]?.[col] ?? 0) < 1e-12) throw new Error('Cannot invert a singular matrix');
    if (pivot !== col) {
      const tmp = a[col]!;
      a[col] = a[pivot]!;
      a[pivot] = tmp;
      const tmpInv = inv[col]!;
      inv[col] = inv[pivot]!;
      inv[pivot] = tmpInv;
    }
    const divisor = a[col]?.[col] ?? 1;
    for (let j = 0; j < 4; j += 1) {
      a[col]![j] = (a[col]?.[j] ?? 0) / divisor;
      inv[col]![j] = (inv[col]?.[j] ?? 0) / divisor;
    }
    for (let row = 0; row < 4; row += 1) {
      if (row === col) continue;
      const factor = a[row]?.[col] ?? 0;
      if (factor === 0) continue;
      for (let j = 0; j < 4; j += 1) {
        a[row]![j] = (a[row]?.[j] ?? 0) - factor * (a[col]?.[j] ?? 0);
        inv[row]![j] = (inv[row]?.[j] ?? 0) - factor * (inv[col]?.[j] ?? 0);
      }
    }
  }
  const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      out[col * 4 + row] = inv[row]?.[col] ?? 0;
    }
  }
  return out;
}

/** Transform a point (w = 1) and return the canonical [x, y, z] triple. */
export function transformPoint(m: Mat4, p: Vec3): Vec3 {
  const [x, y, z] = p;
  return [
    (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0),
    (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z + (m[13] ?? 0),
    (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z + (m[14] ?? 0),
  ];
}

/** Axis-aligned world bounds of a box centred on the local origin (8 corners). */
export function boxWorldBounds(sizeMm: Vec3, worldMatrix: Mat4): Bounds {
  const [sx, sy, sz] = sizeMm;
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const dx of [-hx, hx]) {
    for (const dy of [-hy, hy]) {
      for (const dz of [-hz, hz]) {
        const [x, y, z] = transformPoint(worldMatrix, [dx, dy, dz]);
        if (x < min[0]) min[0] = x;
        if (y < min[1]) min[1] = y;
        if (z < min[2]) min[2] = z;
        if (x > max[0]) max[0] = x;
        if (y > max[1]) max[1] = y;
        if (z > max[2]) max[2] = z;
      }
    }
  }
  return { min, max };
}

/** World bounds for any part geometry in its assembly-local frame. */
export function geometryWorldBounds(geometry: PartGeometry, worldMatrix: Mat4): Bounds {
  if (geometry.shape === 'box') return boxWorldBounds(geometry.sizeMm, worldMatrix);
  const points = geometry.pointsMm;
  const radius = geometry.shape === 'path' ? (geometry.radiusMm ?? 0) : (geometry.markerRadiusMm ?? 0);
  const min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const point of points) {
    const [x, y, z] = transformPoint(worldMatrix, point);
    if (x - radius < min[0]) min[0] = x - radius;
    if (y - radius < min[1]) min[1] = y - radius;
    if (z - radius < min[2]) min[2] = z - radius;
    if (x + radius > max[0]) max[0] = x + radius;
    if (y + radius > max[1]) max[1] = y + radius;
    if (z + radius > max[2]) max[2] = z + radius;
  }
  if (!Number.isFinite(min[0]) || !Number.isFinite(max[0])) {
    return { min: [0, 0, 0], max: [0, 0, 0] };
  }
  return { min, max };
}

export function matricesAlmostEqual(a: Mat4, b: Mat4, epsilon = 1e-9): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (Math.abs((a[i] ?? 0) - (b[i] ?? 0)) > epsilon) return false;
  }
  return true;
}

export function pointsAlmostEqual(a: Vec3, b: Vec3, epsilon = 0.001): boolean {
  return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon && Math.abs(a[2] - b[2]) <= epsilon;
}
