/**
 * Real ViewerHost implementation over a ViewerAdapter (docs/architecture.md section 8).
 *
 * The host owns all UI-facing state, translates step snapshots into adapter calls and forwards
 * adapter events. Step navigation is a deterministic seek: the adapter always receives a reset
 * plus the step's `after` snapshot, so forward, backward and direct links reconstruct the same
 * state (animation is decoration only and never changed by reduced motion).
 */
import type {
  CompiledGuide,
  Operation,
  OverlayObject,
  PartStateEntry,
  Step,
  Vec3,
} from '@diyguide/schema';
import type {
  MeasurementResult,
  OverlayState,
  PickPoint,
  ProjectCamera,
  SectionPlane,
  ViewerAdapter,
  ViewerHost,
  ViewerHostEvents,
  ViewerHostState,
  VisibilityState,
} from './types';
import { mergedRecipeForStep, overlaysForStep, stateAtStep, visiblePartIds } from './stepState';

export function createViewerHost(adapter: ViewerAdapter, compiled: CompiledGuide): ViewerHost {
  const state: ViewerHostState = {
    mounted: false,
    ready: false,
    failed: false,
    currentStepIndex: -1,
    selection: [],
    measureMode: false,
    measurePointsMm: [],
    measurement: null,
    sectionPlane: null,
    visibility: {
      isolatedPartIds: [],
      xrayPartIds: [],
      hiddenPartIds: [],
      showCovered: false,
    },
  };

  let currentSnapshot: PartStateEntry[] = [];
  let currentExtraHiddenPartIds: string[] = [];
  let currentExtraVisiblePartIds: string[] = [];
  let disposed = false;

  const adapterUnsubscribes: Array<() => void> = [];
  const listeners = new Map<keyof ViewerHostEvents, Set<(...args: never[]) => void>>();

  function emit<K extends keyof ViewerHostEvents>(
    event: K,
    ...args: Parameters<ViewerHostEvents[K]>
  ): void {
    const handlers = listeners.get(event);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      (handler as (...callArgs: Parameters<ViewerHostEvents[K]>) => void)(...args);
    }
  }

  function on<K extends keyof ViewerHostEvents>(
    event: K,
    handler: ViewerHostEvents[K],
  ): () => void {
    let handlers = listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      listeners.set(event, handlers);
    }
    handlers.add(handler as (...args: never[]) => void);
    return () => {
      const current = listeners.get(event);
      if (!current) return;
      current.delete(handler as (...args: never[]) => void);
      if (current.size === 0) listeners.delete(event);
    };
  }

  function copyVisibility(visibility: VisibilityState): VisibilityState {
    return {
      isolatedPartIds: [...visibility.isolatedPartIds],
      xrayPartIds: [...visibility.xrayPartIds],
      hiddenPartIds: [...visibility.hiddenPartIds],
      showCovered: visibility.showCovered,
    };
  }

  function resolvePreset(presetId: string): ProjectCamera | null {
    const preset = compiled.views.find((view) => view.id === presetId);
    if (!preset) return null;
    return {
      positionMm: copyVec3(preset.camera.positionMm),
      targetMm: copyVec3(preset.camera.targetMm),
      upMm: preset.camera.upMm ? copyVec3(preset.camera.upMm) : undefined,
      fov: preset.camera.fov,
    };
  }

  function operationsForStepIndex(index: number): Operation[] {
    const stepStateEntry = compiled.stepStates[index];
    const step: Step | null = stepStateEntry
      ? compiled.steps.find((candidate) => candidate.id === stepStateEntry.stepId) ?? null
      : compiled.steps[index] ?? null;
    if (!step) return [];
    const operationsById = new Map(compiled.operations.map((operation) => [operation.id, operation]));
    const operations: Operation[] = [];
    for (const operationId of step.operationIds) {
      const operation = operationsById.get(operationId);
      if (operation) operations.push(operation);
    }
    return operations;
  }

  function recomputeHiddenPartIds(): void {
    const visible = visiblePartIds(compiled, currentSnapshot, {
      showCovered: state.visibility.showCovered,
      extraHiddenPartIds: currentExtraHiddenPartIds,
      extraVisiblePartIds: currentExtraVisiblePartIds,
    });
    const visibleSet = new Set(visible);
    state.visibility = {
      ...state.visibility,
      hiddenPartIds: compiled.parts
        .map((part) => part.id)
        .filter((partId) => !visibleSet.has(partId)),
    };
  }

  function overlaysToState(overlays: OverlayObject[]): OverlayState {
    const overlayState: OverlayState = { fastenerPoints: [], routePaths: [], toolProxy: null };
    for (const overlay of overlays) {
      if (overlay.kind === 'fastener_point' && overlay.positionMm) {
        overlayState.fastenerPoints.push({
          overlayId: overlay.id,
          positionMm: copyVec3(overlay.positionMm),
          state: overlay.state,
          label: overlay.label,
        });
      } else if (overlay.kind === 'route_path') {
        overlayState.routePaths.push({
          overlayId: overlay.id,
          pathPointsMm: (overlay.pathPointsMm ?? []).map(copyVec3),
          state: overlay.state,
          label: overlay.label,
        });
      } else if (overlay.kind === 'tool_proxy' && overlay.positionMm) {
        overlayState.toolProxy = {
          overlayId: overlay.id,
          positionMm: copyVec3(overlay.positionMm),
          toolId: overlay.toolId ?? null,
          label: overlay.label,
        };
      }
    }
    return overlayState;
  }

  function handlePick(point: PickPoint): void {
    if (!state.measureMode) return;
    const appended: Vec3[] = [...state.measurePointsMm.map(copyVec3), copyVec3(point.pointMm)];
    // A third click starts a new measurement pair.
    const points: Vec3[] = appended.length > 2 ? [appended[appended.length - 1]!] : appended;
    state.measurePointsMm = points.map(copyVec3);
    if (points.length === 2) {
      const result = adapter.measure(points);
      state.measurement = result ? copyMeasurement(result) : null;
      if (state.measurement) emit('measure', copyMeasurement(state.measurement));
    }
  }

  function mount(container: HTMLElement): Promise<void> {
    if (disposed) return Promise.reject(new Error('viewer host is disposed'));
    adapterUnsubscribes.push(
      adapter.onSelection((partIds) => {
        state.selection = [...partIds];
        emit('selection', [...partIds]);
      }),
      adapter.onPick((point) => handlePick(point)),
      adapter.onError((message) => {
        state.failed = true;
        emit('error', message);
      }),
      adapter.onReady(() => {
        state.ready = true;
        emit('ready');
      }),
    );
    return adapter.load({ compiled, container }).then(
      () => {
        state.mounted = true;
        // Frame the whole model once on load; step navigation may replace this with a preset.
        adapter.setCamera({ fit: 'all' });
      },
      (error: unknown) => {
        state.failed = true;
        emit('error', error instanceof Error ? error.message : String(error));
        throw error;
      },
    );
  }

  function goToStep(index: number, options?: { reducedMotion?: boolean }): void {
    if (compiled.stepStates.length === 0) return;
    const clamped = Math.min(Math.max(Math.trunc(index), 0), compiled.stepStates.length - 1);
    const stepState = stateAtStep(compiled, clamped);
    const reducedMotion = options?.reducedMotion ?? false;
    const forwardMove = clamped > state.currentStepIndex;
    const operations = operationsForStepIndex(clamped);

    const extraHiddenPartIds = uniqueStrings(
      operations.flatMap((operation) => operation.view.hiddenPartIds),
    );
    const focusPartIds = uniqueStrings(
      operations.flatMap((operation) => operation.view.highlightPartIds),
    );
    const recipe = mergedRecipeForStep(compiled, clamped);
    const extraVisiblePartIds = uniqueStrings(recipe.reveal ?? []);

    const snapshot = stepState.after.map((entry) => ({ ...entry }));
    const visible = visiblePartIds(compiled, snapshot, {
      showCovered: state.visibility.showCovered,
      extraHiddenPartIds,
      extraVisiblePartIds,
    });
    const visibleSet = new Set(visible);

    state.currentStepIndex = clamped;
    state.visibility = {
      ...state.visibility,
      hiddenPartIds: compiled.parts
        .map((part) => part.id)
        .filter((partId) => !visibleSet.has(partId)),
    };
    currentSnapshot = snapshot;
    currentExtraHiddenPartIds = [...extraHiddenPartIds];
    currentExtraVisiblePartIds = [...extraVisiblePartIds];

    adapter.setVisibility(copyVisibility(state.visibility));
    adapter.setOverlays(overlaysToState(overlaysForStep(compiled, clamped)));
    adapter.applyState(snapshot.map((entry) => ({ ...entry })), {
      animate: forwardMove && stepState.applied && !reducedMotion,
      reducedMotion,
      recipe,
      focusPartIds,
    });
    const presetId =
      operations
        .map((operation) => operation.view.cameraPresetId)
        .find((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0) ??
      null;
    if (presetId) {
      const camera = resolvePreset(presetId);
      if (camera) adapter.setCamera(camera);
      else emit('error', `unknown camera preset: ${presetId}`);
    }
    emit('step', clamped);
  }

  function select(partIds: string[]): void {
    const selection = [...partIds];
    state.selection = selection;
    adapter.select(selection);
    adapter.setEmphasis(selection, selection.length > 0 ? 'highlight' : 'none');
    emit('selection', [...selection]);
  }

  function setCamera(camera: ProjectCamera | { fit: 'all' } | { presetId: string }): void {
    if ('fit' in camera) {
      adapter.setCamera({ fit: 'all' });
      return;
    }
    if ('presetId' in camera) {
      const resolved = resolvePreset(camera.presetId);
      if (!resolved) {
        emit('error', `unknown camera preset: ${camera.presetId}`);
        return;
      }
      adapter.setCamera(resolved);
      return;
    }
    adapter.setCamera({
      positionMm: copyVec3(camera.positionMm),
      targetMm: copyVec3(camera.targetMm),
      upMm: camera.upMm ? copyVec3(camera.upMm) : undefined,
      fov: camera.fov,
    });
  }

  function setSection(plane: SectionPlane | null): void {
    state.sectionPlane = plane ? { ...plane } : null;
    adapter.setSection(state.sectionPlane ? { ...state.sectionPlane } : null);
  }

  function setVisibility(patch: Partial<VisibilityState>): void {
    state.visibility = {
      isolatedPartIds: [...(patch.isolatedPartIds ?? state.visibility.isolatedPartIds)],
      xrayPartIds: [...(patch.xrayPartIds ?? state.visibility.xrayPartIds)],
      hiddenPartIds: [...(patch.hiddenPartIds ?? state.visibility.hiddenPartIds)],
      showCovered: patch.showCovered ?? state.visibility.showCovered,
    };
    adapter.setVisibility(copyVisibility(state.visibility));
  }

  function isolate(partIds: string[] | null): void {
    setVisibility({ isolatedPartIds: partIds ?? [] });
  }

  function toggleXray(partIds: string[] | null): void {
    setVisibility({ xrayPartIds: partIds ?? [] });
  }

  function setShowCovered(show: boolean): void {
    state.visibility = { ...state.visibility, showCovered: show };
    recomputeHiddenPartIds();
    adapter.setVisibility(copyVisibility(state.visibility));
  }

  function setMeasureMode(enabled: boolean): void {
    state.measureMode = enabled;
    adapter.setSelectionMode(enabled ? 'measure' : 'select');
  }

  function clearMeasurement(): void {
    state.measurePointsMm = [];
    state.measurement = null;
  }

  function getState(): ViewerHostState {
    return {
      mounted: state.mounted,
      ready: state.ready,
      failed: state.failed,
      currentStepIndex: state.currentStepIndex,
      selection: [...state.selection],
      measureMode: state.measureMode,
      measurePointsMm: state.measurePointsMm.map(copyVec3),
      measurement: state.measurement ? copyMeasurement(state.measurement) : null,
      sectionPlane: state.sectionPlane ? { ...state.sectionPlane } : null,
      visibility: copyVisibility(state.visibility),
    };
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    for (const unsubscribe of adapterUnsubscribes.splice(0)) unsubscribe();
    listeners.clear();
    adapter.dispose();
  }

  return {
    compiled,
    mount,
    dispose,
    goToStep,
    select,
    setCamera,
    setSection,
    setVisibility,
    isolate,
    toggleXray,
    setShowCovered,
    setMeasureMode,
    clearMeasurement,
    getState,
    on,
  };
}

function copyVec3(value: Vec3): Vec3 {
  return [value[0], value[1], value[2]];
}

function copyMeasurement(measurement: MeasurementResult): MeasurementResult {
  return { ...measurement, pointsMm: measurement.pointsMm.map(copyVec3) };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
