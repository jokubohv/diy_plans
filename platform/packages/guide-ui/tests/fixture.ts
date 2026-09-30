/**
 * Hand-written CompiledGuide fixture for guide-ui tests. It never reads the compiler worker's
 * generated output (`apps/guide-site/public/data/`), so unit tests stay green whether or not
 * the data build has run.
 *
 * Story: a frame-first wall job in three phases ("Wall frame" -> "Cabinet backing" ->
 * "Services & finish") with a preparation step (bill of materials + cut list), a held fastening
 * step (no released parameters) and a released connection variant used to check the
 * "quantity/pattern only when released" rule.
 */
import type {
  Assembly,
  Bounds,
  Citation,
  CompiledGuide,
  Datum,
  FastenerSpec,
  Issue,
  Mat4,
  Material,
  Measurement,
  OverlayObject,
  Part,
  PartState,
  PartStateEntry,
  Project,
  SourceRef,
  StepState,
  System,
  Tool,
  ViewPreset,
} from '@diyguide/schema';
import type { CatalogData, CatalogEntry } from '../src/data';

export const FIXTURE_RELEASE_ID = `sha256:${'a'.repeat(64)}`;

export const FASTEN_HOLD_REASON =
  'Fastener type, length and spacing are not released; only proposed locations may be shown.';
export const FASTEN_QUALITY_CHECK = 'Every fastener point matches the released connection detail';
export const FASTEN_STOP_CONDITION = 'Do not drive any fastener until the connection is released.';
export const HELD_PATTERN_SPACING_MM = 406.4;
export const HELD_PATTERN_EDGE_MM = 50.8;
export const RELEASED_PATTERN_SPACING_MM = 304.8;
export const RELEASED_PATTERN_COUNT = 4;

/** Phase labels used by the fixture steps, in published sequence order. */
export const PHASE_WALL_FRAME = 'Wall frame';
export const PHASE_CABINET_BACKING = 'Cabinet backing';
export const PHASE_SERVICES_FINISH = 'Services & finish';
export const PHASE_LABELS = [PHASE_WALL_FRAME, PHASE_CABINET_BACKING, PHASE_SERVICES_FINISH] as const;

export const PREPARE_INSTRUCTION =
  'Gather the backing materials and tools, then check the cut list before cutting.';
export const PREPARE_NOTE =
  'Confirm stock lengths against the recorded dimensions before cutting (test note).';
export const CUT_NOTE = 'Square cut at both ends (test note).';
export const CUT_LENGTH_MM = { backing: '1066.800', cover: '2438.400' } as const;
export const DRYWALL_MATERIAL_NOTE =
  'Cut sheets to the recorded lengths; keep the offcuts for the spare (test note).';

function mat(tx: number, ty: number, tz: number): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1];
}

function boxBounds(
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
): Bounds {
  return {
    min: [cx - sx / 2, cy - sy / 2, cz - sz / 2],
    max: [cx + sx / 2, cy + sy / 2, cz + sz / 2],
  };
}

interface PartInput {
  id: string;
  name: string;
  kind: Part['kind'];
  role: Part['role'];
  trade: Part['trade'];
  stage: Part['stage'];
  ifcClass: string;
  initialState: PartState;
  sizeMm: [number, number, number];
  centerMm: [number, number, number];
  assemblyId: string;
  materialId?: string | null;
}

function makePart(input: PartInput): Part & { worldTransform: Mat4; boundsMm: Bounds } {
  return {
    id: input.id,
    name: input.name,
    kind: input.kind,
    role: input.role,
    assemblyId: input.assemblyId,
    trade: input.trade,
    stage: input.stage,
    ifcClass: input.ifcClass,
    ifcGlobalId: '0000000000000000000000',
    materialId: input.materialId ?? null,
    description: `${input.name} (test fixture)`,
    selectable: true,
    takeoff: { include: true },
    initialState: input.initialState,
    geometry: { shape: 'box', sizeMm: input.sizeMm },
    worldTransform: mat(input.centerMm[0], input.centerMm[1], input.centerMm[2]),
    boundsMm: boxBounds(
      input.centerMm[0],
      input.centerMm[1],
      input.centerMm[2],
      input.sizeMm[0],
      input.sizeMm[1],
      input.sizeMm[2],
    ),
  };
}

function entry(partId: string, state: PartState): PartStateEntry {
  return { partId, state };
}

const PART_STATES: PartStateEntry[] = [
  entry('part.wall.stud-1', 'installed'),
  entry('part.wall.backing', 'absent'),
  entry('part.wall.cover', 'absent'),
  entry('part.cabinet.envelope', 'absent'),
  entry('part.demo.cable', 'absent'),
  entry('part.demo.angle', 'existing'),
];

function withStates(
  base: readonly PartStateEntry[],
  changes: Record<string, PartState>,
): PartStateEntry[] {
  return base.map((row) => {
    const changed = changes[row.partId];
    return changed ? entry(row.partId, changed) : { ...row };
  });
}

const S0 = PART_STATES.map((row) => ({ ...row }));
/** After the backing band is cut (preparation itself changes no part state). */
const S1_CUT = withStates(S0, { 'part.wall.backing': 'cut' });
/** After the backing band is positioned. */
const S2_POSITIONED = withStates(S1_CUT, { 'part.wall.backing': 'positioned' });
/** After the schematic cable is routed. */
const S3_CABLE = withStates(S2_POSITIONED, { 'part.demo.cable': 'installed' });

function makeFixture(): CompiledGuide {
  const parts = [
    makePart({
      id: 'part.wall.stud-1',
      name: 'Stud 1',
      kind: 'linear_member',
      role: 'installed',
      trade: 'framing',
      stage: 'rough',
      ifcClass: 'IfcMember',
      initialState: 'installed',
      sizeMm: [38.1, 88.9, 2362.2],
      centerMm: [57.15, 44.45, 1219.2],
      assemblyId: 'assembly.wall',
      materialId: 'material.lumber.stud',
    }),
    makePart({
      id: 'part.wall.backing',
      name: 'Backing band',
      kind: 'linear_member',
      role: 'installed',
      trade: 'framing',
      stage: 'rough',
      ifcClass: 'IfcPlate',
      initialState: 'absent',
      sizeMm: [1066.8, 38.1, 139.7],
      centerMm: [609.6, -19.05, 1066.8],
      assemblyId: 'assembly.wall',
      materialId: 'material.lumber.stud',
    }),
    makePart({
      id: 'part.wall.cover',
      name: 'Cover panel',
      kind: 'panel',
      role: 'installed',
      trade: 'drywall',
      stage: 'cover',
      ifcClass: 'IfcCovering',
      initialState: 'absent',
      sizeMm: [1219.2, 12.7, 2438.4],
      centerMm: [609.6, -6.35, 1219.2],
      assemblyId: 'assembly.wall',
      materialId: 'material.panel.drywall',
    }),
    makePart({
      id: 'part.cabinet.envelope',
      name: 'Cabinet envelope',
      kind: 'fixture',
      role: 'installed',
      trade: 'cabinetry',
      stage: 'fixture',
      ifcClass: 'IfcFurniture',
      initialState: 'absent',
      sizeMm: [609.6, 609.6, 812.8],
      centerMm: [914.4, -235.5, 1320.8],
      assemblyId: 'assembly.cabinet',
    }),
    makePart({
      id: 'part.demo.cable',
      name: 'Schematic cable',
      kind: 'linear_member',
      role: 'schematic',
      trade: 'electrical',
      stage: 'rough',
      ifcClass: 'IfcCableSegment',
      initialState: 'absent',
      sizeMm: [100, 100, 100],
      centerMm: [500, 100, 1500],
      assemblyId: 'assembly.demo',
    }),
    makePart({
      id: 'part.demo.angle',
      name: 'Loose angle bracket',
      kind: 'connector',
      role: 'loose',
      trade: 'framing',
      stage: 'rough',
      ifcClass: 'IfcDiscreteAccessory',
      initialState: 'existing',
      sizeMm: [88.9, 88.9, 31.75],
      centerMm: [500, -400, 15.875],
      assemblyId: 'assembly.demo',
    }),
  ];

  const assemblies: Assembly[] = [
    { id: 'assembly.wall', name: 'Wall A framing', parentId: null, trade: 'framing', stage: 'rough' },
    {
      id: 'assembly.cabinet',
      name: 'Cabinet envelope',
      parentId: null,
      trade: 'cabinetry',
      stage: 'fixture',
    },
    {
      id: 'assembly.demo',
      name: 'Demonstration schematic',
      parentId: null,
      trade: 'electrical',
      stage: 'rough',
    },
  ];

  const datums: Datum[] = [
    {
      id: 'datum.ff',
      name: 'Finished floor',
      description: 'Top of the finished floor',
      originMm: [0, 0, 0],
    },
  ];

  const measurements: Measurement[] = [
    {
      id: 'measurement.wall.length',
      label: 'Wall A framed length',
      original: { display: '96 in', value: '96', unit: 'in' },
      canonicalMm: '2438.400',
      installationToleranceMm: null,
      evidenceStatus: 'reported',
      declaredReleaseStatus: 'ready',
      citationIds: ['cite.sheet.a'],
    },
    {
      id: 'measurement.wall.opening',
      label: 'Door rough opening width',
      original: { display: '37 1/2 in', value: '37 1/2', unit: 'in' },
      canonicalMm: '952.500',
      installationToleranceMm: null,
      evidenceStatus: 'conflicted',
      declaredReleaseStatus: 'held',
      citationIds: ['cite.sheet.a', 'cite.sheet.b'],
      conflictNote: 'Sheet dimension 952.5 mm disagrees with the field note value 965 mm.',
    },
  ];

  const sources: SourceRef[] = [
    {
      id: 'source.sheet-a',
      kind: 'fixture_sheet',
      title: 'Sheet A (test)',
      authority: 'test fixture',
      date: '2026-09-29',
      privacy: 'public',
      assetPath: 'assets/source-pages/sheet-a.svg',
    },
    {
      id: 'source.sheet-b',
      kind: 'fixture_sheet',
      title: 'Sheet B (test)',
      authority: 'test fixture',
      date: '2026-09-29',
      privacy: 'public',
    },
    {
      id: 'source.private-note',
      kind: 'field_note',
      title: 'Private field note (test)',
      privacy: 'private',
    },
  ];

  const citations: Citation[] = [
    {
      id: 'cite.sheet.a',
      sourceId: 'source.sheet-a',
      label: 'Wall layout and framed dimensions',
      kind: 'region',
      region: { x: 60, y: 60, width: 420, height: 240 },
    },
    {
      id: 'cite.sheet.b',
      sourceId: 'source.sheet-b',
      label: 'Backing connection detail',
      kind: 'region',
      region: { x: 520, y: 60, width: 420, height: 300 },
    },
    {
      id: 'cite.private.note',
      sourceId: 'source.private-note',
      label: 'Private note reference',
      kind: 'field_note',
      excerpt: 'not published',
    },
  ];

  const materials: Material[] = [
    {
      id: 'material.lumber.stud',
      name: '2x4x8 stud (test)',
      category: 'lumber',
      sizeLabel: '2x4x8',
      unit: 'each',
      quantityProposed: 3,
      spareQuantity: null,
      citationIds: [],
    },
    {
      id: 'material.panel.drywall',
      name: '1/2 in gypsum panel (test)',
      category: 'panel',
      unit: 'sheet',
      quantityProposed: 2,
      spareQuantity: 1,
      notes: DRYWALL_MATERIAL_NOTE,
      citationIds: [],
    },
  ];

  const tools: Tool[] = [
    { id: 'tool.level', name: 'Spirit level', category: 'measuring', setup: null, citationIds: [] },
    { id: 'tool.driver', name: 'Impact driver', category: 'driving', setup: null, citationIds: [] },
  ];

  const fastenerSpecs: FastenerSpec[] = [
    {
      id: 'spec.screw',
      name: '#10 x 75 mm structural screw (test)',
      description: 'Test fastener specification',
      lengthMm: 75,
      citationIds: ['cite.sheet.b'],
    },
  ];

  const systems: System[] = [
    {
      id: 'system.demo',
      name: 'Non-energized demonstration route',
      kind: 'electrical',
      energized: false,
      description: 'Schematic cable route used by the test fixture.',
      circuits: [
        {
          id: 'circuit.demo',
          label: 'DEMO-1 (non-energized)',
          conductorLabel: 'schematic',
          citationIds: [],
        },
      ],
      citationIds: [],
    },
  ];

  const views: ViewPreset[] = [
    {
      id: 'view.iso',
      name: 'Isometric',
      kind: 'iso',
      camera: { positionMm: [4200, -3600, 2900], targetMm: [1500, 0, 1200], fov: 45 },
    },
    {
      id: 'view.plan',
      name: 'Plan',
      kind: 'plan',
      camera: { positionMm: [1500, -1200, 5200], targetMm: [1500, 0, 600], fov: 45 },
    },
  ];

  const project: Project = {
    slug: 'ui-fixture',
    title: 'UI Fixture Project (test)',
    projectType: 'fixture_demo',
    description: 'Synthetic project used by guide-ui unit tests. Nothing here is real guidance.',
    jurisdiction: 'test-only',
    coordinateContract: {
      handedness: 'right',
      upAxis: 'Z',
      lengthUnit: 'mm',
      description: 'Z-up millimetres, origin at the finished-floor corner',
    },
    display: { unit: 'in', precisionIn: 0.125 },
    releases: [
      {
        id: 'release.demo',
        state: 'ready',
        scope: 'demonstration_only',
        issuer: 'guide-ui test fixture',
        issuedDate: '2026-09-29',
        evidence: 'synthetic test data',
        notes: 'Demonstration-only test release',
      },
      {
        id: 'release.held',
        state: 'held',
        scope: 'demonstration_only',
        issuer: 'guide-ui test fixture',
        issuedDate: '2026-09-29',
        notes: 'Held test release',
      },
    ],
  };

  const issues: Issue[] = [
    {
      id: 'issue.held-fasteners',
      severity: 'major',
      status: 'open',
      title: 'Fastener specification not released (test)',
      detail: 'The test fixture keeps the connection held on purpose.',
      affectedIds: ['conn.backing-held', 'op.fasten-backing'],
      sourceRefIds: ['source.sheet-b'],
    },
    {
      id: 'issue.loose-parts',
      severity: 'info',
      status: 'accepted',
      title: 'Loose parts are not installed parts (test)',
      detail: 'Demonstration-only connectors.',
      affectedIds: ['part.demo.angle'],
      sourceRefIds: [],
    },
  ];

  const overlays: OverlayObject[] = [
    {
      id: 'overlay.fasten-held.p1',
      kind: 'fastener_point',
      operationId: 'op.fasten-backing',
      partId: 'part.wall.backing',
      toolId: null,
      positionMm: [366.05, 43.9, 1066.8],
      pathPointsMm: null,
      radiusMm: null,
      state: 'proposed',
      label: 'Proposed fastener point 1 (test)',
      inTakeoff: false,
    },
  ];

  const stepStates: StepState[] = [
    {
      index: 0,
      stepId: 'step.survey-wall',
      status: 'ready',
      applied: true,
      reason: null,
      before: S0.map((row) => ({ ...row })),
      after: S0.map((row) => ({ ...row })),
      overlayIds: [],
    },
    {
      index: 1,
      stepId: 'step.prepare-backing',
      status: 'ready',
      applied: true,
      reason: null,
      before: S0.map((row) => ({ ...row })),
      after: S0.map((row) => ({ ...row })),
      overlayIds: [],
    },
    {
      index: 2,
      stepId: 'step.cut-backing',
      status: 'ready',
      applied: true,
      reason: null,
      before: S0.map((row) => ({ ...row })),
      after: S1_CUT.map((row) => ({ ...row })),
      overlayIds: [],
    },
    {
      index: 3,
      stepId: 'step.position-backing',
      status: 'conditional',
      applied: true,
      reason: null,
      before: S1_CUT.map((row) => ({ ...row })),
      after: S2_POSITIONED.map((row) => ({ ...row })),
      overlayIds: [],
    },
    {
      index: 4,
      stepId: 'step.fasten-backing',
      status: 'held',
      applied: false,
      reason: FASTEN_HOLD_REASON,
      before: S2_POSITIONED.map((row) => ({ ...row })),
      after: S2_POSITIONED.map((row) => ({ ...row })),
      overlayIds: ['overlay.fasten-held.p1'],
    },
    {
      index: 5,
      stepId: 'step.inspect-backing',
      status: 'held',
      applied: false,
      reason: 'Propagated from step.fasten-backing (held dependency).',
      before: S2_POSITIONED.map((row) => ({ ...row })),
      after: S2_POSITIONED.map((row) => ({ ...row })),
      overlayIds: [],
    },
    {
      index: 6,
      stepId: 'step.route-cable',
      status: 'ready',
      applied: true,
      reason: null,
      before: S2_POSITIONED.map((row) => ({ ...row })),
      after: S3_CABLE.map((row) => ({ ...row })),
      overlayIds: [],
    },
  ];

  return {
    schema: 'diy-guide-compiled',
    schemaVersion: '0.1.0',
    meta: {
      contentVersion: '0.1.0',
      packageRevision: 1,
      sourceSetHash: `sha256:${'0'.repeat(64)}`,
      contentHash: `sha256:${'1'.repeat(64)}`,
      minimumBuilderVersion: '0.1.0',
      capabilities: [{ name: 'woodFraming', version: 1 }],
      compiler: { name: 'guide-ui-test-fixture', version: '0.1.0' },
      acceptanceStatus: 'accepted',
    },
    project,
    datums,
    sources,
    citations,
    measurements,
    assemblies,
    parts,
    materials,
    tools,
    systems,
    connections: [
      {
        id: 'conn.backing-held',
        fromPartId: 'part.wall.backing',
        toPartId: 'part.wall.stud-1',
        method: 'screw',
        fastenerSpecId: null,
        pattern: {
          type: 'line',
          count: 12,
          spacingMm: HELD_PATTERN_SPACING_MM,
          startOffsetMm: null,
          endOffsetMm: null,
          edgeDistanceMm: HELD_PATTERN_EDGE_MM,
        },
        pilotHole: null,
        toolSetup: null,
        declaredReleaseStatus: 'held',
        holdReason: FASTEN_HOLD_REASON,
        citationIds: ['cite.sheet.b'],
        proposedPointsMm: [
          [366.05, 43.9, 1066.8],
          [442.25, 43.9, 1066.8],
        ],
        effectiveReleaseStatus: 'held',
      },
      {
        id: 'conn.backing-released',
        fromPartId: 'part.wall.backing',
        toPartId: 'part.wall.stud-1',
        method: 'screw',
        fastenerSpecId: 'spec.screw',
        pattern: {
          type: 'line',
          count: RELEASED_PATTERN_COUNT,
          spacingMm: RELEASED_PATTERN_SPACING_MM,
          startOffsetMm: null,
          endOffsetMm: null,
          edgeDistanceMm: 40,
        },
        pilotHole: { required: true, diameterMm: 3.2, depthMm: null },
        toolSetup: 'tool.driver',
        declaredReleaseStatus: 'ready',
        citationIds: ['cite.sheet.a'],
        proposedPointsMm: null,
        effectiveReleaseStatus: 'ready',
      },
    ],
    fastenerSpecs,
    operations: [
      {
        id: 'op.survey-wall',
        kind: 'survey',
        title: 'Survey the framed wall',
        targetPartIds: ['part.wall.stud-1'],
        dependencyOperationIds: [],
        citationIds: ['cite.sheet.a'],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        releaseId: 'release.demo',
        preconditions: [],
        qualityChecks: [
          {
            instruction: 'Framed length reads 96 in',
            evidenceRequired: 'measurement',
          },
        ],
        stopConditions: [],
        stateEffects: [],
        view: {
          cameraPresetId: 'view.iso',
          highlightPartIds: ['part.wall.stud-1'],
          hiddenPartIds: [],
          recipe: {},
        },
        parameters: {
          measurementIds: ['measurement.wall.length'],
          checkInstruction: 'Confirm the framed wall length against the approved dimension.',
        },
      },
      {
        id: 'op.prepare-backing',
        kind: 'prepare',
        title: 'Prepare the backing materials',
        targetPartIds: ['part.wall.backing', 'part.wall.cover'],
        dependencyOperationIds: ['op.survey-wall'],
        citationIds: ['cite.sheet.a'],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        releaseId: 'release.demo',
        preconditions: [],
        qualityChecks: [],
        stopConditions: [],
        stateEffects: [],
        view: {
          cameraPresetId: null,
          highlightPartIds: ['part.wall.backing'],
          hiddenPartIds: [],
          recipe: {},
        },
        parameters: {
          materialIds: ['material.panel.drywall', 'material.lumber.stud'],
          toolIds: ['tool.level', 'tool.driver'],
          instruction: PREPARE_INSTRUCTION,
          cutOperationIds: ['op.cut-backing'],
          note: PREPARE_NOTE,
        },
      },
      {
        id: 'op.cut-backing',
        kind: 'cut',
        title: 'Cut the backing and cover parts',
        targetPartIds: ['part.wall.backing', 'part.wall.cover'],
        dependencyOperationIds: ['op.prepare-backing'],
        citationIds: ['cite.sheet.a'],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        releaseId: 'release.demo',
        preconditions: [],
        qualityChecks: [
          {
            instruction: 'Cut lengths are within 1.5 mm of the recorded cut list.',
            evidenceRequired: 'measurement',
          },
        ],
        stopConditions: [],
        stateEffects: [{ partId: 'part.wall.backing', fromState: 'absent', toState: 'cut' }],
        view: {
          cameraPresetId: null,
          highlightPartIds: ['part.wall.backing', 'part.wall.cover'],
          hiddenPartIds: [],
          recipe: {},
        },
        parameters: {
          cuts: [
            { partId: 'part.wall.backing', finalLengthMm: CUT_LENGTH_MM.backing, note: CUT_NOTE },
            { partId: 'part.wall.cover', finalLengthMm: CUT_LENGTH_MM.cover },
          ],
          toolId: null,
        },
      },
      {
        id: 'op.position-backing',
        kind: 'position',
        title: 'Position the backing band',
        targetPartIds: ['part.wall.backing'],
        dependencyOperationIds: ['op.survey-wall'],
        citationIds: ['cite.sheet.a'],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'conditional',
        releaseId: 'release.demo',
        qualityChecks: [],
        stopConditions: [],
        stateEffects: [{ partId: 'part.wall.backing', fromState: 'cut', toState: 'positioned' }],
        view: {
          cameraPresetId: null,
          highlightPartIds: ['part.wall.backing'],
          hiddenPartIds: [],
          recipe: {},
        },
        parameters: {
          datumNote: 'Band centre 1066.8 mm above the finished floor; face flush with the stud.',
          fromPartId: 'part.wall.stud-1',
          offsetsMm: [0, 0, 1066.8],
          toolId: 'tool.level',
        },
      },
      {
        id: 'op.fasten-backing',
        kind: 'fasten',
        title: 'Fasten the backing band (held)',
        targetPartIds: ['part.wall.backing'],
        dependencyOperationIds: ['op.position-backing'],
        citationIds: ['cite.sheet.b', 'cite.private.note'],
        declaredReleaseStatus: 'held',
        effectiveReleaseStatus: 'held',
        releaseId: 'release.held',
        holdReason: FASTEN_HOLD_REASON,
        preconditions: ['Backing band positioned; the connection detail is not released.'],
        qualityChecks: [
          { instruction: FASTEN_QUALITY_CHECK, evidenceRequired: 'photo' },
        ],
        stopConditions: [FASTEN_STOP_CONDITION],
        stateEffects: [{ partId: 'part.wall.backing', fromState: 'positioned', toState: 'installed' }],
        view: {
          cameraPresetId: null,
          highlightPartIds: ['part.wall.backing'],
          hiddenPartIds: [],
          recipe: { showFastenerPoints: { connectionId: 'conn.backing-held', proposed: true } },
        },
        parameters: {
          connectionIds: ['conn.backing-held'],
          pointsMm: null,
          proposed: true,
          toolId: null,
        },
      },
      {
        id: 'op.inspect-backing',
        kind: 'inspect',
        title: 'Inspect backing band flushness',
        targetPartIds: ['part.wall.backing'],
        dependencyOperationIds: ['op.fasten-backing'],
        citationIds: ['cite.sheet.a'],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'held',
        releaseId: 'release.demo',
        qualityChecks: [],
        stopConditions: [],
        stateEffects: [],
        view: { cameraPresetId: null, highlightPartIds: [], hiddenPartIds: [], recipe: {} },
        parameters: {
          inspectWhat: 'Backing band face flushness',
          criteria: 'Face within 1.5 mm of the stud faces.',
          evidenceRequired: 'field_measurement_or_photo',
        },
      },
      {
        id: 'op.route-cable',
        kind: 'route',
        title: 'Route the schematic cable',
        targetPartIds: ['part.demo.cable'],
        dependencyOperationIds: ['op.survey-wall'],
        citationIds: ['cite.sheet.a'],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        releaseId: 'release.demo',
        qualityChecks: [],
        stopConditions: ['Do not energize; this is a schematic demonstration only.'],
        stateEffects: [{ partId: 'part.demo.cable', fromState: 'absent', toState: 'installed' }],
        view: { cameraPresetId: null, highlightPartIds: [], hiddenPartIds: [], recipe: {} },
        parameters: {
          systemId: 'system.demo',
          circuitId: 'circuit.demo',
          pathPointsMm: [
            [100, 100, 1400],
            [900, 100, 1400],
          ],
          conductorLabel: 'schematic',
          demonstrationOnly: true,
        },
      },
    ],
    steps: [
      {
        id: 'step.survey-wall',
        sequence: 10,
        title: 'Survey the wall',
        phaseLabel: PHASE_WALL_FRAME,
        prerequisiteStepIds: [],
        operationIds: ['op.survey-wall'],
        visibleAssemblyIds: ['assembly.wall'],
        toolIds: [],
        qualityChecks: [],
        stopConditions: [],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        citationIds: ['cite.sheet.a'],
      },
      {
        id: 'step.prepare-backing',
        sequence: 20,
        title: 'Prepare the backing materials',
        phaseLabel: PHASE_CABINET_BACKING,
        prerequisiteStepIds: ['step.survey-wall'],
        operationIds: ['op.prepare-backing'],
        visibleAssemblyIds: ['assembly.wall'],
        toolIds: ['tool.level', 'tool.driver'],
        qualityChecks: [],
        stopConditions: [],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        citationIds: ['cite.sheet.a'],
      },
      {
        id: 'step.cut-backing',
        sequence: 30,
        title: 'Cut the backing and cover parts',
        phaseLabel: PHASE_CABINET_BACKING,
        prerequisiteStepIds: ['step.prepare-backing'],
        operationIds: ['op.cut-backing'],
        visibleAssemblyIds: ['assembly.wall'],
        toolIds: [],
        qualityChecks: [],
        stopConditions: [],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        citationIds: ['cite.sheet.a'],
      },
      {
        id: 'step.position-backing',
        sequence: 40,
        title: 'Position the backing band',
        phaseLabel: PHASE_CABINET_BACKING,
        prerequisiteStepIds: ['step.cut-backing'],
        operationIds: ['op.position-backing'],
        visibleAssemblyIds: ['assembly.wall'],
        toolIds: ['tool.level'],
        qualityChecks: [
          { instruction: 'Confirm the band is level before fastening.', evidenceRequired: 'visual' },
        ],
        stopConditions: [],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'conditional',
        citationIds: ['cite.sheet.a'],
      },
      {
        id: 'step.fasten-backing',
        sequence: 50,
        phaseLabel: PHASE_CABINET_BACKING,
        title: 'Fasten the backing band (held)',
        prerequisiteStepIds: ['step.position-backing'],
        operationIds: ['op.fasten-backing'],
        visibleAssemblyIds: ['assembly.wall'],
        toolIds: ['tool.driver'],
        qualityChecks: [],
        stopConditions: [],
        declaredReleaseStatus: 'held',
        effectiveReleaseStatus: 'held',
        citationIds: ['cite.sheet.b'],
      },
      {
        id: 'step.inspect-backing',
        sequence: 60,
        title: 'Inspect the backing band',
        phaseLabel: PHASE_CABINET_BACKING,
        prerequisiteStepIds: ['step.fasten-backing'],
        operationIds: ['op.inspect-backing'],
        visibleAssemblyIds: ['assembly.wall'],
        toolIds: [],
        qualityChecks: [],
        stopConditions: [],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'held',
        citationIds: ['cite.sheet.a'],
      },
      {
        id: 'step.route-cable',
        sequence: 70,
        title: 'Route the schematic cable',
        phaseLabel: PHASE_SERVICES_FINISH,
        prerequisiteStepIds: ['step.survey-wall'],
        operationIds: ['op.route-cable'],
        visibleAssemblyIds: ['assembly.demo'],
        toolIds: [],
        qualityChecks: [],
        stopConditions: [],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        citationIds: ['cite.sheet.a'],
      },
    ],
    views,
    issues,
    overlays,
    stepStates,
    stats: {
      partCount: parts.length,
      selectablePartCount: parts.length,
      takeoffPartCount: parts.length,
      operationCount: 7,
      stepCount: stepStates.length,
      readyOperationCount: 4,
      conditionalOperationCount: 1,
      heldOperationCount: 2,
      openIssueCount: 1,
      overlayCount: overlays.length,
      sourceCount: sources.length,
    },
    idMap: {
      version: '0.1.0',
      parts: parts.map((part) => ({
        partId: part.id,
        ifcGlobalId: part.ifcGlobalId,
        ifcClass: part.ifcClass,
      })),
    },
  };
}

const FIXTURE: CompiledGuide = makeFixture();

/** Fresh deep copy of the hand-written fixture (safe to hand to code under test). */
export function createFixture(): CompiledGuide {
  return structuredClone(FIXTURE);
}

/**
 * The fasten step with every parameter released: held wording must disappear and the released
 * quantity/pattern may be shown.
 */
export function createReleasedFastenFixture(): CompiledGuide {
  const guide = createFixture();
  const operation = guide.operations.find((candidate) => candidate.id === 'op.fasten-backing');
  if (!operation || operation.kind !== 'fasten') throw new Error('fixture: fasten operation missing');
  operation.declaredReleaseStatus = 'ready';
  operation.effectiveReleaseStatus = 'ready';
  operation.holdReason = undefined;
  operation.releaseId = 'release.demo';
  operation.parameters.connectionIds = ['conn.backing-released'];
  operation.stopConditions = [];
  const step = guide.steps.find((candidate) => candidate.id === 'step.fasten-backing');
  if (!step) throw new Error('fixture: fasten step missing');
  step.declaredReleaseStatus = 'ready';
  step.effectiveReleaseStatus = 'ready';
  step.title = 'Fasten the backing band';
  const stepState = guide.stepStates.find((candidate) => candidate.stepId === 'step.fasten-backing');
  if (!stepState) throw new Error('fixture: fasten step state missing');
  stepState.status = 'ready';
  stepState.applied = true;
  stepState.reason = null;
  return guide;
}

export const CATALOG_ENTRY: CatalogEntry = {
  slug: 'ui-fixture',
  title: 'UI Fixture Project (test)',
  summary: 'Synthetic plan used by guide-ui unit tests only.',
  projectType: 'fixture_demo',
  scope: 'concept',
  revision: '0.1.0',
  updated: '2026-09-29',
  releaseId: FIXTURE_RELEASE_ID,
  contentHash: `sha256:${'b'.repeat(64)}`,
  thumbnailPath: `releases/ui-fixture/${FIXTURE_RELEASE_ID}/assets/thumbnails/ui-fixture.svg`,
  route: `/plans/ui-fixture/releases/${FIXTURE_RELEASE_ID}`,
  statusSummary: { ready: 4, conditional: 1, held: 2, superseded: 0 },
  openIssueCount: 1,
};

export function createCatalogEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return { ...CATALOG_ENTRY, ...overrides };
}

export function createSecondCatalogEntry(): CatalogEntry {
  return createCatalogEntry({
    slug: 'second-plan',
    title: 'Second Plan (test)',
    summary: 'A second catalogue entry used for filter tests.',
    projectType: 'cabinet',
    scope: 'build_guide',
    revision: '2.0.0',
    releaseId: `sha256:${'c'.repeat(64)}`,
    statusSummary: { ready: 9, conditional: 0, held: 0, superseded: 0 },
    openIssueCount: 0,
  });
}

export function createCatalog(entries: CatalogEntry[] = [createCatalogEntry()]): CatalogData {
  return {
    catalogVersion: 1,
    generatedBy: { name: 'guide-ui-test-fixture', version: '0.1.0' },
    entries,
  };
}
