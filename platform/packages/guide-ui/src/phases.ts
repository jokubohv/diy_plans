/**
 * Frame-first build phases. Phases are derived from `step.phaseLabel` alone: no phase name,
 * count or order is ever hard-coded. Steps without a label fall into one generic group so the
 * rail and the project page keep working for guides published before phase labels existed.
 */
import type { CompiledGuide, ReleaseStatus, Step } from '@diyguide/schema';
import { worstStatus } from './status';

/** Group label used when a step carries no `phaseLabel`. */
export const UNLABELLED_PHASE_LABEL = 'Steps';

export interface PhaseStepRef {
  index: number;
  step: Step;
}

export interface PhaseGroup {
  label: string;
  slug: string;
  steps: PhaseStepRef[];
  /** Worst effective status of the group's steps; never `ready` when any step is held. */
  status: ReleaseStatus;
}

/**
 * Effective status of a step: the compiled field wins, then the compiled step state, then the
 * declared status. Shared by the step rail and the project build sequence so both agree.
 */
export function effectiveStepStatus(compiled: CompiledGuide, index: number): ReleaseStatus {
  const step = compiled.steps[index];
  if (!step) return 'not_applicable';
  return (
    step.effectiveReleaseStatus ??
    compiled.stepStates[index]?.status ??
    step.declaredReleaseStatus
  );
}

/** Stable testid slug for a phase label (`Services & finish` -> `services-finish`). */
export function slugifyPhaseLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'phase';
}

/**
 * Steps grouped into contiguous phases in published sequence order. A label that reappears in a
 * later, non-adjacent run forms a new group (with a numbered slug) so rail order always matches
 * the published step order.
 */
export function phaseGroups(compiled: CompiledGuide): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  const slugCounts = new Map<string, number>();
  for (const [index, step] of compiled.steps.entries()) {
    const label = step.phaseLabel?.trim() || UNLABELLED_PHASE_LABEL;
    let group = groups[groups.length - 1];
    if (!group || group.label !== label) {
      const baseSlug = slugifyPhaseLabel(label);
      const seen = (slugCounts.get(baseSlug) ?? 0) + 1;
      slugCounts.set(baseSlug, seen);
      group = {
        label,
        slug: seen === 1 ? baseSlug : `${baseSlug}-${seen}`,
        steps: [],
        status: 'not_applicable',
      };
      groups.push(group);
    }
    group.steps.push({ index, step });
  }
  for (const group of groups) {
    group.status =
      worstStatus(group.steps.map(({ index }) => effectiveStepStatus(compiled, index))) ??
      'not_applicable';
  }
  return groups;
}
