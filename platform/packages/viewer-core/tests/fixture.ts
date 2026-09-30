/**
 * Hand-written CompiledGuide fixture for viewer-core tests. It is intentionally self-contained
 * (no dependency on the compiler worker's output) and small enough to reason about by hand:
 *
 *   step 0 survey (applied)            wall existing, brace existing
 *   step 1 remove brace (applied)      brace removed
 *   step 2 position backing (applied)  backing positioned, wall hidden by the step view
 *   step 3 fasten backing (HELD)       preview only: backing stays positioned, fastener point proposed
 *   step 4 route + cover (applied)     drywall covered, backing covered
 */
import type {
  Bounds,
  Citation,
  CompiledGuide,
  Datum,
  FastenerSpec,
  Mat4,
  Material,
  Measurement,
  OverlayObject,
  Part,
  PartState,
  PartStateEntry,
  Project,
  SourceRef,
  Tool,
  ViewPreset,
  System,
} from '@diyguide/schema';

function mat(tx = 0, ty = 0, tz = 0): Mat4 {
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
  role: Part['role'];
  trade: Part['trade'];
  stage: Part['stage'];
  initialState: PartState;
  sizeMm: [number, number, number];
  centerMm: [number, number, number];
  assemblyId?: string;
}

function makePart(input: PartInput): Part & { worldTransform: Mat4; boundsMm: Bounds } {
  return {
    id: input.id,
    name: input.name,
    kind: 'linear_member',
    role: input.role,
    assemblyId: input.assemblyId ?? 'asm.wall',
    trade: input.trade,
    stage: input.stage,
    ifcClass: 'IfcBuildingElementProxy',
    ifcGlobalId: '0000000000000000000000',
    materialId: null,
    description: `${input.name} (synthetic fixture)`,
    selectable: true,
    takeoff: { include: false },
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

function withStates(
  base: PartStateEntry[],
  changes: Record<string, PartState>,
): PartStateEntry[] {
  return base.map((row) => {
    const changed = changes[row.partId];
    return changed ? entry(row.partId, changed) : { ...row };
  });
}

function makeFixture(): CompiledGuide {
  const parts = [
    makePart({
      id: 'part.existing.wall',
      name: 'Existing wall',
      role: 'existing',
      trade: 'general',
      stage: 'existing',
      initialState: 'existing',
      sizeMm: [3000, 100, 2400],
      centerMm: [1500, 0, 1200],
    }),
    makePart({
      id: 'part.temp.brace',
      name: 'Temporary brace',
      role: 'removed',
      trade: 'framing',
      stage: 'demo',
      initialState: 'existing',
      sizeMm: [50, 50, 900],
      centerMm: [-150, 50, 450],
    }),
    makePart({
      id: 'part.stud.a',
      name: 'Stud A',
      role: 'installed',
      trade: 'framing',
      stage: 'rough',
      initialState: 'absent',
      sizeMm: [38, 89, 2200],
      centerMm: [1000, 0, 1100],
    }),
    makePart({
      id: 'part.backing',
      name: 'Backing block',
      role: 'installed',
      trade: 'framing',
      stage: 'rough',
      initialState: 'absent',
      sizeMm: [89, 38, 700],
      centerMm: [1000, 50, 900],
    }),
    makePart({
      id: 'part.drywall',
      name: 'Drywall panel',
      role: 'installed',
      trade: 'drywall',
      stage: 'cover',
      initialState: 'absent',
      sizeMm: [2400, 12.7, 2400],
      centerMm: [1200, 25, 1200],
    }),
    makePart({
      id: 'part.cabinet',
      name: 'Cabinet envelope',
      role: 'installed',
      trade: 'cabinetry',
      stage: 'fixture',
      initialState: 'absent',
      sizeMm: [600, 600, 900],
      centerMm: [2500, 350, 450],
      assemblyId: 'asm.cabinet',
    }),
  ];

  const s0: PartStateEntry[] = [
    entry('part.existing.wall', 'existing'),
    entry('part.temp.brace', 'existing'),
    entry('part.stud.a', 'absent'),
    entry('part.backing', 'absent'),
    entry('part.drywall', 'absent'),
    entry('part.cabinet', 'absent'),
  ];
  const s1 = withStates(s0, { 'part.temp.brace': 'removed' });
  const s2 = withStates(s1, { 'part.backing': 'positioned' });
  const s3 = withStates(s2, {
    'part.backing': 'covered',
    'part.drywall': 'covered',
  });

  const overlays: OverlayObject[] = [
    {
      id: 'overlay.fasten-backing.p1',
      kind: 'fastener_point',
      operationId: 'op.fasten-backing',
      partId: 'part.backing',
      toolId: null,
      positionMm: [1000, 69, 900],
      pathPointsMm: null,
      radiusMm: null,
      state: 'proposed',
      label: 'Proposed fastener',
      inTakeoff: false,
    },
    {
      id: 'overlay.route.cable',
      kind: 'route_path',
      operationId: 'op.route-cable',
      partId: 'part.drywall',
      toolId: null,
      positionMm: null,
      pathPointsMm: [
        [0, 0, 300],
        [2200, 0, 300],
      ],
      radiusMm: 10,
      state: 'released',
      label: 'Cable route (schematic)',
      inTakeoff: false,
    },
    {
      id: 'overlay.tool.drill',
      kind: 'tool_proxy',
      operationId: 'op.position-backing',
      partId: 'part.backing',
      toolId: 'tool.driver',
      positionMm: [1000, 50, 900],
      pathPointsMm: null,
      radiusMm: null,
      state: 'released',
      label: 'Driver proxy',
      inTakeoff: false,
    },
    {
      id: 'overlay.dimension.1',
      kind: 'dimension',
      operationId: 'op.survey',
      partId: null,
      toolId: null,
      positionMm: [0, 0, 0],
      pathPointsMm: null,
      radiusMm: null,
      state: 'released',
      label: 'Opening width dimension',
      inTakeoff: false,
    },
  ];

  const project: Project = {
    slug: 'viewer-fixture',
    title: 'Viewer fixture (synthetic)',
    projectType: 'fixture_demo',
    description: 'Hand-written CompiledGuide fixture for viewer-core tests.',
    jurisdiction: 'CA-ON (synthetic)',
    coordinateContract: {
      handedness: 'right',
      upAxis: 'Z',
      lengthUnit: 'mm',
      description: 'Z-up mm, origin at the wall datum',
    },
    display: { unit: 'mm', precisionIn: 0.1 },
    releases: [
      {
        id: 'release.fixture',
        state: 'ready',
        scope: 'demonstration_only',
        issuer: 'fixture',
        issuedDate: '2026-09-29',
        notes: 'Synthetic P0 fixture',
      },
    ],
  };

  const datums: Datum[] = [
    {
      id: 'datum.floor',
      name: 'Finished floor',
      description: 'Top of finished floor',
      originMm: [0, 0, 0],
    },
  ];

  const sources: SourceRef[] = [
    {
      id: 'source.fixture-sheet',
      kind: 'fixture_sheet',
      title: 'Fixture sheet A',
      authority: 'fixture',
      privacy: 'public',
      assetPath: 'assets/source-pages/fixture-sheet-a.svg',
    },
  ];

  const citations: Citation[] = [
    {
      id: 'cite.fixture-sheet',
      sourceId: 'source.fixture-sheet',
      label: 'Fixture sheet A',
      kind: 'page',
      excerpt: 'Synthetic fixture citation',
    },
  ];

  const measurements: Measurement[] = [
    {
      id: 'measure.opening-width',
      label: 'Opening width',
      original: { display: '36 in', value: '36', unit: 'in' },
      canonicalMm: '914.4',
      installationToleranceMm: null,
      evidenceStatus: 'document_verified',
      declaredReleaseStatus: 'ready',
      citationIds: ['cite.fixture-sheet'],
    },
  ];

  const materials: Material[] = [
    {
      id: 'mat.screw',
      name: '#8 construction screw',
      category: 'fastener',
      sizeLabel: '#8 x 63 mm',
      actualSizeMm: null,
      unit: 'each',
      quantityProposed: 8,
      spareQuantity: 2,
      citationIds: [],
    },
  ];

  const tools: Tool[] = [
    { id: 'tool.saw', name: 'Circular saw', category: 'cutting', setup: null, citationIds: [] },
    { id: 'tool.driver', name: 'Impact driver', category: 'driving', setup: null, citationIds: [] },
  ];

  const systems: System[] = [
    {
      id: 'system.electrical',
      name: 'Lighting circuit (schematic)',
      kind: 'electrical',
      energized: false,
      description: 'Demonstration-only routing schematic',
      circuits: [
        {
          id: 'circuit.lighting',
          label: 'Lighting',
          conductorLabel: 'NMD90 14/2',
          citationIds: [],
        },
      ],
      citationIds: [],
    },
  ];

  const fastenerSpecs: FastenerSpec[] = [
    {
      id: 'spec.construction-screw',
      name: '#8 construction screw',
      description: 'Fixture fastener',
      lengthMm: 63,
      citationIds: [],
    },
  ];

  const views: ViewPreset[] = [
    {
      id: 'view.iso',
      name: 'Isometric',
      kind: 'iso',
      camera: {
        positionMm: [2000, -2000, 1800],
        targetMm: [500, 0, 1000],
        upMm: [0, 0, 1],
        fov: 50,
      },
      description: 'Fixture isometric',
    },
    {
      id: 'view.fasten',
      name: 'Fasten closeup',
      kind: 'closeup',
      camera: {
        positionMm: [1600, -600, 1100],
        targetMm: [1000, 50, 900],
        fov: 35,
      },
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
      compiler: { name: 'fixture', version: '0.1.0' },
      acceptanceStatus: 'pending',
    },
    project,
    datums,
    sources,
    citations,
    measurements,
    assemblies: [
      { id: 'asm.wall', name: 'Demo wall', parentId: null, trade: 'framing', stage: 'rough' },
      {
        id: 'asm.cabinet',
        name: 'Cabinet envelope assembly',
        parentId: null,
        trade: 'cabinetry',
        stage: 'fixture',
      },
    ],
    parts,
    materials,
    tools,
    systems,
    connections: [
      {
        id: 'conn.backing-stud',
        fromPartId: 'part.backing',
        toPartId: 'part.stud.a',
        method: 'screw',
        fastenerSpecId: 'spec.construction-screw',
        pattern: {
          type: 'line',
          count: 2,
          spacingMm: null,
          startOffsetMm: null,
          endOffsetMm: null,
          edgeDistanceMm: null,
        },
        pilotHole: { required: true, diameterMm: 3.2, depthMm: null },
        toolSetup: 'tool.driver',
        declaredReleaseStatus: 'held',
        holdReason: 'Fastener pattern unresolved in the fixture',
        citationIds: [],
        proposedPointsMm: null,
        effectiveReleaseStatus: 'held',
      },
    ],
    fastenerSpecs,
    operations: [
      {
        id: 'op.survey',
        kind: 'survey',
        title: 'Survey datum',
        targetPartIds: ['part.existing.wall'],
        dependencyOperationIds: [],
        citationIds: ['cite.fixture-sheet'],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        stateEffects: [],
        view: {
          cameraPresetId: 'view.iso',
          highlightPartIds: ['part.existing.wall'],
          hiddenPartIds: [],
          recipe: {},
        },
        parameters: {
          measurementIds: ['measure.opening-width'],
          checkInstruction: 'Confirm the datum lines before layout.',
        },
      },
      {
        id: 'op.remove-brace',
        kind: 'remove',
        title: 'Remove temporary brace',
        targetPartIds: ['part.temp.brace'],
        dependencyOperationIds: ['op.survey'],
        citationIds: [],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        stateEffects: [{ partId: 'part.temp.brace', fromState: 'existing', toState: 'removed' }],
        view: {
          cameraPresetId: null,
          highlightPartIds: ['part.temp.brace'],
          hiddenPartIds: [],
          recipe: {},
        },
        parameters: { disposition: 'discard' },
      },
      {
        id: 'op.position-backing',
        kind: 'position',
        title: 'Position backing block',
        targetPartIds: ['part.backing'],
        dependencyOperationIds: ['op.remove-brace'],
        citationIds: [],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        stateEffects: [{ partId: 'part.backing', fromState: 'absent', toState: 'positioned' }],
        view: {
          cameraPresetId: 'view.fasten',
          highlightPartIds: ['part.backing'],
          hiddenPartIds: ['part.existing.wall'],
          recipe: {
            reveal: ['part.backing'],
            translateFrom: { partId: 'part.backing', offsetMm: [-250, 0, 0] },
          },
        },
        parameters: {
          datumNote: '50 mm off the wall face',
          fromPartId: 'part.existing.wall',
          offsetsMm: [0, 50, 0],
          toolId: null,
        },
      },
      {
        id: 'op.fasten-backing',
        kind: 'fasten',
        title: 'Fasten backing (held preview)',
        targetPartIds: ['part.backing'],
        dependencyOperationIds: ['op.position-backing'],
        citationIds: [],
        declaredReleaseStatus: 'held',
        effectiveReleaseStatus: 'held',
        holdReason: 'Fastener pattern unresolved in the fixture',
        stateEffects: [{ partId: 'part.backing', fromState: 'positioned', toState: 'installed' }],
        view: {
          cameraPresetId: 'view.fasten',
          highlightPartIds: ['part.backing'],
          hiddenPartIds: [],
          recipe: {
            showFastenerPoints: { connectionId: 'conn.backing-stud', proposed: true },
          },
        },
        parameters: {
          connectionIds: ['conn.backing-stud'],
          pointsMm: null,
          proposed: true,
          toolId: 'tool.driver',
        },
      },
      {
        id: 'op.route-cable',
        kind: 'route',
        title: 'Route cable (schematic)',
        targetPartIds: ['part.drywall'],
        dependencyOperationIds: ['op.fasten-backing'],
        citationIds: [],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        stateEffects: [],
        view: {
          cameraPresetId: null,
          highlightPartIds: [],
          hiddenPartIds: [],
          recipe: {
            cutaway: { enabled: false },
            routePath: { partId: 'part.drywall' },
          },
        },
        parameters: {
          systemId: 'system.electrical',
          circuitId: 'circuit.lighting',
          pathPointsMm: [
            [0, 0, 300],
            [2200, 0, 300],
          ],
          conductorLabel: 'NMD90 14/2',
          demonstrationOnly: true,
        },
      },
      {
        id: 'op.cover-drywall',
        kind: 'finish',
        title: 'Cover with drywall',
        targetPartIds: ['part.drywall', 'part.backing'],
        dependencyOperationIds: ['op.route-cable'],
        citationIds: [],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        stateEffects: [
          { partId: 'part.drywall', fromState: 'absent', toState: 'covered' },
          { partId: 'part.backing', fromState: 'positioned', toState: 'covered' },
        ],
        view: {
          cameraPresetId: null,
          highlightPartIds: [],
          hiddenPartIds: [],
          recipe: { cutaway: { enabled: true } },
        },
        parameters: { levelLabel: 'Level 3', passes: 2 },
      },
    ],
    steps: [
      {
        id: 'step.survey',
        sequence: 0,
        title: 'Survey',
        prerequisiteStepIds: [],
        operationIds: ['op.survey'],
        visibleAssemblyIds: ['asm.wall'],
        toolIds: [],
        qualityChecks: [],
        stopConditions: [],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        citationIds: [],
      },
      {
        id: 'step.remove-brace',
        sequence: 1,
        title: 'Remove temporary brace',
        prerequisiteStepIds: ['step.survey'],
        operationIds: ['op.remove-brace'],
        visibleAssemblyIds: ['asm.wall'],
        toolIds: ['tool.saw'],
        qualityChecks: [],
        stopConditions: [],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        citationIds: [],
      },
      {
        id: 'step.position-backing',
        sequence: 2,
        title: 'Position backing block',
        prerequisiteStepIds: ['step.remove-brace'],
        operationIds: ['op.position-backing'],
        visibleAssemblyIds: ['asm.wall'],
        toolIds: ['tool.driver'],
        qualityChecks: [],
        stopConditions: [],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        citationIds: [],
      },
      {
        id: 'step.fasten-backing',
        sequence: 3,
        title: 'Fasten backing (held preview)',
        prerequisiteStepIds: ['step.position-backing'],
        operationIds: ['op.fasten-backing'],
        visibleAssemblyIds: ['asm.wall'],
        toolIds: ['tool.driver'],
        qualityChecks: [],
        stopConditions: [],
        declaredReleaseStatus: 'held',
        effectiveReleaseStatus: 'held',
        citationIds: [],
      },
      {
        id: 'step.cover',
        sequence: 4,
        title: 'Route cable and cover',
        prerequisiteStepIds: ['step.fasten-backing'],
        operationIds: ['op.route-cable', 'op.cover-drywall'],
        visibleAssemblyIds: ['asm.wall'],
        toolIds: [],
        qualityChecks: [],
        stopConditions: [],
        declaredReleaseStatus: 'ready',
        effectiveReleaseStatus: 'ready',
        citationIds: [],
      },
    ],
    views,
    issues: [],
    overlays,
    stepStates: [
      {
        index: 0,
        stepId: 'step.survey',
        status: 'ready',
        applied: true,
        reason: null,
        before: s0.map((row) => ({ ...row })),
        after: s0.map((row) => ({ ...row })),
        overlayIds: [],
      },
      {
        index: 1,
        stepId: 'step.remove-brace',
        status: 'ready',
        applied: true,
        reason: null,
        before: s0.map((row) => ({ ...row })),
        after: s1.map((row) => ({ ...row })),
        overlayIds: [],
      },
      {
        index: 2,
        stepId: 'step.position-backing',
        status: 'ready',
        applied: true,
        reason: null,
        before: s1.map((row) => ({ ...row })),
        after: s2.map((row) => ({ ...row })),
        overlayIds: ['overlay.tool.drill'],
      },
      {
        index: 3,
        stepId: 'step.fasten-backing',
        status: 'held',
        applied: false,
        reason: 'Fastener pattern unresolved in the fixture',
        before: s2.map((row) => ({ ...row })),
        after: s2.map((row) => ({ ...row })),
        overlayIds: ['overlay.fasten-backing.p1'],
      },
      {
        index: 4,
        stepId: 'step.cover',
        status: 'ready',
        applied: true,
        reason: null,
        before: s2.map((row) => ({ ...row })),
        after: s3.map((row) => ({ ...row })),
        overlayIds: ['overlay.route.cable', 'overlay.dimension.1'],
      },
    ],
    stats: {
      partCount: parts.length,
      selectablePartCount: parts.length,
      takeoffPartCount: 0,
      operationCount: 6,
      stepCount: 5,
      readyOperationCount: 5,
      conditionalOperationCount: 0,
      heldOperationCount: 1,
      openIssueCount: 0,
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

export const PART_IDS = [
  'part.existing.wall',
  'part.temp.brace',
  'part.stud.a',
  'part.backing',
  'part.drywall',
  'part.cabinet',
] as const;
