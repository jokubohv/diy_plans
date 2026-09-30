/**
 * Step state history (architecture.md §5, frozen).
 *
 * Snapshots cover ALL parts and start from the authored `initialState`. A step's state effects
 * are applied only when the step is effectively `ready` or `conditional` AND every operation of
 * the step has complete parameters; otherwise `applied = false` with a reason and the snapshot is
 * unchanged. `before` is the previous step's `after`.
 */
import type { AuthoredBundle, OverlayObject, PartState, PartStateEntry, ReleaseStatus, StepState } from '@diyguide/schema';
import { deriveOverlayObjects } from './overlays';
import { effectiveStepStatus } from './status';
import { operationParametersComplete } from './validate';

export interface StepStatesInput {
  bundle: AuthoredBundle;
  operationsEffective: ReadonlyMap<string, ReleaseStatus>;
  /** Optional pre-derived overlays; derived on demand when omitted. */
  overlays?: OverlayObject[];
}

export function buildStepStates(input: StepStatesInput): StepState[] {
  const { bundle } = input;
  const overlays = input.overlays ?? deriveOverlayObjects({ bundle, operationsEffective: input.operationsEffective });
  const overlaysByOperation = new Map<string, string[]>();
  for (const overlay of overlays) {
    const list = overlaysByOperation.get(overlay.operationId) ?? [];
    list.push(overlay.id);
    overlaysByOperation.set(overlay.operationId, list);
  }

  const operationsById = new Map((bundle.operations ?? []).map((op) => [op.id, op]));
  const stepsById = new Map((bundle.steps ?? []).map((step) => [step.id, step]));
  const orderedSteps = (bundle.steps ?? [])
    .map((step, index) => ({ step, index }))
    .sort((a, b) => a.step.sequence - b.step.sequence || a.index - b.index)
    .map((entry) => entry.step);

  const states = new Map<string, PartState>((bundle.parts ?? []).map((part) => [part.id, part.initialState]));
  const snapshot = (): PartStateEntry[] =>
    (bundle.parts ?? []).map((part) => ({ partId: part.id, state: states.get(part.id) ?? part.initialState }));

  const stepStates: StepState[] = [];
  for (const step of orderedSteps) {
    const before = snapshot();
    const status = effectiveStepStatus(step, operationsById, stepsById);
    const operations = (step.operationIds ?? [])
      .map((id) => operationsById.get(id))
      .filter((op): op is NonNullable<typeof op> => op !== undefined);

    let applied = false;
    let reason: string | null = null;
    if (status !== 'ready' && status !== 'conditional') {
      reason = `Step effective status is ${status}; state effects are not applied.`;
    } else {
      const incomplete = operations
        .map((op) => ({ op, check: operationParametersComplete(op) }))
        .filter((entry) => !entry.check.ok);
      if (incomplete.length > 0) {
        reason = incomplete
          .map((entry) => `Operation ${entry.op.id} has incomplete parameters: ${entry.check.missing.join(', ')}`)
          .join('; ');
      } else {
        applied = true;
        for (const op of operations) {
          for (const effect of op.stateEffects ?? []) {
            states.set(effect.partId, effect.toState);
          }
        }
      }
    }

    const after = snapshot();
    const overlayIds = operations.flatMap((op) => overlaysByOperation.get(op.id) ?? []);
    stepStates.push({
      index: stepStates.length,
      stepId: step.id,
      status,
      applied,
      reason,
      before,
      after,
      overlayIds,
    });
  }
  return stepStates;
}
