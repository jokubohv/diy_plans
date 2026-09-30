/**
 * Owner visual review corrections (v3.1):
 *  - temporary supports are hidden from the flat stages (they are only cut, not installed);
 *  - the anchor preset is widened so all three permanent-segment anchors are in frame;
 *  - kerf copy uses one 3 mm kerf per claimed cut, matching the invariant arithmetic.
 *
 * Deterministic patch of the authored fixture; run from platform/ with:
 *   npx tsx work/scripts/apply-v3-corrections.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const dir = 'projects/p0-fixture/0.1.0/';
const read = (file) => JSON.parse(readFileSync(dir + file, 'utf8'));
const write = (file, value) => writeFileSync(dir + file, JSON.stringify(value, null, 2) + '\n');

const TEMP_MEMBERS = ['part.demo.temp-racking-brace', 'part.demo.temp-plumb-prop'];

// 1. Flat stages: the temporary supports are cut stock on the ground, not installed; hide them
//    from the cut/layout/assemble operation views so their upright geometry cannot appear.
const ops = read('operations.json');
for (const id of ['op.cut-frame', 'op.layout-frame', 'op.assemble-frame']) {
  const operation = ops.find((candidate) => candidate.id === id);
  operation.view.hiddenPartIds = [...new Set([...operation.view.hiddenPartIds, ...TEMP_MEMBERS])].sort();
}
// The raise step must show them again (no hiding) and install them.
const raise = ops.find((candidate) => candidate.id === 'op.raise-frame');
raise.view.hiddenPartIds = [];
write('operations.json', ops);

// 2. Widen the anchor preset so all three anchors (world x 499.4 / 1109 / 2667) are in frame.
const views = read('views.json');
const anchorView = views.find((view) => view.id === 'view.anchor');
anchorView.name = 'Bottom plate anchors (all three)';
anchorView.camera = { positionMm: [1583, -1900, 750], targetMm: [1583, 0, 70], fov: 50 };
anchorView.description = 'Wide view of the bottom plate showing all three permanent-segment anchor locations.';
write('views.json', views);

// 3. Kerf copy: one 3 mm kerf per claimed cut, with the exact totals the invariant computes.
const KERF = 3;
const mats = read('materials.json');
const material = (id) => mats.find((candidate) => candidate.id === id);

material('material.lumber.stud').notes =
  `6 boards: one per full-height stud (2362.2 mm + ${KERF} mm kerf = ${(2362.2 + KERF).toFixed(1)} <= 2438.4). ` +
  `2 boards: one per jack stud (2032 mm) whose offcut also yields one cripple (190.5 mm): ` +
  `2032 + 190.5 + 2 x ${KERF} mm kerf = ${(2032 + 190.5 + 2 * KERF).toFixed(1)} <= 2438.4. ` +
  'Kerf convention: one 3 mm kerf per claimed cut.';

material('material.lumber.header').notes =
  `One board yields both header plies: 2 x 1104.9 + 2 x ${KERF} mm kerf = ${(2 * 1104.9 + 2 * KERF).toFixed(1)} <= 2438.4 mm.`;

material('material.lumber.block').notes =
  `One board yields both backing blocks: 368.3 + 336.55 + 2 x ${KERF} mm kerf = ` +
  `${(368.3 + 336.55 + 2 * KERF).toFixed(2)} <= 2438.4 mm.`;

material('material.lumber.brace').notes =
  `One board yields the in-plane racking brace (1336.2 mm + ${KERF} mm kerf = ${(1336.2 + KERF).toFixed(1)} <= 2438.4) ` +
  'and leaves a reusable offcut. It resists racking; it does not hold the wall plumb.';

material('material.lumber.prop').notes =
  `One board yields the out-of-plane plumb prop (2425.9 mm + ${KERF} mm kerf = ${(2425.9 + KERF).toFixed(1)} <= 2438.4 mm).`;

material('material.panel.header-spacer').notes =
  '1104.9 mm strip cut from 1/2 in plywood offcut (no board yield claimed); fills the 2x4 wall thickness between the header plies.';
write('materials.json', mats);

console.log('applied v3.1 corrections: flat-stage hiding, anchor preset, kerf copy');
