/**
 * Pantry R35 deterministic conversion pipeline (packet r35.conversion, Worker R1).
 *
 * Reads only the section-16 listed source inputs from the immutable source tree, re-verifies the
 * four owner-supplied SHA-256 hashes, and writes:
 *   - work/r35/source-inventory.json, carry-forward-map.json, coverage-matrix.json/.md,
 *     reconciliation.json, private-public-map.json
 *   - projects/pantry-r35/R35/** (17 authored files + sanitized excerpt cards + thumbnail)
 *
 * Run from platform/ with: npx tsx work/r35/author-r35.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCardSet } from './lib/cards.mjs';
import {
  FILE,
  OWNER_HASHES,
  SOURCE_ROOT,
  buildCitationRegistry,
  buildGeometry,
  buildModel,
  parseInventoryCsvs,
  readManualSources,
} from './lib/content.mjs';
import { buildOperations } from './lib/ops.mjs';
import {
  buildCarryForwardMap,
  buildCoverageMatrix,
  buildInventory,
  buildPrivatePublicMap,
  buildReconciliation,
  coverageMarkdown,
} from './lib/artifacts.mjs';
import { jsonText, sha256Hex, svgEscape } from './lib/util.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLATFORM = resolve(HERE, '..', '..');
const WORK_DIR = HERE;
const BUNDLE_DIR = join(PLATFORM, 'projects', 'pantry-r35', 'R35');

const abs = (relPath) => join(SOURCE_ROOT, relPath);
const sha256Of = (relPath) => sha256Hex(readFileSync(abs(relPath)));
const statOf = (relPath) => statSync(abs(relPath));
const listFiles = (dir) => {
  const root = abs(dir);
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(relative(SOURCE_ROOT, full).split(sep).join('/'));
    }
  };
  if (!existsSync(root)) throw new Error(`Listed input directory missing: ${dir}`);
  walk(root);
  return out.sort();
};

function writeJson(relPath, value) {
  const target = join(PLATFORM, relPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, jsonText(value));
}

function main() {
  if (!SOURCE_ROOT) {
    throw new Error('R35_SOURCE_ROOT is required to regenerate the private-source-authored R35 bundle.');
  }
  // 1. Verify the owner-supplied hashes (fail loudly).
  const failures = [];
  for (const [relPath, expected] of Object.entries(OWNER_HASHES)) {
    if (!existsSync(abs(relPath))) {
      failures.push(`${relPath}: MISSING`);
      continue;
    }
    const actual = sha256Of(relPath);
    if (actual !== expected) failures.push(`${relPath}: expected ${expected} got ${actual}`);
  }
  if (failures.length > 0) {
    throw new Error(`Owner hash verification failed:\n${failures.join('\n')}`);
  }

  // 2. Read the listed current inputs and parse them deterministically.
  const manual = JSON.parse(readFileSync(abs(FILE.manualJson), 'utf8'));
  const csvs = parseInventoryCsvs((relPath) => readFileSync(abs(relPath), 'utf8'));
  const src = readManualSources(manual, csvs);
  const geo = buildGeometry(src, csvs);
  const cart = readAndVerifyCart();

  // 3. Sanitized excerpt cards.
  const cards = buildCardSet();
  const sourcePagesDir = join(BUNDLE_DIR, 'assets', 'source-pages');
  mkdirSync(sourcePagesDir, { recursive: true });
  for (const [, entry] of cards) {
    writeFileSync(join(sourcePagesDir, entry.card.file), entry.rendered.svg);
  }
  writeThumbnail(join(BUNDLE_DIR, 'assets', 'thumbnails', 'pantry-r35.svg'), geo, src);

  // 4. Citations + content model + operations/steps.
  const registry = buildCitationRegistry(cards);
  const model = buildModel({ src, csvs, geo, registry, cards });
  const { operations, steps } = buildOperations({ src, csvs, geo, cite: model.cite, model });

  // 5. Build the coverage matrix BEFORE writing the bundle: the matrix references sanitized card
  //    citations and may register them in the citation registry (they must exist in sources.json).
  const coverage = buildCoverageMatrix({ model, ops: operations, cite: model.cite });

  // 6. Assemble and write the authored bundle.
  const manifest = {
    schema: 'diy-guide',
    schemaVersion: '0.1.0',
    contentVersion: 'R35',
    packageRevision: 1,
    minimumBuilderVersion: '0.1.0',
    capabilities: [
      { name: 'woodFraming', version: 1 },
      { name: 'drywall', version: 1 },
      { name: 'cabinetry', version: 1 },
    ],
    notes: 'Real-source Pantry R35 conditional concept. No electrical capability is declared: R35 has no sourced circuit/system design, only unknown/held service investigation around the slab and EX1. Only survey and practice_on_loose_scrap scopes are ready.',
  };

  const project = {
    slug: 'pantry-r35',
    title: 'Pantry R35 — Wall Framing, Backing and Cabinet Plan (conditional concept)',
    projectType: 'pantry',
    description: 'Real-source conversion of the Pantry R35 conditional manual. Canonical Z-up millimetres registered to the A3 floor-plan orientation: the origin is the W1/W2 pantry-finish corner, +X runs from the foyer/W2 end toward the garage/refrigerator end, +Y runs from W1 toward the existing EX1 wall/column and +Z is up from the finished floor. R35 source coordinates are preserved in citations/descriptions and registered by X = 149 in - x_R35, Y = y_R35, Z = z_R35. In-place construction with a single top plate per wall: W1 2x4 studs S01-S12, W2 2x8 studs S01-S05, 25 flat 2x6 backing blocks and a four-face drywall map. Cuts, slab drilling, truss attachment, the EX1 opening, drywall close-up, fixture loading, selective trim removal and new baseboard are held exactly as the source releases state; only survey and loose-scrap practice are ready. Member heights are field-fit and unresolved: wall members are shown as plan footprints with no cut height asserted. No electrical circuit/system design exists or is modelled.',
    jurisdiction: 'City of Dade City, Florida',
    coordinateContract: {
      handedness: 'right',
      upAxis: 'Z',
      lengthUnit: 'mm',
      description: 'Right-handed A3-oriented Z-up millimetres. Origin at finished tile where the W1 and W2 pantry finished faces meet. +X runs along W1 from the foyer/W2 end toward the garage/refrigerator end; +Y runs from W1 toward the existing EX1 wall/column; +Z is up. Conversion from the R35 source drawing is X = 149 in - x_R35, Y = y_R35, Z = z_R35. Reported/user values keep their original inch text plus exact 25.4 mm/in canonical strings.',
    },
    display: { unit: 'in', precisionIn: 0.125 },
    releases: model.releases,
  };

  writeJson('projects/pantry-r35/R35/manifest.json', manifest);
  writeJson('projects/pantry-r35/R35/project.json', project);
  writeJson('projects/pantry-r35/R35/datums.json', model.datums);
  writeJson('projects/pantry-r35/R35/measurements.json', model.measurements);
  writeJson('projects/pantry-r35/R35/sources.json', { sources: registry.sources, citations: registry.citations });
  writeJson('projects/pantry-r35/R35/assemblies.json', model.assemblies);
  writeJson('projects/pantry-r35/R35/parts.json', model.parts);
  writeJson('projects/pantry-r35/R35/connections.json', model.connectionsFile);
  writeJson('projects/pantry-r35/R35/materials.json', model.materials);
  writeJson('projects/pantry-r35/R35/tools.json', model.tools);
  writeJson('projects/pantry-r35/R35/systems.json', model.systems);
  writeJson('projects/pantry-r35/R35/operations.json', operations);
  writeJson('projects/pantry-r35/R35/steps.json', steps);
  writeJson('projects/pantry-r35/R35/views.json', model.views);
  writeJson('projects/pantry-r35/R35/issues.json', model.issues);
  writeJson('projects/pantry-r35/R35/acceptance.json', model.acceptance);
  writeJson('projects/pantry-r35/R35/listing.json', model.listing);

  // 7. Work artifacts.
  const inventory = buildInventory({ sha256Of, statOf, listFiles });
  writeJson('work/r35/source-inventory.json', inventory);

  const carryForward = buildCarryForwardMap({ src, csvs, bundle: model, cart });
  writeJson('work/r35/carry-forward-map.json', carryForward);

  writeJson('work/r35/coverage-matrix.json', coverage);
  writeFileSync(join(WORK_DIR, 'coverage-matrix.md'), coverageMarkdown(coverage));

  const reconciliation = buildReconciliation({ csvs, src, model });
  writeJson('work/r35/reconciliation.json', reconciliation);

  const privatePublic = buildPrivatePublicMap({ inventory, cards });
  writeJson('work/r35/private-public-map.json', privatePublic);

  // 7. Summary.
  const statusCounts = {};
  const effective = computeEffectiveStatuses(operations, steps);
  for (const status of steps.map((step) => effective.get(step.id))) {
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  }
  const summary = {
    bundle: 'projects/pantry-r35/R35',
    parts: model.parts.length,
    measurements: model.measurements.length,
    materials: model.materials.length,
    tools: model.tools.length,
    connections: model.connectionsFile.connections.length,
    fastenerSpecs: model.connectionsFile.fastenerSpecs.length,
    sources: registry.sources.length,
    citations: registry.citations.length,
    operations: operations.length,
    steps: steps.length,
    issues: model.issues.length,
    cards: cards.size,
    stepEffectiveStatuses: statusCounts,
    coverage: coverage.summary,
    reconciliation: reconciliation.totals,
    ownedHashes: Object.keys(OWNER_HASHES).length,
    readyOperations: operations.filter((op) => op.declaredReleaseStatus === 'ready').map((op) => op.id),
    unreadInputs: inventory.entries.filter((entry) => entry.readByPipeline === false).length,
  };
  console.log(JSON.stringify(summary, null, 2));
}

/** Offline effective-status calculation for the summary (same rank order as the compiler). */
function computeEffectiveStatuses(operations, steps) {
  const rank = { not_applicable: 0, ready: 1, conditional: 2, held: 3, superseded: 4 };
  const opsById = new Map(operations.map((op) => [op.id, op]));
  const stepsById = new Map(steps.map((step) => [step.id, step]));
  const worst = (a, b) => (rank[a] >= rank[b] ? a : b);
  const propagates = (status) => rank[status] >= rank.conditional;
  const opMemo = new Map();
  const opStatus = (op) => {
    if (opMemo.has(op.id)) return opMemo.get(op.id);
    let result = op.declaredReleaseStatus;
    for (const depId of op.dependencyOperationIds ?? []) {
      const dep = opsById.get(depId);
      if (!dep) continue;
      const status = opStatus(dep);
      if (propagates(status)) result = worst(result, status);
    }
    opMemo.set(op.id, result);
    return result;
  };
  const stepMemo = new Map();
  const stepStatus = (step) => {
    if (stepMemo.has(step.id)) return stepMemo.get(step.id);
    let result = step.declaredReleaseStatus;
    for (const opId of step.operationIds ?? []) {
      const op = opsById.get(opId);
      if (!op) continue;
      const status = opStatus(op);
      if (propagates(status)) result = worst(result, status);
    }
    for (const prereqId of step.prerequisiteStepIds ?? []) {
      const prereq = stepsById.get(prereqId);
      if (!prereq) continue;
      const status = stepStatus(prereq);
      if (propagates(status)) result = worst(result, status);
    }
    stepMemo.set(step.id, result);
    return result;
  };
  const map = new Map();
  for (const step of steps) map.set(step.id, stepStatus(step));
  return map;
}

/** Deterministic concept thumbnail (plan schematic with sourced labels; no identity). */
function writeThumbnail(path, geo, src) {
  const inch = (value) => geo.inch(value);
  const scale = 1.35;
  const x0 = 40;
  const y0 = 150;
  const w1Len = inch('157.375') * scale;
  const depth = inch('68') * scale;
  const w2Thickness = inch('8.375') * scale;
  const plateLen = inch('156.75') * scale;
  const fridge = inch('37') * scale;
  const divider = inch('0.75') * scale;
  const baseRow = inch('108') * scale;
  const leftSpace = inch('3.25') * scale;
  const columnProjection = inch('10.875') * scale;
  const width = Math.ceil(Math.max(920, x0 * 2 + w2Thickness + w1Len));
  const height = Math.ceil(y0 + depth + 120);
  const w1Thickness = inch('4.5') * scale;
  const columnWidth = inch('8.375') * scale;
  const xCorner = x0 + w2Thickness;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Pantry R35 concept plan">`,
    `  <rect x="0" y="0" width="${width}" height="${height}" fill="#f7faf7"/>`,
    `  <text x="40" y="52" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="bold" fill="#173a35">Pantry R35 — conditional concept</text>`,
    `  <text x="40" y="80" font-family="Arial,Helvetica,sans-serif" font-size="15" fill="#48625c">In-place framing; only survey and loose-scrap practice are ready. House cuts, drilling and fixture loading are held.</text>`,
    `  <g stroke="#1d3a35" fill="none">`,
    `    <rect x="${xCorner}" y="${y0}" width="${plateLen}" height="${w1Thickness}" fill="#b9cfc4"/>`,
    `    <rect x="${x0}" y="${y0}" width="${w2Thickness}" height="${depth}" fill="#d9e4de"/>`,
    `    <rect x="${x0}" y="${y0 + depth - columnProjection}" width="${columnWidth}" height="${columnProjection}" fill="#cfd8d2"/>`,
    `    <rect x="${x0}" y="${y0 + depth}" width="${w2Thickness + w1Len + 60}" height="10" fill="#e8e2d4"/>`,
    `  </g>`,
    `  <g font-family="Arial,Helvetica,sans-serif" font-size="13" fill="#33524b">`,
    `    <text x="${xCorner + w1Len - box(geo, '40') * scale}" y="${y0 + depth + 40}">garage / refrigerator end</text>`,
    `    <text x="${xCorner + 44 * scale}" y="${y0 + depth + 60}">108-in base row · 37-in refrigerator bay at far end</text>`,
    `    <text x="${xCorner + 60}" y="${y0 - 18}">W1 candidate plate ${src.p('/layout/W1_plate_comparison_at_selected_corner')} in · finished inside ${src.p('/layout/W1_finished_inside_width')} in</text>`,
    `    <text x="${x0 + 18}" y="${y0 + 28}">W2 ${src.p('/layout/W2_finished_thickness')} in finished · foyer side</text>`,
    `    <text x="${x0 + 18}" y="${y0 + depth - 6}">column (reported)</text>`,
    `    <text x="${x0}" y="${y0 + depth + 92}">68-in trial to the finished EX1 wall · 63½-in clear depth (conditional arithmetic)</text>`,
    `    <text x="${x0}" y="${y0 + depth + 112}" fill="#7b8c87">Schematic only — written dimensions govern; member heights are field-fit and not shown.</text>`,
    `  </g>`,
    `  <text x="40" y="${y0 + depth + 140}" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#7b8c87">${svgEscape('Sources: sanitized R35 excerpt cards; identity withheld.')}</text>`,
    '</svg>',
    '',
  ].join('\n');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, svg);
}

function box(geo, value) {
  return geo.inch(value);
}

/** Read + verify the two cart observations for the temporal reconciliation (procurement only). */
function readAndVerifyCart() {
  if (!existsSync(abs(FILE.cartR35)) || !existsSync(abs(FILE.cartWoodReserve))) {
    throw new Error('R35 cart observation files are required for the temporal reconciliation');
  }
  const r35 = JSON.parse(readFileSync(abs(FILE.cartR35), 'utf8'));
  const reserve = JSON.parse(readFileSync(abs(FILE.cartWoodReserve), 'utf8'));
  const descriptions = (cart) => (cart.project_lines ?? []).map((line) => String(line.description ?? ''));
  const r35Lines = descriptions(r35);
  const reserveLines = descriptions(reserve);
  const allLines = [...r35Lines, ...reserveLines];
  const includes = (pattern) => allLines.filter((line) => pattern.test(line));
  const problems = [];
  if (r35.observed_final_units !== 49) problems.push(`cart units ${r35.observed_final_units} != 49`);
  if (Math.abs(Number(r35.merchandise_subtotal_before_tax) - 657.55) > 0.001) problems.push('cart subtotal != 657.55');
  if (r35.checkout_completed !== false) problems.push('cart shows a completed checkout');
  if (includes(/nailer|nail strip/i).length > 0) problems.push('cart still lists a nailer or nail strips');
  if (includes(/A34Z/i).length < 1) problems.push('cart lacks the A34Z practice samples');
  if (includes(/SD Connector #9/i).length < 1) problems.push('cart lacks the SD9112 practice box');
  if (includes(/nutsetter/i).length < 1) problems.push('cart lacks the nutsetter');
  if (reserve.checkout_completed !== false) problems.push('reserve cart shows a completed checkout');
  if (problems.length > 0) throw new Error(`Cart reconciliation failed:\n${problems.join('\n')}`);
  return {
    r35: {
      units: r35.observed_final_units,
      subtotal: r35.merchandise_subtotal_before_tax,
      checkout: r35.checkout_completed,
      nailerAbsent: includes(/nailer|nail strip/i).length === 0,
      practiceLines: includes(/A34Z|SD Connector #9|nutsetter/i).map((line) => line.replace(/\s+/g, ' ').trim()),
    },
    reserve: {
      units: reserve.observed_final_units,
      subtotal: reserve.merchandise_subtotal_before_tax,
      checkout: reserve.checkout_completed,
      practiceLines: includes(/A34Z|SD Connector #9|nutsetter/i).map((line) => line.replace(/\s+/g, ' ').trim()),
    },
  };
}

main();
