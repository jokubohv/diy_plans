/**
 * Owner geometry correction (v3): credible documented synthetic header assembly, honest stock
 * yields with kerf, continuous sole plate cut after anchoring, permanent-segment anchors, correct
 * bracing semantics (in-plane racking brace + out-of-plane plumb prop), flush end studs and a
 * conventional stud module.
 *
 * Run from platform/ with: npx tsx work/scripts/author-frame-v3.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ifcGuidForPart } from '../../packages/compiler/src/guid.ts';

const dir = 'projects/p0-fixture/0.1.0/';
const read = (file) => JSON.parse(readFileSync(dir + file, 'utf8'));
const write = (file, value) => writeFileSync(dir + file, JSON.stringify(value, null, 2) + '\n');
const round = (n) => Number(n.toFixed(6));
const KERF = 3; // mm saw kerf allowance used by the yield notes and the yield test

// ---- geometry constants (wall-a local, mm) ----
const T = 38.1;
const D = 88.9;
const WALL_L = 2438.4;
const WALL_H = 2438.4;
const PLATE_T = 38.1;
const STUD_L = 2362.2; // 93 in
const OPEN_X0 = 1244.6; // 49 in
const OPEN_W = 952.5;
const OPEN_X1 = OPEN_X0 + OPEN_W;
const OPEN_H = 2070.1; // jack 2032 + plate
const JACK_L = 2032;
const HEAD_L = 1104.9; // 43.5 in
const HEAD_D = 139.7; // 2x6
const SPACER_T = 12.7; // 1/2 in plywood spacer to fill the 2x4 wall thickness
const HEAD_BOTTOM = OPEN_H;
const HEAD_TOP = HEAD_BOTTOM + HEAD_D; // 2209.8
const CRIPPLE_L = round(WALL_H - PLATE_T - HEAD_TOP); // 190.5
const STUD_FLUSH_L = 19.05; // flush end stud centre
const STUD_FLUSH_R = WALL_L - T / 2; // 2419.35
const STUD_16 = 406.4;
const STUD_32 = 812.8;
const KING_L = OPEN_X0 - T - T / 2; // 1187.45
const KING_R = OPEN_X1 + T + T / 2; // 2254.25
const JACK_L_X = OPEN_X0 - T / 2; // 1225.55
const JACK_R_X = OPEN_X1 + T / 2; // 2216.15
const CRIPPLE_1 = 1562.1; // 61.5 in
const CRIPPLE_2 = 1879.6; // 74 in
const BLOCK_A = { x0: STUD_16 + T / 2, x1: STUD_32 - T / 2 }; // 425.45 .. 793.75
const BLOCK_B = { x0: STUD_32 + T / 2, x1: KING_L - T / 2 }; // 831.85 .. 1168.4
const BLOCK_Z = 1066.8;
const Y_MID = D / 2;
const ORIGIN = 347; // wall assembly world x offset

// temporary bracing (world coordinates; assembly.demo is identity)
const RACKING = { lowerX: 500, upperX: ORIGIN + STUD_32, lowerZ: PLATE_T, upperZ: 1200, y: 82 - T / 2 };
const rackingLength = round(Math.hypot(RACKING.upperX - RACKING.lowerX, RACKING.upperZ - RACKING.lowerZ));
const rackingAngle = round(
  (-Math.atan2(RACKING.upperZ - RACKING.lowerZ, RACKING.upperX - RACKING.lowerX) * 180) / Math.PI,
);
const rackingCentre = [
  round((RACKING.lowerX + RACKING.upperX) / 2),
  round(RACKING.y),
  round((RACKING.lowerZ + RACKING.upperZ) / 2),
];
const PROP = { x: ORIGIN + STUD_16, topZ: 2350, topY: 82, floorY: -520 };
const propLength = round(Math.hypot(PROP.topY - PROP.floorY, PROP.topZ));
const propCentre = [round(PROP.x), round((PROP.topY + PROP.floorY) / 2), round(PROP.topZ / 2)];
const propAngle = round(
  (-Math.atan2(PROP.topY - PROP.floorY, PROP.topZ) * 180) / Math.PI,
);

// ---- parts ----
const box = (id, name, kind, role, trade, stage, ifcClass, sizeMm, centreMm, initialState, extra = {}) => ({
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
  takeoff: extra.takeoff ?? { include: true },
  placement: extra.placement ?? { translationMm: centreMm.map(round) },
  initialState,
  geometry: { shape: 'box', sizeMm: sizeMm.map(round) },
});

const vertical = (id, name, x, z, length, initialState, extra = {}) =>
  box(id, name, extra.kind ?? 'linear_member', 'installed', 'framing', 'rough', extra.ifcClass ?? 'IfcMember',
    [T, D, length], [x, Y_MID, z], initialState, extra);
const plate = (id, name, x, length, initialState, extra = {}) =>
  box(id, name, extra.kind ?? 'linear_member', 'installed', 'framing', 'rough', 'IfcPlate',
    [length, D, PLATE_T], [x, Y_MID, PLATE_T / 2], initialState, extra);

const parts = [
  box('part.existing.slab', 'Existing slab', 'panel', 'existing', 'general', 'existing', 'IfcSlab',
    [3200, 2400, 100], [1600, 1200, -50], 'existing', {
      assemblyId: 'assembly.existing',
      description: 'Existing concrete surface used as the demonstration floor.',
    }),

  // continuous sole plate; the doorway section is cut out after anchoring
  plate('part.wall-a.bottom-plate', 'Bottom plate (continuous sole plate)', WALL_L / 2, WALL_L, 'absent', {
    materialId: 'material.lumber.plate',
    description:
      'Continuous sole plate anchored to the slab; the doorway section between the jack studs is cut out after anchoring, leaving the two remaining segments.',
  }),
  // remaining segments after the doorway cut (post-cut representation, installed at that step)
  plate('part.wall-a.bottom-plate-left', 'Bottom plate, remaining left segment', (0 + OPEN_X0) / 2, OPEN_X0, 'absent', {
    materialId: 'material.lumber.plate',
    description: 'Remaining sole-plate segment left of the door opening after the cut-out.',
  }),
  plate('part.wall-a.bottom-plate-right', 'Bottom plate, remaining right segment', (OPEN_X1 + WALL_L) / 2, WALL_L - OPEN_X1, 'absent', {
    materialId: 'material.lumber.plate',
    description: 'Remaining sole-plate segment right of the door opening after the cut-out.',
  }),
  plate('part.wall-a.top-plate', 'Top plate (full length)', WALL_L / 2, WALL_L, 'absent', {
    materialId: 'material.lumber.plate',
    description: 'Single top plate used at full board length (documented synthetic choice).',
    placement: { translationMm: [WALL_L / 2, Y_MID, WALL_H - PLATE_T / 2] },
  }),

  vertical('part.wall-a.stud-1', 'Stud 1 (left end, flush)', STUD_FLUSH_L, STUD_L / 2 + PLATE_T, STUD_L, 'absent', { materialId: 'material.lumber.stud' }),
  vertical('part.wall-a.stud-2', 'Stud 2 (common, 16 in module)', STUD_16, STUD_L / 2 + PLATE_T, STUD_L, 'absent', { materialId: 'material.lumber.stud' }),
  vertical('part.wall-a.stud-3', 'Stud 3 (common, 32 in module)', STUD_32, STUD_L / 2 + PLATE_T, STUD_L, 'absent', { materialId: 'material.lumber.stud' }),
  vertical('part.wall-a.stud-4', 'Stud 4 (right end, flush)', STUD_FLUSH_R, STUD_L / 2 + PLATE_T, STUD_L, 'absent', { materialId: 'material.lumber.stud' }),
  vertical('part.wall-a.king-left', 'King stud (left of opening)', KING_L, STUD_L / 2 + PLATE_T, STUD_L, 'absent', { materialId: 'material.lumber.stud' }),
  vertical('part.wall-a.king-right', 'King stud (right of opening)', KING_R, STUD_L / 2 + PLATE_T, STUD_L, 'absent', { materialId: 'material.lumber.stud' }),
  vertical('part.wall-a.jack-left', 'Jack (trimmer) stud (left)', JACK_L_X, PLATE_T + JACK_L / 2, JACK_L, 'absent', {
    materialId: 'material.lumber.stud',
    description: 'Jack stud carrying the left end of the doubled header.',
  }),
  vertical('part.wall-a.jack-right', 'Jack (trimmer) stud (right)', JACK_R_X, PLATE_T + JACK_L / 2, JACK_L, 'absent', {
    materialId: 'material.lumber.stud',
    description: 'Jack stud carrying the right end of the doubled header.',
  }),
  // doubled header: two 2x6 plies + a 1/2 in spacer filling the 2x4 wall thickness
  box('part.wall-a.header-ply-a', 'Header ply A (front 2x6)', 'linear_member', 'installed', 'framing', 'rough', 'IfcBeam',
    [HEAD_L, T, HEAD_D], [(KING_L - T / 2 + KING_R + T / 2) / 2, T / 2, HEAD_BOTTOM + HEAD_D / 2], 'absent', {
      materialId: 'material.lumber.header',
      description: 'Front ply of the doubled 2x6 header (synthetic, non-structural demonstration).',
    }),
  box('part.wall-a.header-spacer', 'Header spacer (1/2 in plywood)', 'panel', 'installed', 'framing', 'rough', 'IfcPlate',
    [HEAD_L, SPACER_T, HEAD_D], [(KING_L - T / 2 + KING_R + T / 2) / 2, T + SPACER_T / 2, HEAD_BOTTOM + HEAD_D / 2], 'absent', {
      materialId: 'material.panel.header-spacer',
      description: 'Plywood spacer filling the wall thickness between the header plies.',
    }),
  box('part.wall-a.header-ply-b', 'Header ply B (back 2x6)', 'linear_member', 'installed', 'framing', 'rough', 'IfcBeam',
    [HEAD_L, T, HEAD_D], [(KING_L - T / 2 + KING_R + T / 2) / 2, T + SPACER_T + T / 2, HEAD_BOTTOM + HEAD_D / 2], 'absent', {
      materialId: 'material.lumber.header',
      description: 'Back ply of the doubled 2x6 header.',
    }),
  vertical('part.wall-a.cripple-1', 'Cripple stud above header 1', CRIPPLE_1, HEAD_TOP + CRIPPLE_L / 2, CRIPPLE_L, 'absent', { materialId: 'material.lumber.stud' }),
  vertical('part.wall-a.cripple-2', 'Cripple stud above header 2', CRIPPLE_2, HEAD_TOP + CRIPPLE_L / 2, CRIPPLE_L, 'absent', { materialId: 'material.lumber.stud' }),

  box('part.wall-a.opening', 'Door rough opening (void)', 'opening', 'clearance', 'framing', 'rough', 'IfcOpeningElement',
    [OPEN_W, D, OPEN_H], [(OPEN_X0 + OPEN_X1) / 2, Y_MID, PLATE_T / 2 + OPEN_H / 2], 'absent', {
      description: 'Clear door rough opening between the jack studs, under the header. A semantic void, never a solid.',
      takeoff: { include: false, note: 'void, excluded from takeoff' },
    }),

  box('part.wall-a.backing-a', 'Cabinet backing block A (2x6 flat)', 'linear_member', 'installed', 'framing', 'rough', 'IfcPlate',
    [BLOCK_A.x1 - BLOCK_A.x0, T, 139.7], [(BLOCK_A.x0 + BLOCK_A.x1) / 2, -T / 2, BLOCK_Z], 'absent', {
      materialId: 'material.lumber.block',
      description: 'Backing block fitted in the stud bay between stud 2 and stud 3.',
    }),
  box('part.wall-a.backing-b', 'Cabinet backing block B (2x6 flat)', 'linear_member', 'installed', 'framing', 'rough', 'IfcPlate',
    [BLOCK_B.x1 - BLOCK_B.x0, T, 139.7], [(BLOCK_B.x0 + BLOCK_B.x1) / 2, -T / 2, BLOCK_Z], 'absent', {
      materialId: 'material.lumber.block',
      description: 'Backing block fitted in the stud bay between stud 3 and the left king stud.',
    }),

  box('part.wall-a.cover-panel', 'Drywall cover panel (trimmed to the opening)', 'panel', 'installed', 'drywall', 'cover', 'IfcCovering',
    [OPEN_X0, 12.7, WALL_H], [OPEN_X0 / 2, -6.35, WALL_H / 2], 'absent', {
      assemblyId: 'assembly.wall-a.cover',
      materialId: 'material.panel.drywall',
      description: '1/2 in gypsum panel covering the wall left of the door opening (demonstration).',
    }),
  box('part.cabinet.envelope', 'Cabinet envelope', 'fixture', 'installed', 'cabinetry', 'fixture', 'IfcFurniture',
    [609.6, 609.6, 812.8], [914.4, -235.5, 1320.8], 'absent', {
      assemblyId: 'assembly.cabinet',
      description: 'Wall cabinet envelope spanning both backing blocks (demonstration envelope).',
    }),

  box('part.demo.temp-panel', 'Temporary protection panel', 'panel', 'installed', 'general', 'demo', 'IfcBuildingElementProxy',
    [OPEN_X0, 19.05, WALL_H], [OPEN_X0 / 2, -990.6, WALL_H / 2], 'installed', {
      assemblyId: 'assembly.demo',
      materialId: 'material.panel.temp',
      description: 'Reusable floor protection panel removed before cutting.',
    }),

  box('part.demo.temp-racking-brace', 'Temporary racking brace (in-plane diagonal)', 'linear_member', 'installed', 'framing', 'rough', 'IfcMember',
    [rackingLength, T, D], rackingCentre, 'absent', {
      assemblyId: 'assembly.demo',
      materialId: 'material.lumber.brace',
      description:
        'Diagonal brace nailed flat to the framing face: it resists racking (in-plane shear) while the frame is anchored and inspected; it does not hold the wall plumb.',
      placement: { translationMm: rackingCentre, rotationEulerDeg: [0, rackingAngle, 0] },
    }),
  box('part.demo.temp-plumb-prop', 'Temporary plumb prop (out-of-plane)', 'linear_member', 'installed', 'framing', 'rough', 'IfcMember',
    [T, D, propLength], propCentre, 'absent', {
      assemblyId: 'assembly.demo',
      materialId: 'material.lumber.prop',
      description:
        'Prop leaning from the top plate to the floor in the depth direction: it holds the frame plumb (out of plane) until the bottom plate is anchored.',
      placement: { translationMm: propCentre, rotationEulerDeg: [propAngle, 0, 0] },
    }),

  box('part.demo.cable', 'Non-energized schematic cable', 'linear_member', 'schematic', 'electrical', 'rough', 'IfcCableSegment',
    [1, 1, 1], [0, 0, 0], 'absent', {
      assemblyId: 'assembly.demo',
      materialId: 'material.electrical.cable',
      description: 'Schematic non-energized cable route through the wall cavity.',
      takeoff: { include: true, note: 'schematic route length' },
      placement: { translationMm: [0, 0, 0] },
    }),
  box('part.demo.junction-box', 'Schematic junction box', 'fixture', 'schematic', 'electrical', 'rough', 'IfcJunctionBox',
    [101.6, 50.8, 101.6], [152.4, 120, 1651], 'absent', { assemblyId: 'assembly.demo' }),
  box('part.demo.terminal', 'Schematic terminal', 'fixture', 'schematic', 'electrical', 'rough', 'IfcOutlet',
    [76.2, 50.8, 114.3], [990.6, 120, 1727.2], 'absent', { assemblyId: 'assembly.demo' }),

  box('part.loose.angle-1', 'Loose angle bracket 1', 'connector', 'loose', 'framing', 'rough', 'IfcDiscreteAccessory',
    [88.9, 88.9, 31.75], [2900, -400, 15.875], 'existing', {
      assemblyId: 'assembly.demo',
      description: 'Demonstration loose part, not installed.',
      takeoff: { include: true, note: 'demonstration loose part (not installed)' },
    }),
  box('part.loose.angle-2', 'Loose angle bracket 2', 'connector', 'loose', 'framing', 'rough', 'IfcDiscreteAccessory',
    [88.9, 88.9, 31.75], [3060, -460, 15.875], 'existing', {
      assemblyId: 'assembly.demo',
      description: 'Demonstration loose part, not installed.',
      takeoff: { include: true, note: 'demonstration loose part (not installed)' },
    }),
  box('part.loose.angle-3', 'Loose angle bracket 3', 'connector', 'loose', 'framing', 'rough', 'IfcDiscreteAccessory',
    [88.9, 88.9, 31.75], [3220, -330, 15.875], 'existing', {
      assemblyId: 'assembly.demo',
      description: 'Demonstration loose part, not installed.',
      takeoff: { include: true, note: 'demonstration loose part (not installed)' },
    }),
];
const cable = parts.find((candidate) => candidate.id === 'part.demo.cable');
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
write('assemblies.json', read('assemblies.json'));

// ---- measurements ----
const mm = (id, label, display, value, canonicalMm, evidenceStatus, declaredReleaseStatus, citationIds) => ({
  id, label,
  original: { display, value, unit: 'in' },
  canonicalMm,
  installationToleranceMm: null,
  evidenceStatus,
  declaredReleaseStatus,
  citationIds,
});
const measurements = [
  mm('measurement.wall-a.length', 'Wall A framed length', '96 in', '96', '2438.400', 'reported', 'ready', ['citation.sheet-a.wall-length']),
  mm('measurement.wall-a.height', 'Wall A framed height', '8 ft', '8', '2438.400', 'document_verified', 'ready', ['citation.sheet-a.survey']),
  mm('measurement.wall-a.opening.width', 'Door rough opening width', '37 1/2 in', '37 1/2', '952.500', 'conflicted', 'held', ['citation.sheet-a.opening', 'citation.field-note.opening']),
  mm('measurement.opening.height', 'Door rough opening height', '81 1/2 in', '81 1/2', '2070.100', 'reported', 'ready', ['citation.sheet-d.cuts']),
  mm('measurement.stud.length', 'Full-height stud length (common and king)', '93 in', '93', '2362.200', 'reported', 'ready', ['citation.sheet-d.cuts']),
  mm('measurement.jack.length', 'Jack (trimmer) stud length', '80 in', '80', '2032.000', 'reported', 'ready', ['citation.sheet-d.cuts']),
  mm('measurement.header.ply.length', 'Header ply length', '43 1/2 in', '43 1/2', '1104.900', 'reported', 'ready', ['citation.sheet-d.cuts']),
  mm('measurement.header.spacer.length', 'Header spacer length', '43 1/2 in', '43 1/2', '1104.900', 'reported', 'ready', ['citation.sheet-d.cuts']),
  mm('measurement.cripple.length', 'Cripple stud length', '7 1/2 in', '7 1/2', '190.500', 'reported', 'ready', ['citation.sheet-d.cuts']),
  mm('measurement.stud-1.centreline', 'Stud 1 (flush end) centreline from wall origin', '3/4 in', '3/4', '19.050', 'reported', 'ready', ['citation.sheet-a.wall-length']),
  mm('measurement.stud-2.centreline', 'Stud 2 centreline from wall origin (16 in module)', '16 in', '16', '406.400', 'reported', 'ready', ['citation.sheet-a.wall-length']),
  mm('measurement.stud-3.centreline', 'Stud 3 centreline from wall origin (32 in module)', '32 in', '32', '812.800', 'reported', 'ready', ['citation.sheet-a.wall-length']),
  mm('measurement.stud-4.centreline', 'Stud 4 (flush end) centreline from wall origin', '95 1/4 in', '95 1/4', '2419.350', 'reported', 'ready', ['citation.sheet-a.wall-length']),
  mm('measurement.plate-left.remaining', 'Sole plate remaining left segment after the cut-out', '49 in', '49', '1244.600', 'derived', 'ready', ['citation.sheet-d.inspection']),
  mm('measurement.plate-right.remaining', 'Sole plate remaining right segment after the cut-out', '9 1/2 in', '9 1/2', '241.300', 'derived', 'ready', ['citation.sheet-d.inspection']),
  mm('measurement.block-a.length', 'Backing block A length (stud 2 to stud 3 bay)', '14 1/2 in', '14 1/2', round(BLOCK_A.x1 - BLOCK_A.x0).toFixed(3), 'derived', 'conditional', ['citation.sheet-b.band']),
  mm('measurement.block-b.length', 'Backing block B length (stud 3 to king bay)', '13 1/4 in', '13 1/4', round(BLOCK_B.x1 - BLOCK_B.x0).toFixed(3), 'derived', 'conditional', ['citation.sheet-b.band']),
  mm('measurement.cabinet.width', 'Cabinet envelope width', '24 in', '24', '609.600', 'reported', 'conditional', ['citation.sheet-a.cabinet']),
];
measurements.find((m) => m.id === 'measurement.wall-a.opening.width').conflictNote =
  'Sheet A dimension chain gives 952.5 mm (37 1/2 in) clear opening; field note 01 reports 965 mm to the finished face.';
write('measurements.json', measurements);

// ---- materials: honest stock yields with kerf ----
const material = (id, name, category, sizeLabel, unit, quantityProposed, notes, citationIds) => ({
  id, name, category, sizeLabel, actualSizeMm: null, unit, quantityProposed, spareQuantity: 0, notes, citationIds,
});
const materials = [
  material('material.lumber.plate', '2x4x8 plate stock', 'lumber', '2x4x8', 'each', 2,
    `Board 1: continuous sole plate at full length 2438.4 mm (no cut). Board 2: top plate at full length 2438.4 mm (no cut). The doorway section is removed from the anchored sole plate, not pre-cut.`,
    ['citation.sheet-d.cuts']),
  material('material.lumber.stud', '2x4x8 stud stock', 'lumber', '2x4x8', 'each', 8,
    `6 boards: one per full-height stud (2362.2 mm, one cut; 2362.2 + ${KERF} mm kerf <= 2438.4). 2 boards: one per jack stud (2032 mm); each offcut (406.4 mm) also yields one cripple (190.5 mm). Total claimed lengths per board plus kerf never exceed 2438.4 mm.`,
    ['citation.sheet-d.cuts']),
  material('material.lumber.header', '2x6x8 header stock', 'lumber', '2x6x8', 'each', 1,
    `One board yields both header plies (2 x 1104.9 mm + ${KERF} mm kerf = 2212.8 <= 2438.4 mm).`,
    ['citation.sheet-d.joints']),
  material('material.panel.header-spacer', '1/2 in plywood header spacer', 'panel', '1/2 in', 'each', 1,
    '1104.9 mm strip cut from 1/2 in plywood offcut; fills the 2x4 wall thickness between the header plies.',
    ['citation.sheet-d.joints']),
  material('material.lumber.brace', '2x4x8 temporary racking brace', 'lumber', '2x4x8', 'each', 1,
    `One board yields the in-plane racking brace (${rackingLength} mm, one cut) and leaves a reusable offcut. It resists racking; it does not hold the wall plumb.`,
    ['citation.sheet-d.inspection']),
  material('material.lumber.prop', '2x4x8 temporary plumb prop', 'lumber', '2x4x8', 'each', 1,
    `One board yields the out-of-plane plumb prop (${propLength} mm + ${KERF} mm kerf = ${round(propLength + KERF)} <= 2438.4 mm).`,
    ['citation.sheet-d.inspection']),
  material('material.lumber.block', '2x6x8 backing block stock', 'lumber', '2x6x8', 'each', 1,
    `One board yields both backing blocks (${round(BLOCK_A.x1 - BLOCK_A.x0)} + ${round(BLOCK_B.x1 - BLOCK_B.x0)} mm + ${KERF} mm kerf = ${round(BLOCK_A.x1 - BLOCK_A.x0 + BLOCK_B.x1 - BLOCK_B.x0 + KERF)} <= 2438.4 mm).`,
    ['citation.sheet-b.band']),
  material('material.fastener.frame-screw', 'Synthetic structural screw 8 x 63 mm (demonstration)', 'fastener', '8 x 63 mm', 'each', 40,
    'Two screws at every frame joint: 14 plate joints, 2 header joints and 4 cripple ends (20 joints, 40 screws). Synthetic demonstration value only.',
    ['citation.sheet-d.joints']),
  material('material.fastener.frame-anchor', 'Synthetic mechanical anchor M10 x 100 mm (demonstration)', 'fastener', 'M10 x 100 mm', 'each', 3,
    'Anchors on the permanent plate segments only (152.4, 762 and 2320 mm), 609.6 mm on centre where the plate allows; pilot 10 mm x 60 mm (synthetic). No anchor remains in the door opening.',
    ['citation.sheet-d.anchors']),
  material('material.panel.drywall', '1/2 in gypsum panel 4x8', 'panel', '1/2 in', 'sheet', 1,
    'Trimmed to the door opening for the demonstration.', ['citation.sheet-b.cover']),
  material('material.panel.temp', 'Temporary protection panel', 'panel', null, 'each', 1, 'Reused after removal.', ['citation.sheet-a.remove']),
  material('material.fastener.screw', 'Backing screw (specification withheld)', 'fastener', null, 'each', 8,
    'Proposed only; the backing connection is held.', ['citation.sheet-b.connection']),
  material('material.electrical.cable', 'Schematic cable 14/2', 'electrical', null, 'm', 4, 'Non-energized demonstration route.', ['citation.sheet-c.route']),
  material('material.fastener.angle', 'Loose angle bracket', 'fastener', null, 'each', 3, 'Demonstration loose parts, not installed.', ['citation.sheet-a.general']),
];
write('materials.json', materials);

// ---- tools ----
const tools = read('tools.json');
if (!tools.some((tool) => tool.id === 'tool.square')) {
  tools.push({ id: 'tool.square', name: 'Framing square', category: 'measuring', setup: null, citationIds: ['citation.sheet-a.general'] });
}
if (!tools.some((tool) => tool.id === 'tool.hand-saw')) {
  tools.push({ id: 'tool.hand-saw', name: 'Hand saw (doorway cut-out)', category: 'cutting', setup: null, citationIds: ['citation.sheet-d.cuts'] });
}
write('tools.json', tools);

// ---- connections ----
const connections = {
  connections: [
    {
      id: 'connection.frame.plate-to-stud',
      fromPartId: 'part.wall-a.bottom-plate',
      toPartId: 'part.wall-a.stud-1',
      method: 'screw',
      fastenerSpecId: 'fastener.frame-screw',
      pattern: { type: 'line', count: 2, spacingMm: 80, edgeDistanceMm: 40 },
      pilotHole: null,
      toolSetup: 'Impact driver with the synthetic screw bit',
      declaredReleaseStatus: 'ready',
      citationIds: ['citation.sheet-d.joints'],
      proposedPointsMm: null,
    },
    {
      id: 'connection.frame.plate-to-slab',
      fromPartId: 'part.wall-a.bottom-plate',
      toPartId: 'part.existing.slab',
      method: 'mechanical_anchor',
      fastenerSpecId: 'fastener.frame-anchor',
      pattern: { type: 'line', count: 3, spacingMm: 609.6, endOffsetMm: 152.4, edgeDistanceMm: 100 },
      pilotHole: { required: true, diameterMm: 10, depthMm: 60 },
      toolSetup: 'Hammer drill + torque wrench per the synthetic schedule',
      declaredReleaseStatus: 'ready',
      citationIds: ['citation.sheet-d.anchors'],
      proposedPointsMm: null,
    },
    {
      id: 'connection.backing-a.stud-2',
      fromPartId: 'part.wall-a.backing-a',
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
        [round(ORIGIN + STUD_16), 43.9, BLOCK_Z],
        [round(ORIGIN + STUD_32), 43.9, BLOCK_Z],
      ],
    },
    {
      id: 'connection.backing-b.king-left',
      fromPartId: 'part.wall-a.backing-b',
      toPartId: 'part.wall-a.king-left',
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
        [round(ORIGIN + STUD_32), 43.9, BLOCK_Z],
        [round(ORIGIN + KING_L), 43.9, BLOCK_Z],
      ],
    },
  ],
  fastenerSpecs: [
    {
      id: 'fastener.frame-screw',
      name: 'Synthetic structural screw 8 x 63 mm (demonstration)',
      description:
        'Two screws at every frame joint: 14 plate joints, 2 header joints and 4 cripple ends (20 joints, 40 screws). Synthetic demonstration value only.',
      lengthMm: 63,
      citationIds: ['citation.sheet-d.joints'],
    },
    {
      id: 'fastener.frame-anchor',
      name: 'Synthetic mechanical anchor M10 x 100 mm (demonstration)',
      description:
        'Three anchors on permanent plate segments (152.4, 762 and 2320 mm), 10 mm x 60 mm pilot holes. Slab assumed sound for the demonstration; no anchor remains inside the door opening.',
      lengthMm: 100,
      citationIds: ['citation.sheet-d.anchors'],
    },
  ],
};
write('connections.json', connections);

const geometrySummary = {
  parts: parts.length,
  rackingLength,
  rackingAngle,
  propLength,
  propAngle,
  blockA: round(BLOCK_A.x1 - BLOCK_A.x0),
  blockB: round(BLOCK_B.x1 - BLOCK_B.x0),
  cripple: CRIPPLE_L,
  headerPly: HEAD_L,
  anchors: [152.4, 762, 2320],
};
console.log(JSON.stringify(geometrySummary, null, 1));
