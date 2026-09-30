/**
 * Pure step-state and presentation logic for the frozen viewer contract
 * (docs/architecture.md section 8). This module deliberately has no DOM, no three.js and no
 * side effects so it can be reused by the real host, the recording host (text fallback) and
 * tests.
 */
import type {
  CompiledGuide,
  OverlayObject,
  PartState,
  PartStateEntry,
  PresentationRecipe,
  StepState,
  Vec3,
} from '@diyguide/schema';

/**
 * Frozen visibility mapping: how a canonical part state appears in the viewer.
 * `hidden` parts are not drawn at all, `covered` parts are drawn as ghosts only when the
 * caller requested `showCovered`, everything else is drawn normally.
 */
export const PART_STATE_VISIBILITY: Record<PartState, 'visible' | 'hidden' | 'covered'> = {
  absent: 'hidden',
  removed: 'hidden',
  covered: 'covered',
  existing: 'visible',
  cut: 'visible',
  positioned: 'visible',
  installed: 'visible',
};

const STATE_LABELS: Record<PartState, string> = {
  absent: 'not yet installed',
  existing: 'existing',
  removed: 'removed',
  cut: 'cut to size',
  positioned: 'positioned',
  installed: 'installed',
  covered: 'covered',
};

/** Human-readable label for a canonical part state. */
export function stateLabel(state: PartState): string {
  return STATE_LABELS[state];
}

export interface VisiblePartOptions {
  showCovered: boolean;
  /** Part ids that this step/presentation hides on top of the state mapping. */
  extraHiddenPartIds?: readonly string[];
  /** Presentation-only context that may be shown even when its canonical state is absent. */
  extraVisiblePartIds?: readonly string[];
}

/**
 * Part ids that should be drawn for a snapshot, in `compiled.parts` order. States missing from
 * the snapshot fall back to `part.initialState`; snapshot entries for unknown parts are ignored.
 */
export function visiblePartIds(
  compiled: CompiledGuide,
  snapshot: readonly PartStateEntry[],
  options: VisiblePartOptions,
): string[] {
  const extraHidden = new Set(options.extraHiddenPartIds ?? []);
  const extraVisible = new Set(options.extraVisiblePartIds ?? []);
  const stateByPart = new Map<string, PartState>();
  for (const entry of snapshot) stateByPart.set(entry.partId, entry.state);
  const visible: string[] = [];
  for (const part of compiled.parts) {
    if (extraHidden.has(part.id)) continue;
    const state = stateByPart.get(part.id) ?? part.initialState;
    const appearance = PART_STATE_VISIBILITY[state];
    if (
      extraVisible.has(part.id) ||
      appearance === 'visible' ||
      (appearance === 'covered' && options.showCovered)
    ) {
      visible.push(part.id);
    }
  }
  return visible;
}

/**
 * The step-state entry for `index`. Throws a `RangeError` for any index outside
 * `[0, compiled.stepStates.length)` (including non-integers). The result is a defensive copy
 * so callers can never mutate the compiled guide.
 */
export function stateAtStep(compiled: CompiledGuide, index: number): StepState {
  if (!Number.isInteger(index) || index < 0 || index >= compiled.stepStates.length) {
    throw new RangeError(
      `step index out of range: ${index} (expected 0..${compiled.stepStates.length - 1})`,
    );
  }
  const state = compiled.stepStates[index]!;
  return {
    ...state,
    before: state.before.map((entry) => ({ ...entry })),
    after: state.after.map((entry) => ({ ...entry })),
    overlayIds: [...state.overlayIds],
  };
}

/**
 * Overlay objects referenced by `stepStates[index].overlayIds`, in the order declared by the
 * step state. Unknown overlay ids are skipped. Throws a `RangeError` for an out-of-range index.
 */
export function overlaysForStep(compiled: CompiledGuide, index: number): OverlayObject[] {
  const state = stateAtStep(compiled, index);
  const overlaysById = new Map<string, OverlayObject>();
  for (const overlay of compiled.overlays) overlaysById.set(overlay.id, overlay);
  const result: OverlayObject[] = [];
  for (const overlayId of state.overlayIds) {
    const overlay = overlaysById.get(overlayId);
    if (!overlay) continue;
    result.push({
      ...overlay,
      positionMm: overlay.positionMm ? copyVec3(overlay.positionMm) : null,
      pathPointsMm: overlay.pathPointsMm ? overlay.pathPointsMm.map(copyVec3) : null,
    });
  }
  return result;
}

const RECIPE_FIELDS = [
  'reveal',
  'ghostPrevious',
  'translateFrom',
  'showFastenerPoints',
  'driveFasteners',
  'routePath',
  'cutaway',
  'layFlat',
  'schematicElevation',
  'boxTransforms',
  'requirementPreview',
] as const;

type RecipeField = (typeof RECIPE_FIELDS)[number];

/**
 * Merge the presentation recipes of the step's operations, in operation order; later operations
 * win per field. Fields whose value is empty (`undefined`, `null` or an empty array) never
 * overwrite an earlier non-empty value. Throws a `RangeError` for an out-of-range index.
 */
export function mergedRecipeForStep(compiled: CompiledGuide, index: number): PresentationRecipe {
  if (!Number.isInteger(index) || index < 0 || index >= compiled.steps.length) {
    throw new RangeError(
      `step index out of range: ${index} (expected 0..${compiled.steps.length - 1})`,
    );
  }
  const step = compiled.steps[index]!;
  const operationsById = new Map(compiled.operations.map((operation) => [operation.id, operation]));
  const merged = {} as PresentationRecipe;
  const target = merged as unknown as Record<RecipeField, unknown>;
  for (const operationId of step.operationIds) {
    const operation = operationsById.get(operationId);
    if (!operation) continue;
    const recipe = operation.view.recipe;
    for (const field of RECIPE_FIELDS) {
      const value = recipe[field];
      if (!isEmptyRecipeValue(value)) target[field] = cloneRecipeValue(value);
    }
  }
  return merged;
}

function isEmptyRecipeValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function cloneRecipeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item !== null && typeof item === 'object' ? { ...(item as Record<string, unknown>) } : item,
    );
  }
  if (value !== null && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) };
  }
  return value;
}

function copyVec3(value: Vec3): Vec3 {
  return [value[0], value[1], value[2]];
}
