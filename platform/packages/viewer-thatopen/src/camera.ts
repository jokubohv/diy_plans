/**
 * Canonical camera mapping: platform `ProjectCamera` (right-handed Z-up, millimetres) to the
 * candidate engine's camera pose (three.js right-handed Y-up, metres, as driven by
 * `@thatopen/components` `SimpleCamera` + `camera-controls`).
 *
 * The mapping is the platform frame contract frozen in docs/architecture.md section 2 and
 * shared with `viewer-three`:
 *
 *   candidate = [x / 1000, z / 1000, -y / 1000]
 *   canonical = [cx * 1000, -cz * 1000, cy * 1000]
 *
 * `camera-controls` has no OrbitControls compatibility layer: it consumes
 * `camera.position` / `camera.up` and a look-at target. This module therefore returns a plain
 * pose (numbers only, no three.js import) so the conversion is unit-testable without a DOM and
 * the harness is the only place that touches three.js / camera-controls.
 */
import type { ProjectCamera } from '@diyguide/viewer-core';

/** Column vector `[x, y, z]` — structural duplicate of the schema `Vec3` (kept local, no runtime dep). */
export type Vec3 = [number, number, number];

/** Camera pose in candidate units (three.js world metres, Y-up). */
export interface CandidateCameraPose {
  /** Camera position in candidate metres. */
  position: Vec3;
  /** Look-at target in candidate metres. */
  target: Vec3;
  /** Normalized up vector in the candidate frame. */
  up: Vec3;
  /** Vertical field of view in degrees. */
  fov: number;
}

/** Candidate three.js default vertical FOV, matching `viewer-three`'s PerspectiveCamera. */
export const CANDIDATE_DEFAULT_FOV = 50;

/** Canonical +Z up expressed in the candidate Y-up frame. */
export const CANDIDATE_DEFAULT_UP: Vec3 = [0, 1, 0];

/** Canonical millimetres (Z-up) to candidate metres (Y-up). */
export function canonicalToCandidatePoint(pointMm: Vec3): Vec3 {
  return [pointMm[0] / 1000, pointMm[2] / 1000, -pointMm[1] / 1000];
}

/** Candidate metres (Y-up) back to canonical millimetres (Z-up). */
export function candidateToCanonicalPoint(pointM: Vec3): Vec3 {
  return [pointM[0] * 1000, -pointM[2] * 1000, pointM[1] * 1000];
}

/**
 * Canonical direction (no scale change) to the candidate frame. Adds IEEE `+0` so
 * axis-aligned directions compare cleanly and normalize results stay free of `-0`.
 */
export function canonicalToCandidateDirection(direction: Vec3): Vec3 {
  return [direction[0] + 0, direction[2] + 0, -direction[1] + 0];
}

/** Candidate direction back to the canonical frame. */
export function candidateToCanonicalDirection(direction: Vec3): Vec3 {
  return [direction[0] + 0, -direction[2] + 0, direction[1] + 0];
}

/** Normalize, falling back to the candidate default up when the input is degenerate. */
export function normalizeCandidateDirection(direction: Vec3): Vec3 {
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  if (length === 0) return [...CANDIDATE_DEFAULT_UP];
  return [
    direction[0] / length + 0,
    direction[1] / length + 0,
    direction[2] / length + 0,
  ];
}

/**
 * Convert a canonical camera into the candidate pose. The up vector defaults to canonical +Z
 * (candidate +Y) when omitted; fov falls back to the candidate default.
 */
export function canonicalCameraToCandidate(camera: ProjectCamera): CandidateCameraPose {
  const upSource = camera.upMm;
  const up = upSource
    ? normalizeCandidateDirection(canonicalToCandidateDirection(upSource))
    : ([...CANDIDATE_DEFAULT_UP] as Vec3);
  return {
    position: canonicalToCandidatePoint(camera.positionMm),
    target: canonicalToCandidatePoint(camera.targetMm),
    up,
    fov: camera.fov ?? CANDIDATE_DEFAULT_FOV,
  };
}

/**
 * Inverse conversion, used to assert round-trip behaviour and to feed picked poses back into
 * the canonical contract.
 */
export function candidateCameraToCanonical(pose: CandidateCameraPose): ProjectCamera {
  const camera: ProjectCamera = {
    positionMm: candidateToCanonicalPoint(pose.position),
    targetMm: candidateToCanonicalPoint(pose.target),
    upMm: candidateToCanonicalDirection(pose.up),
  };
  if (Number.isFinite(pose.fov)) camera.fov = pose.fov;
  return camera;
}
