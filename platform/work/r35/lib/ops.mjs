/**
 * R35 operations and steps.
 *
 * Dependency topology follows the owner-corrected packet: p4 survey (ready) -> p7 work area
 * (ready) -> p13/p14 loose-stock practice (ready) -> p5 bounded trim removal (held) -> p8/p11
 * plate layouts -> p10/p15 reviews -> p16 plate positioning/restraint -> p9 W1 studs -> p12 W2
 * frame -> p17 straightening -> p18/p19 backing -> p20 EX1 (held) -> p21-p26 drywall -> p27
 * fixtures -> p28 G1-G7 gates -> p29 source record. Page locators stay on every step; page order
 * is not dependency order.
 */

const ALL_ASSEMBLIES = [
  'assembly.existing',
  'assembly.w1',
  'assembly.backing',
  'assembly.w2',
  'assembly.drywall',
  'assembly.fixtures',
  'assembly.trim',
  'assembly.practice',
];

export function buildOperations({ src, csvs, geo, cite, model }) {
  const w1StudIds = src.w1StudCentersIn.map((_, index) => `part.w1.stud-s${String(index + 1).padStart(2, '0')}`);
  const w2StudIds = src.w2FaceStudsIn.map((_, index) => `part.w2.stud-s${String(index + 1).padStart(2, '0')}`);
  const w1FrameIds = ['part.w1.bottom-plate', 'part.w1.top-plate', ...w1StudIds];
  const w2FrameIds = ['part.w2.bottom-plate', 'part.w2.top-plate', ...w2StudIds];
  const blockIds = csvs.backing.map((row) => `part.backing.${row.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
  const panelIds = csvs.panels.map((row) => `part.drywall.${row.panel_id.toLowerCase()}`);
  const wallSchematicElevation = {
    studPartIds: [...w1StudIds, ...w2StudIds],
    topPlatePartIds: ['part.w1.top-plate', 'part.w2.top-plate'],
    panelPartIds: panelIds,
    contextPartIds: ['part.existing.ex1-wall', 'part.existing.column'],
    overallHeightMm: 2819.4,
    bottomPlateThicknessMm: 38.1,
    topPlateThicknessMm: 38.1,
    label: 'Schematic wall + drywall height — 111 in reported reference only; every member and sheet is field-fit / not a cut dimension',
  };
  const fixtureIds = [
    'part.fixture.base-row',
    'part.fixture.fillers',
    'part.fixture.divider',
    'part.fixture.fridge',
    'part.fixture.fridge-bay',
    'part.fixture.counter',
    'part.fixture.upper-u1',
    'part.fixture.upper-u2',
    'part.fixture.upper-u3',
    'part.fixture.shelves',
  ];
  const houseFrameIds = [...w1FrameIds, ...w2FrameIds];
  const frameAndBackingIds = [...houseFrameIds, ...blockIds];
  const frameBackingAndDrywallIds = [...frameAndBackingIds, ...panelIds];
  const fullConceptIds = [...frameBackingAndDrywallIds, ...fixtureIds];
  const trimIds = csvs.parts ? src.trim.existing_baseboards.map((zone) => `part.trim.${zone.id.toLowerCase()}`) : [];
  const nonPracticePartIds = model.parts
    .filter((part) => part.assemblyId !== 'assembly.practice')
    .map((part) => part.id);
  const practiceFrameHiddenPartIds = [...nonPracticePartIds, 'part.practice.angle'];
  const practiceCutPartIds = [
    'part.practice.plate-a',
    'part.practice.plate-b',
    'part.practice.stud-a',
    'part.practice.stud-b',
    'part.practice.stud-c',
  ];
  const practiceFrameBoxTransforms = [
    { partId: 'part.practice.plate-b', offsetMm: [609.6, 0, 571.5] },
    { partId: 'part.practice.stud-a', offsetMm: [0, 250, 19.05] },
    { partId: 'part.practice.stud-b', offsetMm: [0, 250, 19.05] },
    { partId: 'part.practice.stud-c', offsetMm: [0, 250, 19.05] },
  ];
  const ex1RequirementPreview = {
    measurementIds: [
      'measurement.ex1.finished-clear-width-min',
      'measurement.ex1.plan-column-to-closet-span',
      'measurement.ex1.plan-shortfall-before-finishes',
    ],
    label: 'HELD EX1 DOOR PREVIEW · LOCATION: rear shelf wall, retained column face → refrigerator side · WIDTH: 37 in minimum finished clear (30 1/8 in plan span + at least 6 7/8 in) · DISPLAY HEIGHT: 80 in only · actual height and cuts UNKNOWN',
    boxes: [
      {
        id: 'preview.ex1.door-left-jamb',
        label: 'Door-like preview left edge at retained column face; conditional location',
        centerMm: [19.05, 1657.35, 1016],
        sizeMm: [38.1, 101.6, 2032],
        style: 'target',
      },
      {
        id: 'preview.ex1.door-right-jamb',
        label: 'Door-like preview right edge at 37-in minimum finished-clear target',
        centerMm: [920.75, 1657.35, 1016],
        sizeMm: [38.1, 101.6, 2032],
        style: 'target',
      },
      {
        id: 'preview.ex1.door-head',
        label: 'Door-like preview head at 80-in schematic display height; actual height unknown',
        centerMm: [469.9, 1657.35, 2012.95],
        sizeMm: [939.8, 101.6, 38.1],
        style: 'target',
      },
      {
        id: 'preview.ex1.door-display-baseline',
        label: 'Door-like display baseline only; not a sill or cut instruction',
        centerMm: [469.9, 1657.35, 6.35],
        sizeMm: [939.8, 101.6, 12.7],
        style: 'target',
      },
      {
        id: 'preview.ex1.plan-span-limit',
        label: '30 1/8-in original-plan column-to-closet framing-span limit before finishes',
        centerMm: [765.175, 1657.35, 1016],
        sizeMm: [12.7, 127, 2032],
        style: 'context',
      },
      {
        id: 'preview.ex1.minimum-extension-zone',
        label: 'Minimum 6 7/8-in extension toward refrigerator side before finish allowance',
        centerMm: [852.4875, 1657.35, 1016],
        sizeMm: [174.625, 76.2, 2032],
        style: 'extension',
      },
    ],
  };

  const operations = [];
  const addOp = (op) => {
    operations.push(op);
    return op.id;
  };
  const view = (cameraPresetId, highlightPartIds = [], hiddenPartIds = [], recipe = {}) => ({ cameraPresetId, highlightPartIds, hiddenPartIds, recipe });

  // ---- survey & logistics (ready) -----------------------------------------------------------------
  addOp({
    id: 'op.survey-finished-faces',
    title: 'Survey finished faces, endpoints and the physical truss line',
    kind: 'survey',
    targetPartIds: ['part.existing.ex1-wall', 'part.existing.column', 'part.reference.truss-band', 'part.fixture.fridge', 'part.fixture.base-row', 'part.existing.tile-floor', 'part.existing.kitchen-door'],
    dependencyOperationIds: [],
    citationIds: [cite.card.p04('steps', 'Survey items 01-05'), cite.card.p04('ready', 'Non-destructive survey ready'), cite.card.p04('no-cut', 'No stud cut from the 111-in report'), cite.card.p02('inside', '149-in inside run'), cite.json.w1Trial, cite.json.holdPoints],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.r35.survey',
    preconditions: [
      'Painter\'s tape and a field record available; no destructive exposure or drilling is authorized by this survey.',
    ],
    qualityChecks: [
      { instruction: 'W1 finished inside length recorded at floor, counter height and ceiling; W2 contact plane and the reported column projection/width recorded', evidenceRequired: 'measurement', citationIds: [cite.card.p04('steps', 'Measure W1 at three heights and the column')] },
      { instruction: 'Physical roof-truss bottom chord located and marked at both ends and the middle, with any offset from the trial line recorded', evidenceRequired: 'field_measurement_or_photo', citationIds: [cite.card.p04('steps', 'Locate the physical bottom chord')] },
      { instruction: 'B1, B2 and B3 measured separately; the 37-in bay and 108-in base row taped on the floor', evidenceRequired: 'field_measurement_or_photo', citationIds: [cite.card.p04('steps', 'Measure boxes separately; tape the bay and row')] },
      { instruction: 'Both EX1 faces and all existing trim photographed and marked; closet inside width/depth recorded as survey facts only', evidenceRequired: 'photo', citationIds: [cite.card.p04('steps', 'Photograph EX1 and trim')] },
    ],
    stopConditions: [
      'Do not turn the reported 111-in finished ceiling into a stud cut.',
      'Do not infer a fastening point from the A7 PDF alone.',
      'If any endpoint/ceiling plane changes, revise the model, cuts, drywall sheets, trim and cart together.',
    ],
    stateEffects: [],
    view: view('view.iso', ['part.existing.ex1-wall', 'part.reference.truss-band'], [], { reveal: [...w1FrameIds, ...w2FrameIds] }),
    parameters: {
      measurementIds: [
        'measurement.w1.finished-inside',
        'measurement.w1.outside-depth-trial',
        'measurement.w1.clear-depth-derived',
        'measurement.w2.finished-thickness',
        'measurement.column.projection',
        'measurement.column.width',
        'measurement.closet.inside-width',
        'measurement.closet.depth',
        'measurement.truss.center-trial',
        'measurement.w2.plate-53.125',
        'measurement.cabinets.combined',
        'measurement.fridge.clear-bay',
        'measurement.ceiling.reported',
      ],
      checkInstruction: 'Write measured faces on painter\'s tape and in the field record: mark EX1 as depth zero, tape the proposed W1 room-side face at about 68 in with its 4 1/2-in thickness and the 149-in finished inside run; locate the physical roof-truss bottom chord; measure W1 at three heights, the W2 column projection/width and contact plane; measure B1/B2/B3 separately and tape the 37-in bay and 108-in base row; photograph both EX1 faces and all trim. Field survey itself is safe independent work; destructive exposure and drilling remain held.',
    },
  });

  addOp({
    id: 'op.survey-trim',
    title: 'Non-destructive trim survey at the W1 receiver, column and EX1 faces',
    kind: 'inspect',
    targetPartIds: [...trimIds, 'part.existing.kitchen-door'],
    dependencyOperationIds: ['op.survey-finished-faces'],
    citationIds: [cite.card.p05('scope', 'Trim scope before framing'), cite.card.p05('zones', 'TR-01/TR-02/TR-03 ranges'), cite.json.trimRetained, cite.json.trimQuantity],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.r35.survey',
    preconditions: ['Survey photographs and markings available; nothing is removed during this survey.'],
    qualityChecks: [
      { instruction: 'TR-01..TR-03 zones and both EX1 faces photographed; hidden fasteners/services looked for before any removal mark', evidenceRequired: 'photo', citationIds: [cite.card.p05('zones', 'Photograph first; protect tile; ease trim off')] },
      { instruction: 'Retained trim and the kitchen-side door/jamb/casing identified and left in place', evidenceRequired: 'visual', citationIds: [cite.card.p05('scope', 'Keep the existing kitchen-side door, jamb and casing'), cite.json.trimRetained] },
    ],
    stopConditions: [
      'Do not remove any trim during this survey; removal is held for the marked contact areas and the EX1 opening boundary.',
    ],
    stateEffects: [],
    view: view('view.elevation-w1', trimIds, [], { reveal: w1FrameIds }),
    parameters: {
      inspectWhat: 'Existing baseboard/shoe at the W1 left-end receiver, the W2/column contact and both accessible EX1 faces, plus the retained kitchen-side door/jamb/casing.',
      criteria: 'Every zone is photographed, marked and measured only as needed to define the future removal limits; no trim length is released and nothing is removed.',
      evidenceRequired: 'photo',
    },
  });

  addOp({
    id: 'op.protect-route',
    title: 'Protect the tile, inventory the members and prove the carry route',
    kind: 'inspect',
    targetPartIds: ['part.existing.tile-floor', 'part.w1.bottom-plate', 'part.w1.top-plate', 'part.w2.bottom-plate', 'part.w2.top-plate'],
    dependencyOperationIds: ['op.survey-finished-faces'],
    citationIds: [cite.card.p07('ready', 'READY: protect, inventory and prove the handling route'), cite.card.p07('steps', 'Protect the tile, label members, prove the carry path'), cite.card.p07('helper', 'Helper and build-in-place statement'), cite.json.logicalRaising],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.r35.survey',
    preconditions: ['Work area accessible; protection materials and a helper plan available.'],
    qualityChecks: [
      { instruction: 'Tile protected and a clamped cutting bench established in the flex room; long-plate and 4x10 carry path proven before enclosing the room', evidenceRequired: 'photo', citationIds: [cite.card.p07('steps', 'Protect the tile and prove the carry path')] },
      { instruction: 'W1/W2 plates and studs labelled by ID, pantry/room face and datum end; the room face kept accessible for backing connectors and inspection', evidenceRequired: 'visual', citationIds: [cite.card.p07('steps', 'Label plates and studs by ID')] },
      { instruction: 'Temporary support and the top/base/end connections accepted before any house member is set; no reliance on a helper alone to hold an unfinished wall', evidenceRequired: 'visual', citationIds: [cite.card.p07('steps', 'Do not rely on a helper alone')] },
    ],
    stopConditions: ['Do not set any house member before the temporary support and connection details are accepted.', 'No full-height frame tilt is planned; do not adopt a double top plate without revising all dependent heights.'],
    stateEffects: [],
    view: view('view.practice-bench', [], [], {
      reveal: [...w1FrameIds, ...w2FrameIds, 'part.practice.stock', ...practiceCutPartIds],
    }),
    parameters: {
      inspectWhat: 'Work-area protection, member inventory/labelling and the handling route for long plates and 4x10 sheets.',
      criteria: 'Tile protection is in place, every member is labelled by ID and face, and the carry route is walked and proven; build-in-place method with a single top plate per wall.',
      evidenceRequired: 'photo',
    },
  });

  addOp({
    id: 'op.stage-tools',
    title: 'Stage the accepted tools and the separate practice board',
    kind: 'prepare',
    targetPartIds: ['part.practice.stock', ...practiceCutPartIds],
    dependencyOperationIds: ['op.survey-finished-faces'],
    citationIds: [cite.card.p07('tools', 'Tool rows by operation'), cite.json.tools, cite.card.p13('limits', 'Use the actual tool manuals'), cite.pvt('source.r35.ref.ryobi-pbldd02', 'ryobi-family-manual', 'Cached Ryobi manual; the purchased model is not recorded.')],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.r35.survey',
    preconditions: ['Tool condition checked before use; the practice board is kept separate from house parts.'],
    qualityChecks: [
      { instruction: 'Tool set matches the survey/trim, square-cut, frame-assembly and drywall rows; the practice board is staged separately', evidenceRequired: 'visual', citationIds: [cite.card.p07('tools', 'Tool rows')] },
    ],
    stopConditions: ['Stop if a listed tool is missing, damaged or lacks its manual.'],
    stateEffects: [],
    view: view('view.practice-bench', ['part.practice.stock', ...practiceCutPartIds], practiceFrameHiddenPartIds, {
      reveal: ['part.practice.stock', ...practiceCutPartIds],
    }),
    parameters: {
      materialIds: ['material.lumber.practice'],
      toolIds: ['tool.tape-measure', 'tool.pencil', 'tool.square', 'tool.level-48', 'tool.straightedge-laser', 'tool.mason-line', 'tool.circular-saw', 'tool.drill-driver', 'tool.clamps', 'tool.work-supports', 'tool.work-platform', 'tool.utility-knife', 'tool.putty-knife', 'tool.pry-bar', 'tool.wood-pad', 'tool.end-nippers', 'tool.eye-protection'],
      instruction: 'Stage the accepted survey/trim and frame-assembly tools plus the separate 2x4x10 practice board. One-person layout and cutting are possible; a helper holds long top plates and handles drywall sheets. No framing nailer or framing nail strips are required or used.',
      cutOperationIds: ['op.cut-practice'],
      note: 'This is the only released cut list: loose practice stock only. House plates, studs, backing, drywall and trim remain field-fit/held and must not inherit these dimensions.',
    },
  });

  // ---- loose-stock practice (ready) ---------------------------------------------------------------
  addOp({
    id: 'op.prepare-practice',
    title: 'Prepare the loose-stock practice cut list',
    kind: 'prepare',
    targetPartIds: ['part.practice.stock', ...practiceCutPartIds],
    dependencyOperationIds: ['op.stage-tools'],
    citationIds: [cite.card.p13('yield', 'Practice cut yield'), cite.card.p13('ready', 'Loose-stock practice ready after checks'), cite.json.framingConcept],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.r35.practice',
    preconditions: ['Practice stock is the separate 2x4x10 board; no house part is consumed.'],
    qualityChecks: [
      { instruction: 'Cut list matches two 24-in plates and three 21-in studs for the 24x24-in mock rectangle, with kerf/waste checked against the 120-in board', evidenceRequired: 'visual', citationIds: [cite.card.p13('yield', 'Two 24-in plates and three 21-in studs')] },
    ],
    stopConditions: ['Stop if house parts are staged in place of the practice board.'],
    stateEffects: [],
    view: view('view.practice-bench', ['part.practice.stock'], practiceFrameHiddenPartIds),
    parameters: {
      materialIds: ['material.lumber.practice'],
      toolIds: ['tool.circular-saw', 'tool.square', 'tool.tape-measure', 'tool.clamps', 'tool.work-supports', 'tool.eye-protection'],
      instruction: 'Loose stock only: from the separate dry 2x4x10 practice board, cut two 24-in plates and three 21-in studs for a 24x24-in mock rectangle, then use surplus offcuts for a separate angle-and-screw trial. Never house framing and never in the installed takeoff.',
      cutOperationIds: ['op.cut-practice'],
      note: 'Net cuts 2 x 24 + 3 x 21 = 111 in against the 120-in board with kerf/waste checked.',
    },
  });

  addOp({
    id: 'op.cut-practice',
    title: 'Cut the loose practice members',
    kind: 'cut',
    targetPartIds: ['part.practice.plate-a', 'part.practice.plate-b', 'part.practice.stud-a', 'part.practice.stud-b', 'part.practice.stud-c'],
    dependencyOperationIds: ['op.prepare-practice'],
    citationIds: [cite.card.p13('ready', 'Square cut practice'), cite.card.p13('yield', 'Practice cut list')],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.r35.practice',
    preconditions: ['Keeper clamped to stable supports; offcut left free so the kerf cannot pinch the blade; blade kerf placed on waste.'],
    qualityChecks: [
      { instruction: 'First cut checked square; each practice member within a tight tolerance of 24 in / 21 in', evidenceRequired: 'measurement', citationIds: [cite.card.p13('ready', 'Check the first cut square')] },
    ],
    stopConditions: ['Stop if the saw guard or support is not proven.', 'Unplug a corded saw or remove its battery for blade/depth setup.'],
    stateEffects: [
      { partId: 'part.practice.plate-a', fromState: 'absent', toState: 'cut' },
      { partId: 'part.practice.plate-b', fromState: 'absent', toState: 'cut' },
      { partId: 'part.practice.stud-a', fromState: 'absent', toState: 'cut' },
      { partId: 'part.practice.stud-b', fromState: 'absent', toState: 'cut' },
      { partId: 'part.practice.stud-c', fromState: 'absent', toState: 'cut' },
    ],
    view: view('view.practice-bench', ['part.practice.plate-a', 'part.practice.plate-b', 'part.practice.stud-a', 'part.practice.stud-b', 'part.practice.stud-c'], practiceFrameHiddenPartIds),
    parameters: {
      cuts: [
        { partId: 'part.practice.plate-a', finalLengthMm: '609.6', note: 'Practice plate, 24 in, loose stock only.' },
        { partId: 'part.practice.plate-b', finalLengthMm: '609.6', note: 'Practice plate, 24 in, loose stock only.' },
        { partId: 'part.practice.stud-a', finalLengthMm: '533.4', note: 'Practice stud, 21 in, loose stock only.' },
        { partId: 'part.practice.stud-b', finalLengthMm: '533.4', note: 'Practice stud, 21 in, loose stock only.' },
        { partId: 'part.practice.stud-c', finalLengthMm: '533.4', note: 'Practice stud, 21 in, loose stock only.' },
      ],
      toolId: 'tool.circular-saw',
    },
  });

  addOp({
    id: 'op.fit-practice-frame',
    title: 'Dry-fit the 24x24-in practice mock frame',
    kind: 'position',
    targetPartIds: ['part.practice.plate-a', 'part.practice.plate-b', 'part.practice.stud-a', 'part.practice.stud-b', 'part.practice.stud-c'],
    dependencyOperationIds: ['op.cut-practice'],
    citationIds: [cite.card.p13('yield', 'Dry-fit the 24x24-in rectangle'), cite.card.p13('limits', 'A good mock joint checks technique, not the wall capacity')],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.r35.practice',
    preconditions: ['Practice members cut and square-checked.'],
    qualityChecks: [
      { instruction: 'Mock rectangle closes to 24x24 in on loose stock without forcing members', evidenceRequired: 'measurement', citationIds: [cite.card.p13('yield', '24x24-in dry fit')] },
    ],
    stopConditions: ['Stop if any practice member is out of square or damaged; recut from the practice stock only.'],
    stateEffects: [
      { partId: 'part.practice.plate-a', fromState: 'cut', toState: 'positioned' },
      { partId: 'part.practice.plate-b', fromState: 'cut', toState: 'positioned' },
      { partId: 'part.practice.stud-a', fromState: 'cut', toState: 'positioned' },
      { partId: 'part.practice.stud-b', fromState: 'cut', toState: 'positioned' },
      { partId: 'part.practice.stud-c', fromState: 'cut', toState: 'positioned' },
    ],
    view: view(
      'view.practice-bench',
      ['part.practice.plate-a', 'part.practice.stud-a', 'part.practice.stud-b'],
      practiceFrameHiddenPartIds,
      { boxTransforms: practiceFrameBoxTransforms },
    ),
    parameters: {
      datumNote: 'Assemble the 24x24-in dry-fit rectangle on loose stock from the two 24-in practice plates and three 21-in practice studs; this is technique practice, not a house assembly.',
      fromPartId: null,
      offsetsMm: null,
      toolId: 'tool.square',
    },
  });

  addOp({
    id: 'op.read-connector-card',
    title: 'Read the connector stamp, screw box and driver card',
    kind: 'inspect',
    targetPartIds: ['part.practice.angle'],
    dependencyOperationIds: ['op.prepare-practice'],
    citationIds: [cite.card.p14('spec', 'Read the connector stamp and screw box'), cite.card.p14('nonselected', 'Nonselected alternatives'), cite.esr('note', 'ESR excerpt note: directional values only'), cite.pvt('source.r35.ref.simpson-tech', 'simpson-tech-note', 'Cached Simpson technical supplement; substitution rules reference.')],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.r35.practice',
    preconditions: ['Connector tag/stamp and screw packaging available at the work area.'],
    qualityChecks: [
      { instruction: 'Candidate product family (A34/A34Z) and screws (SD9112 #9 x 1 1/2 in) read and matched to the packaging; nonselected products identified', evidenceRequired: 'visual', citationIds: [cite.card.p14('spec', 'A34 candidate with SD9112')] },
    ],
    stopConditions: [
      'SDWS structural wood screws are a different product and are not substitutes through these connector holes.',
      'Do not create arbitrary pilot holes and do not treat a clutch number as a torque specification.',
    ],
    stateEffects: [],
    view: view('view.closeup-connector', ['part.practice.angle']),
    parameters: {
      inspectWhat: 'Connector stamp, screw box and driver/accessory card against the candidate A34/A34Z + SD9112 data.',
      criteria: 'Exact product and screw match the card; SDWS, mending plates and nail-only ties are identified as nonselected; practice only.',
      evidenceRequired: 'visual',
    },
  });

  addOp({
    id: 'op.drive-practice-screws',
    title: 'Drive the practice angle-and-screw trial on scrap',
    kind: 'fasten',
    targetPartIds: ['part.practice.angle', 'part.practice.plate-a'],
    dependencyOperationIds: ['op.read-connector-card', 'op.fit-practice-frame'],
    citationIds: [cite.card.p13('yield', 'Separate angle-and-screw trial'), cite.card.p14('spec', 'Perpendicular driving and seated heads'), cite.card.p14('sources', 'Keep the product and driver manuals at the work area'), cite.esr('note', 'Directional values only')],
    declaredReleaseStatus: 'ready',
    releaseId: 'release.r35.practice',
    preconditions: ['Scrap members square and clamped; hands outside the screw exit path.'],
    qualityChecks: [
      { instruction: 'Angle seats tight to both scrap faces in the specified direction; heads seated on metal without crushing or stripping; all required practice holes filled', evidenceRequired: 'visual', citationIds: [cite.card.p14('spec', 'Drive slowly until the head seats on the metal')] },
      { instruction: 'Check each required hole, model marking, head seating and wood for cracks or breakout; a spinning screw or deformed connector fails the check', evidenceRequired: 'visual', citationIds: [cite.card.p13('yield', 'Check holes, seating and wood')] },
    ],
    stopConditions: [
      'A spinning screw or deformed connector fails the check: stop and use the manufacturer\'s correction.',
      'Do not add random screws or substitute a longer screw to repair a failed hole.',
      'Do not angle a screw just because the chuck will not fit.',
    ],
    stateEffects: [],
    view: view('view.practice-bench', ['part.practice.angle'], [], { showFastenerPoints: { connectionId: 'connection.practice.angle-scrap', proposed: true } }),
    parameters: {
      connectionIds: ['connection.practice.angle-scrap'],
      pointsMm: null,
      proposed: true,
      toolId: 'tool.hex-nutsetter',
    },
  });

  // ---- bounded trim removal (held) -----------------------------------------------------------------
  addOp({
    id: 'op.remove-trim-selective',
    title: 'Remove only the marked baseboard at confirmed tie-ins (held)',
    kind: 'remove',
    targetPartIds: trimIds,
    dependencyOperationIds: ['op.survey-trim'],
    citationIds: [cite.card.p05('zones', 'TR-01/TR-02/TR-03 bounded removal'), cite.json.trimBaseboards, cite.json.trimQuantity, cite.json.releases],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.trim-removal',
    holdReason: 'selective_existing_trim_removal: held for marked contact areas and the EX1 opening boundary (non-destructive trim survey is ready). No trim length or extent is released.',
    preconditions: ['Zones field-marked after the W1 end surface, column contact and EX1 boundaries are confirmed.'],
    qualityChecks: [
      { instruction: 'Only trim within the marked contact/opening limits removed; adjacent runs and the kitchen-side door/jamb/casing protected', evidenceRequired: 'photo', citationIds: [cite.card.p05('scope', 'Keep the existing kitchen-side door, jamb and casing'), cite.card.p05('bounds', 'Do not remove an entire room by default')] },
      { instruction: 'Tile protected; caulk/paint seams scored; trim eased off near fasteners; salvage nails pulled through the back; reusable pieces labelled', evidenceRequired: 'visual', citationIds: [cite.card.p05('zones', 'Photograph first; protect tile; ease trim off')] },
    ],
    stopConditions: ['Stop at any hidden fastener, service or unexpected wall condition.', 'Trim removal does not authorize drilling or tile removal.'],
    stateEffects: [],
    view: view('view.elevation-w1', trimIds),
    parameters: {
      disposition: 'reuse',
      note: 'Remove only the portion obstructing the verified footprint/tie-in; label and reuse sound pieces. Trim lengths remain field measurements.',
    },
  });

  // ---- plate layouts (conditional marking) ---------------------------------------------------------
  addOp({
    id: 'op.layout-w1-plates',
    title: 'Mark W1 plate stud footprints and the conditional plate length',
    kind: 'position',
    targetPartIds: ['part.w1.bottom-plate', 'part.w1.top-plate', 'part.w1.stud-s01', 'part.w1.stud-s11', 'part.w1.stud-s12'],
    dependencyOperationIds: ['op.survey-finished-faces', 'op.stage-tools'],
    citationIds: [cite.card.p08('centres', 'W1 candidate centres'), cite.card.p08('steps', 'Lay out and square the footprints'), cite.card.p08('arithmetic', 'Conditional 156 3/4-in plate arithmetic'), cite.json.backingStuds],
    declaredReleaseStatus: 'conditional',
    releaseId: 'release.r35.plan',
    preconditions: ['Finished faces and the corner receiver field-verified; plate stock sections checked.'],
    qualityChecks: [
      { instruction: 'All 12 ID footprints match between the two marked plates in the same datum direction; pantry-face arrows agree; receiving plane recorded', evidenceRequired: 'measurement', citationIds: [cite.card.p08('steps', 'All footprints match; arrows agree')] },
      { instruction: 'First/last member edges checked against the actual endpoint before any cut is considered', evidenceRequired: 'measurement', citationIds: [cite.card.p08('steps', 'Check first/last edges against the endpoint')] },
    ],
    stopConditions: ['This is not a saw cut: end surfaces and corner support must be accepted before any plate length is treated as a cut.', 'Do not transfer superseded layout marks.'],
    stateEffects: [],
    view: view('view.elevation-w1', ['part.w1.bottom-plate', 'part.w1.top-plate', 'part.w1.stud-s01', 'part.w1.stud-s11', 'part.w1.stud-s12']),
    parameters: {
      datumNote: 'Lay dry W1-TP and accepted sill W1-BP side by side with their left datum ends flush; mark each 1 1/2-in candidate stud footprint across both plates from datum zero at 3/4, 16, 32, 48, 64, 80, 96, 112, 128, 144, 148 3/4 and 156 in. S11 is a short corner backer and S12 an end member, not a normal 16-in bay.',
      fromPartId: null,
      offsetsMm: null,
      toolId: 'tool.square',
    },
  });

  addOp({
    id: 'op.layout-w2-plates',
    title: 'Mark W2 2x8 plate candidates and the column-end field fit',
    kind: 'position',
    targetPartIds: ['part.w2.bottom-plate', 'part.w2.top-plate', 'part.w2.stud-s01'],
    dependencyOperationIds: ['op.survey-finished-faces', 'op.stage-tools'],
    citationIds: [cite.card.p11('scope', 'W2 ends at the column front'), cite.card.p11('chain', '8 3/8-in layer chain'), cite.card.p11('projection', '53 / 53 1/8-in comparison'), cite.json.w2Plate53125],
    declaredReleaseStatus: 'conditional',
    releaseId: 'release.r35.plan',
    preconditions: ['W2 datum zero set at the W2/W1 end; actual finished pantry depth and exposed column front measured at floor, mid-height and overhead.'],
    qualityChecks: [
      { instruction: 'W2-TP and BP marked together with pantry/room faces and W1/column ends unmistakable; first four candidate centres only if they fit the accepted end detail', evidenceRequired: 'measurement', citationIds: [cite.card.p11('projection', 'First four candidate centres; field-fit the last member')] },
      { instruction: 'Actual dry 2x8 section and gypsum thicknesses verified before any drywall or plate cut', evidenceRequired: 'measurement', citationIds: [cite.card.p11('chain', 'Verify the 2x8 section and gypsum thicknesses')] },
    ],
    stopConditions: ['Actual column contact governs; no W2 longitudinal cut is released.', 'A different delivered section or column finish changes the plane and trim fit.'],
    stateEffects: [],
    view: view('view.elevation-w2', ['part.w2.bottom-plate', 'part.w2.top-plate']),
    parameters: {
      datumNote: 'Set W2 datum zero at the W2/W1 end. Candidate plate length 53 to 53 1/8 in (53 1/8 in at the reported 10 7/8-in column projection); mark the first four candidate stud centres 3/4, 16, 32 and 48 in from the W2 plate datum only if they fit the accepted end detail, and field-fit the last member against the true column end.',
      fromPartId: null,
      offsetsMm: null,
      toolId: 'tool.tape-measure',
    },
  });

  // ---- reviews (held/conditional) -------------------------------------------------------------------
  addOp({
    id: 'op.review-connector',
    title: 'Review the A34/A34Z candidate and the ESR-3096 limitations',
    kind: 'inspect',
    targetPartIds: ['part.practice.angle', 'part.w1.stud-s01', 'part.w2.stud-s01'],
    dependencyOperationIds: ['op.read-connector-card', 'op.drive-practice-screws'],
    citationIds: [cite.card.p10('candidate', 'Candidate angle and 4+4 pattern'), cite.card.p10('esr-limits', 'ESR limitations'), cite.card.p10('limits', 'No cabinet weight rating'), cite.esr('note4', 'F1 rotation restraint'), cite.esr('note5', '3-in minimum for opposing angles'), cite.esr('note6', 'F2 directional / both sides'), cite.json.connections],
    declaredReleaseStatus: 'conditional',
    releaseId: 'release.r35.plan',
    preconditions: ['ESR-3096 Table 5 / Figure 5 excerpt card and the connector card reviewed together.'],
    qualityChecks: [
      { instruction: 'Candidate data confirmed as connector-table data only: no project angle quantity, orientation, rotation restraint or capacity claim', evidenceRequired: 'visual', citationIds: [cite.card.p10('conditional', 'Project placement and capacity not released')] },
      { instruction: 'Opposing-angle 3-in minimum recognized for the 1.5-in studs; no vertical-stagger exception assumed', evidenceRequired: 'visual', citationIds: [cite.esr('note5', 'Minimum member thickness note')] },
    ],
    stopConditions: ['Do not convert a directional table capacity into a cabinet-load rating or an installed project quantity.', 'Connector coating at treated plates must match the treatment and exposure.'],
    stateEffects: [],
    view: view('view.closeup-connector', ['part.w1.bottom-plate', 'part.w1.stud-s01']),
    parameters: {
      inspectWhat: 'Candidate A34/A34Z cavity-side angle with SD9112 screws (4 per member), the ESR-3096 Table 5/Figure 5 limitations and the project holds.',
      criteria: 'The review stays conditional: project load direction, rotation restraint, orientation, installed count and capacity are all held; the pattern applies only to an accepted angle.',
      evidenceRequired: 'visual',
    },
  });

  addOp({
    id: 'op.review-slab-base',
    title: 'Investigate the tile/slab base and clear each proposed hole cylinder (held)',
    kind: 'inspect',
    targetPartIds: ['part.existing.tile-floor', 'part.existing.slab'],
    dependencyOperationIds: ['op.survey-finished-faces', 'op.stage-tools'],
    citationIds: [cite.card.p15('hold', 'No drilling until cleared'), cite.card.p15('steps', 'Record the floor stack and clear hole cylinders'), cite.card.p15('limits', 'Never count tile/mortar as embedment'), cite.permit(13, { x: 10, y: 590, width: 195, height: 190 }, 'd5-detail-18-base-reference', 'D5 detail 18 is an original-house typical 2x4 interior nonbearing wall reference, not a retrofit coordinate schedule'), cite.json.holdPoints],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.slab-drilling',
    holdReason: 'slab_drilling: held until the substrate, hidden services and the complete retrofit anchor detail are cleared. Original-house D5/18 gives only a typical Hilti X-CF-or-equal 12-in-o.c. staggered note for a 2x4 PT sill; it does not supply a first offset, W1/W2 center coordinates, W2 2x8 applicability, edge distance, embedment or tile clearance.',
    preconditions: ['House drawings and a qualified site investigation available for the hole-clearance review.'],
    qualityChecks: [
      { instruction: 'Floor stack recorded (tile, mortar/underlayment, concrete); cracks, loose tile, movement joints, membranes and the actual bearing surface identified', evidenceRequired: 'field_measurement_or_photo', citationIds: [cite.card.p15('steps', 'Record the floor stack')] },
      { instruction: 'Every proposed hole cylinder checked for embedded services, reinforcement/tendons and prohibited joints; the PDF is not treated as a clearance certificate', evidenceRequired: 'photo', citationIds: [cite.card.p15('steps', 'Clear every proposed hole cylinder')] },
    ],
    stopConditions: [
      'Never count tile/mortar as anchor embedment or promise crack-free drilling.',
      'Do not drill a test hole to discover hidden services.',
      'No drilling is released by this review; it can only record findings or hold.',
    ],
    stateEffects: [],
    view: view('view.closeup-slab', ['part.existing.tile-floor', 'part.existing.slab']),
    parameters: {
      inspectWhat: 'Tile/mortar/slab layer stack, hidden services, movement joints and the anchor target below W1/W2.',
      criteria: 'Either an accepted retrofit detail exists with every hole envelope cleared, or anchor/drilling work stays held. D5/18 alone does not establish project coordinates.',
      evidenceRequired: 'field_measurement_or_photo',
    },
  });

  // ---- p16 plates (held) ---------------------------------------------------------------------------
  addOp({
    id: 'op.set-bottom-plates',
    title: 'Set and align the W1/W2 bottom plates (held)',
    kind: 'position',
    targetPartIds: ['part.w1.bottom-plate', 'part.w2.bottom-plate'],
    dependencyOperationIds: ['op.layout-w1-plates', 'op.layout-w2-plates', 'op.review-connector', 'op.review-slab-base'],
    citationIds: [cite.card.p16('order', 'Execute before stud installation'), cite.card.p16('steps', 'Set the bottom plate on the accepted stack'), cite.json.logicalW1],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.frame-cuts',
    holdReason: 'frame_cuts/slab_drilling: held until the plate endpoints, bearing/separation stack and anchor detail are accepted; no plate cut or set is released.',
    preconditions: ['Base/top/end/restraint details accepted (p10/p15 reviews); marked plates cross-checked against the surveyed line.'],
    qualityChecks: [
      { instruction: 'Plate reference edge aligned to the surveyed line; parallel plate faces and plumb end lines rechecked', evidenceRequired: 'measurement', citationIds: [cite.card.p16('steps', 'Align the reference edge to the surveyed line')] },
    ],
    stopConditions: ['Do not move the wall by guess or screw into ceiling gypsum.', 'No house state change is applied while this work is held.'],
    stateEffects: [
      { partId: 'part.w1.bottom-plate', fromState: 'absent', toState: 'positioned' },
      { partId: 'part.w2.bottom-plate', fromState: 'absent', toState: 'positioned' },
    ],
    view: view('view.plan', ['part.w1.bottom-plate', 'part.w2.bottom-plate']),
    parameters: {
      datumNote: 'Set the bottom plates on the accepted bearing/separation stack with the reference edge on the surveyed line; W1 first, then W2. The 149-in finished inside target and the 68-in trial stay conditional.',
      fromPartId: null,
      offsetsMm: null,
      toolId: 'tool.level-48',
    },
  });

  addOp({
    id: 'op.anchor-base-plates',
    title: 'Anchor the bottom plates through the prepared tile clearance holes (held)',
    kind: 'fasten',
    targetPartIds: ['part.w1.bottom-plate', 'part.w2.bottom-plate', 'part.existing.slab'],
    dependencyOperationIds: ['op.set-bottom-plates', 'op.review-slab-base'],
    citationIds: [cite.card.p16('steps', 'Do not use wood connector screws as concrete anchors'), cite.card.p15('steps', 'Accepted detail specifies anchors and embedment'), cite.permit(13, { x: 10, y: 590, width: 195, height: 190 }, 'd5-detail-18-base-reference', 'D5 detail 18 shows a reference-only Hilti X-CF-or-equal 12-in-o.c. staggered note for the original 2x4 PT sill condition'), cite.json.holdPoints],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.slab-drilling',
    holdReason: 'slab_drilling: D5/18 documents a generic original-house 12-in-o.c. staggered Hilti X-CF-or-equal note, but no first offset or W1/W2 anchor centers can be derived from it. Exact product/length, diameter/embedment, edge distance, tile clearance, W2 applicability and service-cleared hole cylinders remain unreleased; SD Connector screws are not concrete anchors. Nothing is installed by this operation while held.',
    preconditions: ['Accepted anchor/sill detail and cleared hole cylinders (p15).'],
    qualityChecks: [
      { instruction: 'Every W1/W2 anchor center matches the accepted retrofit schedule and stays outside final edges, movement joints and service envelopes; do not create points by stepping 12 in from an invented origin', evidenceRequired: 'photo', citationIds: [cite.card.p15('steps', 'Specify spacing, edge distance and embedment'), cite.permit(13, { x: 10, y: 590, width: 195, height: 190 }, 'd5-detail-18-base-reference', 'Generic 12-in-o.c. staggered original-house note has no project start offset')] },
    ],
    stopConditions: ['Stop if any hole cylinder is unclear or a service is found.', 'Do not use wood connector screws as concrete anchors.'],
    stateEffects: [],
    view: view('view.closeup-slab', ['part.w1.bottom-plate', 'part.existing.slab'], [], { showFastenerPoints: { connectionId: 'connection.base.anchor', proposed: true } }),
    parameters: {
      connectionIds: ['connection.base.anchor'],
      pointsMm: null,
      proposed: true,
      toolId: 'tool.concrete-drill',
    },
  });

  addOp({
    id: 'op.restrain-top-plates',
    title: 'Position top plates and install the accepted nonbearing restraint (held)',
    kind: 'position',
    targetPartIds: ['part.w1.top-plate', 'part.w2.top-plate', 'part.reference.truss-band'],
    dependencyOperationIds: ['op.set-bottom-plates', 'op.review-connector', 'op.review-slab-base'],
    citationIds: [cite.card.p16('steps', 'Top plate, truss-movement allowance and temporary restraint'), cite.card.p16('truss', 'Locate the real chord before fixing this line'), cite.json.trussStatus, cite.json.logicalW1],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.truss-attachment',
    holdReason: 'truss_attachment: the physical chord and an accepted nonbearing movement restraint are unresolved; ordinary rigid stud angles are not truss clips and no attachment is released.',
    preconditions: ['Physical truss located (p4) and the accepted top/end restraint detail available.'],
    qualityChecks: [
      { instruction: 'Top plates positioned with the required truss-movement allowance and temporary support ready before any piece is left unsupported', evidenceRequired: 'photo', citationIds: [cite.card.p16('steps', 'Helper holds the top plate; restraint installed')] },
      { instruction: 'Plate centre recorded against the ~65 3/4-in candidate on the 68-in trial; any actual offset updates W2, aisle and drywall lengths', evidenceRequired: 'measurement', citationIds: [cite.card.p16('truss', 'Truss centre vs plate centre')] },
    ],
    stopConditions: ['Do not fasten to existing drywall as a structural receiver.', 'Do not screw into ceiling gypsum or wedge/jack the roof framing.'],
    stateEffects: [
      { partId: 'part.w1.top-plate', fromState: 'absent', toState: 'positioned' },
      { partId: 'part.w2.top-plate', fromState: 'absent', toState: 'positioned' },
    ],
    view: view('view.top-plates', ['part.w1.top-plate', 'part.w2.top-plate', 'part.reference.truss-band'], [], { showFastenerPoints: { connectionId: 'connection.top.restraint', proposed: true } }),
    parameters: {
      datumNote: 'Transfer the W1 bottom-plate marks overhead with a checked level or laser; set the single top plates and the accepted nonbearing restraint with the required truss-movement allowance. W1 first, then W2 after W1 is stable. A helper holds the overhead pieces.',
      fromPartId: 'part.w1.bottom-plate',
      offsetsMm: null,
      toolId: 'tool.level-48',
    },
  });

  // ---- studs (held) ---------------------------------------------------------------------------------
  addOp({
    id: 'op.fit-w1-studs',
    title: 'Fit W1 studs S01-S12 in place (held)',
    kind: 'position',
    targetPartIds: w1StudIds,
    dependencyOperationIds: ['op.anchor-base-plates', 'op.restrain-top-plates', 'op.drive-practice-screws'],
    citationIds: [cite.card.p09('steps', 'Measure at S01, cut one stud, plumb and clamp'), cite.card.p09('scope', '12 candidate studs'), cite.card.p09('method-change', 'Screw/angle change from D4 end-nailing'), cite.json.logicalW1],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.frame-cuts',
    holdReason: 'frame_cuts: individual stud heights are field-fit between the installed plates and no cut is released; the connection schedule is also held.',
    preconditions: ['W1 plates positioned/restrained; accepted fit/movement detail and connection orientation available.'],
    qualityChecks: [
      { instruction: 'Each station measured between the actual installed plate faces; one stud cut and trial-fit before repetition', evidenceRequired: 'measurement', citationIds: [cite.card.p09('steps', 'Measure between the actual plates')] },
      { instruction: 'Stud plumb in two directions, clamped/supported; pantry-face alignment checked after each stud; incomplete joints marked', evidenceRequired: 'visual', citationIds: [cite.card.p09('steps', 'Plumb, clamp and check face alignment')] },
    ],
    stopConditions: ['Do not batch-cut from the reported 111-in ceiling height.', 'Do not wedge or jack the roof framing.', 'Held: no house member may be cut or installed through this operation until the release changes.'],
    stateEffects: w1StudIds.map((partId) => ({ partId, fromState: 'absent', toState: 'positioned' })),
    view: view('view.elevation-w1', w1StudIds),
    parameters: {
      datumNote: 'Work S01-S12 in order: measure between the installed plate faces at each station, apply the accepted fit/movement detail, cut and trial-fit one stud, then plumb, clamp and connect it in the approved orientation before moving on.',
      fromPartId: 'part.w1.bottom-plate',
      offsetsMm: null,
      toolId: 'tool.level-48',
    },
  });

  addOp({
    id: 'op.fasten-w1-studs',
    title: 'Fasten W1 stud ends with the candidate angle schedule (held)',
    kind: 'fasten',
    targetPartIds: w1StudIds,
    dependencyOperationIds: ['op.fit-w1-studs', 'op.drive-practice-screws'],
    citationIds: [cite.card.p09('method-change', 'No generic toe-screw substitute'), cite.card.p10('candidate', 'Candidate 4+4 pattern'), cite.card.p10('conditional', 'Placement/capacity not released'), cite.esr('note4', 'F1 rotation restraint')],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.frame-cuts',
    holdReason: 'frame_cuts/connector placement: the stud-angle count, orientation, rotation restraint and loaded-wall capacity are unreleased; the guide may only show proposed connection locations.',
    preconditions: ['Studs fitted and plumb; accepted connector arrangement available for the loaded partition.'],
    qualityChecks: [
      { instruction: 'Only the listed connector-screw holes driven, in the approved orientation; steel and heads kept away from drywall-bearing faces', evidenceRequired: 'photo', citationIds: [cite.card.p14('spec', 'Specified direction; seated heads')] },
      { instruction: 'No connector trimmed, drilled, deformed or countersunk to clear an obstruction', evidenceRequired: 'visual', citationIds: [cite.card.p12('stop', 'Preserve all required holes; do not trim a connector')] },
    ],
    stopConditions: ['Stop if the connector pattern or orientation cannot match the accepted detail.', 'Do not drive through gypsum or an open cavity as though it were a wood receiver.'],
    stateEffects: w1StudIds.map((partId) => ({ partId, fromState: 'positioned', toState: 'installed' })),
    view: view('view.closeup-connector', w1StudIds, [], { showFastenerPoints: { connectionId: 'connection.w1.stud-to-plate', proposed: true } }),
    parameters: {
      connectionIds: ['connection.w1.stud-to-plate'],
      pointsMm: null,
      proposed: true,
      toolId: 'tool.hex-nutsetter',
    },
  });

  addOp({
    id: 'op.fit-w2-frame',
    title: 'Fit the W2 2x8 frame S01-S05 in place (held)',
    kind: 'position',
    targetPartIds: w2StudIds,
    dependencyOperationIds: ['op.fasten-w1-studs', 'op.restrain-top-plates'],
    citationIds: [cite.card.p12('scope', 'Five candidate 2x8 studs'), cite.card.p12('steps', 'Separate W2 placement; field-fit each stud'), cite.json.logicalW2],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.frame-cuts',
    holdReason: 'frame_cuts/W2 assembly: W2 member lengths, plate endpoints and the separate 2x8 connection placement are held; "a wider 2x8 is not automatically covered by a 2x4 joint detail".',
    preconditions: ['W1 stable/restrained; W2 plates positioned/restrained; column contact plane verified.'],
    qualityChecks: [
      { instruction: 'Each W2 station measured between the installed plates; the last member field-fit against the true column end', evidenceRequired: 'measurement', citationIds: [cite.card.p12('steps', 'Measure between the installed plates')] },
      { instruction: '149-in finished inside target and 8 3/8-in finished return thickness rechecked; continuous drywall receivers identified', evidenceRequired: 'measurement', citationIds: [cite.card.p12('steps', 'Check 149 in and 8 3/8 in')] },
    ],
    stopConditions: ['Do not cut the column to make a connector fit.', 'Do not fasten to existing drywall as a structural receiver.'],
    stateEffects: w2StudIds.map((partId) => ({ partId, fromState: 'absent', toState: 'positioned' })),
    view: view('view.elevation-w2', w2StudIds),
    parameters: {
      datumNote: 'After W1 is restrained, verify W2 plate endpoints and its 7 1/4-in core between finish lines; measure at S01-S05 separately, cut and trial-fit one stud, then install each stud plumb with the reviewed W2 connector placement (separate from W1).',
      fromPartId: 'part.w2.bottom-plate',
      offsetsMm: null,
      toolId: 'tool.tape-measure',
    },
  });

  addOp({
    id: 'op.fasten-w2-frame',
    title: 'Fasten the W2 2x8 stud ends with their own detail (held)',
    kind: 'fasten',
    targetPartIds: w2StudIds,
    dependencyOperationIds: ['op.fit-w2-frame'],
    citationIds: [cite.card.p12('steps', 'Reviewed W2 connector placement'), cite.json.connections],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.frame-cuts',
    holdReason: 'W2 connection detail held: no copying the W1 schedule; placement, orientation and capacity are unresolved.',
    preconditions: ['W2 studs fitted; separate 2x8 placement/access review accepted.'],
    qualityChecks: [
      { instruction: 'W2 pattern and edge location distinct from W1; connector holes preserved and heads seated', evidenceRequired: 'photo', citationIds: [cite.card.p12('steps', 'Separate W2 placement; do not copy W1')] },
    ],
    stopConditions: ['Do not copy a W1 quantity or edge location onto the 2x8 members.'],
    stateEffects: w2StudIds.map((partId) => ({ partId, fromState: 'positioned', toState: 'installed' })),
    view: view('view.elevation-w2', w2StudIds, [], { showFastenerPoints: { connectionId: 'connection.w2.stud-to-plate', proposed: true } }),
    parameters: {
      connectionIds: ['connection.w2.stud-to-plate'],
      pointsMm: null,
      proposed: true,
      toolId: 'tool.hex-nutsetter',
    },
  });

  addOp({
    id: 'op.tie-corner-column',
    title: 'Tie W2 to the W1 corner receiver and to sound wood in the column (held)',
    kind: 'fasten',
    targetPartIds: ['part.w2.stud-s01', 'part.w1.stud-s12', 'part.existing.column'],
    dependencyOperationIds: ['op.fasten-w2-frame'],
    citationIds: [cite.card.p12('steps', 'Corner and column tie text'), cite.card.p12('stop', 'No existing-drywall receiver'), cite.svg('r34-wood-junction', { x: 55, y: 1272, width: 900, height: 28 }, 'corner-contact-note', 'text "Butt contact ... fastener / added receiver held"'), cite.json.connections],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.connector-placement',
    holdReason: 'C-CORNER: the junction has only 1.5-in candidate wood contact and needs its own receiver/load path; the small stud angle is not the automatic solution and nothing is released.',
    preconditions: ['Corner receiver and column contact planes verified; separate corner/column connection detail accepted.'],
    qualityChecks: [
      { instruction: 'Both sides of the corner, column and top connections photographed before closure; receiver wood confirmed (never gypsum)', evidenceRequired: 'photo', citationIds: [cite.card.p12('steps', 'Photograph both sides before closure')] },
    ],
    stopConditions: ['Do not fasten to existing drywall as a structural receiver.', 'Do not cut the column to make a connector fit.'],
    stateEffects: [],
    view: view('view.closeup-corner', ['part.w2.stud-s01', 'part.w1.stud-s12', 'part.existing.column'], [], { showFastenerPoints: { connectionId: 'connection.corner.tie', proposed: true } }),
    parameters: {
      connectionIds: ['connection.corner.tie'],
      pointsMm: null,
      proposed: true,
      toolId: 'tool.drill-driver',
    },
  });

  addOp({
    id: 'op.check-straightness',
    title: 'Check and correct the frame plane before backing/drywall (held)',
    kind: 'inspect',
    targetPartIds: [...w1StudIds.slice(0, 6), ...w2StudIds],
    dependencyOperationIds: ['op.fasten-w1-studs', 'op.tie-corner-column'],
    citationIds: [cite.card.p17('hold', 'Straighten only after restraints and correction method accepted'), cite.card.p17('steps', 'Sight members, keep faces flush, plumb and clamp'), cite.card.p17('correction', 'Replace/shim rules; shim is not a screw receiver'), cite.card.p17('handbook', 'CGC/USG ch. 12 p. 350'), cite.json.straightening],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.frame-cuts',
    holdReason: 'HOLD: straighten only after the wall restraints and the correction method are accepted; no framing correction is released.',
    preconditions: ['Wall restraints active; 48-in level, straightedge/line laser, mason line and equal 1/2-in spacers available.'],
    qualityChecks: [
      { instruction: 'String/straightedge checked at counter, upper-cabinet and shelf-bracket heights on both walls; proud/recessed stations marked', evidenceRequired: 'measurement', citationIds: [cite.card.p17('steps', 'Straightedge at several heights; mark stations')] },
      { instruction: 'Bowed/twisted members replaced while the frame is open; recessed drywall faces shimmed flush; cabinet-rail stations land wood on the accepted mounting plane', evidenceRequired: 'photo', citationIds: [cite.card.p17('correction', 'Shims for drywall only; rails land on wood')] },
    ],
    stopConditions: [
      'Do not use screws to pull a badly twisted stud straight.',
      'A drywall shim is not a structural screw receiver.',
      'Any sistered stud or new fastening detail needs review before use.',
    ],
    stateEffects: [],
    view: view('view.elevation-w1', w1StudIds),
    parameters: {
      inspectWhat: 'Plane and plumb of both new walls, member condition and the cabinet/shelf mounting planes before backing or gypsum.',
      criteria: 'W1/W2 straight and plumb within the accepted correction method; rejected members replaced; corrections recorded and photographed.',
      evidenceRequired: 'field_measurement_or_photo',
    },
  });

  // ---- backing (held) -------------------------------------------------------------------------------
  addOp({
    id: 'op.fit-backing-blocks',
    title: 'Field-fit the 25 flat 2x6 backing blocks (held)',
    kind: 'position',
    targetPartIds: blockIds,
    dependencyOperationIds: ['op.check-straightness'],
    citationIds: [cite.card.p18('hold', 'Backing rail/load-path hold'), cite.card.p18('steps', 'Transfer rails, trial-cut one block, measure each bay'), cite.card.p18('short-bay', 'Short 3 1/4-in bay'), cite.json.backingStatus, cite.json.backingBandStatus],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.frame-cuts',
    holdReason: 'MEASURE ACTUAL BAY AND RAIL; NO CUT RELEASED: the rails, bands and block lengths are field-fit and the block-to-stud load path is unresolved.',
    preconditions: ['Actual U1/U2/U3 and base mounting holes/rails transferred to W1; each stud bay measured separately.'],
    qualityChecks: [
      { instruction: 'One trial block cut and checked: 5 1/2-in face vertical and flush to the pantry-side studs; 1 1/2-in depth stays inside the cavity', evidenceRequired: 'measurement', citationIds: [cite.card.p18('steps', 'Trial-cut one block; face vertical and flush')] },
      { instruction: 'All 25 IDs and exposed services photographed before inspection and drywall closure; no stud intersection or plywood substitute', evidenceRequired: 'photo', citationIds: [cite.card.p18('steps', 'Photograph all 25 IDs and services')] },
    ],
    stopConditions: ['These are not batch cuts.', 'Do not put metal or raised screw heads between the cabinet-side gypsum and the backing face.', 'Block lengths change if the rail locations or stud assembly change.'],
    stateEffects: blockIds.map((partId) => ({ partId, fromState: 'absent', toState: 'positioned' })),
    view: view('view.closeup-backing', blockIds),
    parameters: {
      datumNote: 'Field-fit each flat 2x6 block to the actual cabinet mounting rows and each measured stud bay; keep the 5 1/2-in face vertical and pantry-facing flush, 1 1/2-in into the cavity, and keep the room side accessible for rear connectors and inspection.',
      fromPartId: null,
      offsetsMm: null,
      toolId: 'tool.tape-measure',
    },
  });

  addOp({
    id: 'op.review-backing-connection',
    title: 'Review the backing connector row and the opposing-angle conflict (held)',
    kind: 'inspect',
    targetPartIds: blockIds.slice(0, 8),
    dependencyOperationIds: ['op.fit-backing-blocks'],
    citationIds: [cite.card.p19('hold', 'Resolve opposing angles before buying hardware'), cite.card.p19('conflict', 'ESR 3-in minimum conflict'), cite.card.p19('space', 'Space-only check'), cite.card.p19('quantity', 'No 50-angle multiplication'), cite.esr('note5', 'Minimum 3-in member thickness')],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.fixture-loading',
    holdReason: 'HOLD: the complete backing row needs a manufacturer/qualified detail; opposing angles on the 1.5-in studs conflict with the ESR-3096 minimum 3-in member thickness and no staggering exception is documented.',
    preconditions: ['Blocks field-fit; actual rail/hole locations known; cabinet rail templates requested.'],
    qualityChecks: [
      { instruction: 'Connector arrangement, receiver changes, screw pattern and supported cabinet load path documented by a qualified detail before any purchase', evidenceRequired: 'visual', citationIds: [cite.card.p19('hold', 'Obtain a manufacturer/qualified detail')] },
      { instruction: 'Driver access checked in the narrow 3 1/4-in corner bays; no holes assumed reachable', evidenceRequired: 'visual', citationIds: [cite.card.p19('space', 'Driver may not reach every required hole')] },
    ],
    stopConditions: ['Do not order 50 angles for 25 blocks by multiplication.', 'Backing angles do not replace shelf brackets or cabinet mounting screws.'],
    stateEffects: [],
    view: view('view.closeup-backing', blockIds.slice(0, 6)),
    parameters: {
      inspectWhat: 'Rear cavity-side angle concept for the 25 backing blocks, including the adjacent-bay opposing-angle condition on the 1.5-in studs and the 3 1/4-in corner bays.',
      criteria: 'Either an accepted qualified detail exists (then update block lengths/quantities/receivers), or the row stays held.',
      evidenceRequired: 'visual',
    },
  });

  addOp({
    id: 'op.fasten-backing-blocks',
    title: 'Fasten the backing blocks to the accepted detail (held)',
    kind: 'fasten',
    targetPartIds: blockIds,
    dependencyOperationIds: ['op.review-backing-connection'],
    citationIds: [cite.card.p19('quantity', 'Final quantity unresolved'), cite.card.p19('flat', 'Keep flat and flush'), cite.esr('note4', 'Rotation restraint'), cite.json.backingConnection],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.fixture-loading',
    holdReason: 'fixture_loading/backing: the block-to-stud joint and the complete cabinet/shelf load path are held; no automatic fastener quantity or angle count is derived.',
    preconditions: ['Accepted backing-row detail; blocks field-fit and photographed.'],
    qualityChecks: [
      { instruction: 'Only the accepted connector arrangement and screw pattern used; mounting face stays flush and room side accessible', evidenceRequired: 'photo', citationIds: [cite.card.p19('flat', 'Keep the cabinet fastening plane flush')] },
    ],
    stopConditions: ['Stop if the detail requires receiver changes; revise block lengths, quantities and drywall receivers first.'],
    stateEffects: blockIds.map((partId) => ({ partId, fromState: 'positioned', toState: 'installed' })),
    view: view('view.closeup-backing', blockIds, [], { showFastenerPoints: { connectionId: 'connection.backing.angle', proposed: true } }),
    parameters: {
      connectionIds: ['connection.backing.angle'],
      pointsMm: null,
      proposed: true,
      toolId: 'tool.hex-nutsetter',
    },
  });

  // ---- EX1 passage (held) ---------------------------------------------------------------------------
  addOp({
    id: 'op.open-ex1-passage',
    title: 'Review the widened EX1 passage candidate (held)',
    kind: 'position',
    targetPartIds: ['part.existing.ex1-wall', 'part.existing.column', 'part.existing.kitchen-door'],
    dependencyOperationIds: ['op.fasten-backing-blocks', 'op.review-slab-base', 'op.survey-trim'],
    citationIds: [cite.card.p20('hold', 'EX1 role/services/opening hold'), cite.card.p20('steps', 'Identify the wall section; reviewer sets the opening'), cite.card.p20('scope-limits', 'Kitchen door retained; EX1 not part of the new-wall takeoff'), cite.pvt('source.r35.owner-ex1-requirement', 'minimum-37-in-clear-preview', 'Owner requires at least 37 in finished clear and requested a held candidate extended toward the refrigerator side.'), cite.pvt('source.r35.ex1-plan-audit', 'door-like-display-height', 'The visible 80-in portal outline is a presentation convention only. Actual finished-clear and rough-opening heights remain unknown and no vertical cut is released.'), cite.permit(3, { x: 20, y: 40, width: 570, height: 700 }, 'a3-ex1-obstruction', 'A3 written-dimension arithmetic indicates only 30 1/8 in before finishes between the column face and closet right framing face; at least 6 7/8 in more is needed before finish allowance.'), cite.json.holdPoints],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.existing-opening',
    holdReason: 'existing_opening: the 37-in finished-clear requirement exceeds the 30 1/8-in original-plan column-to-closet span by at least 6 7/8 in before finish allowance. The preview extends toward the refrigerator side, but wall role, services, actual offsets, height, support and opening/header/jamb detail remain unresolved; no demolition or exposure is released.',
    preconditions: ['OP approved opening/header/jamb/exposure detail; TR-03 limits field-marked; retained kitchen door kept operational.'],
    qualityChecks: [
      { instruction: 'Transfer both closet sidewall planes to the flex-room face and measure the unobstructed column-to-right-sidewall width at floor, middle and proposed opening-top height; compare it with the held 37-in finished-clear requirement', evidenceRequired: 'field_measurement_or_photo', citationIds: [cite.pvt('source.r35.owner-ex1-requirement', 'field-check-before-opening', 'Field measurements required to resolve the original-plan obstruction and place any opening.')] },
      { instruction: 'Full EX1 section identified on both faces and above the ceiling (role, posts/straps, header conditions, wires, pipes, insulation, rated/bracing function) before any cut', evidenceRequired: 'photo', citationIds: [cite.card.p20('steps', 'Identify the complete EX1 wall section')] },
      { instruction: 'Only the released finish zone exposed with a verified shallow method; unexpected members preserved and the detail revised', evidenceRequired: 'photo', citationIds: [cite.card.p20('steps', 'Preserve unexpected members; revise the detail')] },
    ],
    stopConditions: [
      'Do not use the closet 37-in inside width as an automatic rough opening.',
      'Do not use the 6 7/8-in preview extension as a cut: it excludes finish/jamb allowance and is not field registered.',
      'If an unexpected stud group, brace, strap, pipe, wire or connector is found, preserve it and revise the opening detail.',
    ],
    stateEffects: [],
    view: view('view.ex1-opening', ['part.existing.ex1-wall', 'part.existing.column', 'part.existing.kitchen-door'], blockIds, { requirementPreview: ex1RequirementPreview }),
    parameters: {
      datumNote: 'Presentation-only door-like candidate at the EX1 rear shelf wall: begin at the retained column face and extend toward the refrigerator side to show a 37-in minimum finished-clear width, at least 6 7/8 in beyond the original-plan 30 1/8-in span. The 80-in outline is DISPLAY ONLY, not an accepted height. Locate the opening only per the accepted reviewer detail after field measurement and TR-03 marking. Actual height, finish/jamb allowance, rough opening, studs, support and cuts remain UNKNOWN.',
      fromPartId: null,
      offsetsMm: null,
      toolId: 'tool.utility-knife',
    },
  });

  // ---- drywall (held) -------------------------------------------------------------------------------
  addOp({
    id: 'op.plan-drywall-faces',
    title: 'Plan each drywall face, nest and edge supports (held)',
    kind: 'prepare',
    targetPartIds: panelIds,
    dependencyOperationIds: ['op.fit-backing-blocks', 'op.fasten-backing-blocks'],
    citationIds: [cite.card.p21('hold', 'Actual planes/edge supports/top detail/EX1 patches'), cite.card.p21('faces', 'Four face assignments'), cite.card.p21('steps', 'Inspect faces; nest core sheets plus spare'), cite.card.p21('release', 'Candidate widths and nest are not a cut release'), cite.pvt('source.r35.r34-drywall-layout-md', 'all-panel-receivers-and-orientation', 'work/R34/drywall-layout.md: all 12 vertical panel pieces, face planes, vertical-edge receivers, corner laps and top/bottom holds; conditional geometry only'), cite.json.panelStock, cite.json.panelPatches],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.drywall-closeup',
    holdReason: 'drywall_closeup: no sheet cuts or screws are released; the nest is a rectangular stock study, heights are field-fit, spares are never installed and EX1 patches stay out of the fixed nest.',
    preconditions: ['Frames fixed and inspected; service map and approved top movement detail available; carry path proven.'],
    qualityChecks: [
      { instruction: 'All four faces inspected for confirmed stud/edge receivers, backing, service map, top detail and required inspections; concealed rows photographed', evidenceRequired: 'photo', citationIds: [cite.card.p21('steps', 'Inspect all four faces; photograph concealed rows')] },
      { instruction: 'Core nest distinguished from the optional one-spare allowance: 8 half-inch + 2 five-eighth-inch core sheets, spares never installed, EX1 patches excluded', evidenceRequired: 'visual', citationIds: [cite.card.p21('steps', 'Eight 1/2-in and two 5/8-in sheets; one spare each')] },
      { instruction: 'All 12 installed pieces remain separately selectable and labelled by face/panel ID; candidate orientation is vertical with the 120-in stock direction vertical', evidenceRequired: 'visual', citationIds: [cite.pvt('source.r35.r34-drywall-layout-md', 'all-panel-receivers-and-orientation', 'work/R34/drywall-layout.md: all 12 vertical panel pieces, face planes, vertical-edge receivers, corner laps and top/bottom holds; conditional geometry only')] },
    ],
    stopConditions: ['Do not order exact sheet or fastener counts from the stock study.', 'The actual gypsum product, field heights, seam receivers, ceiling movement and corner overlap must agree before cutting or fastening.', 'Never bridge an intended top movement joint with ordinary fixed-joint fastening, tape or adhesive.'],
    stateEffects: [],
    view: view('view.iso', panelIds, [], { cutaway: { enabled: true } }),
    parameters: {
      materialIds: ['material.gypsum.half', 'material.gypsum.five-eighth'],
      toolIds: ['tool.tape-measure', 'tool.t-square', 'tool.rasp', 'tool.drywall-lift', 'tool.screwgun', 'tool.utility-knife', 'tool.eye-protection'],
      instruction: 'Plan all 12 separately selectable vertical pieces across the four faces: W1 1/2-in both faces; W2 1/2-in pantry and 5/8-in room. The 120-in stock direction is vertical. Keep EX1 patches separate, keep the optional spares out of the installed nest, and do not cut anything until the board system, heights and receivers are accepted.',
      note: 'Height rule: H_i = field fit between accepted upper/lower board-edge elevations; the reported 111-in ceiling is never a panel cut.',
    },
  });

  addOp({
    id: 'op.inspect-faces-supports',
    title: 'Inspect receivers, services and movement detail before panel cutting (held)',
    kind: 'inspect',
    targetPartIds: [...panelIds, 'part.backing.top-b01', 'part.w1.stud-s04'],
    dependencyOperationIds: ['op.plan-drywall-faces'],
    citationIds: [cite.card.p21('steps', 'Inspect faces and mark concealed rows'), cite.card.p21('hold', 'Held until planes and supports confirmed')],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.drywall-closeup',
    holdReason: 'drywall_closeup: the inspection can record findings but cannot release panel cuts, fastening or closure while the source holds stand.',
    preconditions: ['All four faces exposed, service map and approved top movement detail available.'],
    qualityChecks: [
      { instruction: 'Confirmed stud/edge receivers, cabinet backing, service map, top movement detail and required inspections recorded per face', evidenceRequired: 'photo', citationIds: [cite.card.p21('steps', 'Confirmed receivers and services per face')] },
    ],
    stopConditions: ['Stop if any receiver, service or movement detail is missing or unresolved.'],
    stateEffects: [],
    view: view('view.iso', panelIds),
    parameters: {
      inspectWhat: 'Confirmed stud/edge receivers, backing rows, service map, approved top movement detail and required inspections on all four faces.',
      criteria: 'Every seam lands on a verified support and every concealed item is mapped; otherwise the work stays held.',
      evidenceRequired: 'photo',
    },
  });

  addOp({
    id: 'op.review-drywall-drawings',
    title: 'Review the wood junction and gypsum corner drawings before hanging (held)',
    kind: 'inspect',
    targetPartIds: ['part.w1.stud-s11', 'part.w1.stud-s12', 'part.w2.stud-s01', 'part.drywall.w1-p-04'],
    dependencyOperationIds: ['op.inspect-faces-supports'],
    citationIds: [cite.card.p23('junction', 'Wood junction reference planes'), cite.card.p23('footprints', 'S11/S12/S01 footprints'), cite.card.p23('corners', 'Inside/outside corner board laps'), cite.card.p23('hold', 'Fit/support geometry only; fastening held'), cite.svg('r34-drywall-layout', { x: 55, y: 1325, width: 1000, height: 90 }, 'read-the-map', 'READ THE MAP notes: seams, stud centers, q convention')],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.drywall-closeup',
    holdReason: 'drywall_closeup: the junction/corner drawings show fit and support geometry only; connection type, fasteners, added blocking and the load path require acceptance, and the corner receiver is not established.',
    preconditions: ['Frames fixed; drawings compared against the measured faces.'],
    qualityChecks: [
      { instruction: 'Board laps and seams sequenced per the drawings: W2-P butts to W1-P; W1-R laps W2-R; corner bead/movement joint per the accepted detail', evidenceRequired: 'visual', citationIds: [cite.card.p23('corners', 'Inside/outside corner laps')] },
      { instruction: 'W1-S11/S12/S01 candidate footprints checked against the drawings; full-width receiver still not established', evidenceRequired: 'measurement', citationIds: [cite.card.p23('footprints', 'Candidate corner footprints')] },
    ],
    stopConditions: ['Do not drive through gypsum or an open cavity as though it were a wood receiver.', 'Top/truss movement and any rated/control joint need their own accepted details.'],
    stateEffects: [],
    view: view('view.closeup-corner', ['part.w1.stud-s11', 'part.w1.stud-s12', 'part.w2.stud-s01']),
    parameters: {
      inspectWhat: 'The W1-through/W2-butt wood junction, the candidate corner member footprints and the inside/outside gypsum corner laps.',
      criteria: 'Sequence and laps agreed with the drawings and the measured faces; all fastening, receiver and movement details stay held.',
      evidenceRequired: 'visual',
    },
  });

  addOp({
    id: 'op.inspect-preclose',
    title: 'Pre-close inspection of framing, backing, fasteners and services (held)',
    kind: 'inspect',
    targetPartIds: ['part.w1.stud-s01', 'part.w1.stud-s12', 'part.w1.bottom-plate', 'part.w2.stud-s01', 'part.w2.stud-s05', 'part.backing.top-b01', 'part.backing.base-b03', 'part.backing.base-b10'],
    dependencyOperationIds: ['op.review-drywall-drawings', 'op.fasten-backing-blocks', 'op.check-straightness'],
    citationIds: [cite.card.p25('hold', 'Preclose inspection hold'), cite.card.p28('gates', 'G6 close-up gate'), cite.card.p18('steps', 'Photograph all 25 IDs and services before closure')],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.drywall-closeup',
    holdReason: 'G6/close-up: inspection and photographs of the studs, 25 blocks, fasteners, services and board edge supports are required before drywall closure and are not satisfied.',
    preconditions: ['Frames, backing and services complete and exposed; block map updated with actual coordinates; photographs identified with scale.'],
    qualityChecks: [
      { instruction: 'Every stud, the 25 blocks, fasteners and services photographed with ID and scale; block/stud/service map updated with actual x and height coordinates', evidenceRequired: 'photo', citationIds: [cite.card.p28('process', 'ID and scale on concealed photographs')] },
      { instruction: 'No outlet, pipe, bracket backing or seam left hidden without its marked opening/support', evidenceRequired: 'photo', citationIds: [cite.card.p25('steps', 'Verify nothing concealed without a marked opening')] },
    ],
    stopConditions: ['Stop if any concealed item lacks a photograph, an ID or a support.', 'A browser checkbox never satisfies this gate.'],
    stateEffects: [],
    view: view('view.iso', ['part.backing.top-b01', 'part.backing.base-b03']),
    parameters: {
      inspectWhat: 'Framing members, the 25 backing blocks, fasteners, services and board edge supports before any gypsum is closed.',
      criteria: 'Complete photographic record with IDs/scale and the updated block/stud/service map; otherwise closure stays held.',
      evidenceRequired: 'photo',
    },
  });

  addOp({
    id: 'op.hang-drywall',
    title: 'Hang and fasten the four drywall faces (held)',
    kind: 'position',
    targetPartIds: panelIds,
    dependencyOperationIds: ['op.inspect-preclose', 'op.review-drywall-drawings'],
    citationIds: [cite.card.p25('hold', 'Preclose inspection, panel map and screw schedule held'), cite.card.p25('steps', 'Label, cut, dry-fit, screw offcut practice'), cite.card.p25('stop', 'No framing nails; superseded maps not usable'), cite.json.drywallState],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.drywall-closeup',
    holdReason: 'drywall_closeup: preclose inspection, the panel map and the board-specific screw schedule are held; nothing is covered while held.',
    preconditions: ['Pre-close inspection complete; panel map and board-specific screw schedule accepted; selected board system confirmed.'],
    qualityChecks: [
      { instruction: 'Panels labelled by all 12 wall/face IDs, kept in the accepted vertical orientation, cut from measured field sizes on broad supports, edges rasped square and dry-fit against the listed candidate receivers after those receivers are field-confirmed', evidenceRequired: 'photo', citationIds: [cite.card.p25('steps', 'Label each panel; dry-fit against supports'), cite.pvt('source.r35.r34-drywall-layout-md', 'all-panel-receivers-and-orientation', 'work/R34/drywall-layout.md: all 12 vertical panel pieces, face planes, vertical-edge receivers, corner laps and top/bottom holds; conditional geometry only')] },
      { instruction: 'Screw practice on offcut at the same stud/backing stack; heads below the face without paper tearing; approved edge distance/spacing', evidenceRequired: 'visual', citationIds: [cite.card.p25('steps', 'Screwgun practice on offcut')] },
    ],
    stopConditions: ['Do not use framing nails to hang gypsum or drywall screws for structural frame joints.', 'Superseded panel/screw maps cannot be used with the new W2 5/8-in side or changed lengths.', 'Do not bridge an intended top movement joint with ordinary fixed-joint fastening, tape or adhesive.'],
    stateEffects: [
      ...panelIds.map((partId) => ({ partId, fromState: 'absent', toState: 'installed' })),
      ...[...w1StudIds, ...w2StudIds, 'part.w1.bottom-plate', 'part.w1.top-plate', 'part.w2.bottom-plate', 'part.w2.top-plate'].map((partId) => ({ partId, fromState: 'installed', toState: 'covered' })),
      ...blockIds.map((partId) => ({ partId, fromState: 'installed', toState: 'covered' })),
    ],
    view: view('view.iso', panelIds, [], { cutaway: { enabled: true } }),
    parameters: {
      datumNote: 'Hang the four faces from the measured field sizes: W1-P continuous through the corner, W1-R to the finished corner receiver, W2-P butted to W1-P and W2-R butted at the column. Keep the bottom gap and any top movement condition in the selected board/connection system.',
      fromPartId: null,
      offsetsMm: null,
      toolId: 'tool.screwgun',
    },
  });

  addOp({
    id: 'op.inspect-drywall',
    title: 'Inspect drywall seams, supports, gaps and screw schedule (held)',
    kind: 'inspect',
    targetPartIds: panelIds,
    dependencyOperationIds: ['op.hang-drywall'],
    citationIds: [cite.card.p25('steps', 'Inspect seam/support, top gap and bottom separation before tape'), cite.card.p26('steps', 'Finish only after inspection and concealed-work photos')],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.drywall-closeup',
    holdReason: 'drywall_closeup: the inspection can record findings but cannot release finishing while the close-up holds stand.',
    preconditions: ['Panels hung per the accepted map and screw schedule.'],
    qualityChecks: [
      { instruction: 'Each seam/support, top gap and bottom separation checked before tape; torn-paper or missed-stud screws replaced per board instructions', evidenceRequired: 'photo', citationIds: [cite.card.p25('steps', 'Inspect every seam and gap before tape')] },
    ],
    stopConditions: ['Stop if a seam lacks support or a gap/movement condition is unclear.'],
    stateEffects: [],
    view: view('view.iso', panelIds),
    parameters: {
      inspectWhat: 'Panel seams and supports, top gap and bottom separation, screw seating and paper condition on all four faces.',
      criteria: 'Every seam supported, gaps consistent with the accepted system, damaged screws replaced; otherwise finishing stays held.',
      evidenceRequired: 'photo',
    },
  });

  addOp({
    id: 'op.finish-drywall',
    title: 'Tape, finish and paint the drywall (conditional preview)',
    kind: 'finish',
    targetPartIds: panelIds,
    dependencyOperationIds: ['op.inspect-drywall'],
    citationIds: [cite.card.p26('conditional', 'Board/compound system and finish surfaces first'), cite.card.p26('steps', 'Tape inside corner, bead the outside corner, sand and prime'), cite.json.drywallState],
    declaredReleaseStatus: 'conditional',
    releaseId: 'release.r35.plan',
    holdReason: 'Conditional: board/compound system and finish surfaces must be selected first; the parent close-up holds also propagate.',
    preconditions: ['Required inspection complete and concealed-work photos recorded.'],
    qualityChecks: [
      { instruction: 'Movement conditions respected: do not bridge an engineered truss movement joint with a rigid finish; use the selected movement-joint detail where required', evidenceRequired: 'visual', citationIds: [cite.card.p26('steps', 'Use the selected movement-joint detail when required')] },
      { instruction: 'Corner bead straight and bedded per its instructions; sanded with controlled dust and inspected under side light; paint matched at the existing wall/column', evidenceRequired: 'photo', citationIds: [cite.card.p26('steps', 'Bead, sand, prime and finish paint')] },
    ],
    stopConditions: ['Stop if the board/compound system or the movement detail is unselected.', 'Do not conceal an unresolved movement joint.'],
    stateEffects: [],
    view: view('view.iso', panelIds),
    parameters: {
      levelLabel: 'Finish per the selected board/compound system, with the accepted movement-joint detail where required.',
      passes: null,
    },
  });

  addOp({
    id: 'op.install-baseboard',
    title: 'Measure, cut and install matching baseboard (held)',
    kind: 'finish',
    targetPartIds: trimIds,
    dependencyOperationIds: ['op.finish-drywall'],
    citationIds: [cite.card.p26('steps', 'Measure visible faces and returns; attach to verified wood'), cite.card.p26('baseboard', 'Behind-cabinet decision and no-drill boundary'), cite.json.trimNew, cite.json.trimQuantity],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.baseboard',
    holdReason: 'new_baseboard_installation: held for finished drywall/cabinet fit and as-built exposed lengths; trim removal authorizes neither tile removal nor drilling.',
    preconditions: ['Finished drywall, cabinet/fridge fit and measured exposed lengths available; reuse of sound labelled trim assessed.'],
    qualityChecks: [
      { instruction: 'New pieces cut to measured exposed W1/W2 faces and EX1 returns; attached to verified wood avoiding service paths and tile', evidenceRequired: 'measurement', citationIds: [cite.card.p26('steps', 'Cut to measured returns; attach to verified wood')] },
      { instruction: 'Baseboard behind flush cabinets/refrigerator omitted or terminated per the real clearance instructions; shoe fitted only if the existing profile needs it', evidenceRequired: 'visual', citationIds: [cite.card.p26('baseboard', 'Behind-cabinet decision')] },
    ],
    stopConditions: ['Trim removal does not require tile removal or authorize anchor drilling.', 'No trim length is released until the finished surfaces and cabinet fit are measured.'],
    stateEffects: [],
    view: view('view.elevation-w1', trimIds),
    parameters: {
      levelLabel: 'Install matching baseboard on the exposed finished W1/W2 faces and EX1 returns after finish and fixture fit.',
      passes: null,
    },
  });

  // ---- fixtures (held) ------------------------------------------------------------------------------
  addOp({
    id: 'op.dry-fit-fixtures',
    title: 'Dry-fit the base boxes, fillers and divider (held)',
    kind: 'position',
    targetPartIds: ['part.fixture.base-row', 'part.fixture.fillers', 'part.fixture.divider', 'part.fixture.fridge'],
    dependencyOperationIds: ['op.finish-drywall'],
    citationIds: [cite.card.p27('hold', 'Rail templates/fasteners/load path held'), cite.card.p27('steps', 'Dry-fit B1, F1, B2, F2, B3 from the fridge separator'), cite.json.boxConstraint],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.fixture-loading',
    holdReason: 'fixture_loading: actual cabinet widths, rail templates and the full load path are unresolved; dry-fit is not released and cannot fix the seams.',
    preconditions: ['Backing row and its accepted detail available; individual box widths measured or the layout stays provisional.'],
    qualityChecks: [
      { instruction: 'Total 106 1/2-in box width plus the two 3/4-in fillers checked with the actual toe-kick/counter/side scribe; B1 opens cleanly beside the refrigerator panel', evidenceRequired: 'measurement', citationIds: [cite.card.p27('steps', 'Check the total and B1 operation')] },
    ],
    stopConditions: ['Do not freeze seams, cabinet screw paths or backing bands from the schematic subdivisions.', 'No fixture is loaded while held.'],
    stateEffects: [
      { partId: 'part.fixture.base-row', fromState: 'absent', toState: 'positioned' },
      { partId: 'part.fixture.fillers', fromState: 'absent', toState: 'positioned' },
      { partId: 'part.fixture.divider', fromState: 'absent', toState: 'positioned' },
    ],
    view: view('view.elevation-w1', ['part.fixture.base-row']),
    parameters: {
      datumNote: 'Lay out B1, F1, B2, F2 and B3 on their supported floor locations starting at the fridge separator; verify the combined 106 1/2 in plus fillers and the actual scribe before any fixing.',
      fromPartId: 'part.fixture.base-row',
      offsetsMm: null,
      toolId: 'tool.tape-measure',
    },
  });

  addOp({
    id: 'op.set-counter-uppers-shelves',
    title: 'Set the counter, upper cabinets and shelves (held)',
    kind: 'position',
    targetPartIds: ['part.fixture.counter', 'part.fixture.upper-u1', 'part.fixture.upper-u2', 'part.fixture.upper-u3', 'part.fixture.shelves'],
    dependencyOperationIds: ['op.dry-fit-fixtures'],
    citationIds: [cite.card.p27('steps', 'Counter at 36 in; U1/U2/U3 with actual rails; three shelves into full studs'), cite.json.backingShelves, cite.json.backingBandStatus],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.fixture-loading',
    holdReason: 'fixture_loading: the counter/upper/shelf loads cannot be certified by a backing diagram alone; rail holes, bracket hardware and the accepted load path are held.',
    preconditions: ['Base row and counter heights measured; accepted backing/load path detail available.'],
    qualityChecks: [
      { instruction: 'Counter set at the intended 36-in top only after base heights and top thickness are measured; 26-in clear distance to the U1/U2 bottoms at 62 in confirmed', evidenceRequired: 'measurement', citationIds: [cite.card.p27('steps', '36-in top; 26-in clear to 62-in bottoms')] },
      { instruction: 'U1/U2/U3 mounted via their actual rails/holes into approved W1 wood; three shelves on selected brackets fixed into verified full studs', evidenceRequired: 'photo', citationIds: [cite.card.p27('steps', 'Actual rails and full studs')] },
    ],
    stopConditions: ['Do not hang an upper or shelf from drywall or an unreleased backing detail.', 'Shelf brackets are attached to verified full studs with their own hardware.'],
    stateEffects: [
      { partId: 'part.fixture.counter', fromState: 'absent', toState: 'positioned' },
      { partId: 'part.fixture.upper-u1', fromState: 'absent', toState: 'positioned' },
      { partId: 'part.fixture.upper-u2', fromState: 'absent', toState: 'positioned' },
      { partId: 'part.fixture.upper-u3', fromState: 'absent', toState: 'positioned' },
      { partId: 'part.fixture.shelves', fromState: 'absent', toState: 'positioned' },
    ],
    view: view('view.elevation-w1', ['part.fixture.counter', 'part.fixture.upper-u1', 'part.fixture.upper-u2', 'part.fixture.upper-u3', 'part.fixture.shelves']),
    parameters: {
      datumNote: 'Set the butcher-block counter at the intended 36-in top elevation after measuring base heights and top thickness; mount U1/U2 36x34 and U3 over-fridge 36x24 via their actual rails/holes; place three 36-in shelves on selected heavy-duty brackets fixed into full studs.',
      fromPartId: 'part.fixture.counter',
      offsetsMm: null,
      toolId: 'tool.drill-driver',
    },
  });

  addOp({
    id: 'op.set-refrigerator',
    title: 'Set the GE refrigerator and prove the operating fit (held)',
    kind: 'position',
    targetPartIds: ['part.fixture.fridge', 'part.fixture.fridge-bay'],
    dependencyOperationIds: ['op.dry-fit-fixtures'],
    citationIds: [cite.card.p27('steps', 'Set the GE in its 37-in bay; test operation'), cite.card.p03('operating-fit', 'Operating-fit warnings'), cite.json.aisleNote],
    declaredReleaseStatus: 'held',
    releaseId: 'release.r35.fixture-loading',
    holdReason: 'fixture_loading: the project label is set, but physical fit, door swing, bin removal, walking access and service removal are unresolved family-source estimates, not fit proof.',
    preconditions: ['Base row dry-fit and the 37-in clear bay measured; manufacturer clearances available for the actual project label.'],
    qualityChecks: [
      { instruction: 'Door swing, freezer-bin removal, walking access and service removal tested on the taped footprint before final panel/filler fastening', evidenceRequired: 'photo', citationIds: [cite.card.p27('steps', 'Test swing, bin removal and service removal')] },
      { instruction: '3 1/4-in left allowance checked against the family note\'s about 14 1/4-in freezer-side requirement; 26 3/4-in / 11-in nominals not treated as confirmed clearances', evidenceRequired: 'measurement', citationIds: [cite.card.p03('operating-fit', 'Neither proves actual swing; full-size checks required')] },
    ],
    stopConditions: ['Do not fix W1 or the divider before full-size operating and service checks.', 'Family-source dimensions do not substitute for the project label label/room fit.'],
    stateEffects: [{ partId: 'part.fixture.fridge', fromState: 'absent', toState: 'positioned' }],
    view: view('view.plan', ['part.fixture.fridge', 'part.fixture.fridge-bay']),
    parameters: {
      datumNote: 'Set the GE GSE25GYPHCFS in its 37-in clear bay with manufacturer-required clearances and test door swing, bin removal, walking access and service removal before final panel or filler fastening.',
      fromPartId: 'part.fixture.fridge-bay',
      offsetsMm: null,
      toolId: 'tool.tape-measure',
    },
  });

  // ---- G1-G7 release/acceptance gates (held) --------------------------------------------------------
  const gateDefs = [
    ['g1-layout', 'G1 layout gate', 'W1/W2 measured finished endpoints at 3 heights; physical truss centre and approved line.', ['part.w1.bottom-plate', 'part.w2.bottom-plate', 'part.reference.truss-band'], 'field_measurement_or_photo', [cite.card.p28('gates', 'G1 row')]],
    ['g2-floor', 'G2 floor gate', 'Tile/mortar/slab layers, hole clearance, tested anchor/support and repair approach.', ['part.existing.tile-floor', 'part.existing.slab'], 'field_measurement_or_photo', [cite.card.p28('gates', 'G2 row')]],
    ['g3-frame', 'G3 frame gate', 'W1/W2 member lengths, screw/connector patterns, top movement, end/corner/temporary restraint.', ['part.w1.stud-s01', 'part.w2.stud-s01', 'part.w1.bottom-plate', 'part.w2.bottom-plate'], 'photo', [cite.card.p28('gates', 'G3 row')]],
    ['g4-ex1', 'G4 EX1 gate', 'Wall role/services, approved opening/header/jamb/exposure and retained kitchen door.', ['part.existing.ex1-wall', 'part.existing.kitchen-door'], 'photo', [cite.card.p28('gates', 'G4 row')]],
    ['g5-fixtures', 'G5 fixtures gate', 'B1/B2/B3 actual widths, cabinet rail templates, shelf brackets/loads, GE operation.', ['part.fixture.base-row', 'part.fixture.fridge', 'part.backing.top-b01'], 'field_measurement_or_photo', [cite.card.p28('gates', 'G5 row')]],
    ['g6-closeup', 'G6 close-up gate', 'Inspection and photographs of studs, 25 blocks, fasteners, services and board edge supports.', ['part.w1.stud-s01', 'part.backing.top-b01', 'part.drywall.w1-p-01'], 'photo', [cite.card.p28('gates', 'G6 row')]],
    ['g7-finish', 'G7 finish gate', 'Drywall product/face map, trim exposed lengths, cabinet/fridge and door function.', ['part.drywall.w1-p-01', 'part.fixture.fridge', 'part.w1.bottom-plate'], 'photo', [cite.card.p28('gates', 'G7 row')]],
  ];
  for (const [key, title, criteria, targetPartIds, evidenceRequired, citations] of gateDefs) {
    addOp({
      id: `op.gate-${key}`,
      title: `${title} (held release/acceptance gate)`,
      kind: 'inspect',
      targetPartIds,
      dependencyOperationIds: ['op.set-refrigerator', 'op.set-counter-uppers-shelves'],
      citationIds: [cite.card.p28('status', 'Survey/practice ready; house work held'), cite.card.p28('limits', 'Named gates control held steps'), ...citations],
      declaredReleaseStatus: 'held',
      releaseId: null,
      holdReason: `${title}: held until the named evidence is attached and a qualified review accepts it. A browser checkbox never satisfies this gate.`,
      preconditions: ['All evidence listed for this gate attached before affected work.'],
      qualityChecks: [
        { instruction: 'Required evidence attached for this gate; update the measured packet before house cuts, drilling, EX1 alteration or drywall close-up', evidenceRequired, citationIds: [cite.card.p28('process', 'Review the updated measured packet')] },
      ],
      stopConditions: ['This gate is never satisfied by a ready step or a browser checkbox.'],
      stateEffects: [],
      view: view('view.iso', targetPartIds),
      parameters: {
        inspectWhat: `${title}: ${criteria}`,
        criteria: 'The listed evidence exists, is complete and is accepted by a qualified review; otherwise the affected work stays held.',
        evidenceRequired,
      },
    });
  }

  addOp({
    id: 'op.update-field-model',
    title: 'Update the measured packet, cut list, nest and cart (held)',
    kind: 'inspect',
    targetPartIds: [],
    dependencyOperationIds: ['op.gate-g7-finish'],
    citationIds: [cite.card.p28('process', 'Recalculate the cut list, nest, order and cart'), cite.card.p28('limits', 'Not a permit or release'), cite.json.changes],
    declaredReleaseStatus: 'held',
    releaseId: null,
    holdReason: 'Held until the field model is complete and reviewed: the cut list, drywall nesting, material order and cart must be recalculated from measurements, not from the concept.',
    preconditions: ['All gate evidence attached and the as-built changes recorded.'],
    qualityChecks: [
      { instruction: 'Cut list, drywall nesting, material order and pickup cart recalculated from the field model; superseded 2x4 backing/W2 materials reconciled before return or exchange', evidenceRequired: 'field_measurement_or_photo', citationIds: [cite.card.p28('process', 'Recalculate from the field model; reconcile superseded materials')] },
    ],
    stopConditions: ['Do not treat this concept PDF as a permit, structural approval or release.'],
    stateEffects: [],
    view: view('view.plan', []),
    parameters: {
      inspectWhat: 'The updated measured packet: endpoints, truss line, B1/B2/B3 widths, rail templates, service map and as-built notes.',
      criteria: 'Field model recorded and reviewed; downstream cut/order documents regenerated from it.',
      evidenceRequired: 'field_measurement_or_photo',
    },
  });

  addOp({
    id: 'op.record-source-status',
    title: 'Record source status, supersession and limits',
    kind: 'inspect',
    targetPartIds: [],
    dependencyOperationIds: ['op.update-field-model'],
    citationIds: [cite.card.p29('status', 'Concept and numbered sequence; final review held'), cite.card.p29('sources', 'Source table with limits'), cite.card.p29('cart', 'Cart temporal statement'), cite.card.p29('review', 'Review coverage and limits'), cite.json.supersedes, cite.json.changes],
    declaredReleaseStatus: 'conditional',
    releaseId: 'release.r35.plan',
    holdReason: 'Conditional record: the listed sources, supersession and limits are recorded with the guide; the parent field model is still held.',
    preconditions: ['Source records and review notes available.'],
    qualityChecks: [
      { instruction: 'Reviewed artifacts and their limits recorded: R31/R33/R34 review scopes, the R35 scoped review and the R35 PDF hash', evidenceRequired: 'visual', citationIds: [cite.card.p29('review', 'Review record and limits')] },
      { instruction: 'Cart statements reconciled temporally; procurement is non-authoritative for engineering properties and no stale nailer requirement survives', evidenceRequired: 'visual', citationIds: [cite.card.p29('cart', 'Cart status statement')] },
    ],
    stopConditions: ['Do not present an independent review as engineering approval or as a construction release.'],
    stateEffects: [],
    view: view('view.iso', []),
    parameters: {
      inspectWhat: 'Source record: drawing/source limits, supersession list, review scopes, cart timeline and the unchanged holds.',
      criteria: 'Recorded truthfully and consistently with the authored bundle and work/r35 artifacts.',
      evidenceRequired: 'none',
    },
  });

  // ---- steps ----------------------------------------------------------------------------------------
  const stepView = ALL_ASSEMBLIES;
  const steps = [];
  const toolIds = (...ids) => ids;
  const step = (id, sequence, title, phaseLabel, prerequisiteStepIds, operationIds, opts = {}) => {
    steps.push({
      id,
      sequence,
      title,
      phaseLabel,
      prerequisiteStepIds,
      operationIds,
      visibleAssemblyIds: opts.visibleAssemblyIds ?? stepView,
      toolIds: opts.toolIds ?? [],
      qualityChecks: opts.qualityChecks ?? [],
      stopConditions: opts.stopConditions ?? [],
      declaredReleaseStatus: opts.declaredReleaseStatus ?? 'ready',
      citationIds: opts.citationIds ?? [],
    });
  };

  step('step.p4-survey', 10, 'Survey before cutting (p4)', 'Survey & logistics', [], ['op.survey-finished-faces'], {
    toolIds: toolIds('tool.tape-measure', 'tool.pencil', 'tool.level-48', 'tool.straightedge-laser'),
    citationIds: [cite.card.p04('ready', 'Survey ready'), cite.card.p04('steps', 'Survey steps 01-05'), cite.card.p02('inside', '149-in plan reference')],
  });
  step('step.p5-trim-survey', 20, 'Non-destructive trim survey (p5)', 'Survey & logistics', ['step.p4-survey'], ['op.survey-trim'], {
    toolIds: toolIds('tool.utility-knife', 'tool.putty-knife', 'tool.eye-protection'),
    citationIds: [cite.card.p05('scope', 'Trim survey scope'), cite.card.p05('bounds', 'Survey ready, removal held')],
  });
  step('step.p7-setup', 30, 'Set up the work area and prove the route (p7)', 'Survey & logistics', ['step.p4-survey'], ['op.protect-route', 'op.stage-tools'], {
    toolIds: toolIds('tool.circular-saw', 'tool.drill-driver', 'tool.work-platform', 'tool.clamps'),
    citationIds: [cite.card.p07('ready', 'READY protection/inventory/route'), cite.card.p07('steps', 'Setup steps 01-03'), cite.card.p07('method', 'Build-in-place single top plate')],
  });
  step('step.p13-practice', 40, 'Review the highlighted cut list, cut and dry-fit the mock frame (p13)', 'Loose-stock practice', ['step.p7-setup'], ['op.prepare-practice', 'op.cut-practice', 'op.fit-practice-frame'], {
    toolIds: toolIds('tool.circular-saw', 'tool.square', 'tool.clamps', 'tool.eye-protection'),
    citationIds: [cite.card.p13('ready', 'Loose-stock practice ready'), cite.card.p13('yield', 'Practice yield')],
  });
  step('step.p14-sd9112', 50, 'Read the connector card and drive practice screws (p14)', 'Loose-stock practice', ['step.p13-practice'], ['op.read-connector-card', 'op.drive-practice-screws'], {
    toolIds: toolIds('tool.drill-driver', 'tool.hex-nutsetter'),
    citationIds: [cite.card.p14('conditional', 'Practice card; placement conditional'), cite.card.p14('spec', 'SD9112 spec'), cite.esr('note', 'ESR excerpt note')],
  });
  step('step.p5-trim-removal', 60, 'Remove only the marked baseboard (p5, held/bounded)', 'Layout & reviews', ['step.p5-trim-survey', 'step.p14-sd9112'], ['op.remove-trim-selective'], {
    declaredReleaseStatus: 'held',
    toolIds: toolIds('tool.utility-knife', 'tool.putty-knife', 'tool.pry-bar', 'tool.end-nippers'),
    citationIds: [cite.card.p05('zones', 'TR-01..TR-03 bounded removal'), cite.json.releases],
  });
  step('step.p8-w1-layout', 70, 'Mark W1 plate footprints (p8)', 'Layout & reviews', ['step.p4-survey', 'step.p14-sd9112'], ['op.layout-w1-plates'], {
    declaredReleaseStatus: 'conditional',
    toolIds: toolIds('tool.pencil', 'tool.tape-measure', 'tool.square'),
    citationIds: [cite.card.p08('centres', 'W1 centres'), cite.card.p08('arithmetic', 'Conditional plate arithmetic'), cite.card.p08('hold', 'House cut held')],
  });
  step('step.p11-w2-layout', 80, 'Mark W2 2x8 plate candidates (p11)', 'Layout & reviews', ['step.p4-survey', 'step.p14-sd9112'], ['op.layout-w2-plates'], {
    declaredReleaseStatus: 'conditional',
    toolIds: toolIds('tool.pencil', 'tool.tape-measure'),
    citationIds: [cite.card.p11('projection', 'W2 projection comparison'), cite.card.p11('hold', 'House cut held')],
  });
  step('step.p10-connector', 90, 'Review the A34/A34Z candidate and ESR limits (p10)', 'Layout & reviews', ['step.p14-sd9112'], ['op.review-connector'], {
    declaredReleaseStatus: 'conditional',
    citationIds: [cite.card.p10('conditional', 'Conditional connector scope'), cite.card.p10('esr-limits', 'ESR limits')],
  });
  step('step.p15-slab', 100, 'Investigate the tile/slab base (p15, held)', 'Layout & reviews', ['step.p4-survey', 'step.p14-sd9112'], ['op.review-slab-base'], {
    declaredReleaseStatus: 'held',
    toolIds: toolIds('tool.tile-bit', 'tool.concrete-drill', 'tool.dust-control'),
    citationIds: [cite.card.p15('hold', 'No drilling hold'), cite.card.p15('steps', 'Floor-stack and hole-clearance steps')],
  });
  step('step.p16-base-plates', 110, 'Position and anchor the base plates (p16, held)', 'Wall framing (held)', ['step.p8-w1-layout', 'step.p11-w2-layout', 'step.p10-connector', 'step.p15-slab'], ['op.set-bottom-plates', 'op.anchor-base-plates'], {
    declaredReleaseStatus: 'held',
    toolIds: toolIds('tool.level-48', 'tool.concrete-drill'),
    citationIds: [cite.card.p16('order', 'Execute before stud installation'), cite.card.p16('steps', 'Bottom plate and anchor text')],
  });
  step('step.p16-top-restraint', 120, 'Position top plates and the nonbearing restraint (p16, held)', 'Wall framing (held)', ['step.p16-base-plates'], ['op.restrain-top-plates'], {
    declaredReleaseStatus: 'held',
    toolIds: toolIds('tool.level-48', 'tool.work-platform'),
    citationIds: [cite.card.p16('steps', 'Top plate and truss-movement allowance'), cite.card.p16('truss', 'Locate the real chord')],
  });
  step('step.p9-w1-studs', 130, 'Build W1 in place, S01-S12 (p9, held)', 'Wall framing (held)', ['step.p16-top-restraint'], ['op.fit-w1-studs', 'op.fasten-w1-studs'], {
    declaredReleaseStatus: 'held',
    toolIds: toolIds('tool.level-48', 'tool.drill-driver', 'tool.hex-nutsetter', 'tool.clamps'),
    citationIds: [cite.card.p09('scope', 'W1 in-place scope'), cite.card.p09('steps', 'Fit and connect steps')],
  });
  step('step.p12-w2-frame', 140, 'Build W2 and tie the corner (p12, held)', 'Wall framing (held)', ['step.p9-w1-studs'], ['op.fit-w2-frame', 'op.fasten-w2-frame', 'op.tie-corner-column'], {
    declaredReleaseStatus: 'held',
    toolIds: toolIds('tool.tape-measure', 'tool.drill-driver', 'tool.hex-nutsetter'),
    citationIds: [cite.card.p12('scope', 'W2 scope'), cite.card.p12('steps', 'W2 fit and corner tie steps')],
  });
  step('step.p17-straightening', 150, 'Check and correct the frame plane (p17, held)', 'Wall framing (held)', ['step.p12-w2-frame'], ['op.check-straightness'], {
    declaredReleaseStatus: 'held',
    toolIds: toolIds('tool.level-48', 'tool.straightedge-laser', 'tool.mason-line', 'tool.square'),
    citationIds: [cite.card.p17('hold', 'Straightening hold'), cite.card.p17('handbook', 'Handbook reference')],
  });
  step('step.p18-backing', 160, 'Field-fit the 25 backing blocks (p18, held)', 'Cabinet backing (held)', ['step.p17-straightening'], ['op.fit-backing-blocks'], {
    declaredReleaseStatus: 'held',
    toolIds: toolIds('tool.tape-measure', 'tool.square'),
    citationIds: [cite.card.p18('hold', 'Backing rails/load-path hold'), cite.card.p18('mix', 'Cut mix')],
  });
  step('step.p19-backing-connection', 170, 'Resolve and fasten the backing connection (p19, held)', 'Cabinet backing (held)', ['step.p18-backing'], ['op.review-backing-connection', 'op.fasten-backing-blocks'], {
    declaredReleaseStatus: 'held',
    toolIds: toolIds('tool.drill-driver', 'tool.hex-nutsetter'),
    citationIds: [cite.card.p19('hold', 'Opposing angles hold'), cite.card.p19('conflict', 'ESR 3-in conflict')],
  });
  step('step.p20-ex1', 180, 'Form the EX1 closet passage (p20, held)', 'Existing opening (held)', ['step.p19-backing-connection'], ['op.open-ex1-passage'], {
    declaredReleaseStatus: 'held',
    toolIds: toolIds('tool.utility-knife', 'tool.putty-knife'),
    citationIds: [cite.card.p20('hold', 'EX1 hold'), cite.card.p20('scope-limits', 'Kitchen door retained; EX1 excluded from takeoff')],
  });
  step('step.p21-drywall-plan', 190, 'Plan the drywall faces and supports (p21, held)', 'Drywall (held)', ['step.p19-backing-connection'], ['op.plan-drywall-faces', 'op.inspect-faces-supports'], {
    declaredReleaseStatus: 'held',
    toolIds: toolIds('tool.t-square', 'tool.tape-measure'),
    citationIds: [cite.card.p21('hold', 'Drywall plane hold'), cite.card.p21('steps', 'Face inspection and nest')],
  });
  step('step.p23-junction-drawings', 200, 'Review junction and corner drawings (p22-p24, held)', 'Drywall (held)', ['step.p21-drywall-plan'], ['op.review-drywall-drawings'], {
    declaredReleaseStatus: 'held',
    citationIds: [cite.card.p23('junction', 'Wood junction'), cite.card.p23('corners', 'Gypsum corners'), cite.card.p22('release', 'Schematic; use written dimensions')],
  });
  step('step.p25-drywall-hang', 210, 'Inspect pre-close, hang and check drywall (p25, held)', 'Drywall (held)', ['step.p23-junction-drawings'], ['op.inspect-preclose', 'op.hang-drywall', 'op.inspect-drywall'], {
    declaredReleaseStatus: 'held',
    toolIds: toolIds('tool.screwgun', 'tool.drywall-lift', 'tool.utility-knife', 'tool.rasp'),
    citationIds: [cite.card.p25('hold', 'Preclose and screw-schedule hold'), cite.card.p25('steps', 'Hanging and inspection steps')],
  });
  step('step.p26-finish', 220, 'Tape, finish, paint and baseboard (p26, conditional/held)', 'Drywall (held)', ['step.p25-drywall-hang'], ['op.finish-drywall', 'op.install-baseboard'], {
    declaredReleaseStatus: 'conditional',
    toolIds: toolIds('tool.paint-tools', 'tool.tape-measure'),
    citationIds: [cite.card.p26('conditional', 'Finish system conditional'), cite.card.p26('baseboard', 'Baseboard decision and no-drill boundary')],
  });
  step('step.p27-cabinets', 230, 'Install cabinets, counter and shelves (p27, held)', 'Fixtures & release (held)', ['step.p26-finish'], ['op.dry-fit-fixtures', 'op.set-counter-uppers-shelves'], {
    declaredReleaseStatus: 'held',
    toolIds: toolIds('tool.tape-measure', 'tool.drill-driver'),
    citationIds: [cite.card.p27('hold', 'Fixture load-path hold'), cite.card.p27('steps', 'Cabinet/counter/shelf steps')],
  });
  step('step.p27-refrigerator', 240, 'Set the refrigerator and prove the fit (p27, held)', 'Fixtures & release (held)', ['step.p27-cabinets'], ['op.set-refrigerator'], {
    declaredReleaseStatus: 'held',
    toolIds: toolIds('tool.tape-measure'),
    citationIds: [cite.card.p27('steps', 'GE operating checks'), cite.card.p03('operating-fit', 'Operating-fit warnings')],
  });
  step('step.p28-gates', 250, 'G1-G7 release and as-built gates (p28, held)', 'Fixtures & release (held)', ['step.p27-refrigerator'], ['op.gate-g1-layout', 'op.gate-g2-floor', 'op.gate-g3-frame', 'op.gate-g4-ex1', 'op.gate-g5-fixtures', 'op.gate-g6-closeup', 'op.gate-g7-finish', 'op.update-field-model'], {
    declaredReleaseStatus: 'held',
    citationIds: [cite.card.p28('status', 'Survey/practice ready; house work held'), cite.card.p28('gates', 'G1-G7 gate table'), cite.card.p28('process', 'Update and review the measured packet')],
  });
  step('step.p29-source-record', 260, 'Source record, supersession and limits (p29)', 'Fixtures & release (held)', ['step.p28-gates'], ['op.record-source-status'], {
    declaredReleaseStatus: 'conditional',
    citationIds: [cite.card.p29('status', 'Final review held'), cite.card.p29('sources', 'Source limits'), cite.card.p29('cart', 'Cart statement'), cite.card.p29('review', 'Review record')],
  });

  // Held work never mutates canonical step state. Keep each held/conditional operation legible by
  // revealing its absent targets plus the planned context established by earlier held stages. The
  // reveal is presentation-only: every item remains an absent, blue-grey preview and no cut,
  // installation, takeoff, connection quantity or IFC geometry is released by it.
  const plannedContextByOperation = new Map([
    ['op.set-bottom-plates', []],
    ['op.anchor-base-plates', []],
    ['op.restrain-top-plates', ['part.w1.bottom-plate', 'part.w2.bottom-plate']],
    ['op.fit-w1-studs', w1FrameIds],
    ['op.fasten-w1-studs', w1FrameIds],
    ['op.fit-w2-frame', houseFrameIds],
    ['op.fasten-w2-frame', houseFrameIds],
    ['op.tie-corner-column', houseFrameIds],
    ['op.check-straightness', houseFrameIds],
    ['op.fit-backing-blocks', frameAndBackingIds],
    ['op.review-backing-connection', frameAndBackingIds],
    ['op.fasten-backing-blocks', frameAndBackingIds],
    ['op.open-ex1-passage', frameAndBackingIds],
    ['op.plan-drywall-faces', frameBackingAndDrywallIds],
    ['op.inspect-faces-supports', frameBackingAndDrywallIds],
    ['op.review-drywall-drawings', frameBackingAndDrywallIds],
    ['op.inspect-preclose', frameAndBackingIds],
    ['op.hang-drywall', frameBackingAndDrywallIds],
    ['op.inspect-drywall', frameBackingAndDrywallIds],
    ['op.finish-drywall', frameBackingAndDrywallIds],
    ['op.install-baseboard', frameBackingAndDrywallIds],
    ['op.dry-fit-fixtures', fullConceptIds],
    ['op.set-counter-uppers-shelves', fullConceptIds],
    ['op.set-refrigerator', fullConceptIds],
    ['op.gate-g1-layout', fullConceptIds],
    ['op.gate-g2-floor', fullConceptIds],
    ['op.gate-g3-frame', fullConceptIds],
    ['op.gate-g4-ex1', fullConceptIds],
    ['op.gate-g5-fixtures', fullConceptIds],
    ['op.gate-g6-closeup', fullConceptIds],
    ['op.gate-g7-finish', fullConceptIds],
    ['op.update-field-model', fullConceptIds],
    ['op.record-source-status', fullConceptIds],
  ]);
  const initiallyAbsentPartIds = new Set(
    model.parts.filter((part) => part.initialState === 'absent').map((part) => part.id),
  );
  for (const operation of operations) {
    if (
      operation.declaredReleaseStatus !== 'held' &&
      operation.declaredReleaseStatus !== 'conditional'
    ) continue;
    const absentTargets = operation.targetPartIds.filter((partId) =>
      initiallyAbsentPartIds.has(partId),
    );
    const context = plannedContextByOperation.get(operation.id) ?? [];
    const reveal = [...new Set([...(operation.view.recipe.reveal ?? []), ...context, ...absentTargets])];
    if (reveal.length > 0) operation.view.recipe.reveal = reveal;
  }

  // R35 intentionally stores unresolved full-height members as truthful plan footprints. Present
  // those footprints as a clearly labelled schematic elevation in wall-context views only; this
  // recipe never alters source geometry, dimensions, takeoff, measurements or IFC output.
  for (const operation of operations) {
    if (
      operation.view.cameraPresetId !== 'view.practice-bench' &&
      operation.view.cameraPresetId !== 'view.closeup-connector'
    ) {
      operation.view.recipe = {
        ...operation.view.recipe,
        schematicElevation: wallSchematicElevation,
      };
    }
  }
  const setupRoute = operations.find((operation) => operation.id === 'op.protect-route');
  if (setupRoute) {
    setupRoute.view.recipe.schematicElevation = {
      ...wallSchematicElevation,
      label: 'Loose practice cuts highlighted · House-wall schematic hidden · house heights field-fit / not a cut dimension',
    };
  }

  return { operations, steps };
}
