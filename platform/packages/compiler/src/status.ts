/**
 * Status model (architecture.md §5, frozen, reconciled 2026-09-29 with plan §5).
 *
 * Rank (higher wins): not_applicable 0 < ready 1 < conditional 2 < held 3 < superseded 4.
 * - operation.effectiveReleaseStatus = worst(declared, dependency operations effective)
 * - step.effectiveReleaseStatus = worst(declared, operations effective, prerequisite steps effective)
 * - connection.effectiveReleaseStatus = declared in P0
 *
 * Conditional dependencies propagate conditions (plan §5), so a chain that starts conditional
 * stays conditional downstream; held/superseded dominate anything downstream. Conditional steps
 * are still applied to the presentation preview when their parameters are complete (see
 * architecture.md §5 "Step state application").
 */
import type { Operation, ReleaseStatus, Step } from '@diyguide/schema';

export const STATUS_RANK: Record<ReleaseStatus, number> = {
  not_applicable: 0,
  ready: 1,
  conditional: 2,
  held: 3,
  superseded: 4,
};

export function statusRank(status: ReleaseStatus): number {
  return STATUS_RANK[status] ?? 0;
}

export function worstStatus(...statuses: ReleaseStatus[]): ReleaseStatus {
  let worst: ReleaseStatus = 'not_applicable';
  for (const status of statuses) {
    if (statusRank(status) > statusRank(worst)) worst = status;
  }
  return worst;
}

/** Dependencies at or above `conditional` propagate to dependents (plan §5). */
export function propagatesStatus(status: ReleaseStatus): boolean {
  return statusRank(status) >= STATUS_RANK.conditional;
}

/** Effective operation status: declared + propagating dependency operations. Cycle-safe. */
export function effectiveOperationStatus(op: Operation, byId: ReadonlyMap<string, Operation>): ReleaseStatus {
  const memo = new Map<string, ReleaseStatus>();
  const visit = (current: Operation, stack: Set<string>): ReleaseStatus => {
    const cached = memo.get(current.id);
    if (cached !== undefined) return cached;
    if (stack.has(current.id)) return current.declaredReleaseStatus; // cycle guard (validation rejects cycles)
    stack.add(current.id);
    let result = current.declaredReleaseStatus;
    for (const depId of current.dependencyOperationIds ?? []) {
      const dependency = byId.get(depId);
      if (!dependency) continue;
      const depStatus = visit(dependency, stack);
      if (propagatesStatus(depStatus)) result = worstStatus(result, depStatus);
    }
    stack.delete(current.id);
    memo.set(current.id, result);
    return result;
  };
  return visit(op, new Set());
}

/** Effective statuses for a whole operation collection (shared memo, linear-ish). */
export function computeEffectiveOperationStatuses(operations: readonly Operation[]): Map<string, ReleaseStatus> {
  const byId = new Map(operations.map((op) => [op.id, op]));
  const memo = new Map<string, ReleaseStatus>();
  const visit = (current: Operation, stack: Set<string>): ReleaseStatus => {
    const cached = memo.get(current.id);
    if (cached !== undefined) return cached;
    if (stack.has(current.id)) return current.declaredReleaseStatus;
    stack.add(current.id);
    let result = current.declaredReleaseStatus;
    for (const depId of current.dependencyOperationIds ?? []) {
      const dependency = byId.get(depId);
      if (!dependency) continue;
      const depStatus = visit(dependency, stack);
      if (propagatesStatus(depStatus)) result = worstStatus(result, depStatus);
    }
    stack.delete(current.id);
    memo.set(current.id, result);
    return result;
  };
  for (const op of operations) visit(op, new Set());
  return memo;
}

/** Effective step status: declared + operations + propagating prerequisite steps. Cycle-safe. */
export function effectiveStepStatus(
  step: Step,
  ops: ReadonlyMap<string, Operation>,
  steps: ReadonlyMap<string, Step>,
): ReleaseStatus {
  const memo = new Map<string, ReleaseStatus>();
  const visit = (current: Step, stack: Set<string>): ReleaseStatus => {
    const cached = memo.get(current.id);
    if (cached !== undefined) return cached;
    if (stack.has(current.id)) return current.declaredReleaseStatus;
    stack.add(current.id);
    let result = current.declaredReleaseStatus;
    for (const opId of current.operationIds ?? []) {
      const op = ops.get(opId);
      if (!op) continue;
      const opStatus = effectiveOperationStatus(op, ops);
      if (propagatesStatus(opStatus)) result = worstStatus(result, opStatus);
    }
    for (const prereqId of current.prerequisiteStepIds ?? []) {
      const prereq = steps.get(prereqId);
      if (!prereq) continue;
      const prereqStatus = visit(prereq, stack);
      if (propagatesStatus(prereqStatus)) result = worstStatus(result, prereqStatus);
    }
    stack.delete(current.id);
    memo.set(current.id, result);
    return result;
  };
  return visit(step, new Set());
}

/** Effective statuses for every step, reusing one operation-status memo. */
export function computeEffectiveStepStatuses(
  steps: readonly Step[],
  operations: readonly Operation[],
): Map<string, ReleaseStatus> {
  const stepsById = new Map(steps.map((step) => [step.id, step]));
  const operationStatuses = computeEffectiveOperationStatuses(operations);
  const memo = new Map<string, ReleaseStatus>();
  const visit = (current: Step, stack: Set<string>): ReleaseStatus => {
    const cached = memo.get(current.id);
    if (cached !== undefined) return cached;
    if (stack.has(current.id)) return current.declaredReleaseStatus;
    stack.add(current.id);
    let result = current.declaredReleaseStatus;
    for (const opId of current.operationIds ?? []) {
      const status = operationStatuses.get(opId);
      if (status !== undefined && propagatesStatus(status)) result = worstStatus(result, status);
    }
    for (const prereqId of current.prerequisiteStepIds ?? []) {
      const prereq = stepsById.get(prereqId);
      if (!prereq) continue;
      const prereqStatus = visit(prereq, stack);
      if (propagatesStatus(prereqStatus)) result = worstStatus(result, prereqStatus);
    }
    stack.delete(current.id);
    memo.set(current.id, result);
    return result;
  };
  for (const step of steps) visit(step, new Set());
  return memo;
}
