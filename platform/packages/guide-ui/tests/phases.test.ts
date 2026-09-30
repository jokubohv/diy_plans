import { describe, expect, it } from 'vitest';
import type { ReleaseStatus, StepState } from '@diyguide/schema';
import {
  effectiveStepStatus,
  phaseGroups,
  slugifyPhaseLabel,
  UNLABELLED_PHASE_LABEL,
} from '../src/phases';
import { createFixture, PHASE_LABELS } from './fixture';

describe('slugifyPhaseLabel', () => {
  it('turns phase labels into stable, url-safe testid slugs', () => {
    expect(slugifyPhaseLabel('Wall frame')).toBe('wall-frame');
    expect(slugifyPhaseLabel('Services & finish')).toBe('services-finish');
    expect(slugifyPhaseLabel('  Cabinet   backing  ')).toBe('cabinet-backing');
  });

  it('never returns an empty slug', () => {
    expect(slugifyPhaseLabel('& & &')).toBe('phase');
  });
});

describe('phaseGroups', () => {
  const compiled = createFixture();
  const groups = phaseGroups(compiled);

  it('returns one group per phase in first-seen sequence order', () => {
    expect(groups.map((group) => group.label)).toEqual([...PHASE_LABELS]);
    expect(groups.map((group) => group.slug)).toEqual([
      'wall-frame',
      'cabinet-backing',
      'services-finish',
    ]);
  });

  it('keeps every step exactly once, in published sequence order', () => {
    const indexes = groups.flatMap((group) => group.steps.map((entry) => entry.index));
    const ids = groups.flatMap((group) => group.steps.map((entry) => entry.step.id));
    expect(indexes).toEqual(compiled.steps.map((_, index) => index));
    expect(ids).toEqual(compiled.steps.map((step) => step.id));
  });

  it('rolls up the worst effective step status per phase', () => {
    expect(groups.map((group) => group.status)).toEqual(['ready', 'held', 'ready']);
    expect(
      groups[1]!.steps.map((entry) => effectiveStepStatus(compiled, entry.index)),
    ).toEqual(['ready', 'ready', 'conditional', 'held', 'held']);
  });

  it('groups unlabelled steps under a single generic phase', () => {
    const guide = createFixture();
    for (const step of guide.steps) step.phaseLabel = undefined;
    const unlabelled = phaseGroups(guide);
    expect(unlabelled).toHaveLength(1);
    expect(unlabelled[0]!.label).toBe(UNLABELLED_PHASE_LABEL);
    expect(unlabelled[0]!.steps).toHaveLength(guide.steps.length);
  });

  it('splits non-adjacent runs of the same label and keeps testid slugs unique', () => {
    const guide = createFixture();
    guide.steps.forEach((step, index) => {
      step.phaseLabel = index % 2 === 0 ? 'A phase' : 'B phase';
    });
    const alternating = phaseGroups(guide);
    expect(alternating.map((group) => group.label)).toEqual([
      'A phase',
      'B phase',
      'A phase',
      'B phase',
      'A phase',
      'B phase',
      'A phase',
    ]);
    expect(new Set(alternating.map((group) => group.slug)).size).toBe(alternating.length);
  });
});

describe('effectiveStepStatus', () => {
  it('prefers the compiled status, then the compiled step state, then the declared status', () => {
    const guide = createFixture();
    const index = guide.steps.findIndex((step) => step.id === 'step.position-backing');
    const step = guide.steps[index]! as { effectiveReleaseStatus?: ReleaseStatus };

    delete step.effectiveReleaseStatus;
    expect(effectiveStepStatus(guide, index)).toBe('conditional');

    delete (guide.stepStates[index] as Partial<StepState>).status;
    expect(effectiveStepStatus(guide, index)).toBe('ready');

    expect(effectiveStepStatus(guide, guide.steps.length + 10)).toBe('not_applicable');
  });
});
