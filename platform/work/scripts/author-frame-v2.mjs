/**
 * Owner correction phase: re-author the p0-fixture wall with conventional platform-framing
 * anatomy and an 18-step frame-first sequence. Deterministic: run from platform/ with
 *   npx tsx work/scripts/author-frame-v2.mjs
 * It rewrites the authored JSON files (never the compiled output) and prints a summary.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ifcGuidForPart } from '../../packages/compiler/src/guid.ts';

const dir = 'projects/p0-fixture/0.1.0/';
const read = (file) => JSON.parse(readFileSync(dir + file, 'utf8'));
const write = (file, value) => writeFileSync(dir + file, JSON.stringify(value, null, 2) + '\n');

const T = 38.1; // member thickness (1.5 in)
const D = 88.9; // member depth (3.5 in)
const WALL_L = 2438.4; // 96 in
const WALL_H = 2438.4; // 96 in
const PLATE_T = 38.1;
const STUD_L = WALL_H - 2 * PLATE_T; // 2362.2
const OPEN_X0 = 1244.6; // clear opening left (49 in)
const OPEN_W = 952.5; // 37.5 in (conflicted measurement value)
const OPEN_X1 = OPEN_X0 + OPEN_W; // 2197.1
const SILL_TOP = PLATE_T; // 38.1
const JACK_L = 2032; // 80 in
const HEAD_BOTTOM = SILL_TOP + JACK_L; // 2070.1
const HEAD_L = 1104.9; // 43.5 in (king outer to king outer)
const HEAD_D = 139.7; // 2x6
const CRIPPLE_L = WALL_H - PLATE_T - HEAD_BOTTOM - HEAD_D; // 190.5 (7.5 in)
const STUD2_X = 679.45; // 26.75 in
const STUD3_X = 2419.35; // 95.25 in (end stud, flush)
const KING_L_X = OPEN_X0 - T - T / 2; // 1187.45
const KING_R_X = OPEN_X1 + T + T / 2; // 2254.25
const JACK_L_X = OPEN_X0 - T / 2; // 1225.55
const JACK_R_X = OPEN_X1 + T / 2; // 2216.15
const CRIPPLE_1_X = 1562.1; // 61.5 in
const CRIPPLE_2_X = 1879.6; // 74 in
const BLOCK_A_X0 = 57.15 + T / 2; // stud-1 right edge 76.2
const BLOCK_A_X1 = STUD2_X - T / 2; // 660.4
const BLOCK_B_X0 = STUD2_X + T / 2; // 698.5
const BLOCK_B_X1 = KING_L_X - T / 2; // 1168.4
const BLOCK_Z_C = 1066.8; // 42 in
const BLOCK_W = 139.7; // 2x6 flat
const Y_MID = D / 2; // 44.45
const ANCHORS = [152.4, 762, 1371.6, 1981.2]; // 609.6 o.c., 6 in from the end

const yFront = D; // interior-side face in the wall-local frame (y = 88.9)
const worldY = (localY) => 82 + localY;

// ---------------------------------------------------------------- parts
const part = (id, name, kind, role, trade, stage, ifcClass, sizeMm, centreMm, initialState, extra = {}) => ({
  id,
  name,
  kind,
  role,
  assemblyId: extra.assemblyId ?? 'assembly.wall-a',
  trade,
  stage,
  ifcClass,
  ifcGlobalId: ifcGuidForPart(id),
  materialId: extra.materialId ?? null,
  description: extra.description ?? `${name} — synthetic demonstration framing member.`,
  selectable: true,
  ...(extra.takeoff ? { takeoff: extra.takeoff } : {}),
  ...(extra.placement ? { placement: extra.placement } : { placement: { translationMm: centreMm } }),
  initialState,
  geometry: { shape: 'box', sizeMm },
});

const member = (id, name, x, z, length, initialState, extra = {}) =>
  part(id, name, 'linear_member', 'installed', 'framing', 'rough', extra.ifcClass ?? 'IfcMember',
    [length, D, T].map(Number), [x, Y_MID, z].map(Number), initialState, extra);

const plate = (id, name, x, length, initialState, extra = {}) =>
  part(id, name, 'linear_member', 'installed', 'framing', 'rough', 'IfcPlate',
    [length, D, PLATE_T].map(Number), [x, Y_MID, PLATE_T / 2].map(Number), initialState, extra);

const parts = [
  part('part.existing.slab', 'Existing slab', 'panel', 'existing', 'general', 'existing', 'IfcSlab',
    [3200, 2400, 100], [1600, 1200, -50], 'existing', {
      assemblyId: 'assembly.existing',
      description: 'Existing concrete surface used as the demonstration floor.',
      takeoff: { include: true },
    }),

  plate('part.wall-a.bottom-plate-left', 'Bottom plate (left of opening)', (0 + OPEN_X0) / 2, OPEN_X0, 'absent', {
    description: 'Bottom plate segment between the wall end and the door opening jack.',
    materialId: 'material.lumber.plate',
  }),
  plate('part.wall-a.sole-plate-infill', 'Sole plate in the door opening (temporary)', (OPEN_X0 + OPEN_X1) / 2, OPEN_W, 'absent', {
    description: 'Temporary sole-plate segment across the door opening; cut out after the frame is anchored.',
    materialId: 'material.lumber.plate',
  }),
  plate('part.wall-a.bottom-plate-right', 'Bottom plate (right of opening)', (OPEN_X1 + WALL_L) / 2, WALL_L - OPEN_X1, 'absent', {
    description: 'Bottom plate segment between the door opening and the wall end.',
    materialId: 'material.lumber.plate',
  }),
  plate('part.wall-a.top-plate', 'Top plate', WALL_L / 2, WALL_L, 'absent', {
    description: 'Single top plate (the documented synthetic assembly uses one top plate).',
    materialId: 'material.lumber.plate',
  }),

  member('part.wall-a.stud-1', 'Stud 1 (left end)', 57.15, STUD_L / 2 + PLATE_T, STUD_L, 'absent', {
    materialId: 'material.lumber.stud',
  }),
  member('part.wall-a.stud-2', 'Stud 2 (common)', STUD2_X, STUD_L / 2 + PLATE_T, STUD_L, 'absent', {
    materialId: 'material.lumber.stud',
  }),
  member('part.wall-a.stud-3', 'Stud 3 (right end, flush)', STUD3_X, STUD_L / 2 + PLATE_T, STUD_L, 'absent', {
    materialId: 'material.lumber.stud',
  }),
  member('part.wall-a.king-left', 'King stud (left of opening)', KING_L_X, STUD_L / 2 + PLATE_T, STUD_L, 'absent', {
    materialId: 'material.lumber.stud',
  }),
  member('part.wall-a.king-right', 'King stud (right of opening)', KING_R_X, STUD_L / 2 + PLATE_T, STUD_L, 'absent', {
    materialId: 'material.lumber.stud',
  }),
  member('part.wall-a.jack-left', 'Jack (trimmer) stud (left)', JACK_L_X, SILL_TOP + JACK_L / 2, JACK_L, 'absent', {
    materialId: 'material.lumber.stud',
    description: 'Jack stud carrying the left end of the door header.',
  }),
  member('part.wall-a.jack-right', 'Jack (trimmer) stud (right)', JACK_R_X, SILL_TOP + JACK_L / 2, JACK_L, 'absent', {
    materialId: 'material.lumber.stud',
    description: 'Jack stud carrying the right end of the door header.',
  }),
  member('part.wall-a.header', 'Door header (2x6)', (KING_L_X - T / 2 + KING_R_X + T / 2) / 2,
    HEAD_BOTTOM + HEAD_D / 2, HEAD_L, 'absent', {
      ifcClass: 'IfcBeam',
      materialId: 'material.lumber.header',
      description: 'Single 2x6 header bearing on both jack studs (synthetic, non-structural demonstration).',
    }),
  member('part.wall-a.cripple-1', 'Cripple stud above header 1', CRIPPLE_1_X, HEAD_BOTTOM + HEAD_D + CRIPPLE_L / 2, CRIPPLE_L, 'absent', {
    materialId: 'material.lumber.stud',
    description: 'Cripple stud between the header and the top plate.',
  }),
  member('part.wall-a.cripple-2', 'Cripple stud above header 2', CRIPPLE_2_X, HEAD_BOTTOM + HEAD_D + CRIPPLE_L / 2, CRIPPLE_L, 'absent', {
    materialId: 'material.lumber.stud',
    description: 'Cripple stud between the header and the top plate.',
  }),

  part('part.wall-a.opening', 'Door rough opening (void)', 'opening', 'clearance', 'framing', 'rough', 'IfcOpeningElement',
    [OPEN_W, D, JACK_L].map(Number), [(OPEN_X0 + OPEN_X1) / 2, Y_MID, SILL_TOP + JACK_L / 2].map(Number), 'absent', {
      description: 'Clear door rough opening between the jack studs, under the header. A semantic void, never a solid.',
      takeoff: { include: false, note: 'void, excluded from takeoff' },
    }),

  part('part.wall-a.backing-a', 'Cabinet backing block A (2x6 flat)', 'linear_member', 'installed', 'framing', 'rough', 'IfcPlate',
    [BLOCK_A_X1 - BLOCK_A_X0, T, BLOCK_W].map(Number), [(BLOCK_A_X0 + BLOCK_A_X1) / 2, -T / 2, BLOCK_Z_C].map(Number), 'absent', {
      materialId: 'material.lumber.block',
      description: 'Backing block fitted in the stud bay between stud 1 and stud 2.',
    }),
  part('part.wall-a.backing-b', 'Cabinet backing block B (2x6 flat)', 'linear_member', 'installed', 'framing', 'rough', 'IfcPlate',
    [BLOCK_B_X1 - BLOCK_B_X0, T, BLOCK_W].map(Number), [(BLOCK_B_X0 + BLOCK_B_X1) / 2, -T / 2, BLOCK_Z_C].map(Number), 'absent', {
      materialId: 'material.lumber.block',
      description: 'Backing block fitted in the stud bay between stud 2 and the left king stud.',
    }),

  part('part.wall-a.cover-panel', 'Drywall cover panel', 'panel', 'installed', 'drywall', 'cover', 'IfcCovering',
    [1219.2, 12.7, WALL_H], [609.6, -6.35, WALL_H / 2], 'absent', {
      assemblyId: 'assembly.wall-a.cover',
      materialId: 'material.panel.drywall',
      description: '1/2 in gypsum panel covering the first half of the wall (demonstration).',
    }),
  part('part.cabinet.envelope', 'Cabinet envelope', 'fixture', 'installed', 'cabinetry', 'fixture', 'IfcFurniture',
    [609.6, 609.6, 812.8], [914.4, -235.5, 1320.8], 'absent', {
      assemblyId: 'assembly.cabinet',
      description: 'Wall cabinet envelope hung on the backing blocks (demonstration envelope).',
    }),

  part('part.demo.temp-panel', 'Temporary protection panel', 'panel', 'installed', 'general', 'demo', 'IfcBuildingElementProxy',
    [1219.2, 19.05, WALL_H], [609.6, -990.6, WALL_H / 2], 'installed', {
      assemblyId: 'assembly.demo',
      materialId: 'material.panel.temp',
      description: 'Reusable floor protection panel removed before cutting.',
    }),

  part('part.demo.temp-brace', 'Temporary wall brace', 'linear_member', 'installed', 'framing', 'rough', 'IfcMember',
    [1193.8, T, D].map(Number), [539.7, -T / 2, 619.05].map(Number), 'absent', {
      assemblyId: 'assembly.demo',
      materialId: 'material.lumber.brace',
      description: 'Temporary diagonal brace holding the raised frame plumb until the backing is fitted; removed after inspection.',
      placement: {
        translationMm: [539.7, -T / 2, 619.05].map(Number),
        rotationEulerDeg: [0, 0, 76.5],
      },
    }),

  part('part.demo.cable', 'Non-energized schematic cable', 'linear_member', 'schematic', 'electrical', 'rough', 'IfcCableSegment',
    [1, 1, 1], [0, 0, 0], 'absent', {
      assemblyId: 'assembly.demo',
      materialId: 'material.electrical.cable',
      description: 'Schematic non-energized cable route through the wall cavity.',
      takeoff: { include: true, note: 'schematic route length' },
      placement: { translationMm: [0, 0, 0] },
    }),
  part('part.demo.junction-box', 'Schematic junction box', 'fixture', 'schematic', 'electrical', 'rough', 'IfcJunctionBox',
    [101.6, 50.8, 101.6], [152.4, 120, 1651], 'absent', { assemblyId: 'assembly.demo' }),
  part('part.demo.terminal', 'Schematic terminal', 'fixture', 'schematic', 'electrical', 'rough', 'IfcOutlet',
    [76.2, 50.8, 114.3], [990.6, 120, 1727.2], 'absent', { assemblyId: 'assembly.demo' }),

  part('part.loose.angle-1', 'Loose angle bracket 1', 'connector', 'loose', 'framing', 'rough', 'IfcDiscreteAccessory',
    [88.9, 88.9, 31.75], [2900, -400, 15.875], 'existing', {
      assemblyId: 'assembly.demo',
      description: 'Demonstration loose part, not installed.',
      takeoff: { include: true, note: 'demonstration loose part (not installed)' },
    }),
  part('part.loose.angle-2', 'Loose angle bracket 2', 'connector', 'loose', 'framing', 'rough', 'IfcDiscreteAccessory',
    [88.9, 88.9, 31.75], [3060, -460, 15.875], 'existing', {
      assemblyId: 'assembly.demo',
      description: 'Demonstration loose part, not installed.',
      takeoff: { include: true, note: 'demonstration loose part (not installed)' },
    }),
  part('part.loose.angle-3', 'Loose angle bracket 3', 'connector', 'loose', 'framing', 'rough', 'IfcDiscreteAccessory',
    [88.9, 88.9, 31.75], [3220, -330, 15.875], 'existing', {
      assemblyId: 'assembly.demo',
      description: 'Demonstration loose part, not installed.',
      takeoff: { include: true, note: 'demonstration loose part (not installed)' },
    }),
];

// The schematic cable is a path part: replace its placeholder box with the authored route.
const cable = parts.find((candidate) => candidate.id === 'part.demo.cable');
delete cable.placement;
cable.placement = { translationMm: [0, 0, 0] };
cable.geometry = {
  shape: 'path',
  pointsMm: [
    [152.4, 120, 1651],
    [152.4, 120, 2159],
    [990.6, 120, 2159],
    [990.6, 120, 1727.2],
  ],
  radiusMm: 12.7,
};

write('parts.json', parts);

// ---------------------------------------------------------------- assemblies
const assemblies = read('assemblies.json');
const demo = assemblies.find((assembly) => assembly.id === 'assembly.demo');
demo.trade = 'general';
write('assemblies.json', assemblies);

// ---------------------------------------------------------------- measurements
const measurements = [
  ['measurement.wall-a.length', 'Wall A framed length', '96 in', '96', '2438.400', 'reported', 'ready', ['citation.sheet-a.wall-length']],
  ['measurement.wall-a.height', 'Wall A framed height', '8 ft', '8', '2438.400', 'document_verified', 'ready', ['citation.sheet-a.survey']],
  ['measurement.wall-a.opening.width', 'Door rough opening width', '37 1/2 in', '37 1/2', '952.500', 'conflicted', 'held', ['citation.sheet-a.opening', 'citation.field-note.opening']],
  ['measurement.opening.height', 'Door rough opening height', '81 1/2 in', '81 1/2', '2070.100', 'reported', 'ready', ['citation.sheet-d.cuts']],
  ['measurement.stud.length', 'Common and king stud length', '93 in', '93', '2362.200', 'reported', 'ready', ['citation.sheet-d.cuts']],
  ['measurement.jack.length', 'Jack (trimmer) stud length', '80 in', '80', '2032.000', 'reported', 'ready', ['citation.sheet-d.cuts']],
  ['measurement.header.length', 'Header length', '43 1/2 in', '43 1/2', '1104.900', 'reported', 'ready', ['citation.sheet-d.cuts']],
  ['measurement.cripple.length', 'Cripple stud length', '7 1/2 in', '7 1/2', '190.500', 'reported', 'ready', ['citation.sheet-d.cuts']],
  ['measurement.stud-1.centreline', 'Stud 1 centreline from wall origin', '2 1/4 in', '2 1/4', '57.150', 'reported', 'ready', ['citation.sheet-a.wall-length']],
  ['measurement.stud-2.centreline', 'Stud 2 centreline from wall origin', '26 3/4 in', '26 3/4', '679.450', 'reported', 'ready', ['citation.sheet-a.wall-length']],
  ['measurement.stud-3.centreline', 'Stud 3 (end) centreline from wall origin', '95 1/4 in', '95 1/4', '2419.350', 'reported', 'ready', ['citation.sheet-a.wall-length']],
  ['measurement.block-a.length', 'Backing block A length (stud 1 to stud 2 bay)', '23 in', '23', '584.200', 'derived', 'conditional', ['citation.sheet-b.band']],
  ['measurement.block-b.length', 'Backing block B length (stud 2 to king bay)', '18 1/2 in', '18 1/2', '469.900', 'derived', 'conditional', ['citation.sheet-b.band']],
  ['measurement.band.length', 'Backing band length (legacy review note)', '42 in', '42', '1066.800', 'candidate', 'superseded', ['citation.sheet-b.band']],
  ['measurement.cabinet.width', 'Cabinet envelope width', '24 in', '24', '609.600', 'reported', 'conditional', ['citation.sheet-a.cabinet']],
].map(([id, label, display, value, canonicalMm, evidenceStatus, declaredReleaseStatus, citationIds]) => ({
  id, label,
  original: { display, value, unit: 'in' },
  canonicalMm,
  installationToleranceMm: null,
  evidenceStatus,
  declaredReleaseStatus,
  citationIds,
}));
measurements.find((m) => m.id === 'measurement.wall-a.opening.width').conflictNote =
  'Sheet A dimension chain gives 952.5 mm (37 1/2 in) clear opening; field note 01 reports 965 mm to the finished face.';
write('measurements.json', measurements);

// ---------------------------------------------------------------- materials
const materials = [
  ['material.lumber.plate', '2x4x8 plate stock', 'lumber', 'each', 2, 'One board yields the three bottom-plate segments (1244.6 + 952.5 + 241.3 mm); the second board is the top plate.'],
  ['material.lumber.stud', '2x4x8 stud stock', 'lumber', 'each', 6, 'Five boards for the common and king studs; one board yields both jack studs (2 x 2032 mm).'],
  ['material.lumber.header', '2x6x8 header stock', 'lumber', 'each', 1, 'Single 2x6 header, 1104.9 mm (synthetic, non-structural demonstration).'],
  ['material.lumber.brace', '2x4x8 temporary brace', 'lumber', 'each', 1, 'Temporary brace fitted after raising; removed after inspection and stored.'],
  ['material.lumber.block', '2x6x8 backing block stock', 'lumber', 'each', 1, 'One board yields both backing blocks (584.2 + 469.9 mm).'],
  ['material.fastener.frame-screw', 'Synthetic structural screw 8 x 63 mm (demonstration)', 'fastener', 'each', 36, 'Two screws at each of the 18 frame joints (12 plate joints, 2 header joints, 4 cripple ends).'],
  ['material.fastener.frame-anchor', 'Synthetic mechanical anchor M10 x 100 mm (demonstration)', 'fastener', 'each', 4, 'Anchors at 609.6 mm on centre from 152.4 mm; pilot 10 mm x 60 mm (synthetic).'],
  ['material.panel.drywall', '1/2 in gypsum panel 4x8', 'panel', 'sheet', 1, 'Covers the first half of the wall in the demonstration.'],
  ['material.panel.temp', 'Temporary protection panel', 'panel', 'each', 1, 'Reused after removal.'],
  ['material.fastener.screw', 'Backing screw (specification withheld)', 'fastener', 'each', 8, 'Proposed only; the backing connection is held.'],
  ['material.electrical.cable', 'Schematic cable 14/2', 'electrical', 'm', 4, 'Non-energized demonstration route.'],
  ['material.fastener.angle', 'Loose angle bracket', 'fastener', 'each', 3, 'Demonstration loose parts, not installed.'],
].map(([id, name, category, unit, quantityProposed, notes]) => ({
  id, name, category,
  sizeLabel: id === 'material.lumber.header' ? '2x6x8' : category === 'lumber' ? '2x4x8' : null,
  actualSizeMm: null,
  unit,
  quantityProposed,
  spareQuantity: 0,
  notes,
  citationIds: ['citation.sheet-d.cuts'],
}));
write('materials.json', materials);

// ---------------------------------------------------------------- tools
const tools = read('tools.json');
if (!tools.some((tool) => tool.id === 'tool.square')) {
  tools.push({ id: 'tool.square', name: 'Framing square', category: 'measuring', setup: null, citationIds: ['citation.sheet-a.general'] });
}
write('tools.json', tools);

// ---------------------------------------------------------------- connections
const connections = {
  connections: [
    {
      id: 'connection.frame.plate-to-stud',
      fromPartId: 'part.wall-a.bottom-plate-left',
      toPartId: 'part.wall-a.stud-1',
      method: 'screw',
      fastenerSpecId: 'fastener.frame-screw',
      pattern: { type: 'line', count: 2, spacingMm: 80, edgeDistanceMm: 40 },
      pilotHole: null,
      toolSetup: 'Impact driver with the synthetic screw bit',
      declaredReleaseStatus: 'ready',
      holdReason: undefined,
      citationIds: ['citation.sheet-d.joints'],
      proposedPointsMm: null,
    },
    {
      id: 'connection.frame.plate-to-slab',
      fromPartId: 'part.wall-a.bottom-plate-left',
      toPartId: 'part.existing.slab',
      method: 'mechanical_anchor',
      fastenerSpecId: 'fastener.frame-anchor',
      pattern: { type: 'line', count: 4, spacingMm: 609.6, endOffsetMm: 152.4, edgeDistanceMm: 100 },
      pilotHole: { required: true, diameterMm: 10, depthMm: 60 },
      toolSetup: 'Hammer drill + torque wrench per the synthetic schedule',
      declaredReleaseStatus: 'ready',
      holdReason: undefined,
      citationIds: ['citation.sheet-d.anchors'],
      proposedPointsMm: null,
    },
    {
      id: 'connection.backing-a.stud-1',
      fromPartId: 'part.wall-a.backing-a',
      toPartId: 'part.wall-a.stud-1',
      method: 'screw',
      fastenerSpecId: null,
      pattern: null,
      pilotHole: null,
      toolSetup: null,
      declaredReleaseStatus: 'held',
      holdReason:
        'Backing fastener type, length, spacing and edge distance are not released for this synthetic fixture; the guide may only show proposed connection locations.',
      citationIds: ['citation.sheet-b.connection'],
      proposedPointsMm: [
        [57.15, 43.9, 1066.8],
        [679.45, 43.9, 1066.8],
      ],
    },
    {
      id: 'connection.backing-b.stud-2',
      fromPartId: 'part.wall-a.backing-b',
      toPartId: 'part.wall-a.stud-2',
      method: 'screw',
      fastenerSpecId: null,
      pattern: null,
      pilotHole: null,
      toolSetup: null,
      declaredReleaseStatus: 'held',
      holdReason:
        'Backing fastener type, length, spacing and edge distance are not released for this synthetic fixture; the guide may only show proposed connection locations.',
      citationIds: ['citation.sheet-b.connection'],
      proposedPointsMm: [
        [698.5, 43.9, 1066.8],
        [1168.4, 43.9, 1066.8],
      ],
    },
  ],
  fastenerSpecs: [
    {
      id: 'fastener.frame-screw',
      name: 'Synthetic structural screw 8 x 63 mm (demonstration)',
      description:
        'Two screws at every frame joint: 12 plate joints, 2 header-to-jack joints and 4 cripple ends (18 joints, 36 screws). Synthetic demonstration value only.',
      lengthMm: 63,
      citationIds: ['citation.sheet-d.joints'],
    },
    {
      id: 'fastener.frame-anchor',
      name: 'Synthetic mechanical anchor M10 x 100 mm (demonstration)',
      description:
        'Four anchors at 609.6 mm on centre starting 152.4 mm from the wall end, 10 mm x 60 mm pilot holes. Slab assumed sound for the demonstration.',
      lengthMm: 100,
      citationIds: ['citation.sheet-d.anchors'],
    },
  ],
};
// Remove the undefined holdReason key from released connections (JSON.stringify drops it anyway).
write('connections.json', connections);

console.log('parts', parts.length, '| measurements', measurements.length, '| materials', materials.length);
console.log('blocks', (BLOCK_A_X1 - BLOCK_A_X0).toFixed(1), (BLOCK_B_X1 - BLOCK_B_X0).toFixed(1));
console.log('projected cut list:', [OPEN_X0, WALL_L - OPEN_X1, OPEN_W, WALL_L, STUD_L, JACK_L, HEAD_L, CRIPPLE_L].map((n) => n.toFixed(1)).join(', '));
