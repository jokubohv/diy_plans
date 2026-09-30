/**
 * Owner correction phase, part 2: author the 18-step frame-first sequence for the re-built wall.
 * Run from platform/ with: npx tsx work/scripts/author-frame-v2-ops.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const dir = 'projects/p0-fixture/0.1.0/';
const read = (file) => JSON.parse(readFileSync(dir + file, 'utf8'));
const write = (file, value) => writeFileSync(dir + file, JSON.stringify(value, null, 2) + '\n');

// geometry constants (must match author-frame-v2.mjs)
const WALL_L = 2438.4;
const PLATE_T = 38.1;
const HEAD_BOTTOM = 2070.1;
const HEAD_TOP = 2209.8;
const CRIPPLE_1_X = 1562.1;
const CRIPPLE_2_X = 1879.6;
const JACK_L_X = 1225.55;
const JACK_R_X = 2216.15;
const Y_MID = 126.45; // world y of member centres (82 + 44.45)

const FRAME_PARTS = [
  'part.wall-a.bottom-plate-left',
  'part.wall-a.sole-plate-infill',
  'part.wall-a.bottom-plate-right',
  'part.wall-a.top-plate',
  'part.wall-a.stud-1',
  'part.wall-a.stud-2',
  'part.wall-a.stud-3',
  'part.wall-a.king-left',
  'part.wall-a.king-right',
  'part.wall-a.jack-left',
  'part.wall-a.jack-right',
  'part.wall-a.header',
  'part.wall-a.cripple-1',
  'part.wall-a.cripple-2',
];

const LAY_FLAT = {
  partIds: [...FRAME_PARTS, 'part.wall-a.opening'],
  axis: 'x',
  angleDeg: 90,
  pivotMm: [347, 82, 0],
};

// 36 released frame screw points: 12 plate joints (2 each) + 2 header joints (2 each) + 4 cripple ends (2 each).
const bottomJointX = [57.15, 679.45, 1187.45, 2254.25, 2419.35, JACK_L_X, JACK_R_X];
const topJointX = [57.15, 679.45, 1187.45, 2254.25, 2419.35];
const SCREW_POINTS = [
  ...bottomJointX.flatMap((x) => [[x, 86.45, PLATE_T], [x, 166.45, PLATE_T]]),
  ...topJointX.flatMap((x) => [[x, 86.45, 2438.4], [x, 166.45, 2438.4]]),
  ...[JACK_L_X, JACK_R_X].flatMap((x) => [[x, Y_MID, 2110.1], [x, Y_MID, 2170.1]]),
  ...[CRIPPLE_1_X, CRIPPLE_2_X].flatMap((x) =>
    [101.45, 151.45].flatMap((y) => [[x, y, 2219.8], [x, y, 2390.3]]),
  ),
];
const ANCHOR_POINTS = [152.4, 762, 1371.6, 1981.2].map((x) => [x, Y_MID, PLATE_T]);

const quality = (instruction, evidenceRequired, citationIds) => ({ instruction, evidenceRequired, citationIds });

const operations = [
  {
    id: 'op.survey-wall',
    title: 'Verify wall-frame dimensions',
    kind: 'survey',
    targetPartIds: ['part.existing.slab', 'part.demo.temp-panel'],
    dependencyOperationIds: [],
    citationIds: ['citation.sheet-a.survey', 'citation.sheet-a.wall-length'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Build area clear and accessible for the planned 2438.4 mm frame.'],
    qualityChecks: [
      quality(
        'Planned wall-frame length and height confirmed at 2438.4 mm against the approved dimension chain',
        'measurement',
        ['citation.sheet-a.survey'],
      ),
      quality(
        'Planned door rough opening confirmed at 952.5 mm wide and 2070.1 mm high',
        'measurement',
        ['citation.sheet-a.opening'],
      ),
    ],
    stopConditions: [
      'Stop if the build area cannot accept the planned 2438.4 mm frame or the approved dimensions are unavailable.',
    ],
    stateEffects: [],
    view: { cameraPresetId: 'view.iso', highlightPartIds: [], hiddenPartIds: [], recipe: {} },
    parameters: {
      measurementIds: [
        'measurement.wall-a.length',
        'measurement.wall-a.height',
        'measurement.opening.height',
        'measurement.wall-a.opening.width',
        'measurement.stud-1.centreline',
        'measurement.stud-2.centreline',
        'measurement.stud-3.centreline',
      ],
      checkInstruction:
        'Verify the build area and confirm the planned wall-frame dimensions (2438.4 mm long and high, door opening 952.5 x 2070.1 mm, stud centres per the layout note) before cutting any stock.',
    },
  },
  {
    id: 'op.prepare-frame',
    title: 'Prepare frame materials and tools',
    kind: 'prepare',
    targetPartIds: FRAME_PARTS,
    dependencyOperationIds: ['op.survey-wall'],
    citationIds: ['citation.sheet-d.cuts', 'citation.sheet-a.general'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Approved dimension chain available.'],
    qualityChecks: [
      quality('Frame materials and tools gathered match the preparation list', 'visual', ['citation.sheet-d.cuts']),
    ],
    stopConditions: ['Stop if any listed material or tool is missing or damaged.'],
    stateEffects: [],
    view: { cameraPresetId: 'view.frame-flat', highlightPartIds: [], hiddenPartIds: [], recipe: {} },
    parameters: {
      materialIds: [
        'material.lumber.plate',
        'material.lumber.stud',
        'material.lumber.header',
        'material.lumber.brace',
        'material.lumber.block',
        'material.fastener.frame-screw',
        'material.fastener.frame-anchor',
      ],
      toolIds: [
        'tool.tape',
        'tool.pencil',
        'tool.square',
        'tool.miter-saw',
        'tool.driver',
        'tool.drill',
        'tool.safety-glasses',
      ],
      instruction:
        'Gather the frame materials and tools, then check the frame dimensions and the cut list before cutting.',
      cutOperationIds: ['op.cut-frame'],
    },
  },
  {
    id: 'op.remove-temp',
    title: 'Remove temporary protection',
    kind: 'remove',
    targetPartIds: ['part.demo.temp-panel'],
    dependencyOperationIds: ['op.prepare-frame'],
    citationIds: ['citation.sheet-a.remove'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Materials staged away from the work area.'],
    qualityChecks: [quality('Temporary protection panel is intact and stored flat', 'visual', ['citation.sheet-a.remove'])],
    stopConditions: ['Stop if the temporary panel is damaged and cannot be stored.'],
    stateEffects: [{ partId: 'part.demo.temp-panel', fromState: 'installed', toState: 'removed' }],
    view: { cameraPresetId: 'view.iso', highlightPartIds: ['part.demo.temp-panel'], hiddenPartIds: [], recipe: {} },
    parameters: { disposition: 'store', note: 'Fold and store the protection panel for reuse.' },
  },
  {
    id: 'op.cut-frame',
    title: 'Cut frame members',
    kind: 'cut',
    targetPartIds: FRAME_PARTS,
    dependencyOperationIds: ['op.prepare-frame', 'op.remove-temp'],
    citationIds: ['citation.sheet-d.cuts', 'citation.sheet-a.wall-length'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Stock checked against the cut list.'],
    qualityChecks: [
      quality('Every cut length is within 1.5 mm of the synthetic cut list', 'measurement', ['citation.sheet-d.cuts']),
    ],
    stopConditions: ['Stop if a cut length cannot be verified against the approved dimension chain.'],
    stateEffects: FRAME_PARTS.map((partId) => ({ partId, fromState: 'absent', toState: 'cut' })),
    view: {
      cameraPresetId: 'view.frame-flat',
      highlightPartIds: FRAME_PARTS,
      hiddenPartIds: [],
      recipe: { cutaway: { enabled: true }, layFlat: LAY_FLAT },
    },
    parameters: {
      cuts: [
        { partId: 'part.wall-a.bottom-plate-left', finalLengthMm: '1244.600', note: 'Plate from a 2x4x8 board.' },
        { partId: 'part.wall-a.sole-plate-infill', finalLengthMm: '952.500', note: 'Temporary plate segment across the door opening.' },
        { partId: 'part.wall-a.bottom-plate-right', finalLengthMm: '241.300', note: 'Plate from the same 2x4x8 board.' },
        { partId: 'part.wall-a.top-plate', finalLengthMm: '2438.400', note: 'Single top plate from a 2x4x8 board.' },
        { partId: 'part.wall-a.stud-1', finalLengthMm: '2362.200', note: 'Common stud from a 2x4x8 board.' },
        { partId: 'part.wall-a.stud-2', finalLengthMm: '2362.200', note: 'Common stud from a 2x4x8 board.' },
        { partId: 'part.wall-a.stud-3', finalLengthMm: '2362.200', note: 'End stud from a 2x4x8 board.' },
        { partId: 'part.wall-a.king-left', finalLengthMm: '2362.200', note: 'King stud from a 2x4x8 board.' },
        { partId: 'part.wall-a.king-right', finalLengthMm: '2362.200', note: 'King stud from a 2x4x8 board.' },
        { partId: 'part.wall-a.jack-left', finalLengthMm: '2032.000', note: 'Jack stud; both jacks from one board.' },
        { partId: 'part.wall-a.jack-right', finalLengthMm: '2032.000', note: 'Jack stud.' },
        { partId: 'part.wall-a.header', finalLengthMm: '1104.900', note: 'Header from a 2x6x8 board.' },
        { partId: 'part.wall-a.cripple-1', finalLengthMm: '190.500', note: 'Cripple from offcuts.' },
        { partId: 'part.wall-a.cripple-2', finalLengthMm: '190.500', note: 'Cripple from offcuts.' },
      ],
      toolId: 'tool.miter-saw',
    },
  },
  {
    id: 'op.layout-frame',
    title: 'Lay out the frame',
    kind: 'position',
    targetPartIds: FRAME_PARTS,
    dependencyOperationIds: ['op.cut-frame'],
    citationIds: ['citation.sheet-a.wall-length', 'citation.sheet-a.opening', 'citation.sheet-d.cuts'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Cut members checked against the cut list.'],
    qualityChecks: [
      quality(
        'Stud, king, jack and cripple positions match the line-out note and the opening is 952.5 mm wide',
        'measurement',
        ['citation.sheet-a.opening'],
      ),
    ],
    stopConditions: ['Stop if the opening line-out differs from the approved 952.5 mm.'],
    stateEffects: FRAME_PARTS.map((partId) => ({ partId, fromState: 'cut', toState: 'positioned' })),
    view: {
      cameraPresetId: 'view.frame-flat',
      highlightPartIds: FRAME_PARTS,
      hiddenPartIds: [],
      recipe: { layFlat: LAY_FLAT },
    },
    parameters: {
      datumNote:
        'Mark the plates flat on the floor: stud centres at 57.15, 679.45, 1187.45, 2254.25 and 2419.35 mm; jack studs at 1225.55 and 2216.15 mm with the opening clear between 1244.6 and 2197.1 mm; header centred at 1720.85 mm.',
      fromPartId: 'part.wall-a.bottom-plate-left',
      offsetsMm: null,
      toolId: 'tool.pencil',
    },
  },
  {
    id: 'op.assemble-frame',
    title: 'Assemble the frame (flat)',
    kind: 'fasten',
    targetPartIds: [...FRAME_PARTS, 'part.wall-a.opening'],
    dependencyOperationIds: ['op.layout-frame'],
    citationIds: ['citation.sheet-d.joints'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Members marked and laid out flat in assembly order.'],
    qualityChecks: [
      quality(
        'Two screws at every plate joint, header bearing and cripple end; the frame is square before raising',
        'photo',
        ['citation.sheet-d.joints'],
      ),
    ],
    stopConditions: ['Stop if a joint cannot take the two synthetic screws at the scheduled positions.'],
    stateEffects: [
      ...FRAME_PARTS.map((partId) => ({ partId, fromState: 'positioned', toState: 'installed' })),
      { partId: 'part.wall-a.opening', fromState: 'absent', toState: 'installed' },
    ],
    view: {
      cameraPresetId: 'view.frame-flat',
      highlightPartIds: FRAME_PARTS,
      hiddenPartIds: [],
      recipe: {
        layFlat: LAY_FLAT,
        translateFrom: { partId: 'part.wall-a.header', offsetMm: [0, 0, 300] },
      },
    },
    parameters: {
      connectionIds: ['connection.frame.plate-to-stud'],
      pointsMm: SCREW_POINTS,
      proposed: false,
      toolId: 'tool.driver',
    },
  },
  {
    id: 'op.raise-frame',
    title: 'Raise the frame and fit the temporary brace',
    kind: 'position',
    targetPartIds: [...FRAME_PARTS, 'part.demo.temp-brace'],
    dependencyOperationIds: ['op.assemble-frame'],
    citationIds: ['citation.sheet-d.inspection', 'citation.sheet-a.general'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Frame assembled square and lying flat in position.'],
    qualityChecks: [quality('Frame raised upright and the temporary brace fitted', 'visual', ['citation.sheet-d.inspection'])],
    stopConditions: ['Stop if the frame cannot be raised without damaging members or the slab.'],
    stateEffects: [{ partId: 'part.demo.temp-brace', fromState: 'absent', toState: 'installed' }],
    view: {
      cameraPresetId: 'view.installer-eye',
      highlightPartIds: ['part.demo.temp-brace'],
      hiddenPartIds: [],
      recipe: { translateFrom: { partId: 'part.demo.temp-brace', offsetMm: [0, -600, 0] } },
    },
    parameters: {
      datumNote: 'Raise the frame onto the layout line; the temporary brace holds it plumb until the backing is fitted.',
      fromPartId: null,
      offsetsMm: null,
      toolId: 'tool.level',
    },
  },
  {
    id: 'op.anchor-frame',
    title: 'Anchor the bottom plate',
    kind: 'fasten',
    targetPartIds: ['part.wall-a.bottom-plate-left', 'part.wall-a.sole-plate-infill', 'part.wall-a.bottom-plate-right'],
    dependencyOperationIds: ['op.raise-frame'],
    citationIds: ['citation.sheet-d.anchors'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Frame raised and braced; slab sound for the synthetic anchor schedule.'],
    qualityChecks: [
      quality('Four anchors at 609.6 mm on centre with 10 mm x 60 mm pilot holes', 'measurement', ['citation.sheet-d.anchors']),
    ],
    stopConditions: ['Stop if the slab cannot take the synthetic anchor pattern.'],
    stateEffects: [],
    view: {
      cameraPresetId: 'view.anchor',
      highlightPartIds: ['part.wall-a.bottom-plate-left', 'part.wall-a.sole-plate-infill', 'part.wall-a.bottom-plate-right'],
      hiddenPartIds: [],
      recipe: { showFastenerPoints: { connectionId: 'connection.frame.plate-to-slab', proposed: false } },
    },
    parameters: {
      connectionIds: ['connection.frame.plate-to-slab'],
      pointsMm: ANCHOR_POINTS,
      proposed: false,
      toolId: 'tool.drill',
    },
  },
  {
    id: 'op.open-doorway',
    title: 'Open the door rough opening',
    kind: 'remove',
    targetPartIds: ['part.wall-a.sole-plate-infill', 'part.wall-a.opening'],
    dependencyOperationIds: ['op.anchor-frame'],
    citationIds: ['citation.sheet-d.cuts', 'citation.sheet-a.opening'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Bottom plate anchored.'],
    qualityChecks: [
      quality('Sole plate cut flush with both jack studs; opening is clear', 'photo', ['citation.sheet-a.opening']),
    ],
    stopConditions: ['Stop if the plate cannot be cut without damaging the jack studs.'],
    stateEffects: [{ partId: 'part.wall-a.sole-plate-infill', fromState: 'installed', toState: 'removed' }],
    view: {
      cameraPresetId: 'view.elevation',
      highlightPartIds: ['part.wall-a.sole-plate-infill'],
      hiddenPartIds: [],
      recipe: { cutaway: { enabled: true } },
    },
    parameters: {
      disposition: 'discard',
      note: 'Cut the temporary sole plate flush with the jack studs and discard the offcut.',
    },
  },
  {
    id: 'op.inspect-frame',
    title: 'Inspect the frame',
    kind: 'inspect',
    targetPartIds: [...FRAME_PARTS, 'part.wall-a.opening'],
    dependencyOperationIds: ['op.open-doorway'],
    citationIds: ['citation.sheet-d.inspection', 'citation.sheet-a.survey'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Frame anchored and the doorway opened.'],
    qualityChecks: [
      quality(
        'Plumb within 3 mm, diagonals differ by <= 3 mm, opening 952.5 x 2070.1 mm, header bearing on both jacks',
        'field_measurement_or_photo',
        ['citation.sheet-d.inspection'],
      ),
    ],
    stopConditions: ['Stop and raise an issue if plumb, square or the opening is outside the synthetic criteria.'],
    stateEffects: [],
    view: {
      cameraPresetId: 'view.elevation',
      highlightPartIds: ['part.wall-a.header', 'part.wall-a.jack-left', 'part.wall-a.jack-right'],
      hiddenPartIds: [],
      recipe: {},
    },
    parameters: {
      inspectWhat: 'Frame plumb, square, overall size, header bearing and the door rough opening',
      criteria:
        'Plumb within 3 mm over the wall height; diagonals differ by <= 3 mm; framed length and height 2438.4 mm; opening clear width 952.5 mm and height 2070.1 mm; header bearing fully on both jack studs.',
      evidenceRequired: 'field_measurement_or_photo',
    },
  },
  {
    id: 'op.remove-brace',
    title: 'Remove the temporary brace',
    kind: 'remove',
    targetPartIds: ['part.demo.temp-brace'],
    dependencyOperationIds: ['op.inspect-frame'],
    citationIds: ['citation.sheet-d.inspection'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Frame inspection recorded.'],
    qualityChecks: [quality('Temporary brace removed and stored for reuse', 'visual', ['citation.sheet-d.inspection'])],
    stopConditions: ['Stop if the frame moves once the brace is released; refit the brace and raise an issue.'],
    stateEffects: [{ partId: 'part.demo.temp-brace', fromState: 'installed', toState: 'removed' }],
    view: {
      cameraPresetId: 'view.installer-eye',
      highlightPartIds: ['part.demo.temp-brace'],
      hiddenPartIds: [],
      recipe: {},
    },
    parameters: { disposition: 'store', note: 'Store the brace for the next frame; the wall covering will hold the frame.' },
  },
  {
    id: 'op.cut-backing',
    title: 'Cut backing blocks',
    kind: 'cut',
    targetPartIds: ['part.wall-a.backing-a', 'part.wall-a.backing-b'],
    dependencyOperationIds: ['op.inspect-frame', 'op.remove-brace'],
    citationIds: ['citation.sheet-b.band'],
    declaredReleaseStatus: 'conditional',
    releaseId: 'release.p0.conditional',
    preconditions: ['Frame inspected; bay widths checked in the field before cutting.'],
    qualityChecks: [
      quality('Block lengths match the measured bays within 1.5 mm', 'measurement', ['citation.sheet-b.band']),
    ],
    stopConditions: ['Stop if a bay width differs from the derived block length before cutting.'],
    stateEffects: [
      { partId: 'part.wall-a.backing-a', fromState: 'absent', toState: 'cut' },
      { partId: 'part.wall-a.backing-b', fromState: 'absent', toState: 'cut' },
    ],
    view: {
      cameraPresetId: 'view.closeup-band',
      highlightPartIds: ['part.wall-a.backing-a', 'part.wall-a.backing-b'],
      hiddenPartIds: [],
      recipe: { cutaway: { enabled: true } },
    },
    parameters: {
      cuts: [
        { partId: 'part.wall-a.backing-a', finalLengthMm: '584.200', note: 'Fits the stud 1 to stud 2 bay.' },
        { partId: 'part.wall-a.backing-b', finalLengthMm: '469.900', note: 'Fits the stud 2 to king stud bay.' },
      ],
      toolId: 'tool.miter-saw',
    },
  },
  {
    id: 'op.position-backing',
    title: 'Position backing blocks',
    kind: 'position',
    targetPartIds: ['part.wall-a.backing-a', 'part.wall-a.backing-b'],
    dependencyOperationIds: ['op.cut-backing'],
    citationIds: ['citation.sheet-b.band', 'citation.sheet-b.inspect'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Blocks cut to the derived bay lengths.'],
    qualityChecks: [
      quality('Both blocks sit inside their stud bays, face flush with the stud faces', 'measurement', ['citation.sheet-b.inspect']),
    ],
    stopConditions: ['Stop if a block does not fit its bay without forcing.'],
    stateEffects: [
      { partId: 'part.wall-a.backing-a', fromState: 'cut', toState: 'positioned' },
      { partId: 'part.wall-a.backing-b', fromState: 'cut', toState: 'positioned' },
    ],
    view: {
      cameraPresetId: 'view.closeup-band',
      highlightPartIds: ['part.wall-a.backing-a', 'part.wall-a.backing-b'],
      hiddenPartIds: [],
      recipe: {
        translateFrom: { partId: 'part.wall-a.backing-b', offsetMm: [0, -300, 0] },
        ghostPrevious: ['part.wall-a.cover-panel'],
      },
    },
    parameters: {
      datumNote:
        'Block top edge 1136.6 mm above the finished floor; faces flush with the stud faces; block A in the stud 1 to stud 2 bay, block B in the stud 2 to king stud bay.',
      fromPartId: 'part.wall-a.stud-1',
      offsetsMm: [0, 0, 1066.8],
      toolId: 'tool.level',
    },
  },
  {
    id: 'op.fasten-backing',
    title: 'Fasten backing blocks (held)',
    kind: 'fasten',
    targetPartIds: ['part.wall-a.backing-a', 'part.wall-a.backing-b'],
    dependencyOperationIds: ['op.position-backing'],
    citationIds: ['citation.sheet-b.connection'],
    declaredReleaseStatus: 'held',
    releaseId: 'release.p0.held',
    holdReason:
      'Backing fastener type, length, spacing and edge distance are not released for this synthetic fixture; only the proposed connection locations may be shown.',
    preconditions: ['Released backing fastener specification and pattern'],
    qualityChecks: [quality('Every released fastener point driven into the studs', 'photo', ['citation.sheet-b.connection'])],
    stopConditions: ['Do not drive any fastener until the connection is released.'],
    stateEffects: [
      { partId: 'part.wall-a.backing-a', fromState: 'positioned', toState: 'installed' },
      { partId: 'part.wall-a.backing-b', fromState: 'positioned', toState: 'installed' },
    ],
    view: {
      cameraPresetId: 'view.closeup-band',
      highlightPartIds: ['part.wall-a.backing-a', 'part.wall-a.backing-b'],
      hiddenPartIds: [],
      recipe: { showFastenerPoints: { connectionId: 'connection.backing-a.stud-1', proposed: true } },
    },
    parameters: {
      connectionIds: ['connection.backing-a.stud-1', 'connection.backing-b.stud-2'],
      pointsMm: null,
      proposed: true,
      toolId: null,
    },
  },
  {
    id: 'op.inspect-backing',
    title: 'Inspect backing blocks',
    kind: 'inspect',
    targetPartIds: ['part.wall-a.backing-a', 'part.wall-a.backing-b'],
    dependencyOperationIds: ['op.fasten-backing'],
    citationIds: ['citation.sheet-b.inspect'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Backing fastened per the released specification.'],
    qualityChecks: [
      quality('Block faces flush within 1.5 mm and every released fastener point driven', 'field_measurement_or_photo', ['citation.sheet-b.inspect']),
    ],
    stopConditions: ['Stop if a block face is not flush or a fastener point is unresolved.'],
    stateEffects: [],
    view: {
      cameraPresetId: 'view.closeup-band',
      highlightPartIds: ['part.wall-a.backing-a', 'part.wall-a.backing-b'],
      hiddenPartIds: [],
      recipe: {},
    },
    parameters: {
      inspectWhat: 'Backing block flushness and fastener pattern',
      criteria: 'Faces within 1.5 mm of the stud faces; every released fastener point driven.',
      evidenceRequired: 'field_measurement_or_photo',
    },
  },
  {
    id: 'op.route-cable',
    title: 'Route schematic cable',
    kind: 'route',
    targetPartIds: ['part.demo.cable', 'part.demo.junction-box', 'part.demo.terminal'],
    dependencyOperationIds: ['op.inspect-frame'],
    citationIds: ['citation.sheet-c.route'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Frame inspected; demonstration route only.'],
    qualityChecks: [quality('Route matches the approved schematic path', 'visual', ['citation.sheet-c.route'])],
    stopConditions: ['Do not energize; this is a schematic demonstration only.'],
    stateEffects: [
      { partId: 'part.demo.cable', fromState: 'absent', toState: 'installed' },
      { partId: 'part.demo.junction-box', fromState: 'absent', toState: 'installed' },
      { partId: 'part.demo.terminal', fromState: 'absent', toState: 'installed' },
    ],
    view: {
      cameraPresetId: 'view.iso',
      highlightPartIds: ['part.demo.cable'],
      hiddenPartIds: [],
      recipe: { routePath: { partId: 'part.demo.cable' } },
    },
    parameters: {
      systemId: 'system.demo-nonenergized',
      circuitId: 'circuit.demo',
      pathPointsMm: [
        [152.4, 120, 1651],
        [152.4, 120, 2159],
        [990.6, 120, 2159],
        [990.6, 120, 1727.2],
      ],
      conductorLabel: 'schematic',
      demonstrationOnly: true,
    },
  },
  {
    id: 'op.cover-drywall',
    title: 'Cover wall',
    kind: 'position',
    targetPartIds: ['part.wall-a.cover-panel'],
    dependencyOperationIds: ['op.inspect-backing', 'op.route-cable'],
    citationIds: ['citation.sheet-b.cover'],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.p0.demo',
    preconditions: ['Backing inspection accepted; cable route installed.'],
    qualityChecks: [quality('No fasteners penetrate the backing blocks; panel against the stud faces', 'visual', ['citation.sheet-b.cover'])],
    stopConditions: ['Do not cover before the backing inspection is accepted.'],
    stateEffects: [
      { partId: 'part.wall-a.cover-panel', fromState: 'absent', toState: 'installed' },
      { partId: 'part.wall-a.bottom-plate-left', fromState: 'installed', toState: 'covered' },
      { partId: 'part.wall-a.stud-1', fromState: 'installed', toState: 'covered' },
      { partId: 'part.wall-a.stud-2', fromState: 'installed', toState: 'covered' },
      { partId: 'part.wall-a.king-left', fromState: 'installed', toState: 'covered' },
      { partId: 'part.wall-a.jack-left', fromState: 'installed', toState: 'covered' },
      { partId: 'part.wall-a.backing-a', fromState: 'installed', toState: 'covered' },
      { partId: 'part.wall-a.backing-b', fromState: 'installed', toState: 'covered' },
    ],
    view: {
      cameraPresetId: 'view.elevation',
      highlightPartIds: ['part.wall-a.cover-panel'],
      hiddenPartIds: [],
      recipe: {
        translateFrom: { partId: 'part.wall-a.cover-panel', offsetMm: [0, -600, 0] },
        ghostPrevious: ['part.wall-a.stud-1', 'part.wall-a.backing-a'],
      },
    },
    parameters: {
      datumNote: 'Demonstration panel trimmed to the door opening, face against the stud faces.',
      fromPartId: 'part.wall-a.stud-1',
      offsetsMm: [0, 0, 1219.2],
      toolId: null,
    },
  },
  {
    id: 'op.position-cabinet',
    title: 'Position cabinet envelope (conditional)',
    kind: 'position',
    targetPartIds: ['part.cabinet.envelope'],
    dependencyOperationIds: ['op.cover-drywall'],
    citationIds: ['citation.sheet-a.cabinet'],
    declaredReleaseStatus: 'conditional',
    releaseId: 'release.p0.conditional',
    preconditions: [
      'Wall covering installed and inspected; backing fastening released (still held in this demonstration).',
    ],
    qualityChecks: [quality('Confirm the delivered cabinet model and door swing', 'photo', ['citation.sheet-a.cabinet'])],
    stopConditions: ['Stop if the cabinet envelope cannot be placed without modifying released parts.'],
    stateEffects: [{ partId: 'part.cabinet.envelope', fromState: 'absent', toState: 'installed' }],
    view: {
      cameraPresetId: 'view.iso',
      highlightPartIds: ['part.cabinet.envelope'],
      hiddenPartIds: [],
      recipe: {},
    },
    parameters: {
      datumNote:
        'After the wall covering is installed: envelope base 914.4 mm above finished floor; 609.6 wide x 609.6 deep x 812.8 high.',
      fromPartId: 'part.wall-a.backing-b',
      offsetsMm: [0, 0, 1320.8],
      toolId: null,
    },
  },
].map((operation) => {
  // Strip undefined optionals so authored JSON stays canonical.
  const clone = { ...operation };
  if (clone.holdReason === undefined) delete clone.holdReason;
  return clone;
});

write('operations.json', operations);

// ---------------------------------------------------------------- steps (18)
const stepDefs = [
  ['step.survey-wall', 10, 'op.survey-wall', 'Verify wall-frame dimensions', 'Wall frame', []],
  ['step.prepare-frame', 20, 'op.prepare-frame', 'Prepare frame materials and tools', 'Wall frame', ['step.survey-wall']],
  ['step.remove-temp', 30, 'op.remove-temp', 'Remove temporary protection', 'Wall frame', ['step.prepare-frame']],
  ['step.cut-frame', 40, 'op.cut-frame', 'Cut frame members', 'Wall frame', ['step.remove-temp']],
  ['step.layout-frame', 50, 'op.layout-frame', 'Lay out the frame', 'Wall frame', ['step.cut-frame']],
  ['step.assemble-frame', 60, 'op.assemble-frame', 'Assemble the frame (flat)', 'Wall frame', ['step.layout-frame']],
  ['step.raise-frame', 70, 'op.raise-frame', 'Raise the frame and fit the temporary brace', 'Wall frame', ['step.assemble-frame']],
  ['step.anchor-frame', 80, 'op.anchor-frame', 'Anchor the bottom plate', 'Wall frame', ['step.raise-frame']],
  ['step.open-doorway', 90, 'op.open-doorway', 'Open the door rough opening', 'Wall frame', ['step.anchor-frame']],
  ['step.inspect-frame', 100, 'op.inspect-frame', 'Inspect the frame', 'Wall frame', ['step.open-doorway']],
  ['step.remove-brace', 110, 'op.remove-brace', 'Remove the temporary brace', 'Wall frame', ['step.inspect-frame']],
  ['step.cut-backing', 120, 'op.cut-backing', 'Cut backing blocks', 'Cabinet backing', ['step.remove-brace']],
  ['step.position-backing', 130, 'op.position-backing', 'Position backing blocks', 'Cabinet backing', ['step.cut-backing']],
  ['step.fasten-backing', 140, 'op.fasten-backing', 'Fasten backing blocks (held)', 'Cabinet backing', ['step.position-backing']],
  ['step.inspect-backing', 150, 'op.inspect-backing', 'Inspect backing blocks', 'Cabinet backing', ['step.fasten-backing']],
  ['step.route-cable', 160, 'op.route-cable', 'Route schematic cable', 'Services & finish', ['step.inspect-frame']],
  ['step.cover-wall', 170, 'op.cover-drywall', 'Cover wall', 'Services & finish', ['step.inspect-backing', 'step.route-cable']],
  ['step.position-cabinet', 180, 'op.position-cabinet', 'Position cabinet envelope', 'Services & finish', ['step.cover-wall']],
];

const toolsByOp = {
  'op.survey-wall': ['tool.tape', 'tool.level', 'tool.pencil'],
  'op.prepare-frame': ['tool.tape', 'tool.pencil', 'tool.square'],
  'op.remove-temp': ['tool.utility-knife'],
  'op.cut-frame': ['tool.miter-saw', 'tool.tape', 'tool.pencil', 'tool.safety-glasses'],
  'op.layout-frame': ['tool.pencil', 'tool.tape', 'tool.square'],
  'op.assemble-frame': ['tool.driver', 'tool.square'],
  'op.raise-frame': ['tool.level', 'tool.driver'],
  'op.anchor-frame': ['tool.drill', 'tool.tape'],
  'op.open-doorway': ['tool.hand-saw', 'tool.utility-knife'],
  'op.inspect-frame': ['tool.tape', 'tool.level', 'tool.square'],
  'op.remove-brace': ['tool.driver'],
  'op.cut-backing': ['tool.miter-saw', 'tool.tape'],
  'op.position-backing': ['tool.level', 'tool.driver'],
  'op.fasten-backing': [],
  'op.inspect-backing': ['tool.tape'],
  'op.route-cable': ['tool.utility-knife'],
  'op.cover-drywall': ['tool.driver', 'tool.utility-knife'],
  'op.position-cabinet': ['tool.level', 'tool.driver'],
};

const steps = stepDefs.map(([id, sequence, operationId, title, phaseLabel, prerequisiteStepIds]) => ({
  id,
  sequence,
  title,
  phaseLabel,
  prerequisiteStepIds,
  operationIds: [operationId],
  visibleAssemblyIds: ['assembly.existing', 'assembly.wall-a', 'assembly.cabinet', 'assembly.demo'],
  toolIds: toolsByOp[operationId] ?? [],
  qualityChecks: [],
  stopConditions: [],
  declaredReleaseStatus: operationId === 'op.fasten-backing'
    ? 'held'
    : operationId === 'op.cut-backing' || operationId === 'op.position-cabinet'
      ? 'conditional'
      : 'ready',
  citationIds: operations.find((operation) => operation.id === operationId).citationIds,
}));

write('steps.json', steps);

// ---------------------------------------------------------------- tools: add the hand saw used to open the doorway
const tools = read('tools.json');
if (!tools.some((tool) => tool.id === 'tool.hand-saw')) {
  tools.push({
    id: 'tool.hand-saw',
    name: 'Hand saw (doorway cut-out)',
    category: 'cutting',
    setup: null,
    citationIds: ['citation.sheet-d.cuts'],
  });
}
write('tools.json', tools);

// ---------------------------------------------------------------- views: add the flat pose
const views = read('views.json');
if (!views.some((view) => view.id === 'view.frame-flat')) {
  views.push({
    id: 'view.frame-flat',
    name: 'Frame layout (flat)',
    kind: 'plan',
    camera: { positionMm: [3400, -1400, 2600], targetMm: [1500, -1100, 0], fov: 45 },
    description: 'Overhead view of the frame members laid out flat on the floor.',
  });
}
write('views.json', views);

// ---------------------------------------------------------------- issues
const issues = read('issues.json');
const issue = (id) => issues.find((candidate) => candidate.id === id);
issue('issue.p0-01').affectedIds = ['measurement.wall-a.opening.width', 'part.wall-a.opening'];
issue('issue.p0-02').title = 'Backing fastener specification not released';
issue('issue.p0-02').detail =
  'The backing blocks have no released fastener type, length, spacing or edge distance; the fastening step stays held and only proposed connection locations may be shown.';
issue('issue.p0-02').affectedIds = ['connection.backing-a.stud-1', 'connection.backing-b.stud-2', 'op.fasten-backing'];
issue('issue.p0-04').affectedIds = ['connection.frame.plate-to-stud', 'connection.frame.plate-to-slab'];
write('issues.json', issues);

// ---------------------------------------------------------------- listing + project copy
const listing = read('listing.json');
listing.summary =
  'Verify the layout, frame the wall — plates, studs, kings, jacks, header and cripples, then raise, anchor, open the doorway and inspect — before fitting the cabinet backing blocks and finishing the services. Demonstration data; four steps are held and shown as previews only.';
listing.tags = ['demo', 'framing', 'door opening', 'held steps'];
write('listing.json', listing);

const project = read('project.json');
project.description =
  'Demonstration project for the guide platform: a conventionally framed 96 in wall with bottom and top plates, common and king studs, jack studs, a supported 2x6 header with cripple studs, a cut-out door rough opening, temporary bracing, and two cabinet backing blocks fitted in the stud bays. All data is synthetic fixture data, not a construction plan.';
write('project.json', project);

console.log('operations', operations.length, '| steps', steps.length, '| screw points', SCREW_POINTS.length, '| anchor points', ANCHOR_POINTS.length);
console.log('phases:', [...new Set(steps.map((s) => s.phaseLabel))].join(' -> '));
