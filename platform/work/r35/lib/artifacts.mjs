/**
 * work/r35 artifacts: source inventory, field-level carry-forward map, per-page coverage matrix,
 * CSV reconciliation and the private-to-public excerpt map.
 *
 * All values are read from the §16 inputs at build time or copied from the authored model; nothing
 * is invented and no private identity (address, parcel, permit number, raw URLs) is recorded here.
 */
import { FILE, OWNER_HASHES } from './content.mjs';
import { inchMm } from './util.mjs';

const RECORDED_SOURCE_ROOT = 'private://owner-supplied-r35';
const RECORDED_PRIVATE_FILES = new Map([
  [FILE.permitManifest, 'private://permit/source-manifest.json'],
  [FILE.permitReadme, 'private://permit/README.md'],
  [FILE.permitPdf, 'private://permit/approved-drawing-set.pdf'],
]);
const recordedPath = (path) => RECORDED_PRIVATE_FILES.get(path) ?? path;

const ROLE = {
  [FILE.manualJson]: 'Primary structured extraction seed (inches, pre-normalized; not a schema or consistency proof)',
  [FILE.manualPdf]: '29-page reviewed conditional manual: drawing context, step text, checks and page citations',
  [FILE.layoutPdf]: 'One-page layout for cross-check and plan fallback (condensed derivative, not a field survey)',
  [FILE.changeRecord]: 'Revision policy, carry-forward list and cart timeline',
  [FILE.review]: 'Scoped review evidence (conditional planning only; no construction release)',
  [FILE.partsCsv]: '46 candidate framing/part rows -> stable parts (geometry only; lengths/connections conditional)',
  [FILE.backingCsv]: '25 backing blocks, bay endpoints, elevations and purposes (flat 2x6 orientation kept)',
  [FILE.panelsCsv]: '12 panels, face, thickness, endpoints, width, stock and height rule (height unresolved)',
  [FILE.materialsCsv]: '17 planning material rows (quantities as proposed, not purchased or approved)',
  [FILE.svgCabinet]: 'Current cabinet elevation (refrigerator left, B1 drawer-over-door beside it)',
  [FILE.svgTruss]: 'Retained roof alignment trial (not field verification)',
  [FILE.svgBacking]: 'Retained 2x6 backing diagram',
  [FILE.svgBaseboard]: 'Retained selective trim / baseboard removal map',
  [FILE.svgDrywallLayout]: 'Retained four-face drywall layout drawing',
  [FILE.svgWoodJunction]: 'Retained W1/W2 wood junction drawing',
  [FILE.svgCorners]: 'Retained wall/gypsum corner drawing',
  [FILE.permitManifest]: 'Original house source provenance (identity and URLs withheld)',
  [FILE.permitReadme]: 'Original permit document notes (A3/A5/A7/D4/D5 sheet inventory)',
  [FILE.permitPdf]: 'Approved original house plans (A3/A7/D4/D5 references); not a new pantry approval',
  [FILE.cartR35]: 'R35 pickup-only cart observation (procurement history only; no checkout) used for the temporal reconciliation',
  [FILE.cartWoodReserve]: 'R35 wood-reserve cart observation (procurement history only; no checkout) used for the temporal reconciliation',
  [FILE.esrPdf]: 'January 2026 ESR-3096 connector report (Table 5 / Figure 5, p. 8 evidence)',
  [FILE.esrNotes]: 'Research index notes; the primary report remains the evidence',
};

export const PIPELINE_FILES = {
  current: [FILE.manualJson, FILE.manualPdf, FILE.layoutPdf, FILE.changeRecord, FILE.review, FILE.partsCsv, FILE.backingCsv, FILE.panelsCsv, FILE.materialsCsv, FILE.esrPdf, FILE.esrNotes],
  carry_forward: [FILE.svgCabinet, FILE.svgTruss, FILE.svgBacking, FILE.svgBaseboard, FILE.svgDrywallLayout, FILE.svgWoodJunction, FILE.svgCorners],
  reference: [FILE.permitManifest, FILE.permitReadme, FILE.permitPdf, FILE.cartR35, FILE.cartWoodReserve],
};

const REFERENCE_DIRS = [
  'output/reference/R23-fridge',
  'output/reference/R22-drywall',
  'output/reference/R24-materials',
];
const PROVENANCE_DIRS = ['work/R35', 'work/R34', 'work/R33'];

/** Build the private source inventory: every listed input with hash, size, date and privacy. */
export function buildInventory({ sha256Of, statOf, listFiles }) {
  const entries = [];
  const add = (relPath, { privacy, relationship, role, readByPipeline, revision, ownerHash }) => {
    const digest = sha256Of(relPath);
    const stat = statOf(relPath);
    entries.push({
      path: recordedPath(relPath),
      sha256: digest,
      size: stat.size,
      bytes: stat.size,
      date: new Date(stat.mtimeMs).toISOString().slice(0, 10),
      revision: revision ?? null,
      privacy,
      relationship,
      role,
      readByPipeline,
      ownerHashVerified: ownerHash ? digest === ownerHash : null,
    });
  };

  for (const file of PIPELINE_FILES.current) {
    add(file, { privacy: file === FILE.esrPdf || file === FILE.esrNotes ? 'excerpt_only' : 'private', relationship: 'current', role: ROLE[file], readByPipeline: true, ownerHash: OWNER_HASHES[file] });
  }
  for (const file of PIPELINE_FILES.carry_forward) {
    add(file, { privacy: 'private', relationship: 'carry_forward', role: ROLE[file], readByPipeline: true });
  }
  for (const file of PIPELINE_FILES.reference) {
    add(file, { privacy: 'private', relationship: 'reference', role: ROLE[file], readByPipeline: true });
  }
  for (const dir of REFERENCE_DIRS) {
    for (const file of listFiles(dir)) {
      add(file, {
        privacy: 'private',
        relationship: 'reference',
        role: `Cached manufacturer file in ${dir.split('/').pop()} (applicability must be verified; not all cached manuals are current)`,
        readByPipeline: false,
      });
    }
  }
  for (const dir of PROVENANCE_DIRS) {
    for (const file of listFiles(dir)) {
      add(file, {
        privacy: 'private',
        relationship: 'reference',
        role: 'Source-generation script or render (optional provenance aid; read-only, not a canonical input and not read by the conversion pipeline)',
        readByPipeline: false,
      });
    }
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    sourceRoot: RECORDED_SOURCE_ROOT,
    generatedBy: 'work/r35/author-r35.mjs',
    note: 'Private inventory. Address, parcel and permit identity and all raw source URLs are deliberately not recorded.',
    entries,
  };
}

/** Field-level carry-forward / supersession map. */
export function buildCarryForwardMap({ src, csvs, bundle, cart }) {
  const p = (pointer) => pointer;
  const json = FILE.manualJson;
  const entries = [];

  const push = (entry) => entries.push(entry);

  // Superseded geometry revisions named by the JSON.
  src.changes && null;
  const supersedesGeometry = src.p('/supersedes_geometry');
  supersedesGeometry.forEach((value, index) => {
    push({
      id: `cf.supersedes-geometry.${index}`,
      field: 'supersedes_geometry',
      sourceFile: json,
      sourceLocator: p(`/supersedes_geometry/${index}`),
      sourceValue: value,
      normalizedValue: 'superseded',
      status: 'superseded',
      supersededBy: '/revision (R35-screw-metal-connector-manual) and /changes_R35',
      reason: 'R35 explicitly carries forward older geometry drawings while superseding the earlier assembly/geometry revision named here.',
    });
  });

  const retained = src.p('/changes_R35/retained');
  push({
    id: 'cf.changes.retained',
    field: 'changes_R35.retained',
    sourceFile: json,
    sourceLocator: p('/changes_R35/retained'),
    sourceValue: retained,
    normalizedValue: 'carried into drafted/measurements/parts as conditional content',
    status: 'carried_conditional',
    reason: 'Geometry, block map and drywall/cabinet layout are retained; no cut, fastener or load release is implied.',
  });
  const retainedFacts = [
    ['149-in inside W1', 'measurement.w1.finished-inside', '/layout/W1_finished_inside_width'],
    ['68-in trial outside depth', 'measurement.w1.outside-depth-trial', '/layout/W1_outside_face_depth_trial'],
    ['111-in reported ceiling', 'measurement.ceiling.reported', '/site/ceiling_finished_height_user_report'],
    ['W2 8-3/8-in finished', 'measurement.w2.finished-thickness', '/layout/W2_finished_thickness'],
    ['25 flat 2x6 blocks', 'part.backing.top-b01 (representative) + cabinet-backing CSV rows', '/backing/number_of_blocks'],
    ['R34 four-face drywall and cabinet layout', 'part.drywall.w1-p-01 (representative) + drywall CSV rows', '/drywall/panel_layout'],
  ];
  retainedFacts.forEach(([label, target, locator], index) => {
    push({
      id: `cf.retained.${index}`,
      field: label,
      sourceFile: json,
      sourceLocator: p(locator),
      sourceValue: label,
      normalizedValue: target,
      status: 'carried_conditional',
      reason: 'Retained by R35 as conditional source content; not a construction release.',
    });
  });

  // R27/older facts superseded by the screw-and-metal-angle method.
  const supersededMethod = [
    ['21-degree framing nailer', 'tool/method not required; superseded by in-place screws and metal connectors'],
    ['framing nail strips', 'not required; removed from the later cart'],
    ['flat-built wall assembly', 'superseded by in-place plate-then-stud fitting'],
    ['full-height tilt-up frame', 'not planned; logistics state no full-height tilt-up'],
    ['R27 nail count', 'superseded; no nail count is carried into any quantity'],
    ['R27 screw grid', 'superseded; no screw grid is carried into any quantity'],
    ['R27 2x4 W2 studs', 'superseded by the W2 2x8 candidate section'],
    ['R27 2x4 backing', 'superseded by the owner-selected flat 2x6 blocking (D4 still depicts 2x4 and is not this modification)'],
    ['R27 nine-sheet drywall map', 'superseded by the R34 four-face candidate nest'],
    ['R27 slab anchor/cart line', 'not current for this layout; base anchorage held'],
  ];
  supersededMethod.forEach(([label, normalized], index) => {
    push({
      id: `cf.superseded-method.${index}`,
      field: label,
      sourceFile: json,
      sourceLocator: '/supersedes_documents and /changes_R35/method',
      sourceValue: label,
      normalizedValue: normalized,
      status: 'superseded',
      supersededBy: '/changes_R35/request (screws and metal plates instead of a 21-degree framing nailer) and /changes_R35/method (in-place plates then individually fitted studs)',
      reason: 'R35 change record supersedes the flat-assembly/nailer method; no earlier review is represented as approval of the screw connections.',
    });
  });

  // R31/R33/R34 geometry retained by R35.
  const retainedGeometry = [
    ['R33 W1 stud centres S01-S12', '/backing/candidate_W1_stud_centers_from_left_plate_end_in', 'candidate centres in measurement.w1.stud-sNN.centre and the W1 stud parts'],
    ['R31 flat 2x6 backing map (25 blocks, bays, bands)', '/backing + cabinet-backing-R31-CONCEPT.csv', '25 backing parts, one per CSV row'],
    ['R31 68-in truss-line trial', '/roof_plan_alignment', 'part.reference.truss-band and measurement.truss.center-trial (trial only)'],
    ['R32 baseboard removal map', 'output/images/pantry-R32-baseboard-removal-map.svg (TR-01..TR-03 labels)', 'trim parts and bounded removal operation (held)'],
    ['R33 cabinet elevation chain', 'output/images/pantry-R33-cabinet-elevation.svg + /fixtures', 'fixture envelopes and clearance volumes (schematic subdivisions)'],
    ['R34 four-face drywall map', '/drywall/panel_layout/faces + drywall-panel-schedule-R34-CONCEPT.csv', '12 panel parts with faces/endpoints; height field-fit'],
    ['R34 wood junction and gypsum corners', 'output/images/pantry-R34-wood-junction.svg and pantry-R34-wall-and-gypsum-corners.svg', 'corner footprints/board laps recorded; connection held'],
  ];
  retainedGeometry.forEach(([label, locator, normalized], index) => {
    push({
      id: `cf.retained-geometry.${index}`,
      field: label,
      sourceFile: locator.includes('.svg') ? locator : json,
      sourceLocator: locator,
      sourceValue: label,
      normalizedValue: normalized,
      status: 'retained_conditional',
      reason: 'Retained by R35 for geometry/drawing continuity only; connections and cuts remain conditional or held.',
    });
  });

  // Cart temporal reconciliation (publication-time statement vs later cart files).
  push({
    id: 'cf.cart.publication-statement',
    field: 'page-29 cart statement (publication time)',
    sourceFile: FILE.manualPdf,
    sourceLocator: 'printed page 29, cart-status paragraph',
    sourceValue: 'The R34 cart still includes a framing nailer and nail strips. Those are no longer required by R35. This revision does not mutate the live cart.',
    normalizedValue: 'historical statement at R35 publication; nailer/strips already obsolete for the method',
    status: 'historical',
    supersededBy: 'R35-change-record.md cart section (later observation)',
    reason: 'Publication-time note; the cart was updated after the revision was published.',
  });
  push({
    id: 'cf.cart.later-state',
    field: 'lowes-cart-R35.json pickup-only cart (after the revision was published)',
    sourceFile: FILE.cartR35,
    sourceLocator: '$.observed_final_units / $.merchandise_subtotal_before_tax / $.checkout_completed / $.project_lines F-ANGLE-PRACTICE, T-DRIVE, T-SAW',
    sourceValue: `observed_final_units=${cart.r35.units}; merchandise_subtotal_before_tax=${cart.r35.subtotal}; checkout_completed=${cart.r35.checkout}; project lines: ${cart.r35.practiceLines.join('; ')}`,
    normalizedValue: 'later observation reconciled with the publication statement; framing nailer absent and nail strips removed; A34Z samples and the nutsetter added for loose practice; installed connector purchase held; procurement non-authoritative for engineering properties',
    status: 'current',
    supersededBy: null,
    reason: 'Consecutive statements, not a contradiction: no stale nailer requirement survives anywhere; installed connector quantity stays held.',
    verifiedFacts: {
      checkoutCompleted: cart.r35.checkout,
      observedFinalUnits: cart.r35.units,
      merchandiseSubtotalBeforeTax: cart.r35.subtotal,
      nailerAbsent: cart.r35.nailerAbsent,
      practiceLines: cart.r35.practiceLines,
    },
  });
  push({
    id: 'cf.cart.wood-reserve',
    field: 'lowes-cart-R35-wood-reserve.json wood reserve cart (later companion observation)',
    sourceFile: FILE.cartWoodReserve,
    sourceLocator: '$.observed_final_units / $.merchandise_subtotal_before_tax / $.checkout_completed / $.wood_reserve_allocation',
    sourceValue: `observed_final_units=${cart.reserve.units}; merchandise_subtotal_before_tax=${cart.reserve.subtotal}; checkout_completed=${cart.reserve.checkout}; ${cart.reserve.practiceLines.join('; ')}`,
    normalizedValue: 'later companion cart state (wood reserve); consecutive observations only, procurement non-authoritative for engineering properties',
    status: 'current',
    supersededBy: null,
    reason: 'Both cart files reconcile the timeline; neither releases quantities, connections or load paths.',
    verifiedFacts: {
      checkoutCompleted: cart.reserve.checkout,
      observedFinalUnits: cart.reserve.units,
      merchandiseSubtotalBeforeTax: cart.reserve.subtotal,
      practiceLines: cart.reserve.practiceLines,
    },
  });
  push({
    id: 'cf.cart.wood-reserve-allocation',
    field: 'wood-reserve allocation',
    sourceFile: FILE.cartWoodReserve,
    sourceLocator: '$.wood_reserve_allocation',
    sourceValue: 'R35 wood/material lines with reserve boards',
    normalizedValue: 'not read as an engineering input; cart state is procurement-only',
    status: 'reference',
    supersededBy: null,
    reason: 'Cart files reconcile the timeline; they never release quantities, connections or load paths.',
  });

  return {
    sourceRoot: RECORDED_SOURCE_ROOT,
    generatedBy: 'work/r35/author-r35.mjs',
    policy: 'Newest filename alone is not a precedence rule: R35 carries forward older geometry/drawing schedules but supersedes the nailer assembly method. Field-level mapping below records both.',
    entries,
    summary: {
      superseded: entries.filter((entry) => entry.status === 'superseded').length,
      carried_conditional: entries.filter((entry) => entry.status === 'carried_conditional').length,
      retained_conditional: entries.filter((entry) => entry.status === 'retained_conditional').length,
      historical: entries.filter((entry) => entry.status === 'historical').length,
      current: entries.filter((entry) => entry.status === 'current').length,
      reference: entries.filter((entry) => entry.status === 'reference').length,
    },
  };
}

/** One row per PDF page 1-29 with a truthful disposition and named records. */
export function buildCoverageMatrix({ model, ops, cite }) {
  const rows = [
    {
      page: 1,
      title: 'Overview: build the pantry walls; READY survey/practice only',
      disposition: 'represented',
      entityIds: ['release.r35.survey', 'release.r35.practice', 'release.r35.plan'],
      operationIds: [],
      stepIds: [],
      viewIds: ['view.iso'],
      citationIds: [cite.card.p01('ready', 'READY survey/practice statement'), cite.card.p01('method', 'Single top plate concept'), cite.card.p01('next', 'Next physical action: 68-in trial and truss chord')],
      releaseStatus: 'ready (survey/practice only)',
      notes: 'Project intent, readiness statement and single-top-plate concept (see also the pantry-r35 listing and project.json). No house work is represented as ready.',
    },
    {
      page: 2,
      title: 'Read the finished plan: 149 / 68 / 63.5 / W2 / truss trial',
      disposition: 'represented',
      entityIds: ['measurement.w1.finished-inside', 'measurement.w1.outside-depth-trial', 'measurement.w1.clear-depth-derived', 'measurement.w2.finished-thickness', 'measurement.truss.center-trial'],
      operationIds: ['op.survey-finished-faces'],
      stepIds: ['step.p4-survey'],
      viewIds: ['view.plan'],
      citationIds: [cite.card.p02('inside', '149-in inside run'), cite.card.p02('outside', '68-in trial'), cite.card.p02('clear', '63 1/2-in clear'), cite.card.p02('return', 'W2 8 3/8-in return'), cite.card.p02('truss', 'Layout target, not an as-built connection')],
      releaseStatus: 'conditional arithmetic / ready survey',
      notes: 'All dimension rows mapped to measurements with JSON Pointer holds; truss row is a layout target only.',
    },
    {
      page: 3,
      title: 'Read the cabinet elevation: fridge front, chains, operating-fit warnings',
      disposition: 'represented',
      entityIds: ['part.fixture.base-row', 'part.fixture.fridge', 'measurement.cabinets.combined', 'measurement.fridge.bin-removal-required', 'measurement.fridge.closed-front-clearance', 'measurement.fridge.door90-clearance', 'issue.r35.cabinet-seams'],
      operationIds: ['op.dry-fit-fixtures', 'op.set-refrigerator'],
      stepIds: ['step.p27-cabinets', 'step.p27-refrigerator'],
      viewIds: ['view.elevation-w1'],
      citationIds: [cite.card.p03('fronts', 'Refrigerator left; 12-in drawer-over-door base beside it'), cite.card.p03('chain', '3 1/4 + 37 + 3/4 + 106 1/2 + 3/4 + 3/4 chain'), cite.card.p03('operating-fit', '26 3/4-in / 11-in nomials; about 14 1/4-in bin note; neither proves swing')],
      releaseStatus: 'held (fixture loading)',
      notes: 'Exact project label GE GSE25GYPHCFS; family-source distinction and operating-fit warnings attached to the fridge part and issue.',
    },
    {
      page: 4,
      title: 'Survey before cutting: taped faces, truss, boxes, EX1/trim photos',
      disposition: 'represented',
      entityIds: ['measurement.w1.finished-inside', 'measurement.truss.center-trial', 'measurement.cabinets.combined', 'measurement.closet.inside-width', 'measurement.closet.depth'],
      operationIds: ['op.survey-finished-faces'],
      stepIds: ['step.p4-survey'],
      viewIds: ['view.iso'],
      citationIds: [cite.card.p04('ready', 'Non-destructive measuring and removable floor tape'), cite.card.p04('steps', 'Survey steps 01-05'), cite.card.p04('no-cut', 'Do not turn the reported 111-in ceiling into a stud cut')],
      releaseStatus: 'ready (survey scope)',
      notes: 'Ready survey only; destructive exposure and drilling remain held.',
    },
    {
      page: 5,
      title: 'Remove only required baseboard: TR-01..TR-03 bounded removal',
      disposition: 'represented',
      entityIds: ['part.trim.tr-01', 'part.trim.tr-02', 'part.trim.tr-03', 'part.trim.tr-04', 'part.existing.kitchen-door'],
      operationIds: ['op.survey-trim', 'op.remove-trim-selective'],
      stepIds: ['step.p5-trim-survey', 'step.p5-trim-removal'],
      viewIds: ['view.elevation-w1'],
      citationIds: [cite.card.p05('scope', 'Trim scope before framing'), cite.card.p05('zones', 'TR-01/TR-02/TR-03 bounded removal'), cite.card.p05('bounds', 'No default room-wide removal; new baseboard after drywall')],
      releaseStatus: 'survey ready / removal held',
      notes: 'Non-destructive trim survey is ready; removal is held for marked contact areas and the EX1 opening boundary (TR-04 is conditional discovery only).',
    },
    {
      page: 6,
      title: 'Set out the provisional parts: planning tray and stock study',
      disposition: 'represented',
      entityIds: ['material.lumber.w1-stud', 'material.lumber.w2-stud', 'material.lumber.backing', 'material.lumber.practice', 'material.gypsum.half', 'material.gypsum.five-eighth'],
      operationIds: ['op.stage-tools', 'op.prepare-practice'],
      stepIds: ['step.p7-setup', 'step.p13-practice'],
      viewIds: [],
      citationIds: [cite.card.p06('tray', 'Planning tray, not a purchase or cutting release'), cite.card.p06('tray-rows', 'Planning rows'), cite.card.p06('superseded', 'Superseded R27 rows are not valid'), cite.card.p06('stock', 'Rectangular stock study; do not order counts')],
      releaseStatus: 'conditional planning',
      notes: 'Provisional quantities change with field measurements and connections; the superseded R27 material set is explicitly invalid.',
    },
    {
      page: 7,
      title: 'Set up the work area: READY protection, inventory and handling route',
      disposition: 'represented',
      entityIds: ['part.existing.tile-floor', 'part.w1.bottom-plate', 'part.w2.bottom-plate', 'tool.circular-saw', 'tool.drill-driver'],
      operationIds: ['op.protect-route', 'op.stage-tools'],
      stepIds: ['step.p7-setup'],
      viewIds: ['view.installer-eye'],
      citationIds: [cite.card.p07('ready', 'READY: protect, inventory and prove the handling route'), cite.card.p07('steps', 'Setup steps 01-03'), cite.card.p07('method', 'Build in place; single top plate'), cite.card.p07('helper', 'Helper and build-in-place statement')],
      releaseStatus: 'ready (survey/logistics scope)',
      notes: 'Page-7 protection, inventory and handling-route actions are ready under the ready survey/logistics scope; no nailer/strip requirement exists.',
    },
    {
      page: 8,
      title: 'Mark W1 two plates: candidate centres and conditional plate arithmetic',
      disposition: 'represented',
      entityIds: ['part.w1.bottom-plate', 'part.w1.top-plate', 'part.w1.stud-s01', 'part.w1.stud-s11', 'part.w1.stud-s12', 'measurement.w1.plate-156.75'],
      operationIds: ['op.layout-w1-plates'],
      stepIds: ['step.p8-w1-layout'],
      viewIds: ['view.elevation-w1'],
      citationIds: [cite.card.p08('centres', 'W1 candidate centres 3/4...156 in'), cite.card.p08('steps', 'Layout steps 01-03'), cite.card.p08('arithmetic', '149 + 1/2 + 7 1/4 = 156 3/4 conditional arithmetic'), cite.card.p08('hold', 'HOUSE CUT HELD')],
      releaseStatus: 'conditional (marking) / cut held',
      notes: 'Marking is conditional preview; the plate length is conditional arithmetic, not a saw cut.',
    },
    {
      page: 9,
      title: 'Build W1 in place: S01-S12, plates and candidate angle connections',
      disposition: 'represented',
      entityIds: ['part.w1.stud-s01', 'part.w1.stud-s06', 'part.w1.stud-s12', 'connection.w1.stud-to-plate', 'measurement.ceiling.reported'],
      operationIds: ['op.fit-w1-studs', 'op.fasten-w1-studs'],
      stepIds: ['step.p9-w1-studs'],
      viewIds: ['view.closeup-connector'],
      citationIds: [cite.card.p09('scope', '12 candidate studs; install only after connections accepted'), cite.card.p09('steps', 'Fit steps 01-03'), cite.card.p09('method-change', 'Screw/angle change from D4 end-nailing; table does not set the project number')],
      releaseStatus: 'held (frame cuts / connector placement)',
      notes: 'No cut or installed connection is released; do not batch-cut from the reported 111-in ceiling.',
    },
    {
      page: 10,
      title: 'Screw-fastened metal angles: candidate A34/A34Z + ESR limits',
      disposition: 'represented',
      entityIds: ['connection.w1.stud-to-plate', 'fastener.sd9112', 'measurement.connector.bend', 'measurement.connector.leg', 'measurement.connector.screw-length', 'issue.r35.esr-opposing-angle'],
      operationIds: ['op.review-connector'],
      stepIds: ['step.p10-connector'],
      viewIds: ['view.closeup-connector'],
      citationIds: [cite.card.p10('candidate', 'Angle 2 1/2 in; legs 1 7/16 in; 4+4=8 per angle'), cite.card.p10('esr-limits', 'F1 rotation restraint; F2 directional; 3-in opposing minimum'), cite.card.p10('limits', 'No load number is a cabinet weight rating')],
      releaseStatus: 'conditional review / placement held',
      notes: 'Candidate connector data only: installed quantity, orientation, rotation restraint and capacity are held; ESR-3096 excerpt card cited.',
    },
    {
      page: 11,
      title: 'Mark W2 2x8 frame: 8 3/8-in chain and 53 / 53 1/8-in comparisons',
      disposition: 'represented',
      entityIds: ['part.w2.bottom-plate', 'part.w2.top-plate', 'measurement.w2.plate-53', 'measurement.w2.plate-53.125', 'measurement.column.projection'],
      operationIds: ['op.layout-w2-plates'],
      stepIds: ['step.p11-w2-layout'],
      viewIds: ['view.elevation-w2'],
      citationIds: [cite.card.p11('chain', '1/2 + 7 1/4 + 5/8 = 8 3/8 in'), cite.card.p11('projection', '53 / 53 1/8-in comparison; field-fit the last member'), cite.card.p11('hold', 'HOUSE CUT HELD')],
      releaseStatus: 'conditional (marking) / cut held',
      notes: 'Actual column contact governs; no W2 longitudinal cut is released.',
    },
    {
      page: 12,
      title: 'Build W2 and connect the walls: five studs, corner/column ties',
      disposition: 'represented',
      entityIds: ['part.w2.stud-s01', 'part.w2.stud-s05', 'connection.w2.stud-to-plate', 'connection.corner.tie'],
      operationIds: ['op.fit-w2-frame', 'op.fasten-w2-frame', 'op.tie-corner-column'],
      stepIds: ['step.p12-w2-frame'],
      viewIds: ['view.elevation-w2', 'view.closeup-corner'],
      citationIds: [cite.card.p12('scope', 'Five candidate 2x8 studs'), cite.card.p12('steps', 'Separate W2 placement; 1 1/2-in corner contact is not automatically solved'), cite.card.p12('stop', 'No drywall receiver; preserve connector holes')],
      releaseStatus: 'held (W2 assembly / connector placement)',
      notes: 'W2 depends on W1 stability and its own plate positioning/restraint; corner and column ties remain separate held connections.',
    },
    {
      page: 13,
      title: 'Practice the saw and driver: loose-stock yield and mock frame',
      disposition: 'represented',
      entityIds: ['part.practice.stock', 'part.practice.plate-a', 'part.practice.stud-a', 'measurement.practice.yield-net', 'material.lumber.practice'],
      operationIds: ['op.prepare-practice', 'op.cut-practice', 'op.fit-practice-frame'],
      stepIds: ['step.p13-practice'],
      viewIds: ['view.practice-bench'],
      citationIds: [cite.card.p13('ready', 'Loose-stock practice after tool/product checks'), cite.card.p13('yield', 'Two 24-in plates + three 21-in studs for a 24x24-in mock; separate scrap trial'), cite.card.p13('limits', 'No clutch number prescribed; mock joint checks technique only')],
      releaseStatus: 'ready (practice_on_loose_scrap)',
      notes: 'Loose stock only: never house framing and never in the installed takeoff.',
    },
    {
      page: 14,
      title: 'Drive connector screws: SD9112 practice card and nonselected options',
      disposition: 'represented',
      entityIds: ['part.practice.angle', 'fastener.sd9112', 'connection.practice.angle-scrap', 'issue.r35.nonselected-fasteners'],
      operationIds: ['op.read-connector-card', 'op.drive-practice-screws'],
      stepIds: ['step.p14-sd9112'],
      viewIds: ['view.practice-bench', 'view.closeup-connector'],
      citationIds: [cite.card.p14('conditional', 'Practice card; actual joint placement still conditional'), cite.card.p14('spec', 'SD9112 #9 x 1 1/2 in; four screws per leg'), cite.card.p14('nonselected', 'A35 6+6 / 3+6, SDWS, mending plates and nail-only ties nonselected')],
      releaseStatus: 'ready (practice) / house placement held',
      notes: 'Nonselected alternatives are reference-only; they never become parts, quantities or substitutes.',
    },
    {
      page: 15,
      title: 'Plan the tile-to-slab base: held until substrate/services/detail clear',
      disposition: 'represented',
      entityIds: ['part.existing.tile-floor', 'part.existing.slab', 'connection.base.anchor', 'issue.r35.services-unknown'],
      operationIds: ['op.review-slab-base'],
      stepIds: ['step.p15-slab'],
      viewIds: ['view.closeup-slab'],
      citationIds: [cite.card.p15('hold', 'No drilling until substrate, services and anchor detail clear'), cite.card.p15('steps', 'Record the floor stack; clear hole cylinders'), cite.card.p15('limits', 'Never count tile/mortar as embedment; no test holes')],
      releaseStatus: 'held (slab drilling)',
      notes: 'No anchor type, spacing, edge distance, embedment or hole envelope is released; SD connector screws are not concrete anchors.',
    },
    {
      page: 16,
      title: 'Position plates and restrain walls: execute before stud installation',
      disposition: 'represented',
      entityIds: ['part.w1.bottom-plate', 'part.w2.bottom-plate', 'part.w1.top-plate', 'part.w2.top-plate', 'connection.top.restraint'],
      operationIds: ['op.set-bottom-plates', 'op.anchor-base-plates', 'op.restrain-top-plates'],
      stepIds: ['step.p16-base-plates', 'step.p16-top-restraint'],
      viewIds: ['view.plan'],
      citationIds: [cite.card.p16('order', 'Execute before the stud installation in Steps 08 and 10'), cite.card.p16('steps', 'Bottom plate, anchors, top plate and truss-movement allowance'), cite.card.p16('truss', 'Locate the real chord before fixing this line')],
      releaseStatus: 'held (frame/base/truss)',
      notes: 'p16 depends on the marked plate layouts (p8/p11) and the p10/p15 reviews; top restraint is not a rigid stud angle.',
    },
    {
      page: 17,
      title: 'Make the frame straight: member selection, plane checks and corrections',
      disposition: 'represented',
      entityIds: ['part.w1.stud-s01', 'part.w2.stud-s05'],
      operationIds: ['op.check-straightness'],
      stepIds: ['step.p17-straightening'],
      viewIds: ['view.elevation-w1'],
      citationIds: [cite.card.p17('hold', 'Straighten only after restraints and correction method accepted'), cite.card.p17('steps', 'Sight members; keep faces flush; plumb and clamp'), cite.card.p17('correction', 'Shims for drywall only; rails land on wood'), cite.card.p17('handbook', 'CGC/USG ch. 12 p. 350')],
      releaseStatus: 'held (frame)',
      notes: 'Straightening/correction is held; the check itself cannot release screw or shim work.',
    },
    {
      page: 18,
      title: 'Add 2x6 cabinet backing: 25 flat blocks between W1 studs',
      disposition: 'represented',
      entityIds: ['part.backing.top-b01', 'part.backing.base-b03', 'measurement.backing.net-length', 'measurement.backing.band-base.low', 'measurement.backing.block-face'],
      operationIds: ['op.fit-backing-blocks'],
      stepIds: ['step.p18-backing'],
      viewIds: ['view.closeup-backing'],
      citationIds: [cite.card.p18('hold', 'Actual cabinet rails and load path held'), cite.card.p18('scope', 'Owner-selected 2x6 flat pieces'), cite.card.p18('short-bay', 'Short 3 1/4-in bay'), cite.card.p18('mix', '20 x 14 1/2 + 2 x 13 3/4 + 3 x 3 1/4 = 327 1/4 in; not batch cuts')],
      releaseStatus: 'held (backing)',
      notes: 'One part per CSV row; flat 2x6 orientation kept; no plywood substitute and no automatic fastener quantity.',
    },
    {
      page: 19,
      title: 'Connect the cabinet backing: opposing-angle conflict held',
      disposition: 'represented',
      entityIds: ['connection.backing.angle', 'issue.r35.esr-opposing-angle'],
      operationIds: ['op.review-backing-connection', 'op.fasten-backing-blocks'],
      stepIds: ['step.p19-backing-connection'],
      viewIds: ['view.closeup-backing'],
      citationIds: [cite.card.p19('hold', 'Resolve opposing angles before buying hardware'), cite.card.p19('conflict', 'ESR 3-in minimum vs 1.5-in studs; no stagger exception'), cite.card.p19('quantity', 'Do not order 50 angles for 25 blocks'), cite.card.p19('space', 'Space-only check')],
      releaseStatus: 'held (fixture loading / backing)',
      notes: 'Exact backing detail, quantity and load path unresolved; shelf brackets stay on full studs.',
    },
    {
      page: 20,
      title: 'Make the new closet passage: EX1 held before demolition',
      disposition: 'represented',
      entityIds: ['part.existing.ex1-wall', 'part.existing.kitchen-door', 'measurement.closet.inside-width', 'measurement.closet.depth', 'issue.r35.ex1-closet-scope'],
      operationIds: ['op.open-ex1-passage'],
      stepIds: ['step.p20-ex1'],
      viewIds: ['view.elevation-w1'],
      citationIds: [cite.card.p20('hold', 'Existing-wall role/services/support/opening detail held'), cite.card.p20('steps', 'Identify the wall; reviewer sets the opening; do not use the 37-in width'), cite.card.p20('scope-limits', 'Kitchen door retained; EX1 not in the new-wall takeoff')],
      releaseStatus: 'held (existing opening)',
      notes: 'Closet 37/23 are survey facts only and do not define the rough opening; no demolition or exposure is released.',
    },
    {
      page: 21,
      title: 'Plan each drywall face: four faces, stock nest, EX1 patches excluded',
      disposition: 'represented',
      entityIds: ['part.drywall.w1-p-01', 'part.drywall.w2-r-01', 'material.gypsum.half', 'material.gypsum.five-eighth'],
      operationIds: ['op.plan-drywall-faces', 'op.inspect-faces-supports'],
      stepIds: ['step.p21-drywall-plan'],
      viewIds: ['view.elevation-w1'],
      citationIds: [cite.card.p21('faces', 'W1 1/2-in both faces; W2 1/2-in pantry / 5/8-in room'), cite.card.p21('steps', 'Inspect faces; core sheets plus one optional spare each'), cite.card.p21('release', 'Candidate widths and nest are not a cut or screw release')],
      releaseStatus: 'held (drywall close-up)',
      notes: 'Eight 1/2-in + two 5/8-in core sheets distinguished from one optional spare each; spares are never installed and EX1 patches stay out of the fixed nest.',
    },
    {
      page: 22,
      title: 'Four-face drywall map drawing (carried R34 layout)',
      disposition: 'represented',
      entityIds: ['part.drywall.w1-p-01', 'part.drywall.w1-p-04', 'part.drywall.w1-r-04', 'part.drywall.w2-p-02'],
      operationIds: ['op.review-drywall-drawings'],
      stepIds: ['step.p23-junction-drawings'],
      viewIds: ['view.elevation-w1'],
      citationIds: [cite.card.p22('w1p', 'W1-P board width 149 1/2 in'), cite.card.p22('w1r', 'W1-R board width 157 3/8 in'), cite.card.p22('w2p', 'W2-P board width 52 5/8 in'), cite.card.p22('w2r', 'W2-R board width 56 5/8 in'), cite.card.p22('heights', 'height H_i = field fit')],
      releaseStatus: 'held (drywall close-up)',
      notes: 'Panel endpoints/faces from the R34 map; height is field-fit and the reported 111-in ceiling is not a cut.',
    },
    {
      page: 23,
      title: 'Wood junction drawing: W1 through / W2 butt footprints',
      disposition: 'represented',
      entityIds: ['part.w1.stud-s11', 'part.w1.stud-s12', 'part.w2.stud-s01', 'connection.corner.tie'],
      operationIds: ['op.review-drywall-drawings'],
      stepIds: ['step.p23-junction-drawings'],
      viewIds: ['view.closeup-corner'],
      citationIds: [cite.card.p23('junction', 'W1 frame x = 0 -> 156 3/4; W2 frame x = 149 1/2 -> 156 3/4'), cite.card.p23('footprints', 'S11/S12/S01 candidate footprints; full-width receiver not established'), cite.card.p23('hold', 'Fit/support geometry only; no fastening detail')],
      releaseStatus: 'held (corner connection)',
      notes: 'Butt contact about 1.5 in wide; connection type, fasteners, access and load path require acceptance.',
    },
    {
      page: 24,
      title: 'Wall and gypsum corner drawing: board laps and receiver limits',
      disposition: 'represented',
      entityIds: ['part.drywall.w1-r-04', 'part.drywall.w2-r-02', 'part.existing.column'],
      operationIds: ['op.review-drywall-drawings'],
      stepIds: ['step.p23-junction-drawings'],
      viewIds: ['view.closeup-corner'],
      citationIds: [cite.card.p23('corners', 'W2-P butts to W1-P; W1-R laps W2-R'), cite.card.p23('chain', '1/2 + 7 1/4 core + 5/8 = 8 3/8 in'), cite.card.p23('hold', 'Remaining receiver detail held')],
      releaseStatus: 'held (corner/finish)',
      notes: 'Top/truss movement and any rated/control joint need separate accepted details.',
    },
    {
      page: 25,
      title: 'Hang and fasten drywall: preclose inspection and panel handling',
      disposition: 'represented',
      entityIds: ['part.drywall.w1-p-01', 'part.w1.stud-s01', 'part.backing.top-b01', 'issue.r35.gate-g6-closeup'],
      operationIds: ['op.inspect-preclose', 'op.hang-drywall', 'op.inspect-drywall'],
      stepIds: ['step.p25-drywall-hang'],
      viewIds: ['view.elevation-w1'],
      citationIds: [cite.card.p25('hold', 'Preclose inspection, panel map and screw schedule held'), cite.card.p25('steps', 'Label, cut, dry-fit, screw offcut practice; inspect before tape'), cite.card.p25('stop', 'No framing nails; superseded maps not usable')],
      releaseStatus: 'held (drywall close-up / G6)',
      notes: 'Covering effects stay unapplied while held; the preclose inspection is a gate, never a browser checkbox.',
    },
    {
      page: 26,
      title: 'Tape, finish, paint and baseboard: conditional finish, held baseboard',
      disposition: 'represented',
      entityIds: ['part.drywall.w1-p-01', 'part.trim.tr-01', 'measurement.counter.top-elevation'],
      operationIds: ['op.finish-drywall', 'op.install-baseboard'],
      stepIds: ['step.p26-finish'],
      viewIds: ['view.elevation-w1'],
      citationIds: [cite.card.p26('conditional', 'Board/compound system and finish surfaces first'), cite.card.p26('steps', 'Tape/bead/sand; measure returns for baseboard'), cite.card.p26('baseboard', 'Behind-cabinet decision; no tile removal or anchor drilling')],
      releaseStatus: 'conditional (finish) / held (baseboard)',
      notes: 'Movement joints never bridged; new baseboard waits for finished surfaces and measured exposed lengths.',
    },
    {
      page: 27,
      title: 'Install cabinets, shelves and GE refrigerator: full load path held',
      disposition: 'represented',
      entityIds: ['part.fixture.base-row', 'part.fixture.counter', 'part.fixture.upper-u1', 'part.fixture.shelves', 'part.fixture.fridge', 'issue.r35.gate-g5-fixtures'],
      operationIds: ['op.dry-fit-fixtures', 'op.set-counter-uppers-shelves', 'op.set-refrigerator'],
      stepIds: ['step.p27-cabinets', 'step.p27-refrigerator'],
      viewIds: ['view.elevation-w1', 'view.plan'],
      citationIds: [cite.card.p27('hold', 'Actual rail templates, fasteners and load path held'), cite.card.p27('steps', 'B1/F1/B2/F2/B3 dry fit; 36-in top; 26-in clear at 62 in; U1/U2/U3; three 36-in shelves; GE operation'), cite.card.p27('load-path', 'Backing diagram alone cannot certify loads')],
      releaseStatus: 'held (fixture loading / G5)',
      notes: 'Cabinet metadata, sizes and operations recorded; individual box widths remain null and the refrigerator operating fit is unresolved.',
    },
    {
      page: 28,
      title: 'Release and as-built checklist: G1-G7 gates',
      disposition: 'represented',
      entityIds: ['issue.r35.gate-g1-layout', 'issue.r35.gate-g2-floor', 'issue.r35.gate-g3-frame', 'issue.r35.gate-g4-ex1', 'issue.r35.gate-g5-fixtures', 'issue.r35.gate-g6-closeup', 'issue.r35.gate-g7-finish'],
      operationIds: ['op.gate-g1-layout', 'op.gate-g2-floor', 'op.gate-g3-frame', 'op.gate-g4-ex1', 'op.gate-g5-fixtures', 'op.gate-g6-closeup', 'op.gate-g7-finish', 'op.update-field-model'],
      stepIds: ['step.p28-gates'],
      viewIds: ['view.iso'],
      citationIds: [cite.card.p28('status', 'SURVEY/PRACTICE READY; house cuts, drilling and loaded fixtures held'), cite.card.p28('gates', 'G1-G7 evidence table'), cite.card.p28('process', 'Update and review the measured packet'), cite.card.p28('limits', 'Not a permit or release')],
      releaseStatus: 'held (all gates)',
      notes: 'Gates are held inspect/test operations plus acceptance records; no ready operation or checkbox satisfies them.',
    },
    {
      page: 29,
      title: 'Drawing and source record: limits, supersession and cart timeline',
      disposition: 'represented',
      entityIds: ['source.r35.permit-pdf', 'source.r35.esr', 'source.r35.change-record', 'source.r35.review'],
      operationIds: ['op.record-source-status'],
      stepIds: ['step.p29-source-record'],
      viewIds: [],
      citationIds: [cite.card.p29('status', 'Concept and numbered sequence; final review held'), cite.card.p29('sources', 'Source table with limits'), cite.card.p29('cart', 'R34 cart statement reconciled with the later cart record'), cite.card.p29('review', 'Review coverage; not engineering approval')],
      releaseStatus: 'conditional (record only)',
      notes: 'Source records, review scopes and the cart timeline recorded; no stale nailer requirement survives.',
    },
  ];
  const summary = {
    pages: rows.length,
    represented: rows.filter((row) => row.disposition === 'represented').length,
    reference_only: rows.filter((row) => row.disposition === 'reference_only').length,
    excluded: rows.filter((row) => row.disposition === 'excluded').length,
  };
  return { sourceRoot: RECORDED_SOURCE_ROOT, generatedBy: 'work/r35/author-r35.mjs', summary, rows };
}

export function coverageMarkdown(coverage) {
  const lines = [
    '# R35 coverage matrix',
    '',
    `Generated by work/r35/author-r35.mjs. ${coverage.summary.represented}/${coverage.summary.pages} pages represented; ` +
      `${coverage.summary.reference_only} reference-only; ${coverage.summary.excluded} excluded.`,
    '',
    '| Page | Title | Disposition | Release status | Steps | Key records |',
    '|---|---|---|---|---|---|',
  ];
  for (const row of coverage.rows) {
    const records = [...row.entityIds.slice(0, 3), ...row.operationIds.slice(0, 3)].join('<br>');
    lines.push(`| ${row.page} | ${row.title} | ${row.disposition} | ${row.releaseStatus} | ${row.stepIds.join(', ') || '—'} | ${records || '—'} |`);
  }
  lines.push('', 'Citations use JSON Pointer, CSV row+id, SVG element/region and PDF 1-based page + normalized region locators; see work/r35/source-inventory.json, work/r35/carry-forward-map.json and the authored bundle sources.json.', '');
  return lines.join('\n');
}

/** Row-by-row CSV reconciliation with exact totals. */
export function buildReconciliation({ csvs, src, model }) {
  const files = [];

  const partsRows = csvs.parts.map((row) => {
    if (row.kind === 'cabinet blocking') {
      const entityId = `part.backing.${row.id.toLowerCase()}`;
      return {
        row: row.row,
        id: row.id,
        disposition: 'merged',
        entityIds: [entityId],
        reason: `Same block as cabinet-backing-R31-CONCEPT.csv row ${row.id} (the backing CSV is authoritative for the 25 blocks); merged to avoid double counting, with the length mix cross-checked against "${row.candidate_length_in}" in.`,
      };
    }
    let entityId;
    if (row.kind === 'stud') entityId = `part.${row.wall.toLowerCase()}.stud-${row.id.split('-')[1].toLowerCase()}`;
    else if (row.id === 'W1-TP') entityId = 'part.w1.top-plate';
    else if (row.id === 'W1-BP') entityId = 'part.w1.bottom-plate';
    else if (row.id === 'W2-TP') entityId = 'part.w2.top-plate';
    else if (row.id === 'W2-BP') entityId = 'part.w2.bottom-plate';
    else throw new Error(`Unmapped parts row ${row.id}`);
    return {
      row: row.row,
      id: row.id,
      disposition: 'represented',
      entityIds: [entityId],
      reason: row.kind === 'stud'
        ? `Candidate ${row.wall} stud centre ${row.candidate_center_in || '(blank; field-fit)'} from the CSV; height and connection held.`
        : `Candidate plate comparison length ${row.candidate_length_in}; no cut released.`,
    };
  });
  files.push({
    file: FILE.partsCsv,
    inputRows: partsRows.length,
    rows: partsRows,
    totals: { inputRows: 46, representedEntities: 21, excluded: 0, merged: 25, spareOnly: 0 },
    notes: '12 W1 studs + 5 W2 studs + 4 plates = 21 represented rows; the 25 cabinet-blocking rows merge into the authoritative cabinet-backing CSV parts (no double counting). W2-S05 has no CSV centre (field-fit); the R34 face map candidate is recorded with the part.',
  });

  const backingRows = csvs.backing.map((row) => ({
    row: row.row,
    id: row.id,
    disposition: 'represented',
    entityIds: [`part.backing.${row.id.toLowerCase()}`],
    reason: `One part per row: ${row.planning_length} in flat 2x6 block (${row.left_x} to ${row.right_x} in) in the ${row.purpose} band (${row.bottom_z} to ${row.top_z} in AFF); bay field-fit, no automatic fastener quantity.`,
  }));
  files.push({
    file: FILE.backingCsv,
    inputRows: backingRows.length,
    rows: backingRows,
    totals: { inputRows: 25, representedEntities: 25, excluded: 0, merged: 0, spareOnly: 0 },
    notes: 'Length mix 20 x 14.5 + 2 x 13.75 + 3 x 3.25 = 327.25 in net; the CSV row set is authoritative for the 25 parts.',
  });

  const panelRows = csvs.panels.map((row) => ({
    row: row.row,
    id: row.panel_id,
    disposition: 'represented',
    entityIds: [`part.drywall.${row.panel_id.toLowerCase()}`],
    reason: `${row.face} panel ${row.start_in} to ${row.end_in} in (${row.candidate_width_in} in), ${row.board_thickness_in}-in board, stock ${row.source_sheet_4x10}; height field-fit, no cut released.`,
  }));
  files.push({
    file: FILE.panelsCsv,
    inputRows: panelRows.length,
    rows: panelRows,
    totals: { inputRows: 12, representedEntities: 12, excluded: 0, merged: 0, spareOnly: 0 },
    notes: 'The W2-R 31/2 endpoints parse as 15.5 in (division), matching the seam value; no original-data correction is authorized or needed.',
  });

  const materialMap = {
    'L-W1-S': { disposition: 'represented', entityIds: ['material.lumber.w1-stud'] },
    'L-W2-S': { disposition: 'represented', entityIds: ['material.lumber.w2-stud'] },
    'L-W1-TP': { disposition: 'represented', entityIds: ['material.lumber.w1-top-plate'] },
    'L-W1-BP': { disposition: 'represented', entityIds: ['material.lumber.w1-bottom-plate'] },
    'L-W2-TP': { disposition: 'represented', entityIds: ['material.lumber.w2-top-plate'] },
    'L-W2-BP': { disposition: 'represented', entityIds: ['material.lumber.w2-bottom-plate'] },
    'L-BACK': { disposition: 'represented', entityIds: ['material.lumber.backing'] },
    'L-PRACTICE': { disposition: 'represented', entityIds: ['material.lumber.practice'] },
    'G-1/2': { disposition: 'represented', entityIds: ['material.gypsum.half'] },
    'G-5/8': { disposition: 'represented', entityIds: ['material.gypsum.five-eighth'] },
    'T-BASE': { disposition: 'excluded', entityIds: [], reason: 'Linear-foot length is field-measured; no quantity is released. Represented by op.install-baseboard and the baseboard hold.' },
    'S-SHIM': { disposition: 'excluded', entityIds: [], reason: 'Field measure only; frame plane must be checked and severe bow/twist replaced first. No pack quantity is released.' },
    'O-EX1': { disposition: 'excluded', entityIds: [], reason: 'Design-specific existing-wall system; EX1 role/services/opening detail held. Represented by the EX1 issue and operation.' },
    'F-ANGLE': { disposition: 'merged', entityIds: ['connection.w1.stud-to-plate', 'connection.w2.stud-to-plate', 'connection.backing.angle'], reason: 'Candidate angle family merged into candidate connection records; installed quantity and capacity held.' },
    'F-SD': { disposition: 'merged', entityIds: ['fastener.sd9112', 'connection.practice.angle-scrap'], reason: 'Screw pattern merged into the candidate fastener spec and practice connection; installed project quantity held.' },
    'T-DRIVE': { disposition: 'merged', entityIds: ['tool.hex-nutsetter'], reason: 'Bit merged into the tool record; verify the actual driver and screw packaging.' },
    'F-OTHER': { disposition: 'excluded', entityIds: [], reason: 'Concrete anchors, truss/end/corner, cabinet/shelf, drywall and trim hardware are design-specific with separate specs/counts held; SD9112 is not a substitute everywhere.' },
  };
  const materialRows = csvs.materials.map((row) => {
    const mapped = materialMap[row.id];
    if (!mapped) throw new Error(`Unmapped materials row ${row.id}`);
    return {
      row: row.row,
      id: row.id,
      disposition: mapped.disposition,
      entityIds: mapped.entityIds,
      reason: mapped.reason ?? (mapped.disposition === 'represented' ? `Planning quantity ${row.planning_net}${row.planning_spare && row.planning_spare.trim() !== '' ? ` + spare ${row.planning_spare}` : ''}; proposed only, never purchased or approved.` : ''),
    };
  });
  files.push({
    file: FILE.materialsCsv,
    inputRows: materialRows.length,
    rows: materialRows,
    totals: { inputRows: 17, representedEntities: 10, excluded: 4, merged: 3, spareOnly: 0 },
    notes: '10 rows map to material records; 4 are excluded with reasons; 3 merge into connection/spec/tool records. Spare quantities stay separate from installed parts.',
  });

  // Merged rows name the record(s) they were merged into, per the packet wording.
  for (const file of files) {
    for (const row of file.rows) {
      if (row.disposition === 'merged') row.mergedInto = row.entityIds;
    }
  }

  const totals = files.reduce(    (sum, file) => ({
      inputRows: sum.inputRows + file.totals.inputRows,
      representedEntities: sum.representedEntities + file.totals.representedEntities,
      excluded: sum.excluded + file.totals.excluded,
      merged: sum.merged + file.totals.merged,
      spareOnly: sum.spareOnly + file.totals.spareOnly,
    }),
    { inputRows: 0, representedEntities: 0, excluded: 0, merged: 0, spareOnly: 0 },
  );
  return {
    sourceRoot: RECORDED_SOURCE_ROOT,
    generatedBy: 'work/r35/author-r35.mjs',
    rule: 'Every CSV row is represented, excluded with a reason, or merged into a named record. No spare stock becomes an installed part and no row is double counted (assembly vs leaf).',
    files,
    totals,
  };
}

/** Private-to-public excerpt map used by the sanitization test. */
export function buildPrivatePublicMap({ inventory, cards }) {
  const cardBySource = new Map();
  for (const [, entry] of cards) {
    if (entry.card.id === 'esr-3096') continue;
    cardBySource.set(`source.r35.card.${entry.card.id}`, { assetPath: `assets/source-pages/${entry.card.file}`, page: entry.card.page });
  }
  const allPageCards = [...cardBySource.values()];
  const byPage = (pages) => allPageCards.filter((entry) => pages.includes(entry.page));
  const mapping = [
    { privateSourceId: 'source.r35.manual-json', privateFile: FILE.manualJson, publicCards: allPageCards, policy: 'JSON Pointer locators stay on citations; only sanitized quote cards are published.' },
    { privateSourceId: 'source.r35.manual-pdf', privateFile: FILE.manualPdf, publicCards: allPageCards, policy: 'One card per page family with printed page numbers; the raw PDF is not published.' },
    { privateSourceId: 'source.r35.layout-pdf', privateFile: FILE.layoutPdf, publicCards: byPage([2, 11, 16, 17, 22]), policy: 'Cross-check facts are carried on page cards; the address-bearing layout PDF is never published.' },
    { privateSourceId: 'source.r35.change-record', privateFile: FILE.changeRecord, publicCards: byPage([6, 29]), policy: 'Supersession and cart statements quoted on the source-record card only.' },
    { privateSourceId: 'source.r35.review', privateFile: FILE.review, publicCards: byPage([29]), policy: 'Review scopes and limits quoted on the source-record card; not engineering approval.' },
    { privateSourceId: 'source.r35.csv.parts', privateFile: FILE.partsCsv, publicCards: byPage([6, 8, 11, 13]), policy: 'Row+id locators stay on citations; row data is reconciled in work/r35/reconciliation.json.' },
    { privateSourceId: 'source.r35.csv.backing', privateFile: FILE.backingCsv, publicCards: byPage([18, 19]), policy: 'Block rows reconcile to parts; card quotes the mix and orientation.' },
    { privateSourceId: 'source.r35.csv.panels', privateFile: FILE.panelsCsv, publicCards: byPage([21, 22]), policy: 'Panel endpoints reconcile to parts; card quotes face widths.' },
    { privateSourceId: 'source.r35.csv.materials', privateFile: FILE.materialsCsv, publicCards: byPage([6, 21, 18]), policy: 'Planning quantities map to material records; excluded rows are listed in reconciliation.json.' },
    { privateSourceId: 'source.r35.svg.r33-cabinet-elevation', privateFile: FILE.svgCabinet, publicCards: byPage([3]), policy: 'SVG element/region locators stay on citations; card quotes the front/label text.' },
    { privateSourceId: 'source.r35.svg.r31-truss', privateFile: FILE.svgTruss, publicCards: byPage([2, 11, 16]), policy: 'Region locators stay on citations; truss trial text quoted.' },
    { privateSourceId: 'source.r35.svg.r31-backing', privateFile: FILE.svgBacking, publicCards: byPage([18]), policy: 'Region locators stay on citations; band and z-report text quoted.' },
    { privateSourceId: 'source.r35.svg.r32-baseboard', privateFile: FILE.svgBaseboard, publicCards: byPage([5]), policy: 'Region locators stay on citations; TR label text quoted.' },
    { privateSourceId: 'source.r35.svg.r34-drywall-layout', privateFile: FILE.svgDrywallLayout, publicCards: byPage([22]), policy: 'Region locators stay on citations; face widths and height rule quoted.' },
    { privateSourceId: 'source.r35.svg.r34-wood-junction', privateFile: FILE.svgWoodJunction, publicCards: byPage([23]), policy: 'Region locators stay on citations; junction text quoted.' },
    { privateSourceId: 'source.r35.svg.r34-corners', privateFile: FILE.svgCorners, publicCards: byPage([23]), policy: 'Region locators stay on citations; the shared junction/corner card quotes the corner text.' },
    { privateSourceId: 'source.r35.permit-manifest', privateFile: recordedPath(FILE.permitManifest), publicCards: [], policy: 'No asset: permit number, parcel, address and download URLs are private identity and are withheld entirely.' },
    { privateSourceId: 'source.r35.permit-pdf', privateFile: recordedPath(FILE.permitPdf), publicCards: [], policy: 'No asset: permit number, parcel, address and download URLs are private identity and withheld entirely; only identity-free sheet references (A3/A5/A7/D4/D5) appear on the source-record card and in citations.' },
    { privateSourceId: 'source.r35.esr', privateFile: FILE.esrPdf, publicCards: [{ assetPath: 'assets/source-pages/r35-esr-3096-excerpt.svg', page: 8 }], policy: 'Sanitized text-only excerpt of Table 5, Figure 5 and notes 4-6.' },
    { privateSourceId: 'source.r35.ref.ge-catalog', privateFile: 'output/reference/R23-fridge/GE-full-line-catalog-1-G0300.pdf', publicCards: byPage([27]), policy: 'Family-source distinction quoted on page cards; cached file not published.' },
    { privateSourceId: 'source.r35.ref.usg-j371', privateFile: 'output/reference/R22-drywall/USG-J371-installation-finishing.pdf', publicCards: byPage([21, 25, 26]), policy: 'Board-specific handling reference; product not selected and file not published.' },
    { privateSourceId: 'source.r35.ref.ngc-guide', privateFile: 'output/reference/R24-materials/NGC-Construction-Guide-15th.pdf', publicCards: byPage([17]), policy: 'Straightening/handbook reference quoted on the page card; file not published.' },
    { privateSourceId: 'source.r35.ref.goldbond-hsl', privateFile: 'output/reference/R24-materials/GoldBond-HSL-submittal.pdf', publicCards: byPage([21]), policy: 'Candidate board system; not selected and not published.' },
    { privateSourceId: 'source.r35.ref.proform-tape', privateFile: 'output/reference/R24-materials/ProForm-Tape-submittal.pdf', publicCards: byPage([26]), policy: 'Candidate tape system; not selected and not published.' },
    { privateSourceId: 'source.r35.ref.ryobi-pbldd02', privateFile: 'output/reference/R24-materials/RYOBI-PBLDD02-manual.pdf', publicCards: byPage([7, 13, 14]), policy: 'Owned-tool family manual; exact purchased model not recorded; file not published.' },
    { privateSourceId: 'source.r35.ref.simpson-tech', privateFile: 'output/reference/R24-materials/Simpson-C-F-2025TECHSUP.pdf', publicCards: byPage([10, 14]), policy: 'Connector/fastener substitution reference; file not published.' },
  ];
  return {
    sourceRoot: RECORDED_SOURCE_ROOT,
    generatedBy: 'work/r35/author-r35.mjs',
    policy: 'Publication projection removes private identity (address, parcel, permit number, raw URLs) but cannot change geometry, instructions or releases. Permitted values are unchanged.',
    mapping,
  };
}
