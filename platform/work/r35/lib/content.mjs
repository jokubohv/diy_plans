/**
 * R35 authored bundle content model.
 *
 * Every number is either read from the §16-listed inputs at build time (JSON Pointer / CSV row /
 * SVG region locators are recorded on the citation) or computed with exact 25.4 mm/in arithmetic
 * from those numbers. Nothing is invented; unresolved values stay null and are surfaced as issues.
 *
 * Geometry convention (documented in project.json and every affected part):
 * - canonical Z-up mm registered to the A3 plan: origin at the W1/W2 pantry-finish corner;
 *   +X runs from the foyer/W2 end toward the garage/refrigerator end, +Y runs from W1 toward
 *   the existing EX1 wall/column, and +Z is up from the finished floor. Source x coordinates are
 *   converted as X = 149 in - x_R35; source y/z are unchanged.
 * - parts whose vertical extent is Sourced are boxes; parts whose height/elevation is unresolved
 *   are shown as plan footprints at the floor plane (20 mm presentation thickness) so that no
 *   un-sourced member length or elevation is asserted, least of all the reported 111-in ceiling.
 */
import { ifcGuidForPart } from '../../../packages/compiler/src/guid.ts';
import { parseLengthToMm } from '../../../packages/compiler/src/fraction.ts';
import { decimalAdd, decimalSub, inchMm, parseCsv, parseNumericRational, round6 } from './util.mjs';

/** Private owner source tree; required only when regenerating the authored R35 bundle. */
export const SOURCE_ROOT = process.env.R35_SOURCE_ROOT ?? '';

export const FILE = {
  manualJson: 'output/data/project-R35-conditional-manual.json',
  manualPdf: 'output/pdf/pantry-complete-framing-drywall-and-cabinet-plan-R35.pdf',
  layoutPdf: 'output/pdf/pantry-wall-framing-drywall-layout-R35.pdf',
  changeRecord: 'output/data/R35-change-record.md',
  review: 'output/data/review-R35-conditional-manual.md',
  partsCsv: 'output/data/parts-R33-CONCEPT.csv',
  backingCsv: 'output/data/cabinet-backing-R31-CONCEPT.csv',
  panelsCsv: 'output/data/drywall-panel-schedule-R34-CONCEPT.csv',
  materialsCsv: 'output/data/materials-R35-CONCEPT.csv',
  svgCabinet: 'output/images/pantry-R33-cabinet-elevation.svg',
  svgTruss: 'output/images/pantry-R31-truss-line-layout.svg',
  svgBacking: 'output/images/pantry-R31-2x6-backing.svg',
  svgBaseboard: 'output/images/pantry-R32-baseboard-removal-map.svg',
  svgDrywallLayout: 'output/images/pantry-R34-drywall-layout.svg',
  svgWoodJunction: 'output/images/pantry-R34-wood-junction.svg',
  svgCorners: 'output/images/pantry-R34-wall-and-gypsum-corners.svg',
  permitManifest: process.env.R35_PERMIT_MANIFEST_REL ?? 'private/permit/source-manifest.json',
  permitReadme: process.env.R35_PERMIT_README_REL ?? 'private/permit/README.md',
  permitPdf: process.env.R35_PERMIT_PDF_REL ?? 'private/permit/approved-drawing-set.pdf',
  cartR35: 'output/data/lowes-cart-R35.json',
  cartWoodReserve: 'output/data/lowes-cart-R35-wood-reserve.json',
  esrPdf: 'output/reference/screws-R35/ICC-ES-ESR-3096.pdf',
  esrNotes: 'output/reference/screws-R35/research-notes.txt',
};

/** Owner-supplied hashes that must match exactly (fail loudly otherwise). */
export const OWNER_HASHES = {
  [FILE.manualPdf]: 'b3567029aadc65b46e6e3acb31bd6815a1254fda12bbc7b263badf64848efbb7',
  [FILE.manualJson]: '307240e8a82f09c965d5e3cb9c1d7136d3305a3ca7e15f06b3f96499ebd03cc7',
  [FILE.layoutPdf]: '355087555d701475d28fcde04eb0a07f905724e0f034fa1338fbc3b4bdf16d80',
  [FILE.materialsCsv]: 'f87338d754d15e1cccf659bf3c61825758ae65b52f6aa9ab27b8ec0d28ed5f1b',
};

export const PRIVATE_SOURCES = [
  { id: 'source.r35.owner-ex1-requirement', kind: 'user_instruction', title: 'Owner EX1 minimum-clear-width requirement', date: '2026-09-29', relationship: 'current', privacy: 'private', locatorNote: 'Owner requires at least 37 in finished clear at EX1 and requested a held preview extended toward the refrigerator side. This instruction is not a rough-opening, framing or demolition approval.' },
  { id: 'source.r35.ex1-plan-audit', kind: 'field_note', title: 'EX1 construction-plan obstruction audit', date: '2026-09-29', relationship: 'current', privacy: 'private', locatorNote: 'Private review of A3/A4/A5/D1/D2/D5: records the 30 1/8-in before-finish plan span and 6 7/8-in minimum shortfall. An 80-in portal height is permitted only as a visibly labelled presentation convention; actual clear and rough-opening heights remain unknown.' },
  { id: 'source.r35.manual-json', kind: 'user_instruction', title: 'Pantry R35 conditional manual data (structured JSON)', relationship: 'current', privacy: 'private', locatorNote: 'Machine-readable conversion seed. Contains site identity; cited by JSON Pointer and never published.' },
  { id: 'source.r35.manual-pdf', kind: 'pdf_page', title: 'Pantry R35 complete conditional build plan (29 pages)', relationship: 'current', privacy: 'private', locatorNote: 'Raw 29-page manual; not published. Sanitized cards carry the quotable instruction text with printed page numbers. Letter page box 612x792 pt, rotation 0, 1-based pages.' },
  { id: 'source.r35.layout-pdf', kind: 'pdf_page', title: 'Pantry wall framing and drywall layout R35 (one page)', relationship: 'current', privacy: 'private', locatorNote: 'Contains address identity; not published. Plan/assembly cross-check only.' },
  { id: 'source.r35.change-record', kind: 'field_note', title: 'R35 change record (screw-and-metal-connector revision)', relationship: 'current', privacy: 'private', locatorNote: 'Revision policy, cart and supersession record; not published.' },
  { id: 'source.r35.review', kind: 'field_note', title: 'R35 independent scoped review', relationship: 'current', privacy: 'private', locatorNote: 'Conditional-scope review; no construction release. Not published.' },
  { id: 'source.r35.permit-manifest', kind: 'field_note', title: 'Original house permit source manifest (identity withheld)', relationship: 'reference', privacy: 'private', locatorNote: 'Permit number, parcel and download URLs withheld as private identity.' },
  { id: 'source.r35.permit-pdf', kind: 'pdf_page', title: 'Approved original house drawing set (identity withheld)', relationship: 'reference', privacy: 'private', locatorNote: '1-based sheet pages: A3 floor plan = 3; A5 foundation = 5; A7 roof framing = 7; D4 = 12; D5 = 13. Source pages use MediaBox 1728x2592 with Rotate 90; citation regions use the project-normalized 612x792 pre-rotation basis. Original permit approval, not this alteration.' },
  { id: 'source.r35.csv.parts', kind: 'table_row', title: 'R33 candidate framing and part rows (46 rows)', relationship: 'current', privacy: 'private', locatorNote: 'CSV data rows are 1-based below the header; stable row id recorded on each citation.' },
  { id: 'source.r35.csv.backing', kind: 'table_row', title: 'R31 cabinet backing blocks (25 rows)', relationship: 'current', privacy: 'private', locatorNote: 'CSV data rows are 1-based below the header; stable row id recorded on each citation.' },
  { id: 'source.r35.csv.panels', kind: 'table_row', title: 'R34 drywall panel schedule (12 rows)', relationship: 'current', privacy: 'private', locatorNote: 'CSV data rows are 1-based below the header; stable row id recorded on each citation.' },
  { id: 'source.r35.csv.materials', kind: 'table_row', title: 'R35 planning materials (17 rows)', relationship: 'current', privacy: 'private', locatorNote: 'CSV data rows are 1-based below the header; stable row id recorded on each citation.' },
  { id: 'source.r35.svg.r33-cabinet-elevation', kind: 'drawing_region', title: 'Cabinet elevation (carry-forward drawing)', relationship: 'carry_forward', privacy: 'private', locatorNote: 'viewBox 1600x1000; element/region locators are in viewBox units.' },
  { id: 'source.r35.svg.r31-truss', kind: 'drawing_region', title: 'R31 68-in truss-line trial (carry-forward drawing)', relationship: 'carry_forward', privacy: 'private', locatorNote: 'viewBox 1600x1000; element/region locators are in viewBox units.' },
  { id: 'source.r35.svg.r31-backing', kind: 'drawing_region', title: 'R31 W1 cabinet backing (carry-forward drawing)', relationship: 'carry_forward', privacy: 'private', locatorNote: 'viewBox 1600x1180; element/region locators are in viewBox units.' },
  { id: 'source.r35.svg.r32-baseboard', kind: 'drawing_region', title: 'R32 existing baseboard work map (carry-forward drawing)', relationship: 'carry_forward', privacy: 'private', locatorNote: 'viewBox 1600x1000; element/region locators are in viewBox units.' },
  { id: 'source.r35.svg.r34-drywall-layout', kind: 'drawing_region', title: 'R34 four-face drywall layout (carry-forward drawing)', relationship: 'carry_forward', privacy: 'private', locatorNote: 'viewBox 1224x1584; element/region locators are in viewBox units.' },
  { id: 'source.r35.svg.r34-wood-junction', kind: 'drawing_region', title: 'R34 wood junction (carry-forward drawing)', relationship: 'carry_forward', privacy: 'private', locatorNote: 'viewBox 1224x1584; element/region locators are in viewBox units.' },
  { id: 'source.r35.svg.r34-corners', kind: 'drawing_region', title: 'R34 wall and gypsum corners (carry-forward drawing)', relationship: 'carry_forward', privacy: 'private', locatorNote: 'viewBox 1224x1584; element/region locators are in viewBox units.' },
  { id: 'source.r35.r34-drywall-layout-md', kind: 'field_note', title: 'R34 drywall geometry, receivers, laps and nesting', relationship: 'carry_forward', privacy: 'private', locatorNote: 'Private carry-forward source work/R34/drywall-layout.md; relevant sections: Assumptions and reference planes, Seam support and ends, Height and top/bottom holds, Joint finishing concept and Gross sheet study.' },
  { id: 'source.r35.ref.ge-catalog', kind: 'product_manual', title: 'GE full-line catalog (family refrigerator dimensions; cached manufacturer file)', relationship: 'reference', privacy: 'private', locatorNote: 'Family data source, not the project label; not published.' },
  { id: 'source.r35.ref.usg-j371', kind: 'product_manual', title: 'USG J371 installation and finishing (cached manufacturer file)', relationship: 'reference', privacy: 'private', locatorNote: 'Board-specific handling/finishing reference; choose the actual product.' },
  { id: 'source.r35.ref.ngc-guide', kind: 'product_manual', title: 'National Gypsum construction guide (cached manufacturer file)', relationship: 'reference', privacy: 'private', locatorNote: 'Crooked-framing and shimming reference (ch. 12 p. 350 in the plan).' },
  { id: 'source.r35.ref.goldbond-hsl', kind: 'product_manual', title: 'Gold Bond High Strength LITE submittal (cached manufacturer file)', relationship: 'reference', privacy: 'private', locatorNote: 'Candidate board system; not selected.' },
  { id: 'source.r35.ref.proform-tape', kind: 'product_manual', title: 'ProForm tape submittal (cached manufacturer file)', relationship: 'reference', privacy: 'private', locatorNote: 'Candidate tape system; not selected.' },
  { id: 'source.r35.ref.ryobi-pbldd02', kind: 'product_manual', title: 'Ryobi drill/driver manual (cached manufacturer file)', relationship: 'reference', privacy: 'private', locatorNote: 'Owned-tool family manual; exact purchased model not recorded.' },
  { id: 'source.r35.ref.simpson-tech', kind: 'product_manual', title: 'Simpson strong-tie technical supplement (cached manufacturer file)', relationship: 'reference', privacy: 'private', locatorNote: 'Connector/fastener substitution rules reference.' },
];

/** Build the citation registry (authored bundle sources + citations). */
export function buildCitationRegistry(cards) {
  const sources = [];
  const citations = [];
  const byId = new Map();
  const seen = new Set();

  for (const source of PRIVATE_SOURCES) sources.push({ ...source, privacy: 'private' });

  for (const [cardId, entry] of cards) {
    if (cardId === 'esr-3096') {
      sources.push({
        id: 'source.r35.esr',
        kind: 'code_section',
        title: 'ICC-ES ESR-3096 (Jan 2026) A34/A35 framing connectors — sanitized excerpt',
        authority: 'ICC Evaluation Service',
        date: '2026-01-01',
        revision: 'January 2026',
        privacy: 'excerpt_only',
        assetPath: `assets/source-pages/${entry.card.file}`,
        page: 8,
        relationship: 'reference',
        locatorNote: 'Sanitized text-only excerpt of Table 5, Figure 5 and notes 4-6 (printed page 8 of 25).',
      });
    } else {
      sources.push({
        id: `source.r35.card.${cardId}`,
        kind: entry.card.kind,
        title: `Sanitized excerpt card — ${entry.card.title}`,
        privacy: 'public',
        assetPath: `assets/source-pages/${entry.card.file}`,
        page: entry.card.page,
        relationship: entry.card.relationship,
        locatorNote: 'Text-only sanitized excerpt of the private source; region locators are in card viewBox pixels (top-left origin).',
      });
    }
  }

  function add(citation) {
    if (byId.has(citation.id)) return citation.id;
    if (seen.has(citation.id)) throw new Error(`Duplicate citation id ${citation.id}`);
    seen.add(citation.id);
    byId.set(citation.id, citation);
    citations.push(citation);
    return citation.id;
  }

  function jsonCite(pointer, label, expected) {
    const id = `citation.json.${pointer.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')}`;
    if (!byId.has(id)) {
      add({
        id,
        sourceId: 'source.r35.manual-json',
        label,
        kind: 'note',
        excerpt: pointer,
        note: `Unavailable-source hold: private source project-R35-conditional-manual.json is not published. JSON Pointer ${pointer}${expected !== undefined ? ` = ${JSON.stringify(expected)}` : ''}.`,
      });
    }
    return id;
  }

  function csvCite(csvKey, row, stableId, label, field) {
    const sourceId = `source.r35.csv.${csvKey}`;
    const id = `citation.csv.${csvKey}.${stableId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}${field ? `.${field}` : ''}`;
    if (!byId.has(id)) {
      add({
        id,
        sourceId,
        label,
        kind: 'table_cell',
        row,
        excerpt: field ? `${stableId} / ${field}` : stableId,
        note: `Unavailable-source hold: the private CSV is not published. Data row ${row} (1-based below the header), stable id ${stableId}${field ? `, field ${field}` : ''}.`,
      });
    }
    return id;
  }

  function cardCite(cardId, blockKey, label) {
    const entry = cards.get(cardId);
    if (!entry) throw new Error(`Unknown card ${cardId}`);
    const region = entry.rendered.regions[blockKey];
    if (!region) throw new Error(`Unknown block ${cardId}.${blockKey}`);
    const id = `citation.card.${cardId}.${blockKey}`;
    if (!byId.has(id)) {
      const block = entry.card.blocks.find((candidate) => candidate.key === blockKey);
      add({
        id,
        sourceId: `source.r35.card.${cardId}`,
        label,
        kind: 'region',
        region,
        excerpt: block.lines.join(' '),
        note: `Printed page ${entry.card.page} of 29; region is a pixel rectangle in the sanitized card (top-left origin).`,
      });
    }
    return id;
  }

  function esrCite(blockKey, label) {
    const entry = cards.get('esr-3096');
    const region = entry.rendered.regions[blockKey];
    const id = `citation.esr.${blockKey}`;
    if (!byId.has(id)) {
      const block = entry.card.blocks.find((candidate) => candidate.key === blockKey);
      add({
        id,
        sourceId: 'source.r35.esr',
        label,
        kind: 'region',
        region,
        excerpt: block.lines.join(' '),
        note: 'ICC-ES ESR-3096 (Jan 2026), Table 5 / Figure 5 / notes 4-6, printed page 8 of 25; sanitized excerpt card.',
      });
    }
    return id;
  }

  function svgCite(name, region, label, elementNote) {
    const id = `citation.svg.${name}.${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
    if (!byId.has(id)) {
      add({
        id,
        sourceId: `source.r35.svg.${name}`,
        label,
        kind: 'region',
        region,
        note: `Unavailable-source hold: the carry-forward SVG is private and not published. ${elementNote}.`,
      });
    }
    return id;
  }

  function permitCite(page, region, label, note) {
    const id = `citation.permit.p${page}.${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
    if (!byId.has(id)) {
      add({
        id,
        sourceId: 'source.r35.permit-pdf',
        label,
        kind: 'region',
        region,
        note: `Unavailable-source hold: the approved original drawing set is private (identity withheld) and not published. ${note}; 1-based PDF page ${page}, region in the project-normalized 612x792 pre-rotation basis (source MediaBox 1728x2592, Rotate 90).`,
      });
    }
    return id;
  }

  function pvt(sourceId, label, note, extra = {}) {
    const id = `citation.pvt.${sourceId.replace(/^source\.r35\./, '').replace(/[^a-zA-Z0-9]+/g, '-')}.${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
    if (!byId.has(id)) {
      add({ id, sourceId, label, kind: 'note', note: `Unavailable-source hold: private source not published. ${note}`, ...extra });
    }
    return id;
  }

  return { sources, citations, byId, jsonCite, csvCite, cardCite, esrCite, svgCite, permitCite, pvt };
}

/** Trimmed-down view of the structured manual JSON needed by the conversion. */
export function readManualSources(json, csvs) {
  const p = (pointer) => pointer.split('/').slice(1).reduce((value, key) => (value === undefined || value === null ? value : value[/^\d+$/.test(key) ? Number(key) : key]), json);
  const inch = (value) => inchMm(value);
  const faces = p('/drywall/panel_layout/faces');

  const w1StudCentersIn = p('/backing/candidate_W1_stud_centers_from_left_plate_end_in').map(String);
  const w2FaceStudsIn = faces[2].studs.map(String);
  const w2SeamIn = String(faces[3].seams[0]);

  const bands = p('/backing/bands_above_finished_tile_in');
  const blockMix = p('/backing/planning_cut_mix_in');

  return {
    p,
    inch,
    w1StudCentersIn,
    w2FaceStudsIn,
    w2SeamIn,
    bands,
    blockMix,
    releases: p('/releases'),
    holdPoints: p('/hold_points'),
    connections: p('/connections_R35'),
    tools: p('/tools_R35'),
    changes: p('/changes_R35'),
    trim: p('/trim'),
    drywall: p('/drywall'),
    fixtures: p('/fixtures'),
    backing: p('/backing'),
    layout: p('/layout'),
    site: p('/site'),
    roof: p('/roof_plan_alignment'),
    straightening: p('/straightening'),
    materialsConcept: p('/framing_materials_concept'),
    references: p('/references'),
  };
}

/** Parse the four inventory CSVs into row tables with 1-based data-row numbers. */
export function parseInventoryCsvs(readFile) {
  const parse = (path) => {
    const text = readFile(path);
    const { rows } = parseCsv(text);
    return rows.map((row, index) => ({ row: index + 1, ...row }));
  };
  return {
    parts: parse(FILE.partsCsv),
    backing: parse(FILE.backingCsv),
    panels: parse(FILE.panelsCsv),
    materials: parse(FILE.materialsCsv),
  };
}

// ---- canonical geometry (exact inch conversion; mm floats) ------------------------------------

export const GEOM = (() => {
  const IN = 25.4;
  const inchMmValue = (value) => inchMm(value).mm;
  const W1 = {
    studCentersMm: null, // filled in buildGeometry
  };
  return { IN, inchMmValue, W1 };
})();

export function buildGeometry(src, csvs) {
  const inch = (value) => inchMm(value).mm;
  const inchExact = (value) => inchMm(value).exact;

  const w1Centers = src.w1StudCentersIn.map((value) => ({ original: value, mm: inch(value) }));
  const w2Centers = src.w2FaceStudsIn.map((value) => ({ original: value, mm: inch(value) }));
  const w2CsvCenters = csvs.parts
    .filter((row) => row.wall === 'W2' && row.kind === 'stud')
    .map((row) => ({ id: row.id, centerIn: row.candidate_center_in, row: row.row, status: row.status }));

  const bandZ = {};
  for (const [key, value] of Object.entries(src.bands)) {
    bandZ[key] = { lowMm: inch(value[0]), highMm: inch(value[1]) };
  }

  const w1PlateLenMm = inch('156.75');
  const w2PlateLenMm = inch('53.125');
  const w2CoreCenterXMm = inch('153.125');
  const w2CoreWidthMm = inch('7.25');
  const w1CoreCenterYMm = inch('-2.25');
  const w1CoreDepthMm = inch('3.5');
  const footprintT = 20;
  const footprintZ = 10;

  return {
    inch,
    inchExact,
    w1Centers,
    w2Centers,
    w2CsvCenters,
    bandZ,
    w1PlateLenMm,
    w2PlateLenMm,
    w2CoreCenterXMm,
    w2CoreWidthMm,
    w1CoreCenterYMm,
    w1CoreDepthMm,
    footprintT,
    footprintZ,
    w2PlateStartYMm: inch('-0.5'),
    w2ColumnFrontYMm: inch('52.625'),
    w1RoomFaceYMm: inch('-4.5'),
    w1PantryFaceYMm: 0,
    ex1FaceYMm: inch('63.5'),
    w1BoardCenterPantryMm: inch('-0.25'),
    w1BoardCenterRoomMm: inch('-4.25'),
    w2BoardCenterPantryMm: inch('149.25'),
    w2BoardCenterRoomMm: inch('157.0625'),
    w1BoardHalfMm: inch('0.5'),
    w2BoardRoomMm: inch('0.625'),
    blockDepthMm: inch('1.5'),
    blockFaceMm: inch('5.5'),
    blockCenterYMm: inch('-1.25'),
    studWidthMm: inch('1.5'),
    w2StudWidthMm: inch('1.5'),
    columnFrontYMm: inch('52.625'),
    columnProjectionMm: inch('10.875'),
    columnWidthMm: inch('8.375'),
  };
}

/** Convert a stable CSV id into a part id segment. */
export function idSegment(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function partId(prefix, stableId) {
  return `part.${prefix}.${idSegment(stableId)}`;
}

export function boxPart(id, name, kind, role, assemblyId, trade, stage, ifcClass, sizeMm, centreMm, initialState, extra = {}) {
  const part = {
    id,
    name,
    kind,
    role,
    assemblyId,
    trade,
    stage,
    ifcClass,
    ifcGlobalId: ifcGuidForPart(id),
    materialId: extra.materialId ?? null,
    description: extra.description ?? name,
    selectable: true,
    takeoff: extra.takeoff ?? { include: true },
    placement: { translationMm: centreMm.map((value) => Number(round6(value))) },
    initialState,
    geometry: { shape: 'box', sizeMm: sizeMm.map((value) => Number(round6(value))) },
  };
  if (extra.rotationEulerDeg) part.placement.rotationEulerDeg = extra.rotationEulerDeg;
  return part;
}

export function markerPart(id, name, kind, role, assemblyId, trade, stage, ifcClass, pointsMm, initialState, extra = {}) {
  const part = {
    id,
    name,
    kind,
    role,
    assemblyId,
    trade,
    stage,
    ifcClass,
    ifcGlobalId: ifcGuidForPart(id),
    materialId: extra.materialId ?? null,
    description: extra.description ?? name,
    selectable: true,
    takeoff: extra.takeoff ?? { include: false, note: 'reference marker; not part of the takeoff' },
    placement: { translationMm: [0, 0, 0] },
    initialState,
    geometry: { shape: 'markers', pointsMm: pointsMm.map((point) => point.map((value) => Number(round6(value)))), markerRadiusMm: extra.markerRadiusMm ?? 25, proposed: extra.proposed ?? true },
  };
  if (extra.placement) part.placement = extra.placement;
  return part;
}

/** Build all assemblies, parts, measurements, materials, tools, connections, views, issues, listing, acceptance. */
export function buildModel({ src, csvs, geo, registry, cards }) {
  const { jsonCite, csvCite, cardCite, esrCite, svgCite, permitCite, pvt } = registry;
  const { p, inch } = src;
  const iE = (value) => Number(round6(inch(value).mm));

  const assemblies = [
    { id: 'assembly.existing', name: 'Existing conditions (reference)', parentId: null, trade: 'general', stage: 'existing' },
    { id: 'assembly.w1', name: 'W1 pantry wall framing', parentId: null, trade: 'framing', stage: 'rough' },
    { id: 'assembly.backing', name: 'W1 cabinet backing blocks', parentId: 'assembly.w1', trade: 'framing', stage: 'rough' },
    { id: 'assembly.w2', name: 'W2 return wall framing', parentId: null, trade: 'framing', stage: 'rough' },
    { id: 'assembly.drywall', name: 'Drywall faces', parentId: null, trade: 'drywall', stage: 'cover' },
    { id: 'assembly.fixtures', name: 'Cabinets, shelves and refrigerator envelopes', parentId: null, trade: 'cabinetry', stage: 'fixture' },
    { id: 'assembly.trim', name: 'Selective trim zones (reference)', parentId: null, trade: 'finishes', stage: 'existing' },
    { id: 'assembly.practice', name: 'Loose-stock practice (not house framing)', parentId: null, trade: 'general', stage: 'demo', placement: { translationMm: [5200, 4200, 0] } },
  ];

  const datums = [
    {
      id: 'datum.ff',
      name: 'Finished floor (pantry)',
      description: 'Z origin at the top of the retained finished tile. Layer stack below the tile is unresolved and investigated at step p15.',
      originMm: [0, 0, 0],
      axes: { x: 'from the foyer/W2 end toward the garage/refrigerator end', y: 'from the W1 pantry finished face toward the existing EX1 wall/column', z: 'up from the finished floor' },
    },
    {
      id: 'datum.w1.left-plate-end',
      name: 'W1 left plate end / left finished reference',
      description: 'R35 source x=0 left/refrigerator datum, registered at scene X=149 in. Source x increases toward W2; corrected scene +X points the opposite way, toward the garage/refrigerator end.',
      originMm: [iE('149'), 0, 0],
      axes: { x: 'scene +X toward garage/refrigerator; source +x toward W2', y: 'depth direction', z: 'up' },
    },
    {
      id: 'datum.w1.pantry-face',
      name: 'W1 pantry finished face',
      description: 'Y datum zero: W1 pantry (cabinet) finished face; room face is at -4 1/2 in and the existing EX1 finished face is the 68-in trial depth basis.',
      originMm: [0, 0, 0],
      axes: { x: 'toward the garage/refrigerator end', y: 'toward the existing closet wall/column', z: 'up' },
    },
    {
      id: 'datum.w2.column-front',
      name: 'W2 column front / plate end datum',
      description: 'Conditional column-front plane at scene Y=52 5/8 in. W2 runs from its frame butt at Y=-1/2 in toward this retained-column end; its local q datum is q=Y+1/2.',
      originMm: [0, iE('52.625'), 0],
      axes: { x: 'W2 thickness direction; +X toward pantry', y: 'W2 length direction toward the column', z: 'up' },
    },
  ];

  // ---- citations ---------------------------------------------------------------------------------
  const cite = {
    json: {
      state: jsonCite('/state', 'Project state: layout concept; no site construction cuts or connections released', p('/state')),
      jurisdiction: jsonCite('/site/jurisdiction', 'Jurisdiction (City of Dade City, Florida)', p('/site/jurisdiction')),
      floor: jsonCite('/site/floor', 'Tile retained over concrete slab', p('/site/floor')),
      ceiling: jsonCite('/site/ceiling_finished_height_user_report', 'Reported finished ceiling height (user report)', p('/site/ceiling_finished_height_user_report')),
      trussVerified: jsonCite('/site/truss_as_built_verified', 'Truss not as-built verified', p('/site/truss_as_built_verified')),
      columnProjection: jsonCite('/site/column_projection_user_report', 'Reported column projection', p('/site/column_projection_user_report')),
      columnWidth: jsonCite('/site/column_finished_width_user_report', 'Reported column finished width', p('/site/column_finished_width_user_report')),
      w1Inside: jsonCite('/layout/W1_finished_inside_width', 'W1 finished inside width', p('/layout/W1_finished_inside_width')),
      w1Thickness: jsonCite('/layout/W1_finished_thickness_candidate', 'W1 finished thickness candidate', p('/layout/W1_finished_thickness_candidate')),
      w1Trial: jsonCite('/layout/W1_outside_face_depth_trial', 'W1 outside face depth trial', p('/layout/W1_outside_face_depth_trial')),
      w1Move: jsonCite('/layout/W1_move_from_old_70', 'Movement from the superseded 70-in basis', p('/layout/W1_move_from_old_70')),
      clearDepth: jsonCite('/layout/W1_inside_clear_depth_derived', 'Derived clear pantry depth', p('/layout/W1_inside_clear_depth_derived')),
      w2Thickness: jsonCite('/layout/W2_finished_thickness', 'W2 finished thickness', p('/layout/W2_finished_thickness')),
      w2Section: jsonCite('/layout/W2_section_candidate', 'W2 candidate layer chain', p('/layout/W2_section_candidate')),
      w2Plate53: jsonCite('/layout/W2_plate_comparison_at_11_projection', 'W2 plate comparison at the 11-in projection', p('/layout/W2_plate_comparison_at_11_projection')),
      w2Plate53125: jsonCite('/layout/W2_plate_comparison_at_10_7_8_projection', 'W2 plate comparison at the reported 10 7/8-in projection', p('/layout/W2_plate_comparison_at_10_7_8_projection')),
      w1Plate15675: jsonCite('/layout/W1_plate_comparison_at_selected_corner', 'W1 candidate plate comparison', p('/layout/W1_plate_comparison_at_selected_corner')),
      outward157375: jsonCite('/layout/W1_outside_finished_plane_comparison', 'W1 outside finished-plane comparison', p('/layout/W1_outside_finished_plane_comparison')),
      plateStatus: jsonCite('/layout/W1_plate_and_W2_plate_status', 'Plate comparison status: conditional arithmetic, no cuts released', p('/layout/W1_plate_and_W2_plate_status')),
      leftSpace: jsonCite('/fixtures/left_end_space', 'Left-end space', p('/fixtures/left_end_space')),
      fridgeBay: jsonCite('/fixtures/fridge_clear_bay', 'Refrigerator clear bay', p('/fixtures/fridge_clear_bay')),
      divider: jsonCite('/fixtures/divider', 'Refrigerator/base-cabinet divider', p('/fixtures/divider')),
      boxesCombined: jsonCite('/fixtures/base_boxes_combined', 'B1+B2+B3 measured together', p('/fixtures/base_boxes_combined')),
      fillers: jsonCite('/fixtures/base_fillers_between_boxes', 'Between-box fillers', p('/fixtures/base_fillers_between_boxes')),
      baseRow: jsonCite('/fixtures/base_installed_row', 'Base installed row', p('/fixtures/base_installed_row')),
      upperRow: jsonCite('/fixtures/upper_shelf_row', 'Upper/shelf row', p('/fixtures/upper_shelf_row')),
      chainTotal: jsonCite('/fixtures/chain_total', 'Chain total', p('/fixtures/chain_total')),
      seams: jsonCite('/fixtures/seam_positions', 'Seam positions unknown', p('/fixtures/seam_positions')),
      fridgeAccess: jsonCite('/fixtures/refrigerator_access', 'Refrigerator bin-removal access note', p('/fixtures/refrigerator_access')),
      fridgeClosed: jsonCite('/fixtures/closed_refrigerator_front_to_opposite_wall_nominal', 'Nominal closed-front clearance', p('/fixtures/closed_refrigerator_front_to_opposite_wall_nominal')),
      fridgeDoor90: jsonCite('/fixtures/door_90_front_to_opposite_wall_nominal', 'Nominal 90-degree condition', p('/fixtures/door_90_front_to_opposite_wall_nominal')),
      aisleNote: jsonCite('/fixtures/aisle_note', 'Aisle note: depth subtraction, not door-sweep proof', p('/fixtures/aisle_note')),
      baseOrder: jsonCite('/fixtures/base_order_from_refrigerator', 'Base order from the refrigerator', p('/fixtures/base_order_from_refrigerator')),
      boxConstraint: jsonCite('/fixtures/box_width_constraint', 'Individual box widths unknown', p('/fixtures/box_width_constraint')),
      baseFrontChange: jsonCite('/fixtures/base_front_change', 'B1 front change beside the refrigerator', p('/fixtures/base_front_change')),
      trussCenter: jsonCite('/roof_plan_alignment/drawing_truss_center_from_existing_finished_face', 'A7 candidate truss centre from the existing finished face', p('/roof_plan_alignment/drawing_truss_center_from_existing_finished_face')),
      trussPlate: jsonCite('/roof_plan_alignment/candidate_W1_top_plate_center_at_68', 'Candidate W1 top-plate centre on the 68-in trial', p('/roof_plan_alignment/candidate_W1_top_plate_center_at_68')),
      trussStatus: jsonCite('/roof_plan_alignment/status', 'Truss alignment trial status', p('/roof_plan_alignment/status')),
      holdPoints: jsonCite('/hold_points', 'Hold points', p('/hold_points')),
      releases: jsonCite('/releases', 'Release scope dictionary', p('/releases')),
      changes: jsonCite('/changes_R35', 'R35 change record', p('/changes_R35')),
      retained: jsonCite('/changes_R35/retained', 'Retained facts', p('/changes_R35/retained')),
      supersedes: jsonCite('/supersedes_documents', 'Superseded documents', p('/supersedes_documents')),
      connections: jsonCite('/connections_R35', 'Candidate connections', p('/connections_R35')),
      tools: jsonCite('/tools_R35', 'Tool notes', p('/tools_R35')),
      backing: jsonCite('/backing', 'Backing concept', p('/backing')),
      backingStatus: jsonCite('/backing/status', 'Backing status and hold', p('/backing/status')),
      backingSection: jsonCite('/backing/section_actual_target_in', 'Block section target', p('/backing/section_actual_target_in')),
      backingOrientation: jsonCite('/backing/orientation', 'Block orientation', p('/backing/orientation')),
      backingNumber: jsonCite('/backing/number_of_blocks', 'Block count', p('/backing/number_of_blocks')),
      backingMix: jsonCite('/backing/planning_cut_mix_in', 'Planning cut mix', p('/backing/planning_cut_mix_in')),
      backingNet: jsonCite('/backing/net_length_in', 'Net block length', p('/backing/net_length_in')),
      backingBands: jsonCite('/backing/bands_above_finished_tile_in', 'Backing bands above finished tile', p('/backing/bands_above_finished_tile_in')),
      backingBandStatus: jsonCite('/backing/band_status', 'Band status: provisional zones', p('/backing/band_status')),
      backingShelves: jsonCite('/backing/shelves', 'Shelf bracket concept', p('/backing/shelves')),
      backingStuds: jsonCite('/backing/candidate_W1_stud_centers_from_left_plate_end_in', 'Candidate W1 stud centres from the left plate end', p('/backing/candidate_W1_stud_centers_from_left_plate_end_in')),
      backingDatum: jsonCite('/backing/candidate_datum', 'Stud centre datum note', p('/backing/candidate_datum')),
      backingShortBay: jsonCite('/backing/short_corner_bay', 'Short S10-S11 bay', p('/backing/short_corner_bay')),
      backingConnection: jsonCite('/backing/connection_R35', 'Backing connection intent and conflict', p('/backing/connection_R35')),
      logicalW1: jsonCite('/logistics/W1', 'W1 logistics', p('/logistics/W1')),
      logicalW2: jsonCite('/logistics/W2', 'W2 logistics', p('/logistics/W2')),
      logicalBacking: jsonCite('/logistics/backing', 'Backing logistics', p('/logistics/backing')),
      logicalRaising: jsonCite('/logistics/raising', 'No full-height tilt-up planned', p('/logistics/raising')),
      drywallState: jsonCite('/drywall/state', 'Drywall state: estimate only, no cuts or screws released', p('/drywall/state')),
      drywallStock: jsonCite('/drywall/base_stock_study', 'Drywall stock study', p('/drywall/base_stock_study')),
      drywallOrder: jsonCite('/drywall/order_status', 'Drywall order status', p('/drywall/order_status')),
      drywallMap: jsonCite('/drywall/panel_map_status', 'Panel map status', p('/drywall/panel_map_status')),
      panelLayout: jsonCite('/drywall/panel_layout', 'Panel layout block (R34 addendum)', p('/drywall/panel_layout')),
      panelFaces: jsonCite('/drywall/panel_layout/faces', 'Four face candidates', p('/drywall/panel_layout/faces')),
      panelStock: jsonCite('/drywall/panel_layout/stock', 'Panel stock nest', p('/drywall/panel_layout/stock')),
      panelPatches: jsonCite('/drywall/panel_layout/patches', 'EX1 patches excluded', p('/drywall/panel_layout/patches')),
      panelHeight: jsonCite('/drywall/panel_layout/height', 'Panel height rule (field fit)', p('/drywall/panel_layout/height')),
      panelHolds: jsonCite('/drywall/panel_layout/holds', 'Panel layout holds', p('/drywall/panel_layout/holds')),
      trim: jsonCite('/trim', 'Trim concept', p('/trim')),
      trimBaseboards: jsonCite('/trim/existing_baseboards', 'Existing baseboard zones TR-01..TR-04', p('/trim/existing_baseboards')),
      trimRetained: jsonCite('/trim/retained', 'Retained trim and kitchen door', p('/trim/retained')),
      trimNew: jsonCite('/trim/new_trim', 'New baseboard scope', p('/trim/new_trim')),
      trimQuantity: jsonCite('/trim/quantity_status', 'Trim lengths field measured', p('/trim/quantity_status')),
      trimFloor: jsonCite('/trim/floor', 'Tile retained; no drilling authorized by trim removal', p('/trim/floor')),
      straightening: jsonCite('/straightening', 'Straightening check and correction', p('/straightening')),
      framingConcept: jsonCite('/framing_materials_concept', 'Framing material concept rows', p('/framing_materials_concept')),
      reviewR31: jsonCite('/review/R31_geometry_backing', 'R31 review scope', p('/review/R31_geometry_backing')),
      reviewR33: jsonCite('/review/R33_manual', 'R33 review scope', p('/review/R33_manual')),
      reviewR34: jsonCite('/review/R34_manual', 'R34 review scope', p('/review/R34_manual')),
      reviewR35: jsonCite('/review/R35', 'R35 scoped review', p('/review/R35')),
      reviewHash: jsonCite('/review/R35_pdf_sha256', 'Reviewed R35 PDF hash', p('/review/R35_pdf_sha256')),
    },
    card: {
      p01: (block, label) => cardCite('p01-overview', block, label),
      p02: (block, label) => cardCite('p02-plan', block, label),
      p03: (block, label) => cardCite('p03-elevation', block, label),
      p04: (block, label) => cardCite('p04-survey', block, label),
      p05: (block, label) => cardCite('p05-trim', block, label),
      p06: (block, label) => cardCite('p06-parts', block, label),
      p07: (block, label) => cardCite('p07-setup', block, label),
      p08: (block, label) => cardCite('p08-w1-plates', block, label),
      p09: (block, label) => cardCite('p09-w1-frame', block, label),
      p10: (block, label) => cardCite('p10-connector', block, label),
      p11: (block, label) => cardCite('p11-w2-layout', block, label),
      p12: (block, label) => cardCite('p12-w2-frame', block, label),
      p13: (block, label) => cardCite('p13-practice', block, label),
      p14: (block, label) => cardCite('p14-sd9112', block, label),
      p15: (block, label) => cardCite('p15-slab', block, label),
      p16: (block, label) => cardCite('p16-plates', block, label),
      p17: (block, label) => cardCite('p17-straightening', block, label),
      p18: (block, label) => cardCite('p18-backing', block, label),
      p19: (block, label) => cardCite('p19-backing-connection', block, label),
      p20: (block, label) => cardCite('p20-ex1', block, label),
      p21: (block, label) => cardCite('p21-drywall-faces', block, label),
      p22: (block, label) => cardCite('p22-drywall-map', block, label),
      p23: (block, label) => cardCite('p23-24-junction', block, label),
      p25: (block, label) => cardCite('p25-drywall-hang', block, label),
      p26: (block, label) => cardCite('p26-finish', block, label),
      p27: (block, label) => cardCite('p27-fixtures', block, label),
      p28: (block, label) => cardCite('p28-gates', block, label),
      p29: (block, label) => cardCite('p29-source-record', block, label),
    },
    esr: (block, label) => esrCite(block, label),
    csv: (key, row, stableId, label, field) => csvCite(key, row, stableId, label, field),
    svg: (name, region, label, elementNote) => svgCite(name, region, label, elementNote),
    permit: (page, region, label, note) => permitCite(page, region, label, note),
    pvt: (sourceId, label, note, extra) => pvt(sourceId, label, note, extra),
  };

  // ---- parts -------------------------------------------------------------------------------------
  const parts = [];

  // Existing context (reference; excluded from takeoff).
  parts.push(
    boxPart(
      'part.existing.tile-floor',
      'Retained finished tile floor',
      'layered_surface',
      'existing',
      'assembly.existing',
      'finishes',
      'existing',
      'IfcCovering',
      [4400, 2820, 20],
      [2000, 310, -10],
      'existing',
      {
        takeoff: { include: false, note: 'existing surface; retained; not part of the new takeoff' },
        description: 'Retained finished tile. Reference volume at the floor plane only: the tile/mortar/slab layer stack and hidden services are unresolved (see the tile/slab investigation hold).',
      },
    ),
    boxPart(
      'part.existing.slab',
      'Existing concrete slab (below tile)',
      'layered_surface',
      'existing',
      'assembly.existing',
      'general',
      'existing',
      'IfcSlab',
      [4400, 2820, 80],
      [2000, 310, -60],
      'existing',
      {
        takeoff: { include: false, note: 'existing substrate; anchor target only after the accepted detail' },
        description: 'Existing concrete below the tile. Reference volume only; thickness, reinforcement, tendons and under-slab services are unresolved and no hole envelope is released.',
      },
    ),
    boxPart(
      'part.existing.ex1-wall',
      'Existing EX1 wall / closet back (reference)',
      'layered_surface',
      'existing',
      'assembly.existing',
      'general',
      'existing',
      'IfcWall',
      [4400, 88.9, 20],
      [2000, iE('63.5') + 44.45, 10],
      'existing',
      {
        takeoff: { include: false, note: 'existing wall; excluded from the new-wall takeoff' },
        description: 'Existing wall/closet back at the surveyed depth-zero plane (finished face at the 68-in trial basis). Plan footprint only: role, services, structure and any approved opening remain held (EX1). Alteration is not released.',
      },
    ),
    markerPart(
      'part.existing.kitchen-door',
      'Retained kitchen-side pantry door, jamb and casing (reference)',
      'fixture',
      'existing',
      'assembly.existing',
      'finishes',
      'existing',
      'IfcDoor',
      [[2000, iE('63.5') + 44.45, 10]],
      'existing',
      {
        takeoff: { include: false, note: 'retained existing element; never replaced or taken off by this guide' },
        description: 'Retained kitchen-side door, jamb and casing. Reference marker only: the exact position is not surveyed and is not modelled; the passage opening is through EX1 and does not replace this door.',
      },
    ),
    boxPart(
      'part.existing.column',
      'Existing column (reported 10 7/8 in projection x 8 3/8 in width)',
      'linear_member',
      'existing',
      'assembly.existing',
      'general',
      'existing',
      'IfcColumn',
      [iE('8.375'), iE('10.875'), 20],
      [iE('153.1875'), iE('63.5') - iE('10.875') / 2, 10],
      'existing',
      {
        takeoff: { include: false, note: 'existing column; retained, never cut' },
        description: 'Existing column at the W2 terminus. Cross-section from the user-reported projection (10 7/8 in) and finished width (8 3/8 in); height and exact contact plane are reported, not field-verified. No frame passes through the column.',
      },
    ),
    boxPart(
      'part.reference.truss-band',
      'Roof-truss candidate reference band (unverified)',
      'linear_member',
      'clearance',
      'assembly.existing',
      'framing',
      'rough',
      'IfcMember',
      [4400, 20, 20],
      [2000, iE('-2.36'), 10],
      'existing',
      {
        takeoff: { include: false, note: 'candidate clearance reference; no fastener point' },
        description: 'Candidate roof-truss centreline reference from the A3/A7 comparison (about 65.86 in from the existing finished face). Trial only: the physical chord must be located before any top restraint; no truss attachment is released.',
      },
    ),
    markerPart(
      'part.existing.ceiling-report',
      'Reported 111-in ceiling reference (user report; not a cut)',
      'linear_member',
      'clearance',
      'assembly.existing',
      'general',
      'existing',
      'IfcBuildingElementProxy',
      [[2000, 310, iE('111')]],
      'existing',
      {
        takeoff: { include: false, note: 'reported reference only; never a stud or panel cut' },
        description: 'Reference marker for the reported 111-in finished ceiling height. User report only, not field-verified, and explicitly not a stud cut or panel cut height. Member heights remain field-fit.',
      },
    ),
  );

  // Trim zones (reference; locations and lengths not measured).
  const trimRows = src.trim.existing_baseboards;
  const trimCitations = {
    'TR-01': [jsonCite('/trim/existing_baseboards/0', 'TR-01 zone and bounded action', trimRows[0]), cardCite('p05-trim', 'zones', 'TR-01/TR-02/TR-03 bounded removal text'), svgCite('r32-baseboard', { x: 150, y: 175, width: 340, height: 180 }, 'tr-01', 'TR-01 label at the W1 left-end receiver')],
    'TR-02': [jsonCite('/trim/existing_baseboards/1', 'TR-02 zone and bounded action', trimRows[1]), cardCite('p05-trim', 'zones', 'TR-01/TR-02/TR-03 bounded removal text'), svgCite('r32-baseboard', { x: 1180, y: 570, width: 340, height: 130 }, 'tr-02', 'TR-02 label at the column')],
    'TR-03': [jsonCite('/trim/existing_baseboards/2', 'TR-03 zone and bounded action', trimRows[2]), cardCite('p05-trim', 'zones', 'TR-03 EX1 faces bounded removal'), svgCite('r32-baseboard', { x: 900, y: 775, width: 460, height: 90 }, 'tr-03', 'TR-03 label on both accessible EX1 faces')],
    'TR-04': [jsonCite('/trim/existing_baseboards/3', 'TR-04 discovery zone only', trimRows[3]), cardCite('p05-trim', 'bounds', 'No assumed extent / no default room-wide removal')],
  };
  const trimPoints = {
    'TR-01': [0, iE('-1.75'), 0],
    'TR-02': [iE('153.1875'), iE('63.5') - iE('10.875') / 2, 0],
    'TR-03': [2000, iE('63.5'), 0],
    'TR-04': [2000, iE('-8'), 0],
  };
  for (const zone of trimRows) {
    parts.push(
      markerPart(
        `part.trim.${idSegment(zone.id)}`,
        `Trim zone ${zone.id}: ${zone.location}`,
        'linear_member',
        'existing',
        'assembly.trim',
        'finishes',
        'existing',
        'IfcBuildingElementProxy',
        [trimPoints[zone.id]],
        'existing',
        {
          takeoff: { include: false, note: 'existing trim; lengths field-measured; nothing taken off' },
          description: `${zone.action} Length null in the source; status: ${zone.status}. Removal is held for marked contact areas and the EX1 opening boundary; only the non-destructive trim survey is ready.`,
        },
      ),
    );
  }

  // W1 framing.
  const w1PlateLen = geo.w1PlateLenMm;
  parts.push(
    boxPart(
      'part.w1.bottom-plate',
      'W1 treated bottom plate (candidate, 2x4x16)',
      'linear_member',
      'installed',
      'assembly.w1',
      'framing',
      'rough',
      'IfcPlate',
      [w1PlateLen, geo.w1CoreDepthMm, iE('1.5')],
      [w1PlateLen / 2, geo.w1CoreCenterYMm, iE('1.5') / 2],
      'absent',
      {
        materialId: 'material.lumber.w1-bottom-plate',
        takeoff: { include: true, note: 'candidate plate; no cut released' },
        description: 'Single treated candidate bottom plate laid on the verified line; candidate comparison length 156 3/4 in from the through-corner arithmetic. Treatment, bearing/separation stack and anchor detail are held; no cut is released.',
        citationIds: [cite.json.w1Plate15675, cite.card.p08('arithmetic', 'W1 candidate plate arithmetic'), cite.csv('parts', 17, 'W1-BP', 'W1 bottom plate candidate length', 'candidate_length_in')],
      },
    ),
    boxPart(
      'part.w1.top-plate',
      'W1 single top plate (candidate, 2x4x16)',
      'linear_member',
      'installed',
      'assembly.w1',
      'framing',
      'rough',
      'IfcPlate',
      [w1PlateLen, geo.w1CoreDepthMm, iE('1.5')],
      [w1PlateLen / 2, geo.w1CoreCenterYMm, 45],
      'absent',
      {
        materialId: 'material.lumber.w1-top-plate',
        takeoff: { include: true, note: 'single top plate concept; elevation and restraint held' },
        description: 'Single top plate (one plate per wall concept). Plan footprint shown at an offset presentation height: the top-plate elevation depends on the field-fit stud lengths and the unverified truss line, so no elevation or cut is asserted.',
        citationIds: [cite.json.retained, cite.card.p07('method', 'Single top plate basis'), cite.card.p09('steps', 'Top plate and nonbearing restraint installation')],
      },
    ),
  );
  src.w1StudCentersIn.forEach((value, index) => {
    const n = String(index + 1).padStart(2, '0');
    const csvRow = csvs.parts.find((row) => row.id === `W1-S${n}`);
    parts.push(
      boxPart(
        `part.w1.stud-s${n}`,
        `W1 candidate stud S${n} (2x4, centre ${value} in from the left plate end)`,
        'linear_member',
        'installed',
        'assembly.w1',
        'framing',
        'rough',
        'IfcMember',
        [iE('1.5'), geo.w1CoreDepthMm, geo.footprintT],
        [iE(value), geo.w1CoreCenterYMm, geo.footprintZ],
        'absent',
        {
          materialId: 'material.lumber.w1-stud',
          takeoff: { include: true, note: 'candidate stud position; height and connection held' },
          description: 'Candidate 2x4 stud position (actual thickness 1.5 in x depth 3.5 in). Plan footprint only: the member height is field-fit between the installed plates and is not asserted. No header and no door opening exists in W1.',
          citationIds: [cite.json.backingStuds, cite.csv('parts', csvRow.row, csvRow.id, `W1 stud ${csvRow.id} candidate centre`, 'candidate_center_in'), cite.card.p08('centres', 'W1 candidate stud centres')],
        },
      ),
    );
  });

  // W2 framing.
  const w2Centers = geo.w2Centers;
  parts.push(
    boxPart(
      'part.w2.bottom-plate',
      'W2 treated bottom plate (candidate, 2x8x8)',
      'linear_member',
      'installed',
      'assembly.w2',
      'framing',
      'rough',
      'IfcPlate',
      [geo.w2CoreWidthMm, geo.w2PlateLenMm, iE('1.5')],
      [geo.w2CoreCenterXMm, geo.w2PlateStartYMm + geo.w2PlateLenMm / 2, iE('1.5') / 2],
      'absent',
      {
        materialId: 'material.lumber.w2-bottom-plate',
        takeoff: { include: true, note: 'candidate plate; column contact governs' },
        description: 'Single treated candidate bottom plate for W2, candidate length 53 to 53 1/8 in (the 53 1/8-in comparison is used for presentation). Actual column contact, grade, bearing and anchors are held.',
        citationIds: [cite.json.w2Plate53125, cite.card.p11('plate', 'W2 candidate plate length'), cite.csv('parts', 21, 'W2-BP', 'W2 bottom plate candidate length', 'candidate_length_in')],
      },
    ),
    boxPart(
      'part.w2.top-plate',
      'W2 single top plate (candidate, 2x8x8)',
      'linear_member',
      'installed',
      'assembly.w2',
      'framing',
      'rough',
      'IfcPlate',
      [geo.w2CoreWidthMm, geo.w2PlateLenMm, iE('1.5')],
      [geo.w2CoreCenterXMm, geo.w2PlateStartYMm + geo.w2PlateLenMm / 2, 45],
      'absent',
      {
        materialId: 'material.lumber.w2-top-plate',
        takeoff: { include: true, note: 'single top plate concept; elevation and restraint held' },
        description: 'Single top plate for W2. Plan footprint only: elevation follows the field-fit studs and the held top restraint; no elevation or cut is asserted.',
        citationIds: [cite.json.w2Plate53125, cite.card.p11('plate', 'W2 candidate plate length')],
      },
    ),
  );
  w2Centers.forEach((centre, index) => {
    const n = String(index + 1).padStart(2, '0');
    const csvRow = csvs.parts.find((row) => row.id === `W2-S${n}`);
    const csvCentre = csvRow.candidate_center_in === '' ? null : csvRow.candidate_center_in;
    const description = index === 4
      ? 'Candidate 2x8 stud position (actual thickness 1.5 in x depth 7.25 in). The CSV leaves the last centre blank (field-fit at the column end); the R34 face map records the last candidate centre as 51 7/8 in from the W1 pantry face and that value is shown as a candidate only. Actual column contact governs.'
      : 'Candidate 2x8 stud position (actual thickness 1.5 in x depth 7.25 in). Plan footprint only: member height is field-fit and not asserted. A wider 2x8 is not covered by the W1 2x4 joint detail.';
    parts.push(
      boxPart(
        `part.w2.stud-s${n}`,
        `W2 candidate stud S${n} (2x8, centre ${src.w2FaceStudsIn[index]} in from the W1 pantry face)`,
        'linear_member',
        'installed',
        'assembly.w2',
        'framing',
        'rough',
        'IfcMember',
        [geo.w2CoreWidthMm, iE('1.5'), geo.footprintT],
        [geo.w2CoreCenterXMm, centre.mm, geo.footprintZ],
        'absent',
        {
          materialId: 'material.lumber.w2-stud',
          takeoff: { include: true, note: 'candidate stud position; height and connection held' },
          description,
          citationIds: [
            jsonCite(`/drywall/panel_layout/faces/2/studs/${index}`, `W2 face-map candidate stud centre ${src.w2FaceStudsIn[index]} in`, src.w2FaceStudsIn[index]),
            csvCite('parts', csvRow.row, csvRow.id, `W2 stud ${csvRow.id} candidate centre${csvCentre === null ? ' (blank in CSV; field-fit)' : ''}`, 'candidate_center_in'),
            cite.card.p12('steps', 'W2 stud fitting text'),
          ],
        },
      ),
    );
  });

  // 25 backing blocks (exactly the CSV rows).
  const bandFor = (row) => row.purpose;
  const bayNumber = (stableId) => Number(/B(\d+)$/.exec(stableId)[1]);
  for (const row of csvs.backing) {
    const bay = bayNumber(row.id);
    if (bay < 1 || bay > 10) throw new Error(`Backing row ${row.id} outside candidate bays 1-10`);
    const left = iE(row.left_x);
    const right = iE(row.right_x);
    const lengthIn = row.planning_length;
    const lengthMm = iE(lengthIn);
    const expected = Number((right - left).toFixed(3));
    if (Math.abs(expected - lengthMm) > 0.05) {
      throw new Error(`Backing row ${row.id}: CSV length ${lengthIn} in does not match its left/right endpoints ${expected} mm`);
    }
    const band = bandFor(row);
    if (!geo.bandZ[band]) throw new Error(`Backing row ${row.id} has unknown purpose band ${band}`);
    const z = (iE(row.bottom_z) + iE(row.top_z)) / 2;
    const jsonZ = (geo.bandZ[band].lowMm + geo.bandZ[band].highMm) / 2;
    if (Math.abs(z - jsonZ) > 0.05) throw new Error(`Backing row ${row.id}: band z does not match the JSON band map`);
    parts.push(
      boxPart(
        partId('backing', row.id),
        `Backing block ${row.id} (flat 2x6, ${lengthIn} in, ${band} band)`,
        'linear_member',
        'installed',
        'assembly.backing',
        'framing',
        'rough',
        'IfcPlate',
        [lengthMm, geo.blockDepthMm, geo.blockFaceMm],
        [(left + right) / 2, geo.blockCenterYMm, z],
        'absent',
        {
          materialId: 'material.lumber.backing',
          takeoff: { include: true, note: 'one part per CSV row; field-fit, no automatic fastener quantity' },
          description: `Flat dry 2x6 block: 5 1/2-in vertical face flush to the pantry-side stud faces, 1 1/2-in depth into the 3.5-in cavity, in the ${band} provisional band. Length equals the candidate bay clear span; every bay is field-fit and the block-to-stud load path is held.`,
          citationIds: [cite.csv('backing', row.row, row.id, `Backing block ${row.id} (${band} band)`, 'planning_length'), cite.json.backingMix, cite.card.p18('mix', 'Backing cut mix and field-fit rule')],
        },
      ),
    );
  }

  // 12 drywall panels (exactly the CSV rows).
  const facePlane = {
    'W1-P': { axis: 'x', plane: geo.w1BoardCenterPantryMm, thickness: geo.w1BoardHalfMm, y: true },
    'W1-R': { axis: 'x', plane: geo.w1BoardCenterRoomMm, thickness: geo.w1BoardHalfMm, y: true },
    'W2-P': { axis: 'y', plane: geo.w2BoardCenterPantryMm, thickness: geo.w1BoardHalfMm, y: false },
    'W2-R': { axis: 'y', plane: geo.w2BoardCenterRoomMm, thickness: geo.w2BoardRoomMm, y: false },
  };
  const drywallFaceDetails = new Map(
    src.drywall.panel_layout.faces.map((face) => [face.id, face]),
  );
  const drywallCornerCondition = {
    'W1-P-04': 'At the pantry-side inside corner, W1-P continues through and W2-P butts to it; the final receiver and fastening remain held.',
    'W1-R-04': 'At the room-side outside corner, W1-R laps W2-R; the accepted bead/control/movement detail remains held.',
    'W2-P-01': 'At the pantry-side inside corner, this W2-P sheet butts to the through W1-P sheet; the final receiver and fastening remain held.',
    'W2-R-01': 'At the room-side outside corner, this W2-R sheet is lapped by W1-R; the accepted bead/control/movement detail remains held.',
  };
  const drywallFaceEnvelope = {
    'W1-P': 'y=-1/2…0 in; pantry finish y=0',
    'W1-R': 'y=-4 1/2…-4 in; room finish y=-4 1/2',
    'W2-P': 'scene X=-1/2…0 in; pantry finish X=0 (source x=149…149 1/2)',
    'W2-R': 'scene X=-8 3/8…-7 3/4 in; room finish X=-8 3/8 (source x=156 3/4…157 3/8)',
  };
  const drywallEdgeReceivers = {
    'W1-P-01': 'left W1-S01; right W1-S04 at seam x=48',
    'W1-P-02': 'left W1-S04; right W1-S07 at seam x=96',
    'W1-P-03': 'left W1-S07; right W1-S10 at seam x=144',
    'W1-P-04': 'left W1-S10; right W1-S11 corner-support footprint',
    'W1-R-01': 'left W1-S01; right W1-S02 at seam x=16',
    'W1-R-02': 'left W1-S02; right W1-S05 at seam x=64',
    'W1-R-03': 'left W1-S05; right W1-S08 at seam x=112',
    'W1-R-04': 'left W1-S08; right W1-S12 vicinity, with outside-edge fastening unresolved',
    'W2-P-01': 'left W2-S01; right W2-S03 at seam y=31 1/2 (q=32)',
    'W2-P-02': 'left W2-S03; right conditional W2-S05/column termination',
    'W2-R-01': 'W1-S12 side-face wrap and W2-S01 at the corner; right W2-S02 at seam y=15 1/2 (q=16)',
    'W2-R-02': 'left W2-S02; right conditional W2-S05/column termination',
  };
  for (const row of csvs.panels) {
    const face = facePlane[row.face];
    if (!face) throw new Error(`Unknown panel face ${row.face}`);
    const faceDetail = drywallFaceDetails.get(row.face);
    if (!faceDetail) throw new Error(`Missing panel-layout detail for ${row.face}`);
    const thickness = row.board_thickness_in === '½' ? geo.w1BoardHalfMm : geo.w2BoardRoomMm;
    const start = inch(row.start_in).mm;
    const end = inch(row.end_in).mm;
    const length = end - start;
    const widthIn = row.candidate_width_in;
    if (Math.abs(iE(widthIn) - length) > 0.05) {
      throw new Error(`Panel ${row.panel_id}: candidate width ${widthIn} in does not match its endpoints`);
    }
    const along = face.axis === 'x';
    const size = along ? [length, thickness, geo.footprintT] : [thickness, length, geo.footprintT];
    const centre = along ? [(start + end) / 2, face.plane, geo.footprintZ] : [face.plane, (start + end) / 2, geo.footprintZ];
    const touchingSeams = faceDetail.seams.flatMap((seam, index) => {
      const seamMm = inch(String(seam)).mm;
      if (Math.abs(seamMm - start) > 0.05 && Math.abs(seamMm - end) > 0.05) return [];
      return [`${seam} in at ${faceDetail.support[index] ?? 'receiver held'}`];
    });
    const seamNote = touchingSeams.length > 0
      ? ` Scheduled internal seam receiver${touchingSeams.length === 1 ? '' : 's'} touching this sheet: ${touchingSeams.join('; ')}.`
      : ' This sheet touches no scheduled internal seam; its boundary-edge receiver still requires field confirmation.';
    const cornerNote = drywallCornerCondition[row.panel_id]
      ? ` ${drywallCornerCondition[row.panel_id]}`
      : '';
    const sourceStartIn = start / 25.4;
    const sourceEndIn = end / 25.4;
    const sceneExtent = along
      ? `; corrected scene X=${round6(149 - sourceEndIn)} to ${round6(149 - sourceStartIn)} in`
      : '; corrected scene Y equals the listed source y extent';
    parts.push(
      boxPart(
        partId('drywall', row.panel_id),
        `Drywall panel ${row.panel_id} (${row.face}, ${row.board_thickness_in} in board)`,
        'panel',
        'installed',
        'assembly.drywall',
        'drywall',
        'cover',
        'IfcCovering',
        size,
        centre,
        'absent',
        {
          materialId: row.board_thickness_in === '½' ? 'material.gypsum.half' : 'material.gypsum.five-eighth',
          takeoff: { include: true, note: 'candidate panel; height field-fit; no cut released' },
          description: `Candidate ${faceDetail.title} (${row.face}) panel, ${row.board_thickness_in}-in board, source horizontal extent ${row.start_in} to ${row.end_in} in on datum “${faceDetail.datum}”${sceneExtent}; face envelope ${drywallFaceEnvelope[row.face]}; core-nest stock ${row.source_sheet_4x10} (not a spare). Candidate orientation is vertical with the 120-in stock direction vertical. Candidate vertical-edge receivers: ${drywallEdgeReceivers[row.panel_id]}.${seamNote}${cornerNote} Plan footprint at the sourced face plane only: the interactive viewer raises it to the labelled schematic height, while its real height stays field-fit between accepted upper/lower board-edge elevations. Taper compatibility, horizontal top/bottom plate receiver use, bottom gap, top movement joint and board-specific fastening remain held; never bridge an intended movement joint with ordinary fixed-joint fastening, tape or adhesive. The reported 111-in ceiling is never a cut.`,
          citationIds: [cite.csv('panels', row.row, row.panel_id, `Panel ${row.panel_id} (${row.face})`, 'candidate_width_in'), cite.json.panelFaces, cite.json.panelHeight, cite.card.p22(row.face === 'W1-P' ? 'w1p' : row.face === 'W1-R' ? 'w1r' : row.face === 'W2-P' ? 'w2p' : 'w2r', `R34 ${row.face} board width`), cite.pvt('source.r35.r34-drywall-layout-md', `panel-${row.panel_id}-receivers`, `work/R34/drywall-layout.md, sections “Assumptions and reference planes”, “Seam support and ends”, “Height and top/bottom holds” and “Joint finishing concept”; candidate orientation/receivers/laps only, not a cut or screw release.`), cite.permit(3, { x: 20, y: 40, width: 570, height: 700 }, 'a3-scene-registration', 'A3 floor-plan orientation places the foyer/W2 end opposite the garage/refrigerator end; the anonymized local scene registers X=149 in−x_R35 without publishing site identity')],
        },
      ),
    );
  }

  // Practice parts (loose stock; never house framing, never installed takeoff).
  const practiceAssembly = 'assembly.practice';
  parts.push(
    boxPart(
      'part.practice.stock',
      'Practice stock 2x4x10 (loose)',
      'linear_member',
      'loose',
      practiceAssembly,
      'general',
      'demo',
      'IfcMember',
      [3048, 88.9, 38.1],
      [1524, 0, 19.05],
      'absent',
      {
        materialId: 'material.lumber.practice',
        takeoff: { include: false, note: 'loose practice stock; never house framing' },
        description: 'Separate dry 2x4x10 practice board for the loose-stock saw/driver practice. Never a house part and never in the installed takeoff.',
        citationIds: [cite.card.p13('yield', 'Practice yield text'), cite.json.framingConcept],
      },
    ),
  );
  const practicePlate = (id, name, centreX) =>
    boxPart(id, name, 'linear_member', 'loose', practiceAssembly, 'general', 'demo', 'IfcPlate', [609.6, 88.9, 38.1], [centreX, 0, 19.05], 'absent', {
      materialId: 'material.lumber.practice',
      takeoff: { include: false, note: 'loose practice part' },
      description: 'Practice mock-frame plate (24 in) cut only from the separate practice board; never house framing.',
      citationIds: [cite.card.p13('yield', 'Practice mock frame yield'), cite.json.framingConcept],
    });
  parts.push(practicePlate('part.practice.plate-a', 'Practice plate A (24 in, loose)', 304.8));
  parts.push(practicePlate('part.practice.plate-b', 'Practice plate B (24 in, loose)', -304.8));
  for (const [index, name] of ['a', 'b', 'c'].entries()) {
    parts.push(
      boxPart(
        `part.practice.stud-${name}`,
        `Practice stud ${name.toUpperCase()} (21 in, loose)`,
        'linear_member',
        'loose',
        practiceAssembly,
        'general',
        'demo',
        'IfcMember',
        [38.1, 88.9, 533.4],
        [304.8 + (index - 1) * 285.75, -250, 285.75],
        'absent',
        {
          materialId: 'material.lumber.practice',
          takeoff: { include: false, note: 'loose practice part' },
          description: 'Practice mock-frame stud (21 in) for the 24x24-in loose dry-fit rectangle; never house framing.',
          citationIds: [cite.card.p13('yield', 'Practice mock frame yield'), cite.json.framingConcept],
        },
      ),
    );
  }
  parts.push(
    boxPart('part.practice.angle', 'Practice A34-family angle (loose candidate)', 'connector', 'loose', practiceAssembly, 'framing', 'demo', 'IfcDiscreteAccessory', [63.5, 36.5125, 1.2], [0, -420, 10], 'existing', {
      takeoff: { include: false, note: 'loose practice connector; candidate only' },
      description: 'Loose A34/A34Z-family angle for the separate scrap angle-and-screw trial. Candidate product family only: installed quantity, orientation and capacity are not released.',
      citationIds: [cite.card.p14('spec', 'SD9112 candidate and practice driving'), cite.esr('table', 'A34 table excerpt'), cite.json.connections],
    }),
  );

  // Fixtures and clearances (envelopes and reference volumes, takeoff excluded).
  const fixtureBox = (id, name, role, sizeMm, centreMm, description, citationIds, kind = 'fixture') =>
    boxPart(id, name, kind, role, 'assembly.fixtures', kind === 'opening' ? 'general' : 'cabinetry', 'fixture', kind === 'opening' ? 'IfcVirtualElement' : 'IfcFurniture', sizeMm, centreMm, 'absent', {
      takeoff: { include: false, note: 'envelope/clearance reference only; not a purchase quantity or fit proof' },
      description,
      citationIds,
    });
  parts.push(
    fixtureBox(
      'part.fixture.fridge-bay',
      'Refrigerator clear bay (37 in)',
      'clearance',
      [iE('37'), 20, 20],
      [iE('3.25') + iE('37') / 2, 10, 10],
      '37-in clear finished bay for the refrigerator, at the left end beside the 3 1/4-in left space. Width sourced; depth/height not modelled and the operating fit is unresolved.',
      [cite.json.fridgeBay, cite.card.p03('chain', '3 1/4 + 37 + 3/4 chain'), cite.card.p27('steps', 'Fridge bay and operating checks')],
      'opening',
    ),
    fixtureBox(
      'part.fixture.divider',
      'Refrigerator/base-cabinet divider (3/4 in)',
      'installed',
      [iE('0.75'), 20, 20],
      [iE('40.25') + iE('0.75') / 2, 10, 10],
      'Separator panel between the refrigerator and the base cabinet group; 3/4-in design choice with final scribe field-fit. Depth/elevation follow the accepted cabinet fit.',
      [cite.json.divider, cite.card.p03('chain', 'Divider in the 41-in segment')],
    ),
    fixtureBox(
      'part.fixture.base-row',
      'Base cabinet row B1+F1+B2+F2+B3 (108 in envelope; individual widths unknown)',
      'installed',
      [iE('108'), 20, 20],
      [iE('41') + iE('108') / 2, 10, 10],
      'Base cabinet row envelope: B1+B2+B3 measured together at 106 1/2 in plus two 3/4-in fillers = the 108-in installed row, ending at the W2 pantry face. B1 is the nominal 12-in one-drawer-over-one-door base directly beside the refrigerator; B2/B3 are larger three-drawer fronts. Individual measured widths are null and the seams are schematic; no cut or mounting location is authoritative. Height, depth, toe-kick and scribe are field-verified.',
      [cite.json.boxesCombined, cite.json.baseOrder, cite.json.boxConstraint, cite.card.p03('boxes', 'Individual widths unknown'), cite.card.p27('fronts', 'B1/B2/B3 fronts and dry fit')],
    ),
    fixtureBox(
      'part.fixture.fillers',
      'Between-box fillers F1 and F2 (3/4 in each)',
      'installed',
      [iE('1.5'), 20, 20],
      [iE('41') + iE('108') / 2, 10, 10],
      'Two 3/4-in fillers (F1 between B1 and B2, F2 between B2 and B3), user-selected design choice with final scribe field-fit. Positions between the unmeasured individual boxes are schematic and not modelled.',
      [cite.json.fillers, cite.card.p03('fillers', 'F1/F2 3/4 in each')],
    ),
    fixtureBox(
      'part.fixture.fridge',
      'Refrigerator GE GSE25GYPHCFS (project label; family-source dimensions)',
      'installed',
      [20, 20, 20],
      [iE('3.25') + iE('37') / 2, iE('2'), 10],
      'Project refrigerator label GE GSE25GYPHCFS (side-by-side, 37-in clear bay). Reference marker only: the project label is distinct from the generic GE family data source, and physical size, door swing, bin removal, walking access and service removal are unresolved. 3.25-in left allowance vs the family note\'s about 14.25-in freezer-bin removal requirement; 26.75-in nominal closed-front clearance and 11-in nominal 90-degree condition are depth-subtraction nomials, not fit proof.',
      [cite.json.fridgeAccess, cite.json.fridgeClosed, cite.json.fridgeDoor90, cite.json.aisleNote, cite.card.p03('operating-fit', 'Operating-fit warnings'), cite.card.p27('steps', 'Set the GE in its clear bay and test')],
    ),
    fixtureBox(
      'part.fixture.counter',
      'Butcher-block counter (108 in, intended 36-in top)',
      'installed',
      [iE('108'), 20, 20],
      [iE('41') + iE('108') / 2, 10, iE('36') - 10],
      'Butcher-block counter over the base row: intended 36-in top elevation only after base heights and top thickness are measured; thickness and depth are field-measured. 26-in planned clear distance to the U1/U2 bottoms at 62 in.',
      [cite.card.p27('steps', 'Counter at 36-in top; 26-in clear to U1/U2')],
    ),
    fixtureBox('part.fixture.upper-u1', 'Upper cabinet U1 (36 x 34)', 'installed', [iE('36'), 20, iE('34')], [iE('41') + iE('36') / 2, 10, iE('62') + iE('34') / 2], 'Upper cabinet U1, 36 in wide x 34 in high at the reported 62-in bottom elevation (conditional design value). Mounting rails/holes and the load path are held.', [cite.card.p27('steps', 'U1/U2 36x34 at 62 in')]),
    fixtureBox('part.fixture.upper-u2', 'Upper cabinet U2 (36 x 34)', 'installed', [iE('36'), 20, iE('34')], [iE('113') + iE('36') / 2, 10, iE('62') + iE('34') / 2], 'Upper cabinet U2, 36 in wide x 34 in high, on the same intended 62-in bottom elevation. Mounting rails/holes and the load path are held.', [cite.card.p27('steps', 'U1/U2 36x34 at 62 in')]),
    fixtureBox(
      'part.fixture.upper-u3',
      'Over-fridge upper cabinet U3 (36 x 24)',
      'installed',
      [iE('36'), 20, iE('24')],
      [iE('3.25') + iE('37') / 2, 10, iE('71.25') + iE('24') / 2],
      'Over-fridge upper cabinet U3, 36 in wide x 24 in high. Elevation shown from the 71 1/4-in lower edge of the provisional U3 backing band; the real rail elevation and mounting plane are field-fit, and the backing band is not a load release.',
      [cite.card.p27('steps', 'U3 over-fridge 36x24'), cite.json.backingBands, cite.json.backingBandStatus],
    ),
    fixtureBox('part.fixture.shelves', 'Three butcher-block shelves (36 in, bracket concept)', 'installed', [iE('36'), 20, 20], [iE('77') + iE('36') / 2, 10, 10], 'Three 36-in butcher-block shelves on visible heavy-duty brackets fixed into verified full studs with their own hardware; shelf elevations, depths and bracket loads are not modelled and remain field-set after load-path review.', [cite.card.p27('steps', 'Three 36-in shelves into full studs'), cite.json.backingShelves]),
    fixtureBox('part.clearance.fridge-closed', 'Nominal closed-front clearance volume (26.75 in)', 'clearance', [iE('37'), iE('26.75'), 20], [iE('3.25') + iE('37') / 2, iE('63.5') - iE('26.75') / 2, 10], 'Nominal closed-refrigerator-front-to-opposite-wall clearance from a simple depth subtraction with GE family dimensions and a 2-in rear gap. Not door-sweep proof.', [cite.json.fridgeClosed, cite.json.aisleNote], 'opening'),
    fixtureBox('part.clearance.fridge-door90', 'Nominal 90-degree door condition volume (11 in)', 'clearance', [iE('37'), iE('11'), 20], [iE('3.25') + iE('37') / 2, iE('63.5') - iE('11') / 2, 10], 'Nominal 11-in condition at the stated 90-degree door projection; a nominal reference only, never a confirmed service clearance.', [cite.json.fridgeDoor90, cite.json.aisleNote], 'opening'),
    fixtureBox('part.clearance.aisle-note', 'Aisle depth-subtraction note reference', 'clearance', [iE('37'), 20, 20], [iE('3.25') + iE('37') / 2, 10, 10], 'Reference marker for the aisle note: a simple depth subtraction with GE family dimensions and a 2-in rear gap, not door-sweep proof. Full-size operating and service checks are required.', [cite.json.aisleNote, cite.card.p03('operating-fit', 'Neither proves actual swing')], 'opening'),
  );

  // ---- measurements ------------------------------------------------------------------------------
  const measurements = [];
  const addM = (id, label, display, value, unit, evidence, release, citationIds, extra = {}) => {
    const parsed = parseLengthToMm(String(value), unit);
    measurements.push({
      id,
      label,
      original: { display, value: String(value), unit },
      canonicalMm: parsed.exact,
      installationToleranceMm: null,
      evidenceStatus: evidence,
      declaredReleaseStatus: release,
      citationIds,
      ...extra,
    });
  };

  addM('measurement.w1.finished-inside', 'W1 finished inside width', '149 in', '149', 'in', 'reported', 'conditional', [cite.json.w1Inside, cite.card.p02('inside', '149-in inside run'), cite.card.p04('steps', 'Survey taped faces')], {
    derivedFromMeasurementIds: [],
  });
  addM('measurement.w1.finished-thickness-candidate', 'W1 finished thickness candidate', '4 1/2 in (2x4 + 1/2 in board each face)', '4.5', 'in', 'candidate', 'conditional', [cite.json.w1Thickness, cite.card.p02('clear', '4 1/2-in thickness in the clear-depth row')]);
  addM('measurement.w1.outside-depth-trial', 'W1 outside finished face depth trial from the existing finished EX1 wall', 'about 68 in trial (2 in less than the superseded 70-in basis)', '68', 'in', 'candidate', 'conditional', [cite.json.w1Trial, cite.card.p02('outside', '68-in trial row'), jsonCite('/measurements/2/value', 'Superseded 70-in depth basis (to recheck)', p('/measurements/2/value'))]);
  addM('measurement.w1.move-from-old-70', 'W1 movement from the superseded 70-in basis', '2 in less than the old 70-in line', '-2', 'in', 'derived', 'conditional', [cite.json.w1Move, cite.json.w1Trial], { derivedFromMeasurementIds: ['measurement.w1.outside-depth-trial'] });
  addM('measurement.w1.clear-depth-derived', 'Derived clear pantry depth', 'about 63 1/2 in', '63.5', 'in', 'derived', 'conditional', [cite.json.clearDepth, cite.card.p02('clear', '63 1/2-in clear depth')], { derivedFromMeasurementIds: ['measurement.w1.outside-depth-trial', 'measurement.w1.finished-thickness-candidate'] });
  addM('measurement.w2.finished-thickness', 'W2 finished return thickness', '8 3/8 in', '8.375', 'in', 'reported', 'conditional', [cite.json.w2Thickness, cite.card.p11('chain', 'W2 8 3/8-in thickness'), cite.svg('r31-truss', { x: 1150, y: 640, width: 150, height: 32 }, 'w2-8-3-8-finished', 'text "8⅜″ finished" near the W2 callout')]);
  addM('measurement.w2.core-thickness', 'W2 actual dry 2x8 core thickness', '7 1/4 in actual dry 2x8 core', '7.25', 'in', 'document_verified', 'conditional', [cite.json.w2Section, cite.card.p11('chain', '7 1/4-in core in the layer chain')]);
  addM('measurement.w2.pantry-board', 'W2 pantry-side board (1/2 in gypsum)', '1/2 in', '0.5', 'in', 'document_verified', 'conditional', [cite.json.w2Section, cite.card.p11('chain', '1/2-in pantry board')]);
  addM('measurement.w2.room-board', 'W2 room-side board (5/8 in gypsum)', '5/8 in', '0.625', 'in', 'document_verified', 'conditional', [cite.json.w2Section, cite.card.p11('chain', '5/8-in room board')]);
  addM('measurement.w2.section-sum', 'W2 finished thickness chain sum', '1/2 + 7 1/4 + 5/8 = 8 3/8 in', '8.375', 'in', 'derived', 'conditional', [cite.json.w2Thickness, cite.card.p11('chain', 'Layer chain sums to 8 3/8 in')], { derivedFromMeasurementIds: ['measurement.w2.pantry-board', 'measurement.w2.core-thickness', 'measurement.w2.room-board'] });
  addM('measurement.w2.plate-53', 'W2 candidate plate comparison at the A3 11-in projection', '53 in', '53', 'in', 'derived', 'conditional', [cite.json.w2Plate53, cite.card.p11('projection', '53-in comparison'), cite.svg('r31-truss', { x: 205, y: 762, width: 900, height: 28 }, 'w2-plate-53', 'text "with A3\'s 11″ it is 53″"')]);
  addM('measurement.w2.plate-53.125', 'W2 candidate plate comparison at the reported 10 7/8-in projection', '53 1/8 in', '53.125', 'in', 'derived', 'conditional', [cite.json.w2Plate53125, cite.card.p11('projection', '53 1/8-in comparison'), cite.svg('r34-corners', { x: 100, y: 528, width: 900, height: 28 }, 'w2-plate-53-125', 'text "candidate plate length C + ½ = 53⅛"')]);
  addM('measurement.w1.plate-156.75', 'W1 candidate plate comparison (through-corner model)', '156 3/4 in', '156.75', 'in', 'derived', 'conditional', [cite.json.w1Plate15675, cite.card.p08('arithmetic', '149 + 1/2 + 7 1/4 = 156 3/4'), cite.svg('r34-wood-junction', { x: 100, y: 388, width: 900, height: 28 }, 'w1-frame-156-75', 'text "W1 frame x = 0 → 156¾"')]);
  addM('measurement.w1.outside-plane-157.375', 'W1 outside finished-plane comparison to the W2 outer face', '157 3/8 in', '157.375', 'in', 'derived', 'conditional', [cite.json.outward157375, cite.card.p22('w1r', 'W1 room face 157 3/8-in board width'), cite.svg('r34-corners', { x: 55, y: 1370, width: 900, height: 28 }, 'w1-r-terminus', 'text "W1-R terminates x = 157⅜"')]);

  src.w1StudCentersIn.forEach((value, index) => {
    const n = String(index + 1).padStart(2, '0');
    const csvRow = csvs.parts.find((row) => row.id === `W1-S${n}`);
    addM(
      `measurement.w1.stud-s${n}.centre`,
      `W1 candidate stud S${n} centre from the left plate end`,
      `${value} in`,
      value,
      'in',
      'candidate',
      'conditional',
      [jsonCite(`/backing/candidate_W1_stud_centers_from_left_plate_end_in/${index}`, `W1 stud S${n} candidate centre`, value), cite.csv('parts', csvRow.row, csvRow.id, `W1 stud ${csvRow.id} candidate centre`, 'candidate_center_in'), cite.card.p08('centres', 'W1 candidate centre list')],
    );
  });
  src.w2FaceStudsIn.forEach((value, index) => {
    const n = String(index + 1).padStart(2, '0');
    const csvRow = csvs.parts.find((row) => row.id === `W2-S${n}`);
    addM(
      `measurement.w2.stud-s${n}.centre`,
      `W2 candidate stud S${n} centre from the W1 pantry finished face`,
      `${value} in`,
      value,
      'in',
      'candidate',
      'conditional',
      [jsonCite(`/drywall/panel_layout/faces/2/studs/${index}`, `W2 face-map candidate stud centre S${n}`, value), cite.csv('parts', csvRow.row, csvRow.id, `W2 stud ${csvRow.id} CSV centre${csvRow.candidate_center_in === '' ? ' (blank; field-fit)' : ''}`, 'candidate_center_in')],
      { conflictNote: undefined },
    );
  });
  // Remove undefined conflictNote keys deterministically.
  for (const measurement of measurements) {
    if (measurement.conflictNote === undefined) delete measurement.conflictNote;
    if (Array.isArray(measurement.derivedFromMeasurementIds) && measurement.derivedFromMeasurementIds.length === 0) delete measurement.derivedFromMeasurementIds;
  }

  addM('measurement.ceiling.reported', 'Reported finished ceiling height (user report)', '111 in reported, floor to ceiling', '111', 'in', 'reported', 'not_applicable', [cite.json.ceiling, cite.card.p04('no-cut', 'Do not turn the reported 111-in ceiling into a stud cut'), cite.svg('r31-backing', { x: 190, y: 188, width: 130, height: 30 }, 'reported-ceiling-111', 'z-axis label "111″" above finished tile')], {
    conflictNote: 'User report, not field-verified. Declared not_applicable for cutting: member heights are field-fit and no cut may derive from this value.',
  });
  addM('measurement.cabinets.combined', 'B1+B2+B3 base boxes measured together', '106 1/2 in measured together; individual widths unknown', '106.5', 'in', 'reported', 'conditional', [cite.json.boxesCombined, cite.card.p03('boxes', 'Individual widths unknown'), cite.card.p27('steps', 'Check total 106 1/2-in box width')], {
    conflictNote: 'Combined width only. Nominal 12/48/48 labels are not measured widths; no individual cut or mounting location is authoritative.',
  });
  addM('measurement.cabinets.filler-f1', 'Between-box filler F1', '3/4 in', '0.75', 'in', 'reported', 'conditional', [jsonCite('/fixtures/base_fillers_between_boxes/0', 'Filler F1 selected width', 0.75), cite.card.p03('fillers', 'F1/F2 3/4 each')]);
  addM('measurement.cabinets.filler-f2', 'Between-box filler F2', '3/4 in', '0.75', 'in', 'reported', 'conditional', [jsonCite('/fixtures/base_fillers_between_boxes/1', 'Filler F2 selected width', 0.75), cite.card.p03('fillers', 'F1/F2 3/4 each')]);
  addM('measurement.cabinets.divider', 'Refrigerator/base-cabinet divider', '3/4 in', '0.75', 'in', 'reported', 'conditional', [cite.json.divider, cite.card.p03('chain', 'Divider in the 3 1/4 + 37 + 3/4 chain row')]);
  addM('measurement.cabinets.left-space', 'Left-end wall-side allowance', '3 1/4 in', '3.25', 'in', 'reported', 'conditional', [cite.json.leftSpace, cite.card.p03('chain', '3 1/4-in left space'), cite.card.p03('operating-fit', '3 1/4-in allowance vs the family bin note')]);
  addM('measurement.cabinets.base-row', 'Base cabinet installed row (boxes plus fillers)', '108 in', '108', 'in', 'derived', 'conditional', [cite.json.baseRow, cite.card.p27('steps', '108-in row')], { derivedFromMeasurementIds: ['measurement.cabinets.combined', 'measurement.cabinets.filler-f1', 'measurement.cabinets.filler-f2'] });
  addM('measurement.fridge.clear-bay', 'Refrigerator clear finished bay', '37 in', '37', 'in', 'reported', 'conditional', [cite.json.fridgeBay, cite.card.p27('steps', '37-in clear bay'), cite.svg('r33-cabinet-elevation', { x: 330, y: 815, width: 110, height: 36 }, 'fridge-bay-37', 'text "37″ bay"')]);
  addM('measurement.fridge.bin-removal-required', 'GE family freezer-bin removal requirement (family-source note)', 'about 14 1/4 in at the freezer-side wall', '14.25', 'in', 'reported', 'conditional', [cite.card.p03('operating-fit', 'About 14 1/4-in bin-removal note'), cite.json.fridgeAccess], {
    conflictNote: 'Family-source requirement (about 14 1/4 in) versus the planned 3 1/4-in left-end allowance; physical bin removal is unverified. Not a confirmed service clearance.',
  });
  addM('measurement.fridge.closed-front-clearance', 'Nominal closed-front clearance to the opposite wall', 'about 26 3/4 in nominal', '26.75', 'in', 'candidate', 'conditional', [cite.json.fridgeClosed, cite.card.p03('operating-fit', '26 3/4-in nominal closed condition'), cite.svg('r33-cabinet-elevation', { x: 1420, y: 495, width: 180, height: 50 }, 'counter-to-upper-26', 'text "26″ counter to upper bottoms"')], {
    conflictNote: 'Depth subtraction with GE family dimensions and a 2-in rear gap; not door-sweep proof.',
  });
  addM('measurement.fridge.door90-clearance', 'Nominal 90-degree door condition', 'about 11 in at the stated 90-degree projection', '11', 'in', 'candidate', 'conditional', [cite.json.fridgeDoor90, cite.card.p03('operating-fit', '11-in stated 90-degree condition')], { conflictNote: 'Nominal only; neither the closed nor the 90-degree figure proves actual swing or service access.' });
  addM('measurement.fridge.rear-gap', 'Assumed rear gap behind the refrigerator', '2 in rear gap (aisle note)', '2', 'in', 'reported', 'conditional', [cite.json.aisleNote, cite.card.p03('operating-fit', '2-in rear space in the depth subtraction')]);
  addM('measurement.column.projection', 'Existing column projection (reported)', '10 7/8 in', '10.875', 'in', 'reported', 'conditional', [cite.json.columnProjection, cite.card.p11('projection', 'Reported 10 7/8-in projection'), cite.svg('r34-corners', { x: 100, y: 490, width: 900, height: 28 }, 'column-front-plane', 'text "Column-front plane C = 63½ − 10⅞ = 52⅝"')]);
  addM('measurement.column.width', 'Existing column finished width (reported)', '8 3/8 in', '8.375', 'in', 'reported', 'conditional', [cite.json.columnWidth, cite.svg('r33-cabinet-elevation', { x: 1385, y: 240, width: 110, height: 50 }, 'w2-8-3-8', 'text "W2 8⅜″" at the column end')]);
  addM('measurement.closet.inside-width', 'Existing closet inside width (survey reference)', '37 in', '37', 'in', 'reported', 'conditional', [cite.card.p04('steps', 'Establish the closet 37-in inside width'), cite.card.p20('scope', '37-in-wide closet back wall'), cite.json.trimRetained], {
    conflictNote: 'Survey/reference fact only; it does not define the EX1 rough opening width.',
  });
  addM('measurement.closet.depth', 'Existing closet depth (survey reference)', '23 in', '23', 'in', 'reported', 'conditional', [cite.card.p04('steps', 'Establish the closet 23-in depth'), cite.card.p20('scope', '23-in-deep closet'), cite.json.trimRetained], {
    conflictNote: 'Survey/reference fact only; it does not define the EX1 rough opening or header.',
  });
  addM('measurement.ex1.finished-clear-width-min', 'EX1 minimum finished-clear width requirement', 'at least 37 in finished clear', '37', 'in', 'reported', 'held', [cite.pvt('source.r35.owner-ex1-requirement', 'minimum-37-in-finished-clear', 'Owner instruction: EX1 must provide at least 37 in finished clear; no rough-opening allowance, height or cut boundary was supplied.')], {
    conflictNote: 'Owner requirement only. Actual finished width, finish/jamb buildup, rough opening, height, offsets and framing remain UNKNOWN / NOT APPROVED.',
  });
  addM('measurement.ex1.plan-column-to-closet-span', 'EX1 plan-derived column-to-closet framing span', '30 1/8 in before finishes (original-plan arithmetic)', '30.125', 'in', 'derived', 'held', [cite.permit(3, { x: 20, y: 40, width: 570, height: 700 }, 'a3-ex1-column-obstruction-chain', 'A3 written dimensions: closet left framing face 76 7/8 in; closet right framing face 114 7/8 in derived from 76 7/8 + 41 1/2 - 3 1/2; column face 84 3/4 in derived from 10 + 54 + 13 3/4 + 7; difference 30 1/8 in before finishes. Original-design reference only, not a field-approved opening coordinate.')], {
    conflictNote: 'Original-plan arithmetic, before finishes. It is not a measured clear opening and cannot locate demolition or establish the current column/wall condition.',
  });
  addM('measurement.ex1.plan-shortfall-before-finishes', 'EX1 minimum geometric shortfall before finish allowance', 'at least 6 7/8 in beyond the 30 1/8-in plan span to reach 37 in', '6.875', 'in', 'derived', 'held', [cite.pvt('source.r35.owner-ex1-requirement', 'extend-toward-refrigerator-side', 'Owner requested that the held EX1 preview extend farther toward the refrigerator side.'), cite.permit(3, { x: 20, y: 40, width: 570, height: 700 }, 'a3-ex1-minimum-shortfall', '37 in owner minimum minus the 30 1/8-in original-plan column-to-closet framing span = 6 7/8 in, before any finish/jamb or rough-opening allowance.')], {
    derivedFromMeasurementIds: ['measurement.ex1.finished-clear-width-min', 'measurement.ex1.plan-column-to-closet-span'],
    conflictNote: 'Minimum geometric difference only. The actual extension must be greater once the approved finish/jamb build-up is known; it is not a cut or rough-opening dimension.',
  });
  addM('measurement.truss.center-trial', 'A7 candidate truss centre from the existing finished face', 'about 65 7/8 in (schematic)', '65.86', 'in', 'candidate', 'conditional', [cite.json.trussCenter, cite.card.p02('truss', 'Candidate truss centre ~65 7/8 in'), cite.svg('r31-truss', { x: 205, y: 845, width: 900, height: 28 }, 'truss-centre-65-875', 'text "truss center ≈ 65⅞″"')], {
    conflictNote: 'Drawing comparison only; the roof truss is not as-built verified and no attachment is released.',
  });
  addM('measurement.truss.plate-centre-65.75', 'Candidate W1 top-plate centre on the 68-in trial', 'about 65 3/4 in', '65.75', 'in', 'candidate', 'conditional', [cite.json.trussPlate, cite.card.p02('truss', 'Top-plate centre ~65 3/4 in'), cite.svg('r31-truss', { x: 205, y: 845, width: 900, height: 28 }, 'plate-centre-65-75', 'same scale-check text')]);
  addM('measurement.backing.net-length', 'Backing net cut length', '20 x 14 1/2 + 2 x 13 3/4 + 3 x 3 1/4 = 327 1/4 in net', '327.25', 'in', 'derived', 'conditional', [cite.json.backingNet, cite.json.backingMix, cite.card.p18('mix', 'Nominal mix 327 1/4 in net')], { derivedFromMeasurementIds: [] });
  const bandKeys = [
    ['TOP', 'measurement.backing.band-top', 'Provisional TOP band above finished tile'],
    ['U3LOW', 'measurement.backing.band-u3low', 'Provisional U3 lower-rail band'],
    ['U1LOW', 'measurement.backing.band-u1low', 'Provisional U1 lower-rail band'],
    ['U2LOW', 'measurement.backing.band-u2low', 'Provisional U2 lower-rail band'],
    ['BASE', 'measurement.backing.band-base', 'Provisional base-cabinet band'],
  ];
  for (const [key, idBase, label] of bandKeys) {
    const band = src.bands[key];
    addM(`${idBase}.low`, `${label} — lower elevation`, `${band[0]} in above finished tile`, String(band[0]), 'in', 'candidate', 'conditional', [jsonCite(`/backing/bands_above_finished_tile_in/${key}/0`, `${label} lower edge`, band[0]), cite.json.backingBandStatus, cite.svg('r31-backing', { x: 65, y: 1065, width: 900, height: 28 }, 'bands-above-finished-tile', 'text "Bands above finished tile: TOP 91¼–96¾″ …"')], {
      conflictNote: 'Provisional zone only; set from actual cabinet mounting-rail/hole locations and not a release.',
    });
    addM(`${idBase}.high`, `${label} — upper elevation`, `${band[1]} in above finished tile`, String(band[1]), 'in', 'candidate', 'conditional', [jsonCite(`/backing/bands_above_finished_tile_in/${key}/1`, `${label} upper edge`, band[1]), cite.json.backingBandStatus]);
  }
  addM('measurement.backing.block-face', 'Flat 2x6 block vertical face', '5 1/2 in vertical face', '5.5', 'in', 'document_verified', 'conditional', [cite.json.backingSection, cite.json.backingOrientation, cite.card.p18('scope', '25 flat 2x6 pieces')]);
  addM('measurement.backing.block-depth', 'Flat 2x6 block cavity depth', '1 1/2 in into the 3.5-in cavity', '1.5', 'in', 'document_verified', 'conditional', [cite.json.backingOrientation, cite.card.p19('flat', '5 1/2-in face, 1 1/2-in depth'), cite.card.p19('space', '1 7/16-in leg fits the 2-in space behind the block')]);
  addM('measurement.connector.bend', 'Candidate A34/A34Z bend length', '2 1/2 in along bend', '2.5', 'in', 'manufacturer_verified', 'conditional', [cite.card.p10('candidate', 'Angle 2 1/2 in along bend'), cite.esr('fig5', 'Figure 5 A34/A35 shapes'), cite.json.connections]);
  addM('measurement.connector.leg', 'Candidate A34/A34Z leg length', '1 7/16 in each leg', '1.4375', 'in', 'manufacturer_verified', 'conditional', [cite.card.p10('candidate', 'Each leg 1 7/16 in'), cite.esr('fig5', 'Figure 5 A34/A35 shapes')]);
  addM('measurement.connector.screw-length', 'Candidate SD Connector screw length', '1 1/2 in (#9 x 1 1/2 in SD Connector screw)', '1.5', 'in', 'manufacturer_verified', 'conditional', [cite.card.p10('candidate', 'Fastener: SD9112, #9 x 1 1/2 in'), cite.card.p14('spec', 'SD9112 #9 x 1 1/2 in'), cite.esr('table', 'A34 table excerpt')], {
    conflictNote: 'Screw identity only. The installed project quantity, angle count, orientation and capacity are held; no total is derived.',
  });
  addM('measurement.drywall.w1p-width', 'W1 pantry face candidate board width', '149 1/2 in', '149.5', 'in', 'derived', 'conditional', [cite.card.p22('w1p', 'W1-P board width 149 1/2 in'), cite.svg('r34-drywall-layout', { x: 80, y: 282, width: 900, height: 26 }, 'w1p-board-width', 'text "Board width 149½ in"')]);
  addM('measurement.drywall.w1r-width', 'W1 room face candidate board width', '157 3/8 in', '157.375', 'in', 'derived', 'conditional', [cite.card.p22('w1r', 'W1-R board width 157 3/8 in'), cite.svg('r34-drywall-layout', { x: 80, y: 637, width: 900, height: 26 }, 'w1r-board-width', 'text "Board width 157⅜ in"')]);
  addM('measurement.drywall.w2p-width', 'W2 pantry face candidate board width', '52 5/8 in', '52.625', 'in', 'derived', 'conditional', [cite.card.p22('w2p', 'W2-P board width 52 5/8 in'), cite.svg('r34-drywall-layout', { x: 80, y: 991, width: 900, height: 26 }, 'w2p-board-width', 'text "Board width 52⅝ in"')]);
  addM('measurement.drywall.w2r-width', 'W2 room face candidate board width', '56 5/8 in', '56.625', 'in', 'derived', 'conditional', [cite.card.p22('w2r', 'W2-R board width 56 5/8 in'), cite.svg('r34-drywall-layout', { x: 665, y: 991, width: 500, height: 26 }, 'w2r-board-width', 'text "Board width 56⅝ in"'), jsonCite('/drywall/panel_layout/coordinates/W2_local_q', 'W2 local q = y + 1/2 convention', 'y+1/2')]);
  addM('measurement.drywall.seam-w2r', 'W2 room face candidate seam at the second panel joint', '15 1/2 in (parsed from "31/2" as a division, never 3 1/2)', '15.5', 'in', 'derived', 'conditional', [jsonCite('/drywall/panel_layout/faces/3/seams/0', 'W2-R seam value', 15.5), cite.csv('panels', 11, 'W2-R-01', 'W2-R-01 ends at 15 1/2 in', 'end_in'), cite.csv('panels', 12, 'W2-R-02', 'W2-R-02 starts at 15 1/2 in', 'start_in'), cite.card.p22('w2r', 'W2-R panel map')], {
    conflictNote: 'SRC-R35-01 parsing regression check: 31/2 = 15 1/2, with -4 + 19 1/2 = 15 1/2 and 52 5/8 - 15 1/2 = 37 1/8. The CSV rows W2-R-01/02 agree; no source-data correction is authorized or needed.',
  });
  addM('measurement.drywall.w2r-01-length', 'W2-R-01 panel length', '19 1/2 in', '19.5', 'in', 'derived', 'conditional', [cite.csv('panels', 11, 'W2-R-01', 'W2-R-01 candidate width', 'candidate_width_in'), jsonCite('/drywall/panel_layout/faces/3/panels/0/width', 'W2-R-01 width', '39/2')]);
  addM('measurement.drywall.w2r-02-length', 'W2-R-02 panel length', '37 1/8 in', '37.125', 'in', 'derived', 'conditional', [cite.csv('panels', 12, 'W2-R-02', 'W2-R-02 candidate width', 'candidate_width_in'), jsonCite('/drywall/panel_layout/faces/3/panels/1/width', 'W2-R-02 width', '297/8')], {
    conflictNote: '52 5/8 - 15 1/2 = 37 1/8; matches the CSV row.',
  });
  addM('measurement.practice.board-length', 'Practice board length', '10 ft (120 in)', '120', 'in', 'document_verified', 'ready', [cite.card.p13('yield', 'Separate dry 2x4x10 practice board'), cite.csv('materials', 8, 'L-PRACTICE', 'Practice board planning row', 'planning_net')]);
  addM('measurement.practice.plate-length', 'Practice mock-frame plate length', '24 in', '24', 'in', 'document_verified', 'ready', [cite.card.p13('yield', 'Two 24-in plates')]);
  addM('measurement.practice.stud-length', 'Practice mock-frame stud length', '21 in', '21', 'in', 'document_verified', 'ready', [cite.card.p13('yield', 'Three 21-in studs')]);
  addM('measurement.practice.yield-net', 'Practice net cut length from the practice board', '2 x 24 + 3 x 21 = 111 in, with kerf/waste checked against 120 in', '111', 'in', 'derived', 'ready', [cite.card.p13('yield', 'Practice yield and mock rectangle'), cite.json.framingConcept], {
    conflictNote: 'Loose-stock only. It never counts as house framing and never enters the installed takeoff.',
  });
  addM('measurement.counter.top-elevation', 'Intended counter top elevation', '36 in (after base heights and top thickness are measured)', '36', 'in', 'reported', 'conditional', [cite.card.p27('steps', 'Counter at the intended 36-in top elevation')]);
  addM('measurement.upper.bottom-elevation', 'Intended U1/U2 bottom elevation', '62 in (planned clear distance basis)', '62', 'in', 'reported', 'conditional', [cite.card.p27('steps', 'U1/U2 bottoms at 62 in')]);
  addM('measurement.counter-upper.clearance', 'Planned counter-to-upper-bottom distance', '26 in', '26', 'in', 'derived', 'conditional', [cite.card.p27('steps', '26-in clear distance'), cite.svg('r33-cabinet-elevation', { x: 1420, y: 495, width: 180, height: 50 }, 'counter-upper-26', 'text "26″ counter to upper bottoms"')], { derivedFromMeasurementIds: ['measurement.counter.top-elevation', 'measurement.upper.bottom-elevation'] });
  addM('measurement.upper.u1u2-height', 'Upper cabinets U1/U2 height', '34 in', '34', 'in', 'reported', 'conditional', [cite.card.p27('steps', 'U1/U2 36x34')]);
  addM('measurement.upper.u3-height', 'Over-fridge upper cabinet U3 height', '24 in', '24', 'in', 'reported', 'conditional', [cite.card.p27('steps', 'U3 over-fridge 36x24')]);
  addM('measurement.upper.width', 'Upper cabinet width (U1/U2/U3)', '36 in', '36', 'in', 'reported', 'conditional', [cite.card.p27('steps', '36-in upper widths'), cite.svg('r33-cabinet-elevation', { x: 630, y: 350, width: 320, height: 30 }, 'u1-36x34', 'text "U1 · 36″ × 34″"')]);
  addM('measurement.shelves.length', 'Butcher-block shelf length (three shelves)', '36 in each, three shelves', '36', 'in', 'reported', 'conditional', [cite.card.p27('steps', 'Three 36-in butcher-block shelves'), cite.svg('r33-cabinet-elevation', { x: 920, y: 532, width: 400, height: 30 }, 'three-shelves-36', 'text "3 × 36″ butcher-block shelves"'), cite.json.backingShelves]);

  // ---- materials (only rows with a released planning quantity) -----------------------------------
  const materials = [];
  const materialRows = new Map();
  const materialSpecs = {
    'L-W1-S': { id: 'material.lumber.w1-stud', name: 'Dry 2x4x10 studs (W1, candidate)', category: 'lumber', unit: 'board', sizeLabel: '2x4x10', notes: 'Candidate net 12 with 1 candidate spare. Heights and connections are held; the spare is a planning allowance only and is never installed.' },
    'L-W2-S': { id: 'material.lumber.w2-stud', name: 'Dry 2x8x10 studs (W2, candidate)', category: 'lumber', unit: 'board', sizeLabel: '2x8x10', notes: 'Candidate net 5 with 1 candidate spare. W2 member/connection detail is held; the spare is never installed.' },
    'L-W1-TP': { id: 'material.lumber.w1-top-plate', name: 'Dry 2x4x16 top plate (W1, candidate)', category: 'lumber', unit: 'board', sizeLabel: '2x4x16', notes: 'Candidate net 1. Conditional 156.75-in plate comparison; no cut released.' },
    'L-W1-BP': { id: 'material.lumber.w1-bottom-plate', name: 'Treated 2x4x16 bottom plate (W1, candidate)', category: 'lumber', unit: 'board', sizeLabel: '2x4x16', notes: 'Candidate net 1. Treatment, bearing and anchor detail held; no cut released.' },
    'L-W2-TP': { id: 'material.lumber.w2-top-plate', name: 'Dry 2x8x8 top plate (W2, candidate)', category: 'lumber', unit: 'board', sizeLabel: '2x8x8', notes: 'Candidate net 1. Conditional 53-53.125-in plate comparison; no cut released.' },
    'L-W2-BP': { id: 'material.lumber.w2-bottom-plate', name: 'Treated 2x8x8 bottom plate (W2, candidate)', category: 'lumber', unit: 'board', sizeLabel: '2x8x8', notes: 'Candidate net 1. Treatment, bearing and anchor detail held; no cut released.' },
    'L-BACK': { id: 'material.lumber.backing', name: 'Dry 2x6x8 backing boards (flat blocks)', category: 'lumber', unit: 'board', sizeLabel: '2x6x8', notes: '4 boards pack on paper for the 25 field-fit blocks (net 327.25 in) plus 1 field-fit/defect allowance. Actual rail locations and fasteners held; the allowance is never installed as a member by this guide.' },
    'L-PRACTICE': { id: 'material.lumber.practice', name: 'Dry 2x4x10 board for the loose practice frame', category: 'lumber', unit: 'board', sizeLabel: '2x4x10', notes: 'Separate loose-stock practice only: two 24-in plates and three 21-in studs (net 111 in of cuts); never house framing and never in the installed takeoff.' },
    'G-1/2': { id: 'material.gypsum.half', name: '1/2-in gypsum 4x10 (W1 both faces and W2 pantry face)', category: 'panel', unit: 'sheet', sizeLabel: '1/2 in 4x10', notes: '8 core sheets in the R34-specific conditional H01-H08 nest plus 1 optional spare (never installed; 12 total before EX1 patches only if the spare is taken). EX1 patches stay out of the fixed nest; field heights, edge receivers and product are held.' },
    'G-5/8': { id: 'material.gypsum.five-eighth', name: '5/8-in gypsum 4x10 (W2 room face)', category: 'panel', unit: 'sheet', sizeLabel: '5/8 in 4x10', notes: '2 core sheets in the R34-specific conditional E01-E02 nest plus 1 optional spare (never installed). Field heights, edge receivers, EX1 patches and product are held.' },
  };
  for (const row of csvs.materials) {
    const spec = materialSpecs[row.id];
    if (!spec) continue; // excluded rows are recorded in work/r35/reconciliation.json
    const quantity = Number(String(row.planning_net).replace(/[^0-9.]/g, ''));
    const spare = /^\d+$/.test(String(row.planning_spare).trim()) ? Number(row.planning_spare) : String(row.planning_spare).includes('optional') ? 1 : null;
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Material ${row.id} has no released quantity`);
    materialRows.set(row.id, row.row);
    materials.push({
      id: spec.id,
      name: spec.name,
      category: spec.category,
      sizeLabel: spec.sizeLabel,
      actualSizeMm: null,
      unit: spec.unit,
      quantityProposed: quantity,
      spareQuantity: spare,
      notes: `${spec.notes} Proposal only: quantity as proposed, not purchased and not engineering-approved (${row.status}).`,
      citationIds: [
        cite.csv('materials', row.row, row.id, `Material row ${row.id}`, 'planning_net'),
        spec.category === 'panel' ? cite.card.p21('steps', 'Gypsum core sheets and optional spare') : catRowCitation(row),
      ],
    });
  }
  function catRowCitation(row) {
    if (row.id === 'L-BACK') return cite.card.p18('mix', 'Backing board packing');
    if (row.id === 'L-PRACTICE') return cite.card.p13('yield', 'Practice board');
    if (row.id.startsWith('L-W1') || row.id.startsWith('L-W2')) return cite.card.p06('tray-rows', 'Planning tray rows');
    return cite.json.framingConcept;
  }

  // ---- tools -------------------------------------------------------------------------------------
  const tools = [
    ['tool.tape-measure', 'Tape measure', 'measuring', null, [cite.card.p07('tools', 'Survey/trim tools'), cite.json.tools]],
    ['tool.pencil', 'Pencil / marker', 'other', null, [cite.card.p07('tools', 'Survey/trim tools')]],
    ['tool.square', 'Carpenter\'s square', 'measuring', 'Check several joints with a square; never use screws to pull a twisted stud straight.', [cite.card.p07('tools', 'Square in the tool rows'), cite.card.p17('steps', 'Square checks while fitting')]],
    ['tool.level-48', 'Checked 48-in level', 'measuring', 'Check the vial before use (source: checked 48-in level).', [cite.card.p07('tools', 'Checked 48-in level'), cite.json.straightening]],
    ['tool.straightedge-laser', '8-ft straightedge or line laser', 'measuring', null, [cite.card.p07('tools', '8-ft straightedge or line laser'), cite.card.p17('steps', 'Straightedge across stud faces')]],
    ['tool.mason-line', 'Mason\'s line with two equal 1/2-in spacer blocks', 'measuring', 'Spacers are equal; the line stays 1/2 in off each middle face (source schematic).', [cite.card.p17('steps', 'String line with equal spacers')]],
    ['tool.circular-saw', 'Supported circular saw with a compatible wood blade', 'cutting', 'Put the blade kerf on waste; leave the offcut free; unplug or remove the battery for blade/depth setup and check the guard.', [cite.card.p13('ready', 'Square cut practice'), cite.card.p07('tools', 'Supported circular saw')]],
    ['tool.drill-driver', 'Owned Ryobi drill/driver (exact model not recorded)', 'driving', 'Use the actual tool manual; no clutch/torque number is prescribed. No hammer-drill mode for driving wood/connector screws.', [cite.card.p13('limits', 'Use its own manual; no clutch number prescribed'), cite.json.tools, cite.pvt('source.r35.ref.ryobi-pbldd02', 'ryobi-manual', 'Cached Ryobi manual family file; the purchased model is not recorded.')]],
    ['tool.hex-nutsetter', '1/4-in hex nut setter compatible with the SD Connector screws', 'driving', 'Match the setter to the actual screw packaging and driver.', [cite.card.p14('spec', 'Compatible 1/4-in hex nut setter'), cite.json.tools]],
    ['tool.clamps', 'Clamps', 'other', null, [cite.card.p13('ready', 'Clamp the keeper to stable supports'), cite.card.p07('tools', 'Clamps')]],
    ['tool.work-supports', 'Stable saw/work supports', 'other', null, [cite.card.p13('ready', 'Stable supports'), cite.card.p07('tools', 'Stable work supports')]],
    ['tool.work-platform', 'Stable work platform (helper for overhead plates)', 'other', null, [cite.card.p07('steps', 'Helper and stable work platform')]],
    ['tool.utility-knife', 'Utility knife', 'cutting', null, [cite.card.p05('scope', 'Trim removal tools'), cite.card.p07('tools', 'Utility knife')]],
    ['tool.putty-knife', 'Thin putty knife / wall-protection pad', 'other', null, [cite.card.p05('scope', 'Ease trim off near fasteners with wall protection'), cite.card.p07('tools', 'Thin putty knife, wood pad')]],
    ['tool.pry-bar', 'Small pry bar', 'other', null, [cite.card.p05('scope', 'Trim removal tools'), cite.card.p07('tools', 'Small pry bar')]],
    ['tool.wood-pad', 'Wood protection pad', 'safety', null, [cite.card.p05('scope', 'Wall-protection pad')]],
    ['tool.end-nippers', 'End nippers (pull salvage nails through the back)', 'other', null, [cite.card.p05('scope', 'Pull salvage nails through the back')]],
    ['tool.eye-protection', 'Eye, hearing and dust protection', 'safety', 'Match protection to the tool in use.', [cite.card.p07('tools', 'Eye/hearing/dust protection'), cite.card.p13('ready', 'Safety setup')]],
    ['tool.t-square', 'Drywall T-square', 'measuring', null, [cite.card.p21('steps', 'Panel cutting tools'), cite.card.p25('steps', 'Label and cut panels')]],
    ['tool.rasp', 'Rasp', 'other', null, [cite.card.p25('steps', 'Rasp the edge square')]],
    ['tool.drywall-lift', 'Panel lift/support', 'other', null, [cite.card.p25('steps', 'Full sheet on broad supports')]],
    ['tool.screwgun', 'Adjustable-depth screwgun', 'driving', 'Practice on offcut at the same stud/backing stack; heads just below the face without tearing paper.', [cite.card.p25('steps', 'Adjustable-depth screwgun practice')]],
    ['tool.rasp-taping', 'Taping and finishing tools (knives, hawk, sanding with dust control)', 'other', null, [cite.card.p26('steps', 'Tape/compound system')]],
    ['tool.tile-bit', 'Approved tile bit (only after the accepted detail)', 'drilling', 'Permitted non-hammer mode only; no drilling is released.', [cite.card.p15('steps', 'Tile bit in permitted non-hammer mode')]],
    ['tool.concrete-drill', 'Concrete drill/bit with depth reference (only after the accepted detail)', 'drilling', 'Specified concrete pilot without hammering the tile; no test holes to discover services.', [cite.card.p15('steps', 'Specified concrete pilot')]],
    ['tool.dust-control', 'Dust control and cleaning/setting tools', 'safety', null, [cite.card.p15('steps', 'Dust control and setting tools')]],
    ['tool.paint-tools', 'Paint and trim finishing tools', 'other', null, [cite.card.p26('steps', 'Finish paint and trim')]],
  ].map(([id, name, category, setup, citationIds]) => ({ id, name, category, setup, citationIds }));

  // ---- systems (none: no sourced electrical design) ----------------------------------------------
  const systems = [];

  // ---- connections and fastener specs ------------------------------------------------------------
  const connectionsFile = {
    connections: [
      {
        id: 'connection.w1.stud-to-plate',
        fromPartId: 'part.w1.stud-s01',
        toPartId: 'part.w1.bottom-plate',
        method: 'bracket',
        fastenerSpecId: 'fastener.sd9112',
        pattern: { type: 'field', count: 8, spacingMm: null, startOffsetMm: null, endOffsetMm: null, edgeDistanceMm: null },
        pilotHole: null,
        toolSetup: 'Owned Ryobi drill/driver with a compatible 1/4-in hex nut setter; no hammer-drill mode.',
        declaredReleaseStatus: 'held',
        holdReason: 'Candidate A34/A34Z cavity-side angle (C-SP1). Project load direction, rotation restraint, orientation, installed count and the complete loaded-wall capacity are held; the published screw table does not establish the project joint.',
        citationIds: [cite.card.p10('candidate', 'W1 GSP candidate angle and screw pattern'), cite.card.p10('esr-limits', 'ESR limitations for the candidate'), cite.esr('table', 'A34 table excerpt'), jsonCite('/connections_R35/0', 'C-SP1 W1 stud-to-plate record', p('/connections_R35/0'))],
        proposedPointsMm: null,
      },
      {
        id: 'connection.w2.stud-to-plate',
        fromPartId: 'part.w2.stud-s01',
        toPartId: 'part.w2.bottom-plate',
        method: 'bracket',
        fastenerSpecId: null,
        pattern: null,
        pilotHole: null,
        toolSetup: null,
        declaredReleaseStatus: 'held',
        holdReason: 'C-SP2: same candidate family, but a separate 2x8 placement/access review is required. No W1 quantity or edge location may be copied; nothing is released.',
        citationIds: [jsonCite('/connections_R35/1', 'C-SP2 W2 stud-to-plate record', p('/connections_R35/1')), cite.card.p12('steps', 'Separate W2 connector placement')],
        proposedPointsMm: null,
      },
      {
        id: 'connection.backing.angle',
        fromPartId: 'part.backing.top-b01',
        toPartId: 'part.w1.stud-s01',
        method: 'bracket',
        fastenerSpecId: null,
        pattern: null,
        pilotHole: null,
        toolSetup: null,
        declaredReleaseStatus: 'held',
        holdReason: 'C-BACK: rear cavity-side angle concept for the 25 flat 2x6 blocks. Opposing angles on the 1.5-in studs conflict with the ESR-3096 minimum 3-in member thickness (no automatic vertical-stagger exception); the exact backing detail and loaded row are held.',
        citationIds: [jsonCite('/connections_R35/2', 'C-BACK backing connection record', p('/connections_R35/2')), cite.card.p19('conflict', 'Opposing-angle conflict'), cite.card.p19('quantity', 'Do not multiply 25 blocks by two angles'), cite.card.p19('space', 'Space check only')],
        proposedPointsMm: null,
      },
      {
        id: 'connection.corner.tie',
        fromPartId: 'part.w2.stud-s01',
        toPartId: 'part.w1.stud-s12',
        method: 'other',
        fastenerSpecId: null,
        pattern: null,
        pilotHole: null,
        toolSetup: null,
        declaredReleaseStatus: 'held',
        holdReason: 'C-CORNER: the W1/W2 junction and the existing end/column ties have only 1.5-in candidate wood contact and need their own receiver/load path. A small stud angle is not the automatic solution.',
        citationIds: [jsonCite('/connections_R35/3', 'C-CORNER tie record', p('/connections_R35/3')), cite.card.p12('steps', 'Corner and column tie text'), cite.svg('r34-wood-junction', { x: 55, y: 1272, width: 900, height: 28 }, 'corner-contact-1-5', 'text "butt contact ... 1½ in wide"')],
        proposedPointsMm: null,
      },
      {
        id: 'connection.top.restraint',
        fromPartId: 'part.w1.top-plate',
        toPartId: 'part.reference.truss-band',
        method: 'other',
        fastenerSpecId: null,
        pattern: null,
        pilotHole: null,
        toolSetup: null,
        declaredReleaseStatus: 'held',
        holdReason: 'C-TOP: nonbearing roof-truss restraint. The actual chord, movement detail and accepted non-rigid restraint are unresolved; ordinary rigid stud angles are not truss clips and no attachment is released.',
        citationIds: [jsonCite('/connections_R35/4', 'C-TOP truss restraint record', p('/connections_R35/4')), cite.card.p16('truss', 'Locate the real chord before fixing the line'), cite.card.p16('steps', 'Truss-movement allowance')],
        proposedPointsMm: null,
      },
      {
        id: 'connection.base.anchor',
        fromPartId: 'part.w1.bottom-plate',
        toPartId: 'part.existing.slab',
        method: 'mechanical_anchor',
        fastenerSpecId: null,
        pattern: { type: 'line', count: null, spacingMm: inch('12').mm, startOffsetMm: null, endOffsetMm: null, edgeDistanceMm: null },
        pilotHole: null,
        toolSetup: null,
        declaredReleaseStatus: 'held',
        holdReason: 'C-BASE: original-house D5/18 is reference-only and shows Hilti X-CF nails or equal at 12 in o.c., staggered from a 2x4 PT sill plate to concrete. It gives no first offset, exact product/length, diameter/embedment, edge distance, tile clearance, W1/W2 retrofit coordinates, W2 2x8 applicability or field service clearance. The project anchorage therefore remains held; SD Connector screws are not concrete anchors.',
        citationIds: [jsonCite('/connections_R35/5', 'C-BASE base anchorage record', p('/connections_R35/5')), cite.card.p15('limits', 'Never count tile/mortar as embedment'), cite.card.p16('steps', 'Do not use wood connector screws as concrete anchors'), cite.permit(13, { x: 10, y: 590, width: 195, height: 190 }, 'd5-detail-18-base-reference', 'D5 detail 18, TYP. INT. NON-BRNG WALL: reference-only 2x4 PT sill-to-concrete note, Hilti X-CF nails or equal at 12 in o.c. staggered; no project start offset or retrofit coordinates')],
        proposedPointsMm: null,
      },
      {
        id: 'connection.practice.angle-scrap',
        fromPartId: 'part.practice.angle',
        toPartId: 'part.practice.plate-a',
        method: 'bracket',
        fastenerSpecId: 'fastener.sd9112',
        pattern: { type: 'field', count: 8, spacingMm: null, startOffsetMm: null, endOffsetMm: null, edgeDistanceMm: null },
        pilotHole: null,
        toolSetup: 'Owned drill/driver with the matched 1/4-in hex nut setter; low speed, heads seated without crushing.',
        declaredReleaseStatus: 'conditional',
        holdReason: 'Loose-scrap practice only. The candidate angle and its documented per-angle screw pattern may be tried on separate offcuts; this is not a house connection and it releases nothing on W1/W2.',
        citationIds: [cite.card.p13('yield', 'Separate scrap angle-and-screw trial'), cite.card.p14('spec', 'SD9112 candidate and four screws per leg'), cite.esr('table', 'A34 table excerpt'), cite.json.connections],
        proposedPointsMm: null,
      },
    ],
    fastenerSpecs: [
      {
        id: 'fastener.sd9112',
        name: 'SD9112 #9 x 1-1/2 in SD Connector screw (candidate)',
        description: 'Candidate connector screw for the A34/A34Z review and the loose-scrap practice. 4 screws into each connected member = 8 per accepted angle. Project quantity, angle count, orientation and capacity are held; SDWS structural screws, mending plates and nail-only ties are different products and are not substitutes.',
        lengthMm: 38.1,
        citationIds: [cite.card.p10('candidate', 'SD9112 candidate'), cite.card.p14('spec', 'SD9112 spec and non-substitution'), cite.esr('table', 'ESR table excerpt'), cite.csv('materials', 15, 'F-SD', 'Materials row F-SD (quantity held)', 'planning_net')],
      },
    ],
  };

  // ---- views -------------------------------------------------------------------------------------
  const views = [
    { id: 'view.iso', name: 'Pantry overview (isometric)', kind: 'iso', camera: { positionMm: [6100, -4700, 3900], targetMm: [2050, 620, 1350], fov: 47 }, description: 'Concept overview from the pantry side of W1, W2, the existing context and the fixture envelopes.' },
    { id: 'view.plan', name: 'Plan', kind: 'plan', camera: { positionMm: [1900, 700, 5200], targetMm: [1900, 700, 0], fov: 45 }, description: 'Plan view showing the candidate footprints and the 68-in trial depth.' },
    { id: 'view.elevation-w1', name: 'W1 room-face elevation', kind: 'elevation', camera: { positionMm: [1990, -5400, 1450], targetMm: [1990, -57, 1400], fov: 44 }, description: 'W1 room-face elevation with the 12 candidate stud positions, backing bands and W1-R sheet boundaries.' },
    { id: 'view.elevation-w1-pantry', name: 'W1 pantry-face drywall', kind: 'elevation', camera: { positionMm: [1990, 1500, 1450], targetMm: [1990, -6.35, 1400], fov: 100 }, description: 'W1 pantry-face elevation from inside the pantry, showing all four W1-P sheet boundaries without treating schematic height as a cut.' },
    { id: 'view.elevation-w2', name: 'W2 room-face elevation', kind: 'elevation', camera: { positionMm: [8100, 660, 1500], targetMm: [3989.3875, 660, 1400], fov: 45 }, description: 'W2 room-face elevation showing both 5/8-in W2-R sheet boundaries.' },
    { id: 'view.elevation-w2-pantry', name: 'W2 pantry-face drywall', kind: 'elevation', camera: { positionMm: [-400, 660, 1500], targetMm: [3790.95, 660, 1400], fov: 45 }, description: 'W2 pantry-face elevation showing both 1/2-in W2-P sheet boundaries.' },
    { id: 'view.closeup-corner', name: 'W1/W2 corner close-up', kind: 'closeup', camera: { positionMm: [4800, 2100, 1800], targetMm: [3890, 900, 500], fov: 50 }, description: 'Corner close-up for the S11/S12/S01 candidate footprints and the held receiver.' },
    { id: 'view.closeup-backing', name: 'Backing bands close-up', kind: 'closeup', camera: { positionMm: [2413, -2200, 1800], targetMm: [2413, -30, 1500], fov: 50 }, description: 'Backing bands close-up over the candidate stud bays.' },
    { id: 'view.closeup-slab', name: 'Base and slab close-up', kind: 'closeup', camera: { positionMm: [600, -900, 700], targetMm: [600, 800, 0], fov: 50 }, description: 'Base/slab close-up: retained tile and the unresolved layer stack.' },
    { id: 'view.closeup-connector', name: 'Connector card close-up', kind: 'closeup', camera: { positionMm: [2500, -1800, 1400], targetMm: [2500, -57, 800], fov: 50 }, description: 'Representative cavity-side joint zone for the candidate angle review.' },
    { id: 'view.top-plates', name: 'Top plates — framing view', kind: 'closeup', camera: { positionMm: [2100, -3000, 3350], targetMm: [3300, 300, 2760], fov: 54 }, description: 'Upward diagonal framing view of both single top plates. Elevation is the labelled 111-in schematic reference only; restraint and member heights remain held.' },
    { id: 'view.installer-eye', name: 'Installer eye line', kind: 'installer_eye', camera: { positionMm: [-1800, 1100, 2200], targetMm: [1850, -57, 1350], fov: 50 }, description: 'Installer eye line from inside the pantry toward W1 and the W1/W2 corner.' },
    { id: 'view.room-inside', name: 'Inside pantry — eye level', kind: 'installer_eye', camera: { positionMm: [1700, 1250, 1650], targetMm: [3550, 150, 1350], fov: 72 }, description: 'Upright diagonal eye-level view from inside the pantry toward the W1/W2 corner. Use slow orbit and wheel movement to turn toward W2 or move back outside.' },
    { id: 'view.room-outside', name: 'Outside room — eye level', kind: 'installer_eye', camera: { positionMm: [1700, -1800, 1650], targetMm: [3500, 150, 1350], fov: 68 }, description: 'Upright diagonal eye-level view from the room side toward the W1/W2 corner. Use slow orbit and wheel movement to enter or turn around the corner.' },
    { id: 'view.ex1-opening', name: 'EX1 door-like candidate (held)', kind: 'closeup', camera: { positionMm: [3314.7, -1800, 1500], targetMm: [3314.7, 1657.35, 1016], upMm: [0, 0, 1], fov: 48 }, description: 'Front close-up of the presentation-only EX1 door-like outline: 37-in minimum finished-clear width, the 30 1/8-in original-plan obstruction limit and the minimum 6 7/8-in refrigerator-side extension. The 80-in displayed height is schematic only; actual height, demolition boundary and rough opening remain unknown.' },
    { id: 'view.practice-bench', name: 'Loose-stock practice bench', kind: 'closeup', camera: { positionMm: [5775, 5000, 1050], targetMm: [5505, 4200, 305], fov: 46 }, description: 'Separate loose-stock practice area, away from the house walls.' },
  ];

  // Register the full house layout—not W2 alone—to the A3-oriented right-handed scene. R35 source
  // x increases from the refrigerator datum toward W2; the A3 scene +X points from W2 toward the
  // garage/refrigerator end. Boxes are axis-aligned and reflection-symmetric, so reflecting their
  // centres preserves sourced dimensions. Marker/path local x coordinates must also be negated.
  // Loose practice stock stays in its separate presentation area and is not part of this house map.
  const sceneSourceXOriginMm = iE('149');
  for (const part of parts) {
    if (part.assemblyId === 'assembly.practice') continue;
    if (part.placement.rotationEulerDeg) {
      throw new Error(`A3 scene registration requires explicit reflected rotation for ${part.id}`);
    }
    part.placement.translationMm[0] = Number(
      round6(sceneSourceXOriginMm - part.placement.translationMm[0]),
    );
    if (part.geometry.shape === 'markers' || part.geometry.shape === 'path') {
      part.geometry.pointsMm = part.geometry.pointsMm.map(([x, y, z]) => [
        Number(round6(-x)),
        y,
        z,
      ]);
    }
  }
  for (const viewPreset of views) {
    if (viewPreset.id === 'view.practice-bench') continue;
    viewPreset.camera.positionMm[0] = Number(
      round6(sceneSourceXOriginMm - viewPreset.camera.positionMm[0]),
    );
    viewPreset.camera.targetMm[0] = Number(
      round6(sceneSourceXOriginMm - viewPreset.camera.targetMm[0]),
    );
    if (viewPreset.id === 'view.plan') viewPreset.camera.upMm = [0, 1, 0];
  }

  // ---- issues ------------------------------------------------------------------------------------
  const issues = [];
  const holdSeeds = src.holdPoints.map((text, index) => ({ text, index }));
  const holdTitles = [
    'Roof-truss chord location and W1 top restraint unverified',
    'Individual base box widths and appliance access unmeasured',
    'W1/W2 finished endpoints and column surfaces unmeasured',
    'W2 material grade, connections and drywall schedule unresolved',
    'Tile/slab layers, hidden services and retrofit anchor coordinates unresolved',
    'EX1 37-in clear target conflicts with the 30 1/8-in plan span; opening detail unresolved',
    'Cabinet rail/shelf bracket load path unresolved before close-up',
    'Alteration permit and inspection sequence to confirm',
    'Owner-selected 2x6 blocking band vs D4 2x4 backing',
    'Existing baseboard/shoe removal marks pending verified boundaries',
    'B1/B2/B3 individual widths and rail templates unresolved',
    'R35 stud-angle count/orientation and loaded-wall capacity unreleased',
    'Opposing angles on 1.5-in studs conflict with the ESR-3096 3-in minimum',
    'Pressure-treated end-tag treatment/retention must select the connector coating',
  ];
  const holdAffected = [
    ['part.reference.truss-band', 'part.w1.top-plate', 'op.restrain-top-plates'],
    ['measurement.cabinets.combined', 'part.fixture.base-row', 'part.fixture.fridge'],
    ['measurement.w1.finished-inside', 'part.existing.column', 'measurement.column.projection'],
    ['part.w2.bottom-plate', 'part.w2.top-plate', 'connection.w2.stud-to-plate'],
    ['part.existing.slab', 'part.existing.tile-floor', 'connection.base.anchor'],
    ['part.existing.ex1-wall', 'part.existing.column', 'measurement.ex1.finished-clear-width-min', 'measurement.ex1.plan-column-to-closet-span', 'measurement.ex1.plan-shortfall-before-finishes', 'op.open-ex1-passage'],
    ['part.fixture.upper-u1', 'part.fixture.shelves', 'connection.backing.angle'],
    [],
    ['part.backing.top-b01', 'connection.backing.angle'],
    ['part.trim.tr-01', 'part.trim.tr-02', 'part.trim.tr-03', 'part.trim.tr-04'],
    ['measurement.cabinets.combined', 'part.fixture.base-row'],
    ['connection.w1.stud-to-plate', 'connection.w2.stud-to-plate'],
    ['connection.backing.angle'],
    ['part.w1.bottom-plate', 'part.w2.bottom-plate', 'connection.base.anchor'],
  ];
  const holdCitations = [
    [cite.card.p16('truss', 'Truss location hold')],
    [cite.card.p03('operating-fit', 'Appliance fit warnings')],
    [cite.card.p04('steps', 'Measure endpoints and column')],
    [cite.card.p11('projection', 'W2 grade/connection hold text'), cite.card.p12('steps', 'W2 connection detail')],
    [cite.card.p15('hold', 'No drilling hold'), cite.permit(13, { x: 10, y: 590, width: 195, height: 190 }, 'd5-detail-18-base-reference', 'Original-house D5/18 provides only a typical 12-in-o.c. staggered 2x4 PT sill note and no W1/W2 retrofit anchor centers')],
    [cite.card.p20('steps', 'EX1 role/services/opening detail'), cite.pvt('source.r35.owner-ex1-requirement', 'minimum-clear-target-hold', 'Owner requires at least 37 in finished clear and requested extension toward the refrigerator side; opening geometry and demolition remain held.'), cite.permit(3, { x: 20, y: 40, width: 570, height: 700 }, 'a3-ex1-column-conflict-hold', 'Original-plan written-dimension arithmetic leaves 30 1/8 in before finishes between the column face and closet right framing face, creating at least a 6 7/8-in shortfall before finish allowance.')],
    [cite.card.p19('hold', 'Backing load-path hold')],
    [cite.card.p20('hold', 'Permit/inspection path note')],
    [cite.card.p18('scope', 'Owner-selected 2x6 vs approved 2x4 backing')],
    [cite.card.p05('zones', 'Marked trim removal scope')],
    [cite.card.p03('boxes', 'Individual widths unknown')],
    [cite.card.p10('conditional', 'Project placement and capacity not released')],
    [cite.card.p19('conflict', 'Opposing-angle conflict')],
    [cite.card.p10('limits', 'Connector coating at treated plates')],
  ];
  holdSeeds.forEach(({ text, index }) => {
    const id = `issue.r35.hold-${String(index + 1).padStart(2, '0')}`;
    issues.push({
      id,
      severity: 'major',
      status: 'open',
      title: holdTitles[index],
      detail: `Hold point ${index + 1} from the R35 manual: ${text}`,
      affectedIds: holdAffected[index],
      sourceRefIds: [...holdCitations[index], cite.json.holdPoints],
    });
  });

  const gateIssues = [
    ['g1-layout', 'G1 layout gate not satisfied', 'W1/W2 measured finished endpoints at 3 heights, the physical truss centre and the approved line are required before house cuts.', ['measurement.w1.finished-inside', 'part.reference.truss-band'], [cite.card.p28('gates', 'G1 layout gate'), cite.card.p28('process', 'Update the measured packet before cuts')]],
    ['g2-floor', 'G2 floor gate not satisfied', 'Tile/mortar/slab layers, hole clearance, a tested anchor/support and the repair approach are required before any drilling.', ['part.existing.slab', 'part.existing.tile-floor', 'connection.base.anchor'], [cite.card.p28('gates', 'G2 floor gate'), cite.card.p15('hold', 'No drilling hold')]],
    ['g3-frame', 'G3 frame gate not satisfied', 'W1/W2 member lengths, screw/connector patterns, top movement and end/corner/temporary restraint are required before frame work.', ['connection.w1.stud-to-plate', 'connection.w2.stud-to-plate', 'connection.top.restraint'], [cite.card.p28('gates', 'G3 frame gate'), cite.card.p10('conditional', 'Connector placement not released')]],
    ['g4-ex1', 'G4 EX1 gate not satisfied', 'Wall role/services, the approved opening/header/jamb/exposure and the retained kitchen door must be settled before the passage.', ['part.existing.ex1-wall', 'op.open-ex1-passage'], [cite.card.p28('gates', 'G4 EX1 gate'), cite.card.p20('hold', 'EX1 hold')]],
    ['g5-fixtures', 'G5 fixtures gate not satisfied', 'B1/B2/B3 actual widths, cabinet rail templates, shelf brackets/loads and GE operation are required before fixture loading.', ['measurement.cabinets.combined', 'part.fixture.base-row', 'part.fixture.fridge', 'connection.backing.angle'], [cite.card.p28('gates', 'G5 fixtures gate'), cite.card.p27('hold', 'Fixture load-path hold')]],
    ['g6-closeup', 'G6 close-up gate not satisfied', 'Inspection and photographs of the studs, 25 blocks, fasteners, services and board edge supports are required before drywall close-up.', ['part.w1.stud-s01', 'part.backing.top-b01', 'op.hang-drywall'], [cite.card.p28('gates', 'G6 close-up gate'), cite.card.p25('hold', 'Preclose inspection hold')]],
    ['g7-finish', 'G7 finish gate not satisfied', 'Drywall product/face map, trim exposed lengths, cabinet/fridge and door function must be verified before finish sign-off.', ['part.drywall.w1-p-01', 'part.trim.tr-01', 'part.fixture.fridge'], [cite.card.p28('gates', 'G7 finish gate'), cite.card.p26('conditional', 'Finish-system condition')]],
  ];
  for (const [key, title, detail, affectedIds, sourceRefIds] of gateIssues) {
    issues.push({ id: `issue.r35.gate-${key}`, severity: 'major', status: 'open', title, detail: `${detail} This gate is a release/acceptance gate: it is modelled as a held operation plus an acceptance gate record, and a browser checkbox never satisfies it.`, affectedIds, sourceRefIds });
  }

  issues.push(
    {
      id: 'issue.r35.esr-opposing-angle',
      severity: 'major',
      status: 'open',
      title: 'ESR-3096 opposing-angle 3-in minimum conflicts with 1.5-in studs',
      detail: 'The rear cavity-side angle concept for the 25 backing blocks can require angles on both sides of a shared 1.5-in stud, but ESR-3096 Table 5 note 5 requires a minimum 3-in wood member thickness for opposing angles. There is no automatic vertical-stagger exception. Adjacent-bay arrangement, exact quantity and the block-to-stud load path are held; D4 depicts 2x4 backing, not this modification.',
      affectedIds: ['connection.backing.angle', 'part.backing.top-b01', 'part.backing.base-b03'],
      sourceRefIds: [cite.card.p19('conflict', 'Opposing-angle conflict text'), cite.esr('note5', 'Minimum 3-in member thickness note'), cite.card.p10('esr-limits', 'ESR limitations card')],
    },
    {
      id: 'issue.r35.cabinet-seams',
      severity: 'major',
      status: 'open',
      title: 'Individual cabinet seams unknown; combined width only',
      detail: 'B1+B2+B3 are measured together at 106.5 in; the individual measured widths are null and the nominal 12/48/48 labels are not measured widths. Seams, fillers and cabinet screw paths stay schematic until B1/B2/B3 are measured separately and rail templates are obtained.',
      affectedIds: ['measurement.cabinets.combined', 'part.fixture.base-row', 'part.fixture.fillers'],
      sourceRefIds: [cite.card.p03('boxes', 'Individual widths unknown'), cite.card.p27('fronts', 'B1/B2/B3 fronts')],
    },
    {
      id: 'issue.r35.fridge-operating-fit',
      severity: 'major',
      status: 'open',
      title: 'GE GSE25GYPHCFS operating fit is unresolved (warnings, not proof)',
      detail: 'Project label GE GSE25GYPHCFS (side-by-side) with generic GE family data as the dimensional source. Warnings: the planned 3.25-in left-end allowance versus the family note\'s about 14.25-in freezer-side bin-removal requirement; the 37-in clear bay; the 26.75-in nominal closed-front clearance and the 11-in nominal 90-degree condition are depth-subtraction nominals with a 2-in rear gap. None of these proves door swing, bin removal, walking access or service removal; full-size operating and service checks are required before fixing W1 or the divider.',
      affectedIds: ['part.fixture.fridge', 'part.fixture.fridge-bay', 'measurement.fridge.bin-removal-required', 'measurement.fridge.closed-front-clearance', 'measurement.fridge.door90-clearance'],
      sourceRefIds: [cite.card.p03('operating-fit', '3 1/4 vs about 14 1/4-in bin note; 26 3/4 / 11-in nomials; neither proves swing'), cite.card.p27('steps', 'Set the GE in its 37-in bay and test operation'), cite.json.fridgeAccess],
    },
    {
      id: 'issue.r35.truss-trial',
      severity: 'major',
      status: 'open',
      title: 'Roof-truss alignment is a trial, not field verification',
      detail: 'The 68-in W1 line and the ~65.86-in candidate truss centre are A3/A7 drawing comparisons; the truss is not as-built verified and no truss attachment or top restraint is released. Ordinary rigid stud angles are not truss clips.',
      affectedIds: ['part.reference.truss-band', 'measurement.truss.center-trial', 'connection.top.restraint'],
      sourceRefIds: [cite.json.trussStatus, cite.card.p02('truss', 'Layout target, not an as-built connection'), cite.card.p16('truss', 'Locate the real chord')],
    },
    {
      id: 'issue.r35.source-age',
      severity: 'major',
      status: 'open',
      title: 'Source-age and as-built mismatch',
      detail: 'Original approved plans may omit finish/drywall thickness or differ from as-built conditions; the 111-in ceiling is a user report (design label 9 ft 4 in per the permit set); D4 shows 2x4 backing while the owner selected 2x6 flat blocking; manufacturer editions and field measurements are separate observations. No original-plan divergence substitutes for field measurement.',
      affectedIds: ['measurement.ceiling.reported', 'part.backing.top-b01', 'measurement.closet.inside-width'],
      sourceRefIds: [cite.json.state, cite.card.p29('sources', 'Source table limits'), cite.permit(12, { x: 60, y: 60, width: 500, height: 300 }, 'permit-d4-detail', 'D4 wall fastening/backing detail (2x4 backing per the plan set)')],
    },
    {
      id: 'issue.r35.member-heights',
      severity: 'major',
      status: 'open',
      title: 'Wall member heights are field-fit; the 111-in ceiling is not a cut',
      detail: 'Stud and top-plate heights depend on the actual installed plate faces and the unverified top restraint. Wall members and drywall panels are shown as plan footprints with no height or cut asserted; the reported 111-in ceiling is marked not_applicable for cutting and no cut operation may derive from it.',
      affectedIds: ['measurement.ceiling.reported', 'part.w1.stud-s01', 'part.w2.stud-s01', 'part.drywall.w1-p-01'],
      sourceRefIds: [cite.card.p09('steps', 'Do not batch-cut from the reported 111-in ceiling'), cite.card.p21('faces', 'Panel heights field fit')],
    },
    {
      id: 'issue.r35.jurisdiction',
      severity: 'info',
      status: 'accepted',
      title: 'Dade City/Pasco County profile is not a universal code rule',
      detail: 'This pantry construction profile is City of Dade City, Florida; it must not become a universal code rule for future projects. The alteration permit and inspection sequence still require confirmation with the building department.',
      affectedIds: [],
      sourceRefIds: [cite.json.jurisdiction, cite.card.p29('sources', 'Building department row')],
      resolution: 'Accepted as a project-scope statement.',
    },
    {
      id: 'issue.r35.privacy',
      severity: 'info',
      status: 'accepted',
      title: 'Private source identity excluded from publication',
      detail: 'The permit PDF, address/parcel/permit identity, raw source URLs and the raw conditional-manual JSON are private and are not copied into the bundle or release. Published source pages are text-only sanitized excerpt cards with printed page numbers; the private-to-public map is recorded in work/r35/private-public-map.json.',
      affectedIds: ['source.r35.permit-pdf', 'source.r35.manual-json'],
      sourceRefIds: [cite.json.state],
      resolution: 'Sanitization policy applied; public assets contain no private identity.',
    },
    {
      id: 'issue.r35.nonselected-fasteners',
      severity: 'info',
      status: 'accepted',
      title: 'Nonselected fastening alternatives are reference-only',
      detail: 'The A35 bent stud-to-plate A2/C2/D configuration (6 + 6 SD9112) and A1/C1/E (3 + 6) are reference-only and not selected; SDWS structural wood screws, generic mending plates and nail-only stud ties are explicitly nonselected. None of them may become a part, quantity or allowed substitute for the candidate A34/A34Z review.',
      affectedIds: ['fastener.sd9112', 'connection.practice.angle-scrap'],
      sourceRefIds: [cite.card.p14('nonselected', 'Nonselected alternatives text'), cite.card.p10('candidate', 'Candidate family only')],
      resolution: 'Accepted as reference-only; candidate A34/A34Z with SD9112 remains unreleased for house work.',
    },
    {
      id: 'issue.r35.cart-history',
      severity: 'info',
      status: 'accepted',
      title: 'Cart statements reconciled temporally; procurement is non-authoritative',
      detail: 'Publication-time statement: the R34 cart still included a framing nailer and nail strips and R35 did not mutate the live cart. Later change-record statement: the framing nailer was already absent when checked; framing nail strips were removed; the saw was restored; two A34Z angles, one 100-count SD9112 box and one 1/4-in nutsetter were added for loose practice; installed connector purchase remains held; the observed pickup-only cart was 49 units / $657.55 before tax with no checkout. These are consecutive observations, not a contradiction. Cart state is procurement history only and is non-authoritative for engineering properties; no stale nailer requirement survives.',
      affectedIds: ['fastener.sd9112', 'material.lumber.practice'],
      sourceRefIds: [cite.card.p29('cart', 'Publication-time cart statement'), cite.pvt('source.r35.change-record', 'cart-later-state', 'R35 change record: nailer already absent, strips removed, A34Z/SD9112/nutsetter added for loose practice; 49 units / $657.55; no checkout.')],
      resolution: 'Accepted with the temporal reconciliation recorded in work/r35/carry-forward-map.json.',
    },
    {
      id: 'issue.r35.practice-not-house',
      severity: 'info',
      status: 'accepted',
      title: 'Loose-stock practice never counts as house framing',
      detail: 'The practice board yields two 24-in plates and three 21-in studs for a 24x24-in mock rectangle plus a separate scrap angle-and-screw trial. Practice parts are a separate assembly, are excluded from takeoff, and never become installed house members or purchase quantities.',
      affectedIds: ['part.practice.stock', 'part.practice.plate-a', 'part.practice.angle'],
      sourceRefIds: [cite.card.p13('yield', 'Practice scope and yield'), cite.json.logicalW1],
      resolution: 'Accepted as loose-stock practice under the ready practice scope only.',
    },
    {
      id: 'issue.r35.ex1-closet-scope',
      severity: 'major',
      status: 'open',
      title: 'Closet 37/23 survey facts do not define the EX1 rough opening',
      detail: "The closet's 37-in inside width and 23-in depth are survey/reference facts only; they are not the EX1 rough opening, header or jamb sizes. The retained kitchen-side door/jamb/casing stays distinct from the new passage and the exact opening requires an accepted detail.",
      affectedIds: ['measurement.closet.inside-width', 'measurement.closet.depth', 'part.existing.ex1-wall', 'part.existing.kitchen-door'],
      sourceRefIds: [cite.card.p20('steps', 'Do not use the 37-in width as a rough opening'), cite.card.p04('steps', 'Establish the closet dimensions')],
    },
    {
      id: 'issue.r35.services-unknown',
      severity: 'major',
      status: 'open',
      title: 'Service routing around slab and EX1 is unknown; no electrical design exists',
      detail: 'No electrical circuit, cable, box, device or installation operation is modelled: the only electrical-related content is the unknown/held service investigation around the slab and EX1, captured as investigation stop conditions and hold points. A5 indicates under-slab conduit/condensate routes but cannot certify any hole clear, and EX1 role/services must be identified on both faces and above the ceiling.',
      affectedIds: ['part.existing.slab', 'part.existing.ex1-wall', 'op.review-slab-base', 'op.open-ex1-passage'],
      sourceRefIds: [cite.card.p15('steps', 'Clear every proposed hole cylinder of services'), cite.card.p20('steps', 'Identify EX1 services')],
    },
    {
      id: 'issue.r35.backing-bands-provisional',
      severity: 'major',
      status: 'open',
      title: 'Backing bands are provisional zones, not cabinet rail releases',
      detail: 'The TOP/U3LOW/U1LOW/U2LOW/BASE bands are provisional zones set from actual cabinet mounting-rail/hole locations; the 25-block map is a layout concept and does not release loading or drywall closure. Shelf brackets use verified full studs with their own hardware.',
      affectedIds: ['part.backing.top-b01', 'part.fixture.upper-u3', 'part.fixture.shelves'],
      sourceRefIds: [cite.json.backingBandStatus, cite.card.p18('hold', 'Backing rail/fastener hold'), cite.json.backingShelves],
    },
  );

  // ---- releases, listing, acceptance -------------------------------------------------------------
  const releases = [
    { id: 'release.r35.survey', state: 'ready', scope: 'design_review', issuer: 'Pantry R35 conversion (Worker R1, agent)', issuedDate: '2026-09-29', evidence: 'Source state: survey_and_removable_floor_tape = ready', affectedIds: ['op.survey-finished-faces', 'op.survey-trim', 'op.protect-route', 'op.stage-tools'], notes: 'Non-destructive survey, removable floor tape, non-destructive trim survey and the page-7 protection/inventory/handling-route actions only. Destructive exposure and drilling remain held.' },
    { id: 'release.r35.practice', state: 'ready', scope: 'practice_on_loose_scrap', issuer: 'Pantry R35 conversion (Worker R1, agent)', issuedDate: '2026-09-29', evidence: 'Source state: practice_on_loose_scrap = ready', affectedIds: ['op.prepare-practice', 'op.cut-practice', 'op.fit-practice-frame', 'op.read-connector-card', 'op.drive-practice-screws'], notes: 'Loose-stock saw/driver/SD9112 practice only, after tool and product checks; never house framing and never installed takeoff.' },
    { id: 'release.r35.plan', state: 'conditional', scope: 'design_review', issuer: 'Pantry R35 conversion (Worker R1, agent)', issuedDate: '2026-09-29', evidence: 'Conditional arithmetic and candidate layouts; no cuts or fasteners released', affectedIds: ['op.layout-w1-plates', 'op.layout-w2-plates', 'op.review-connector', 'op.finish-drywall', 'op.record-source-status'], notes: 'Preview-only conditional content: sourced geometry may be shown with a CONDITIONAL label; conditions must be resolved by an authorized content revision before real work.' },
    { id: 'release.r35.frame-cuts', state: 'held', scope: 'site_installation', issuer: 'Pantry R35 conversion (Worker R1, agent)', issuedDate: '2026-09-29', evidence: 'Source state: frame_cuts = held', affectedIds: ['op.set-bottom-plates', 'op.restrain-top-plates', 'op.fit-w1-studs', 'op.fasten-w1-studs', 'op.fit-w2-frame', 'op.fasten-w2-frame'], notes: 'No house member cut is released: plate cut lengths, stud heights and connections are field-fit/held.' },
    { id: 'release.r35.slab-drilling', state: 'held', scope: 'site_installation', issuer: 'Pantry R35 conversion (Worker R1, agent)', issuedDate: '2026-09-29', evidence: 'Source state: slab_drilling = held', affectedIds: ['op.review-slab-base', 'op.anchor-base-plates', 'connection.base.anchor'], notes: 'No drilling: the layer stack, hidden services, hole envelopes and a tested anchor detail are unresolved; tile/mortar is never anchor embedment.' },
    { id: 'release.r35.truss-attachment', state: 'held', scope: 'site_installation', issuer: 'Pantry R35 conversion (Worker R1, agent)', issuedDate: '2026-09-29', evidence: 'Source state: truss_attachment = held', affectedIds: ['op.restrain-top-plates', 'connection.top.restraint', 'part.reference.truss-band'], notes: 'The physical truss must be located and a nonbearing movement detail accepted; rigid stud angles are not truss clips.' },
    { id: 'release.r35.existing-opening', state: 'held', scope: 'site_installation', issuer: 'Pantry R35 conversion (Worker R1, agent)', issuedDate: '2026-09-29', evidence: 'Source state: existing_opening = held', affectedIds: ['op.open-ex1-passage', 'part.existing.ex1-wall'], notes: 'EX1 wall role/services and the approved walk-through opening detail are unresolved; the closet 37/23 dimensions do not define the rough opening.' },
    { id: 'release.r35.drywall-closeup', state: 'held', scope: 'site_installation', issuer: 'Pantry R35 conversion (Worker R1, agent)', issuedDate: '2026-09-29', evidence: 'Source state: drywall_closeup = held', affectedIds: ['op.plan-drywall-faces', 'op.inspect-preclose', 'op.hang-drywall', 'op.inspect-drywall'], notes: 'Held for the preclose inspection, panel map, board-specific screw schedule, board selection and EX1 patches; panel heights are field-fit.' },
    { id: 'release.r35.fixture-loading', state: 'held', scope: 'site_installation', issuer: 'Pantry R35 conversion (Worker R1, agent)', issuedDate: '2026-09-29', evidence: 'Source state: fixture_loading = held', affectedIds: ['op.dry-fit-fixtures', 'op.set-counter-uppers-shelves', 'op.set-refrigerator', 'connection.backing.angle'], notes: 'Held for actual cabinet rail templates, shelf bracket loads, the complete backing/load path and GE operating-fit checks.' },
    { id: 'release.r35.trim-removal', state: 'held', scope: 'site_installation', issuer: 'Pantry R35 conversion (Worker R1, agent)', issuedDate: '2026-09-29', evidence: 'Source state: selective_existing_trim_removal = held for marked contact areas and EX1 opening boundary; non-destructive trim survey ready', affectedIds: ['op.remove-trim-selective', 'part.trim.tr-01', 'part.trim.tr-02', 'part.trim.tr-03', 'part.trim.tr-04'], notes: 'Removal is held until the marked contact areas and the EX1 opening boundaries are verified; the non-destructive trim survey is ready under the survey scope.' },
    { id: 'release.r35.baseboard', state: 'held', scope: 'site_installation', issuer: 'Pantry R35 conversion (Worker R1, agent)', issuedDate: '2026-09-29', evidence: 'Source state: new_baseboard_installation = held for finished drywall/cabinet fit and as-built exposed lengths', affectedIds: ['op.install-baseboard'], notes: 'New baseboard waits for finished drywall, cabinet/fridge fit and measured exposed lengths; trim removal authorizes neither tile removal nor drilling.' },
    { id: 'release.r35.connector-placement', state: 'held', scope: 'site_installation', issuer: 'Pantry R35 conversion (Worker R1, agent)', issuedDate: '2026-09-29', evidence: 'Candidate A34/A34Z only; installed_quantity null; no capacity claim', affectedIds: ['connection.w1.stud-to-plate', 'connection.w2.stud-to-plate', 'connection.corner.tie'], notes: 'Stud-angle count, orientation, rotation restraint and loaded-wall capacity require manufacturer/qualified acceptance; retained geometry alone does not release the screw method.' },
  ];

  const listing = {
    slug: 'pantry-r35',
    title: 'Pantry R35 — Wall Framing, Backing and Cabinet Plan (conditional concept)',
    summary: 'Real-source conversion of the R35 pantry manual: survey and loose-scrap practice are the only ready scopes. W1 2x4 and W2 2x8 walls are built in place with screw-fastened metal connectors, 25 flat 2x6 backing blocks and a four-face drywall map — all house cuts, drilling, truss attachment, the EX1 opening, drywall close-up, fixture loading and baseboard work remain held by the source releases. Candidate A34/A34Z data only; no installed angle count, orientation or capacity.',
    projectType: 'pantry',
    scope: 'concept',
    revision: 'R35',
    updated: '2026-09-29',
    thumbnailAssetPath: 'assets/thumbnails/pantry-r35.svg',
    tags: ['pantry', 'in-place framing', 'concept', 'held steps', 'metal connectors'],
  };

  const acceptance = {
    status: 'accepted',
    reviewer: 'Pantry R35 conversion author (Worker R1, agent)',
    role: 'conversion author',
    date: '2026-09-29',
    scope: 'concept',
    sourceSetHash: null,
    contentHash: null,
    issueDispositions: [
      ...issues.map((issue) => ({
        issueId: issue.id,
        disposition: issue.status === 'open' ? 'held_open' : 'accepted',
        note: issue.status === 'open'
          ? 'Open hold carried from the source releases; not resolved by this conversion.'
          : 'Accepted as published with its recorded note.',
      })),
    ],
    notes: 'Concept-scope acceptance of the real-source conversion only. This is not a permit, structural approval, engineering review or construction release. G1-G7 are release/acceptance gates modelled as held operations plus gate records; a browser checkbox never satisfies them. Only the survey and practice_on_loose_scrap scopes are ready.',
  };

  return { assemblies, datums, parts, measurements, materials, tools, systems, connectionsFile, views, issues, releases, listing, acceptance, cite };
}
