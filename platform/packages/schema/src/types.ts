/**
 * TypeScript mirror of the canonical JSON Schema (diy-guide-0.1.0.schema.json and
 * diy-guide-compiled-0.1.0.schema.json). The schema files are canonical; a parity test in
 * tests/ validates fixtures against both representations.
 */

export type Vec3 = [number, number, number];
/** Column-major 4x4 matrix; translation at indices 12-14. */
export type Mat4 = number[];

export type Unit = 'mm' | 'cm' | 'm' | 'in' | 'ft';

export type ReleaseStatus = 'ready' | 'conditional' | 'held' | 'superseded' | 'not_applicable';

export type EvidenceStatus =
  | 'field_verified'
  | 'document_verified'
  | 'manufacturer_verified'
  | 'reported'
  | 'derived'
  | 'candidate'
  | 'conflicted'
  | 'unknown';

export type PartState =
  | 'absent'
  | 'existing'
  | 'removed'
  | 'cut'
  | 'positioned'
  | 'installed'
  | 'covered';

export type CapabilityId = string;

export interface Capability {
  name: CapabilityId;
  version: number;
}

export interface Placement {
  translationMm: Vec3;
  rotationEulerDeg?: Vec3;
  scale?: Vec3;
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export interface Datum {
  id: string;
  name: string;
  description: string;
  originMm: Vec3;
  axes?: { x: string; y: string; z: string };
}

export type ReleaseScope =
  | 'demonstration_only'
  | 'practice_on_loose_scrap'
  | 'site_installation'
  | 'design_review';

export interface ReleaseRecord {
  id: string;
  state: ReleaseStatus;
  scope: ReleaseScope;
  issuer: string;
  issuedDate: string;
  evidence?: string;
  affectedIds?: string[];
  notes?: string;
}

export type ProjectType =
  | 'fixture_demo'
  | 'pantry'
  | 'wall'
  | 'closet'
  | 'cabinet'
  | 'bathroom'
  | 'flooring'
  | 'deck'
  | 'plumbing'
  | 'electrical'
  | 'other';

export interface Project {
  slug: string;
  title: string;
  projectType: ProjectType;
  description: string;
  jurisdiction?: string;
  coordinateContract: {
    handedness: 'right';
    upAxis: 'Z';
    lengthUnit: 'mm';
    description: string;
  };
  display: { unit: 'in' | 'mm' | 'cm' | 'ft'; precisionIn: number };
  releases: ReleaseRecord[];
}

export type SourceKind =
  | 'fixture_sheet'
  | 'pdf_page'
  | 'drawing_region'
  | 'field_note'
  | 'product_manual'
  | 'code_section'
  | 'table_row'
  | 'photo'
  | 'user_instruction';

export interface SourceRef {
  id: string;
  kind: SourceKind;
  title: string;
  authority?: string;
  date?: string;
  revision?: string;
  privacy: 'public' | 'private' | 'excerpt_only';
  assetPath?: string;
  checksum?: string;
  page?: number;
  relationship?: 'current' | 'carry_forward' | 'superseded' | 'reference';
  locatorNote?: string;
}

export interface CitationRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Citation {
  id: string;
  sourceId: string;
  label: string;
  kind?:
    | 'page'
    | 'region'
    | 'element'
    | 'table_cell'
    | 'note'
    | 'manual_page'
    | 'field_note'
    | 'code_section';
  region?: CitationRegion;
  elementId?: string;
  row?: number;
  note?: string;
  excerpt?: string;
}

export interface SourcesFile {
  sources: SourceRef[];
  citations: Citation[];
}

export interface Measurement {
  id: string;
  label: string;
  original: { display: string; value: string; unit: Unit };
  canonicalMm: string;
  installationToleranceMm: number | null;
  evidenceStatus: EvidenceStatus;
  declaredReleaseStatus: ReleaseStatus;
  citationIds: string[];
  derivedFromMeasurementIds?: string[];
  conflictNote?: string;
}

export interface GeometryBox {
  shape: 'box';
  sizeMm: Vec3;
}

export interface GeometryPath {
  shape: 'path';
  pointsMm: Vec3[];
  radiusMm?: number;
  dashed?: boolean;
}

export interface GeometryMarkers {
  shape: 'markers';
  pointsMm: Vec3[];
  markerRadiusMm?: number;
  proposed?: boolean;
}

export type PartGeometry = GeometryBox | GeometryPath | GeometryMarkers;

export type PartKind =
  | 'linear_member'
  | 'panel'
  | 'layered_surface'
  | 'opening'
  | 'fixture'
  | 'connector'
  | 'mesh_asset';

export type PartRole =
  | 'installed'
  | 'existing'
  | 'removed'
  | 'clearance'
  | 'overlay'
  | 'schematic'
  | 'loose';

export type Trade =
  | 'general'
  | 'framing'
  | 'drywall'
  | 'electrical'
  | 'plumbing'
  | 'cabinetry'
  | 'appliances'
  | 'finishes';

export type Stage =
  | 'existing'
  | 'demo'
  | 'rough'
  | 'inspection'
  | 'cover'
  | 'finish'
  | 'fixture';

export interface Part {
  id: string;
  name: string;
  kind: PartKind;
  role: PartRole;
  assemblyId: string;
  trade: Trade;
  stage: Stage;
  ifcClass: string;
  /** 22-character IFC GlobalId, deterministic from partId (see compiler guid.ts). */
  ifcGlobalId: string;
  materialId?: string | null;
  description: string;
  selectable: boolean;
  takeoff?: { include: boolean; quantity?: number; note?: string };
  placement?: Placement;
  initialState: PartState;
  geometry: PartGeometry;
  /** Compiled only. */
  worldTransform?: Mat4;
  /** Compiled only. */
  boundsMm?: Bounds;
}

export interface Assembly {
  id: string;
  name: string;
  parentId: string | null;
  trade: string;
  stage: string;
  placement?: Placement;
}

export interface FastenerPattern {
  type: 'line' | 'edge' | 'field';
  count?: number | null;
  spacingMm?: number | null;
  startOffsetMm?: number | null;
  endOffsetMm?: number | null;
  edgeDistanceMm?: number | null;
}

export interface PilotHole {
  required: boolean;
  diameterMm: number | null;
  depthMm: number | null;
}

export interface Connection {
  id: string;
  fromPartId: string;
  toPartId: string;
  method:
    | 'mechanical_anchor'
    | 'screw'
    | 'nail'
    | 'bolt'
    | 'adhesive'
    | 'clamp'
    | 'bracket'
    | 'other';
  fastenerSpecId?: string | null;
  pattern?: FastenerPattern | null;
  pilotHole?: PilotHole | null;
  toolSetup?: string | null;
  declaredReleaseStatus: ReleaseStatus;
  holdReason?: string;
  citationIds: string[];
  proposedPointsMm?: Vec3[] | null;
  /** Compiled only. */
  effectiveReleaseStatus?: ReleaseStatus;
}

export interface FastenerSpec {
  id: string;
  name: string;
  description?: string;
  lengthMm?: number | null;
  citationIds: string[];
}

export interface ConnectionsFile {
  connections: Connection[];
  fastenerSpecs: FastenerSpec[];
}

export interface Material {
  id: string;
  name: string;
  category: 'lumber' | 'panel' | 'fastener' | 'electrical' | 'adhesive' | 'other';
  sizeLabel?: string | null;
  actualSizeMm?: Vec3 | null;
  unit: 'each' | 'sheet' | 'board' | 'm' | 'ft' | 'tube' | 'box';
  quantityProposed: number;
  spareQuantity?: number | null;
  notes?: string;
  citationIds: string[];
}

export interface Tool {
  id: string;
  name: string;
  category: 'measuring' | 'cutting' | 'driving' | 'drilling' | 'routing' | 'safety' | 'other';
  setup?: string | null;
  citationIds: string[];
}

export interface Circuit {
  id: string;
  label: string;
  description?: string;
  conductorLabel?: string | null;
  citationIds: string[];
}

export interface System {
  id: string;
  name: string;
  kind: 'electrical' | 'plumbing' | 'hvac';
  energized: boolean;
  description: string;
  circuits: Circuit[];
  citationIds: string[];
}

export interface QualityCheck {
  instruction: string;
  evidenceRequired?: 'visual' | 'field_measurement_or_photo' | 'photo' | 'measurement' | 'none';
  citationIds?: string[];
}

export interface StateEffect {
  partId: string;
  fromState?: PartState;
  toState: PartState;
}

export interface PresentationRecipe {
  reveal?: string[];
  ghostPrevious?: string[];
  translateFrom?: { partId: string; offsetMm: Vec3 };
  showFastenerPoints?: { connectionId: string; proposed?: boolean };
  driveFasteners?: { connectionId: string };
  routePath?: { partId: string };
  cutaway?: { enabled: boolean };
  /**
   * Presentation-only pose for flat assembly stages: rotate the listed parts about an axis
   * through a pivot (canonical mm). Deterministic on every seek; never affects data, takeoff or
   * the IFC.
   */
  layFlat?: {
    partIds: string[];
    axis: 'x' | 'y' | 'z';
    angleDeg: number;
    pivotMm: Vec3;
  };
  /**
   * Presentation-only elevation for plan-footprint wall geometry whose field-fit height remains
   * unresolved. The label must state that the displayed height is schematic. Canonical geometry,
   * dimensions, takeoff and IFC remain unchanged.
   */
  schematicElevation?: {
    studPartIds: string[];
    topPlatePartIds: string[];
    /** Field-fit drywall sheets shown at their sourced face/width with schematic height only. */
    panelPartIds?: string[];
    contextPartIds?: string[];
    overallHeightMm: number;
    bottomPlateThicknessMm: number;
    topPlateThicknessMm: number;
    label: string;
  };
  /** Per-part visual transform; canonical placement/geometry and IFC remain unchanged. */
  boxTransforms?: Array<{
    partId: string;
    offsetMm?: Vec3;
    scale?: Vec3;
  }>;
  /**
   * Presentation-only requirement envelopes. These are deliberately not Parts: they never enter
   * canonical geometry, state snapshots, takeoff or IFC. Use them for held spatial requirements
   * whose final construction boundaries remain unresolved.
   */
  requirementPreview?: {
    measurementIds: string[];
    label: string;
    boxes: Array<{
      id: string;
      label: string;
      centerMm: Vec3;
      sizeMm: Vec3;
      style: 'context' | 'target' | 'extension';
    }>;
  };
}

export interface OperationView {
  cameraPresetId?: string | null;
  highlightPartIds: string[];
  hiddenPartIds: string[];
  recipe: PresentationRecipe;
}

export type OperationKind =
  | 'survey'
  | 'prepare'
  | 'remove'
  | 'cut'
  | 'position'
  | 'fasten'
  | 'drill'
  | 'route'
  | 'terminate'
  | 'finish'
  | 'inspect'
  | 'test';

export interface SurveyParameters {
  measurementIds: string[];
  checkInstruction: string;
}

/** Preparation step: the materials and tools to gather, plus the phase cut list. */
export interface PrepareParameters {
  materialIds: string[];
  toolIds: string[];
  instruction: string;
  cutOperationIds?: string[];
  note?: string;
}

export interface RemoveParameters {
  disposition: 'discard' | 'store' | 'reuse';
  note?: string;
}

export interface CutParameters {
  cuts: { partId: string; finalLengthMm: string; note?: string }[];
  toolId?: string | null;
}

export interface PositionParameters {
  datumNote: string;
  fromPartId?: string | null;
  offsetsMm?: Vec3 | null;
  toolId?: string | null;
}

export interface FastenParameters {
  connectionIds: string[];
  pointsMm?: Vec3[] | null;
  proposed: boolean;
  toolId?: string | null;
}

export interface DrillParameters {
  holeDiameterMm: number | null;
  depthMm: number | null;
  pointsMm: Vec3[] | null;
  toolId?: string | null;
}

export interface RouteParameters {
  systemId: string;
  circuitId?: string | null;
  pathPointsMm: Vec3[] | null;
  conductorLabel?: string | null;
  demonstrationOnly: boolean;
}

export interface TerminateParameters {
  systemId: string;
  circuitId?: string | null;
  terminalPartId?: string | null;
  diagramCitationIds: string[];
}

export interface FinishParameters {
  levelLabel: string;
  passes?: number | null;
}

export interface InspectParameters {
  inspectWhat: string;
  criteria: string;
  evidenceRequired: 'visual' | 'field_measurement_or_photo' | 'photo' | 'measurement' | 'none';
}

export interface TestParameters {
  testType: string;
  expectedResult: string;
}

export interface ParametersByKind {
  survey: SurveyParameters;
  prepare: PrepareParameters;
  remove: RemoveParameters;
  cut: CutParameters;
  position: PositionParameters;
  fasten: FastenParameters;
  drill: DrillParameters;
  route: RouteParameters;
  terminate: TerminateParameters;
  finish: FinishParameters;
  inspect: InspectParameters;
  test: TestParameters;
}

export interface OperationBase {
  id: string;
  title: string;
  targetPartIds: string[];
  dependencyOperationIds: string[];
  citationIds: string[];
  declaredReleaseStatus: ReleaseStatus;
  releaseId?: string | null;
  preconditions?: string[];
  qualityChecks?: QualityCheck[];
  stopConditions?: string[];
  stateEffects: StateEffect[];
  view: OperationView;
  holdReason?: string;
  /** Compiled only. */
  effectiveReleaseStatus?: ReleaseStatus;
}

export type Operation = {
  [K in OperationKind]: OperationBase & { kind: K; parameters: ParametersByKind[K] };
}[OperationKind];

export interface Step {
  id: string;
  sequence: number;
  title: string;
  /** Optional user-facing phase label; steps with the same label form a phase in sequence order. */
  phaseLabel?: string;
  prerequisiteStepIds: string[];
  operationIds: string[];
  visibleAssemblyIds: string[];
  toolIds: string[];
  qualityChecks: QualityCheck[];
  stopConditions: string[];
  declaredReleaseStatus: ReleaseStatus;
  citationIds: string[];
  /** Compiled only. */
  effectiveReleaseStatus?: ReleaseStatus;
}

export interface ViewPreset {
  id: string;
  name: string;
  kind: 'iso' | 'elevation' | 'plan' | 'section' | 'closeup' | 'installer_eye';
  camera: { positionMm: Vec3; targetMm: Vec3; upMm?: Vec3; fov?: number };
  description?: string;
}

export interface Issue {
  id: string;
  severity: 'blocking' | 'major' | 'minor' | 'info';
  status: 'open' | 'resolved' | 'accepted';
  title: string;
  detail: string;
  affectedIds: string[];
  sourceRefIds: string[];
  resolution?: string;
}

export interface Acceptance {
  status: 'accepted' | 'rejected' | 'pending';
  reviewer: string;
  role: string;
  date: string;
  scope: 'concept' | 'build_guide' | 'demo';
  sourceSetHash: string | null;
  contentHash: string | null;
  issueDispositions: { issueId: string; disposition: string; note?: string }[];
  notes?: string;
}

export interface Listing {
  slug: string;
  title: string;
  summary: string;
  projectType: string;
  scope: 'concept' | 'build_guide';
  revision: string;
  updated: string;
  thumbnailAssetPath: string;
  tags?: string[];
}

export interface BundleManifest {
  schema: 'diy-guide';
  schemaVersion: '0.1.0';
  contentVersion: string;
  packageRevision: number;
  minimumBuilderVersion: string;
  capabilities: Capability[];
  notes?: string;
}

export interface PartStateEntry {
  partId: string;
  state: PartState;
}

export interface OverlayObject {
  id: string;
  kind: 'fastener_point' | 'route_path' | 'tool_proxy' | 'dimension';
  operationId: string;
  partId?: string | null;
  toolId?: string | null;
  positionMm?: Vec3 | null;
  pathPointsMm?: Vec3[] | null;
  radiusMm?: number | null;
  state: 'proposed' | 'released';
  label: string;
  inTakeoff: false;
}

export interface StepState {
  index: number;
  stepId: string;
  status: ReleaseStatus;
  applied: boolean;
  reason: string | null;
  before: PartStateEntry[];
  after: PartStateEntry[];
  overlayIds: string[];
}

export interface IdMap {
  version: '0.1.0';
  parts: { partId: string; ifcGlobalId: string; ifcClass: string }[];
}

export interface CompiledStats {
  partCount: number;
  selectablePartCount: number;
  takeoffPartCount: number;
  operationCount: number;
  stepCount: number;
  readyOperationCount: number;
  conditionalOperationCount: number;
  heldOperationCount: number;
  openIssueCount: number;
  overlayCount: number;
  sourceCount: number;
}

export interface CompiledMeta {
  contentVersion: string;
  packageRevision: number;
  sourceSetHash: string;
  contentHash: string;
  minimumBuilderVersion: string;
  capabilities: Capability[];
  compiler: { name: string; version: string };
  acceptanceStatus: 'accepted' | 'rejected' | 'pending';
}

export interface CompiledGuide {
  schema: 'diy-guide-compiled';
  schemaVersion: '0.1.0';
  meta: CompiledMeta;
  project: Project;
  datums: Datum[];
  sources: SourceRef[];
  citations: Citation[];
  measurements: Measurement[];
  assemblies: Assembly[];
  parts: (Part & { worldTransform: Mat4; boundsMm: Bounds })[];
  materials: Material[];
  tools: Tool[];
  systems: System[];
  connections: (Connection & { effectiveReleaseStatus: ReleaseStatus })[];
  fastenerSpecs: FastenerSpec[];
  operations: (Operation & { effectiveReleaseStatus: ReleaseStatus })[];
  steps: (Step & { effectiveReleaseStatus: ReleaseStatus })[];
  views: ViewPreset[];
  issues: Issue[];
  overlays: OverlayObject[];
  stepStates: StepState[];
  stats: CompiledStats;
  idMap: IdMap;
}

/** Authored bundle as read from disk. */
export interface AuthoredBundle {
  manifest: BundleManifest;
  project: Project;
  datums: Datum[];
  measurements: Measurement[];
  sources: SourcesFile;
  assemblies: Assembly[];
  parts: Part[];
  connections: ConnectionsFile;
  materials: Material[];
  tools: Tool[];
  systems: System[];
  operations: Operation[];
  steps: Step[];
  views: ViewPreset[];
  issues: Issue[];
  acceptance: Acceptance;
  listing: Listing;
}

export const AUTHORED_FILE_NAMES = [
  'manifest.json',
  'project.json',
  'datums.json',
  'measurements.json',
  'sources.json',
  'assemblies.json',
  'parts.json',
  'connections.json',
  'materials.json',
  'tools.json',
  'systems.json',
  'operations.json',
  'steps.json',
  'views.json',
  'issues.json',
  'acceptance.json',
  'listing.json',
] as const;

export type AuthoredFileName = (typeof AUTHORED_FILE_NAMES)[number];
