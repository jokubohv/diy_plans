/**
 * Frozen ViewerAdapter contract (P0). Every engine adapter implements this interface; the
 * guide UI only ever talks to ViewerHost, never to an engine.
 *
 * Canonical frame at this boundary: right-handed Z-up, millimetres. Adapters convert to their
 * own frame exactly once and expose round-trip behaviour for picked points, cameras, sections
 * and measurements. The planned Y-up metre viewer mapping is [x, y, z] -> [x, z, -y] / 1000.
 */
import type {
  CompiledGuide,
  OverlayObject,
  PartStateEntry,
  PresentationRecipe,
  Vec3,
} from '@diyguide/schema';

export interface ViewerCapabilities {
  engine: string;
  version: string;
  picking: boolean;
  clipping: boolean;
  xray: boolean;
  measurement: boolean;
  animation: boolean;
  overlays: boolean;
  canonicalUnit: 'mm';
  viewerFrame: string;
}

export interface ProjectCamera {
  positionMm: Vec3;
  targetMm: Vec3;
  upMm?: Vec3;
  fov?: number;
}

export interface SectionPlane {
  axis: 'x' | 'y' | 'z';
  offsetMm: number;
  flip?: boolean;
}

export interface VisibilityState {
  isolatedPartIds: string[];
  xrayPartIds: string[];
  hiddenPartIds: string[];
  showCovered: boolean;
}

export interface FastenerPointOverlay {
  overlayId: string;
  positionMm: Vec3;
  state: 'proposed' | 'released';
  label: string;
}

export interface RoutePathOverlay {
  overlayId: string;
  pathPointsMm: Vec3[];
  state: 'proposed' | 'released';
  label: string;
}

export interface ToolProxyOverlay {
  overlayId: string;
  positionMm: Vec3;
  toolId: string | null;
  label: string;
}

export interface OverlayState {
  fastenerPoints: FastenerPointOverlay[];
  routePaths: RoutePathOverlay[];
  toolProxy: ToolProxyOverlay | null;
}

export interface LoadInput {
  compiled: CompiledGuide;
  container: HTMLElement;
}

export interface PickPoint {
  pointMm: Vec3;
  partId: string | null;
}

export interface MeasurementResult {
  kind: 'distance' | 'angle' | 'none';
  valueMm: number | null;
  valueDeg: number | null;
  pointsMm: Vec3[];
  approximate: boolean;
  note?: string;
}

export interface ApplyOptions {
  animate: boolean;
  reducedMotion: boolean;
  recipe?: PresentationRecipe | null;
  focusPartIds?: string[];
}

export type AdapterEventHandler = (...args: never[]) => void;

export interface ViewerAdapter {
  readonly capabilities: ViewerCapabilities;
  load(input: LoadInput): Promise<void>;
  dispose(): void;
  /** Canonical selection: adapter maps partIds to its own object identities internally. */
  select(partIds: string[]): void;
  onSelection(handler: (partIds: string[]) => void): () => void;
  onPick(handler: (point: PickPoint) => void): () => void;
  onError(handler: (message: string, detail?: string) => void): () => void;
  onReady(handler: () => void): () => void;
  setCamera(camera: ProjectCamera | { fit: 'all' }): void;
  setSection(plane: SectionPlane | null): void;
  setVisibility(state: VisibilityState): void;
  setOverlays(state: OverlayState): void;
  /** Deterministic seek: resets visuals, then applies this snapshot. */
  applyState(snapshot: PartStateEntry[], options: ApplyOptions): void;
  /** Points in canonical mm; returns unrounded canonical values with approximation label. */
  measure(pointsMm: Vec3[]): MeasurementResult | null;
  setSelectionMode(mode: 'select' | 'measure'): void;
  setEmphasis(partIds: string[], style: 'highlight' | 'none'): void;
}

/** UI-facing host state. */
export interface ViewerHostState {
  mounted: boolean;
  ready: boolean;
  failed: boolean;
  currentStepIndex: number;
  selection: string[];
  measureMode: boolean;
  measurePointsMm: Vec3[];
  measurement: MeasurementResult | null;
  sectionPlane: SectionPlane | null;
  visibility: VisibilityState;
}

export interface ViewerHostEvents {
  selection: (partIds: string[]) => void;
  ready: () => void;
  error: (message: string) => void;
  measure: (result: MeasurementResult) => void;
  step: (index: number) => void;
}

/**
 * The only interface the guide UI uses. Implementations: createViewerHost (real adapter) and
 * createRecordingHost (headless, for tests and text fallback).
 */
export interface ViewerHost {
  readonly compiled: CompiledGuide;
  mount(container: HTMLElement): Promise<void>;
  dispose(): void;
  goToStep(index: number, options?: { reducedMotion?: boolean }): void;
  select(partIds: string[]): void;
  setCamera(camera: ProjectCamera | { fit: 'all' } | { presetId: string }): void;
  setSection(plane: SectionPlane | null): void;
  setVisibility(patch: Partial<VisibilityState>): void;
  isolate(partIds: string[] | null): void;
  toggleXray(partIds: string[] | null): void;
  setShowCovered(show: boolean): void;
  setMeasureMode(on: boolean): void;
  clearMeasurement(): void;
  getState(): ViewerHostState;
  on<K extends keyof ViewerHostEvents>(event: K, handler: ViewerHostEvents[K]): () => void;
}

export type { OverlayObject };
