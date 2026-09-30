/**
 * Candidate camera mapping tests. The candidate frame is the same Y-up metre frame as
 * `viewer-three` (docs/architecture.md section 2); `camera-controls` consumes the pose through
 * `SimpleCamera.controls`, so the mapping must be exact before any three.js object is touched.
 */
import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_DEFAULT_FOV,
  CANDIDATE_DEFAULT_UP,
  candidateCameraToCanonical,
  candidateToCanonicalPoint,
  canonicalCameraToCandidate,
  canonicalToCandidateDirection,
  canonicalToCandidatePoint,
  normalizeCandidateDirection,
  type Vec3,
} from '../src/index';

/** Control point from the architecture fixture discussion (mm, Z-up). */
const CONTROL_POINT: Vec3 = [404.15, 126.45, 1219.2];
const CONTROL_POINT_CANDIDATE: Vec3 = [0.40415, 1.2192, -0.12645];

const ROUND_TRIP_POINTS: Vec3[] = [
  CONTROL_POINT,
  [0, 0, 0],
  [-1234.56, 789.01, -234.5],
  [9000, -4500, 2500],
];

function expectVecClose(actual: Vec3, expected: Vec3, digits: number): void {
  for (let index = 0; index < 3; index += 1) {
    expect(actual[index]).toBeCloseTo(expected[index]!, digits);
  }
}

describe('canonicalToCandidatePoint / candidateToCanonicalPoint', () => {
  it('maps the control point to the frozen candidate coordinates', () => {
    expectVecClose(canonicalToCandidatePoint(CONTROL_POINT), CONTROL_POINT_CANDIDATE, 9);
  });

  it('round-trips within the 0.1 mm error budget', () => {
    for (const point of ROUND_TRIP_POINTS) {
      const roundTripped = candidateToCanonicalPoint(canonicalToCandidatePoint(point));
      for (let index = 0; index < 3; index += 1) {
        expect(Math.abs(roundTripped[index]! - point[index]!)).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it('applies the exact inverse formula', () => {
    expect(candidateToCanonicalPoint([1, 2, 3])).toEqual([1000, -3000, 2000]);
  });

  it('preserves handedness: canonical +X cross +Y still points to canonical +Z', () => {
    const x = canonicalToCandidatePoint([1000, 0, 0]);
    const y = canonicalToCandidatePoint([0, 1000, 0]);
    const cross: Vec3 = [
      x[1] * y[2] - x[2] * y[1],
      x[2] * y[0] - x[0] * y[2],
      x[0] * y[1] - x[1] * y[0],
    ];
    expectVecClose(cross, canonicalToCandidatePoint([0, 0, 1000]), 9);
  });

  it('is not the identity: the candidate frame is Y-up metres', () => {
    expect(canonicalToCandidatePoint([0, 0, 1000])).toEqual([0, 1, -0]);
    expect(canonicalToCandidatePoint([0, 1000, 0])).toEqual([0, 0, -1]);
  });
});

describe('canonicalToCandidateDirection / normalizeCandidateDirection', () => {
  it('maps the canonical up axis (+Z) to candidate +Y', () => {
    expect(canonicalToCandidateDirection([0, 0, 1])).toEqual([0, 1, 0]);
    expect(canonicalToCandidateDirection([0, 0, -1])).toEqual([0, -1, 0]);
    expect(canonicalToCandidateDirection([1, 0, 0])).toEqual([1, 0, 0]);
    expect(canonicalToCandidateDirection([0, 1, 0])).toEqual([0, 0, -1]);
  });

  it('does not scale directions', () => {
    expect(canonicalToCandidateDirection([0, 0, 250])).toEqual([0, 250, 0]);
  });

  it('normalizes scaled and non-axis-aligned directions', () => {
    expectVecClose(normalizeCandidateDirection([0, 250, 0]), [0, 1, 0], 12);
    expectVecClose(normalizeCandidateDirection([1, 1, 0]), [Math.SQRT1_2, Math.SQRT1_2, 0], 12);
  });

  it('falls back to the candidate default up for a degenerate vector', () => {
    expect(normalizeCandidateDirection([0, 0, 0])).toEqual([...CANDIDATE_DEFAULT_UP]);
  });
});

describe('canonicalCameraToCandidate', () => {
  it('converts position, target and up (canonical +Z -> candidate +Y), keeping fov', () => {
    const pose = canonicalCameraToCandidate({
      positionMm: CONTROL_POINT,
      targetMm: [0, 0, 1000],
      upMm: [0, 0, 1],
      fov: 50,
    });
    expectVecClose(pose.position, CONTROL_POINT_CANDIDATE, 9);
    expectVecClose(pose.target, [0, 1, 0], 9);
    expect(pose.up).toEqual([0, 1, 0]);
    expect(pose.fov).toBe(50);
  });

  it('defaults the up vector to canonical +Z and the fov to the candidate default', () => {
    const pose = canonicalCameraToCandidate({ positionMm: [1000, 0, 500], targetMm: [0, 0, 0] });
    expect(pose.up).toEqual([0, 1, 0]);
    expect(pose.fov).toBe(CANDIDATE_DEFAULT_FOV);
  });

  it('normalizes a scaled up vector and reports it exactly (no silent clamping)', () => {
    const scaled = canonicalCameraToCandidate({
      positionMm: [0, 0, 0],
      targetMm: [1000, 0, 0],
      upMm: [0, 0, 250],
    });
    expectVecClose(scaled.up, [0, 1, 0], 12);

    const flipped = canonicalCameraToCandidate({
      positionMm: [0, 0, 0],
      targetMm: [1000, 0, 0],
      upMm: [0, 0, -1],
    });
    expectVecClose(flipped.up, [0, -1, 0], 12);
  });
});

describe('candidateCameraToCanonical', () => {
  it('round-trips a full camera through the candidate frame', () => {
    const canonical = {
      positionMm: CONTROL_POINT,
      targetMm: [0, 0, 1000] as Vec3,
      upMm: [1, 0, 0] as Vec3,
      fov: 38,
    };
    const roundTripped = candidateCameraToCanonical(canonicalCameraToCandidate(canonical));
    expectVecClose(roundTripped.positionMm, canonical.positionMm, 9);
    expectVecClose(roundTripped.targetMm, canonical.targetMm, 9);
    expectVecClose(roundTripped.upMm!, canonical.upMm, 12);
    expect(roundTripped.fov).toBe(38);
  });
});
