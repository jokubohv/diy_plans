/**
 * Headless ViewerHost for tests and for the text/2D WebGL fallback path (docs/architecture.md
 * section 8). No DOM and no three.js: a recording adapter captures every call the real adapter
 * would have received, and pure canonical measurement math replaces the engine's raycasting.
 */
import type { CompiledGuide, Vec3 } from '@diyguide/schema';
import type {
  MeasurementResult,
  PickPoint,
  ViewerAdapter,
  ViewerCapabilities,
} from './types';
import { createViewerHost } from './host';
import type { ViewerHost } from './types';

/** One adapter call the host performed, in order. `args` are the exact call arguments. */
export interface HostCall {
  method: string;
  args: unknown[];
}

export interface RecordingHost extends ViewerHost {
  /** Adapter calls recorded so far, in call order. */
  readonly calls: HostCall[];
  /** Simulate an adapter pick with canonical-mm coordinates (measure mode flow). */
  pick(point: PickPoint): void;
  /** Simulate the adapter's selection event. */
  emitSelection(partIds: string[]): void;
  /** Simulate the adapter's ready event. */
  emitReady(): void;
  /** Simulate the adapter's error event. */
  emitError(message: string, detail?: string): void;
}

/**
 * Canonical software measurement: two points give a distance, three or more give the angle at
 * the second point using the first three points. Values are unrounded; `approximate` is always
 * true because host-level measurements come from viewer picks (software conversion), never from
 * a field instrument.
 */
export function measureCanonicalPoints(pointsMm: readonly Vec3[]): MeasurementResult | null {
  const points = pointsMm.map(copyVec3);
  if (points.length < 2) return null;
  if (points.length === 2) {
    return {
      kind: 'distance',
      valueMm: distanceMm(points[0]!, points[1]!),
      valueDeg: null,
      pointsMm: points,
      approximate: true,
    };
  }
  const a = points[0]!;
  const b = points[1]!;
  const c = points[2]!;
  const u: Vec3 = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const v: Vec3 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const lengthU = Math.hypot(u[0], u[1], u[2]);
  const lengthV = Math.hypot(v[0], v[1], v[2]);
  if (lengthU === 0 || lengthV === 0) {
    return {
      kind: 'none',
      valueMm: null,
      valueDeg: null,
      pointsMm: points,
      approximate: true,
      note: 'coincident measurement points',
    };
  }
  const cosine = clamp(
    (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lengthU * lengthV),
    -1,
    1,
  );
  return {
    kind: 'angle',
    valueMm: null,
    valueDeg: (Math.acos(cosine) * 180) / Math.PI,
    pointsMm: points,
    approximate: true,
  };
}

type RecordingAdapter = ViewerAdapter & {
  emitPick(point: PickPoint): void;
  emitSelection(partIds: string[]): void;
  emitError(message: string, detail?: string): void;
  emitReady(): void;
};

function createRecordingAdapter(calls: HostCall[]): RecordingAdapter {
  const selectionHandlers = new Set<(partIds: string[]) => void>();
  const pickHandlers = new Set<(point: PickPoint) => void>();
  const errorHandlers = new Set<(message: string, detail?: string) => void>();
  const readyHandlers = new Set<() => void>();

  const capabilities: ViewerCapabilities = {
    engine: 'recording-host',
    version: '0.1.0',
    picking: false,
    clipping: false,
    xray: false,
    measurement: true,
    animation: false,
    overlays: false,
    canonicalUnit: 'mm',
    viewerFrame: 'canonical Z-up mm (headless)',
  };

  return {
    capabilities,
    load(input) {
      calls.push({ method: 'load', args: [input] });
      return Promise.resolve();
    },
    dispose() {
      calls.push({ method: 'dispose', args: [] });
    },
    select(partIds) {
      calls.push({ method: 'select', args: [[...partIds]] });
    },
    onSelection(handler) {
      selectionHandlers.add(handler);
      return () => selectionHandlers.delete(handler);
    },
    onPick(handler) {
      pickHandlers.add(handler);
      return () => pickHandlers.delete(handler);
    },
    onError(handler) {
      errorHandlers.add(handler);
      return () => errorHandlers.delete(handler);
    },
    onReady(handler) {
      readyHandlers.add(handler);
      return () => readyHandlers.delete(handler);
    },
    setCamera(camera) {
      calls.push({ method: 'setCamera', args: [camera] });
    },
    setSection(plane) {
      calls.push({ method: 'setSection', args: [plane] });
    },
    setVisibility(visibility) {
      calls.push({ method: 'setVisibility', args: [visibility] });
    },
    setOverlays(overlays) {
      calls.push({ method: 'setOverlays', args: [overlays] });
    },
    applyState(snapshot, options) {
      calls.push({ method: 'applyState', args: [snapshot, options] });
    },
    measure(pointsMm) {
      const result = measureCanonicalPoints(pointsMm);
      calls.push({ method: 'measure', args: [pointsMm.map(copyVec3)] });
      return result;
    },
    setSelectionMode(mode) {
      calls.push({ method: 'setSelectionMode', args: [mode] });
    },
    setEmphasis(partIds, style) {
      calls.push({ method: 'setEmphasis', args: [[...partIds], style] });
    },
    emitPick(point) {
      for (const handler of [...pickHandlers]) handler(point);
    },
    emitSelection(partIds) {
      for (const handler of [...selectionHandlers]) handler([...partIds]);
    },
    emitError(message, detail) {
      for (const handler of [...errorHandlers]) handler(message, detail);
    },
    emitReady() {
      for (const handler of [...readyHandlers]) handler();
    },
  };
}

/**
 * Create a headless host over `compiled` with identical step/visibility/measurement semantics
 * to `createViewerHost`. Inspect `host.calls` to assert what a real adapter would have done.
 */
export function createRecordingHost(compiled: CompiledGuide): RecordingHost {
  const calls: HostCall[] = [];
  const adapter = createRecordingAdapter(calls);
  const host = createViewerHost(adapter, compiled);
  return Object.assign(host, {
    calls,
    pick: (point: PickPoint) => adapter.emitPick(point),
    emitSelection: (partIds: string[]) => adapter.emitSelection(partIds),
    emitReady: () => adapter.emitReady(),
    emitError: (message: string, detail?: string) => adapter.emitError(message, detail),
  });
}

function distanceMm(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function copyVec3(value: Vec3): Vec3 {
  return [value[0], value[1], value[2]];
}
