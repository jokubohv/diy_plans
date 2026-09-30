/**
 * Manager correction pass for the owner fixture review (9 findings). Deterministic rewrite of
 * the authored JSON; run once from platform/ with: npx tsx work/scripts/apply-owner-fixes.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const dir = 'projects/p0-fixture/0.1.0/';
const read = (file) => JSON.parse(readFileSync(dir + file, 'utf8'));
const write = (file, value) => writeFileSync(dir + file, JSON.stringify(value, null, 2) + '\n');

// ---- materials: two screws per joint across six joints = twelve
const materials = read('materials.json');
const frameScrew = materials.find((m) => m.id === 'material.fastener.frame-screw');
frameScrew.quantityProposed = 12;
frameScrew.notes = 'Two screws per plate-to-stud joint (6 joints, 12 screws); synthetic demonstration value.';
write('materials.json', materials);

// ---- connection pattern: two screws per joint, 80 mm apart, straddling the stud centreline
const connections = read('connections.json');
const joint = connections.connections.find((c) => c.id === 'connection.frame.plate-to-stud');
joint.pattern = { type: 'line', count: 2, spacingMm: 80, edgeDistanceMm: 40 };
joint.toolSetup = 'Impact driver with the synthetic screw bit (2 screws per joint, 6 joints)';
write('connections.json', connections);

// ---- measurements: truthful centres, no false "spacing"
const measurements = read('measurements.json');
const byId = new Map(measurements.map((m) => [m.id, m]));
const spacing = byId.get('measurement.stud.spacing');
spacing.id = 'measurement.stud-2.centreline';
spacing.label = 'Stud 2 centreline from wall origin';
measurements.push(
  {
    id: 'measurement.stud-1.centreline',
    label: 'Stud 1 centreline from wall origin',
    original: { display: '2 1/4 in', value: '2 1/4', unit: 'in' },
    canonicalMm: '57.150',
    installationToleranceMm: null,
    evidenceStatus: 'reported',
    declaredReleaseStatus: 'ready',
    citationIds: ['citation.sheet-a.wall-length'],
  },
  {
    id: 'measurement.stud-3.centreline',
    label: 'Stud 3 centreline from wall origin',
    original: { display: '81 in', value: '81', unit: 'in' },
    canonicalMm: '2057.400',
    installationToleranceMm: null,
    evidenceStatus: 'reported',
    declaredReleaseStatus: 'ready',
    citationIds: ['citation.sheet-a.wall-length'],
  },
);
write('measurements.json', measurements);

// ---- operations
const ops = read('operations.json');
const op = (id) => ops.find((o) => o.id === id);

const survey = op('op.survey-wall');
survey.title = 'Verify wall-frame dimensions';
survey.targetPartIds = ['part.existing.slab', 'part.demo.temp-panel'];
survey.parameters = {
  measurementIds: [
    'measurement.wall-a.length',
    'measurement.wall-a.height',
    'measurement.stud-1.centreline',
    'measurement.stud-2.centreline',
    'measurement.stud-3.centreline',
    'measurement.wall-a.opening.width',
  ],
  checkInstruction:
    'Verify the build area and confirm the planned wall-frame dimensions (2438.4 mm length and height, stud centres at 57.15 / 1066.8 / 2057.4 mm, 952.5 mm opening) before cutting any stock.',
};
survey.qualityChecks = [
  {
    instruction:
      'Planned wall-frame length and height confirmed at 2438.4 mm against the approved dimension chain',
    evidenceRequired: 'measurement',
  },
];
survey.stopConditions = [
  'Stop if the build area cannot accept the planned 2438.4 mm frame or the approved dimensions are unavailable.',
];
survey.view = { cameraPresetId: 'view.iso', highlightPartIds: [], hiddenPartIds: [], recipe: {} };
survey.qualityChecks[0].citationIds = ['citation.sheet-a.survey'];

const cutFrame = op('op.cut-frame');
cutFrame.dependencyOperationIds = ['op.prepare-frame', 'op.remove-temp'];

const assemble = op('op.assemble-frame');
const studCentres = [404.15, 1413.8, 2404.4];
const jointPoints = [];
for (const x of studCentres) {
  for (const z of [19.05, 2419.35]) {
    jointPoints.push([Number((x - 40).toFixed(2)), 82, z], [Number((x + 40).toFixed(2)), 82, z]);
  }
}
assemble.parameters.pointsMm = jointPoints;
assemble.stopConditions = [
  'Stop if a joint cannot take the two synthetic screws at the scheduled spacing.',
];

const cabinet = op('op.position-cabinet');
cabinet.dependencyOperationIds = ['op.cover-drywall'];
cabinet.parameters.datumNote =
  'After the wall covering is installed: envelope base 914.4 mm above finished floor; 609.6 wide x 609.6 deep x 812.8 high.';
cabinet.preconditions = [
  'Wall covering installed and inspected; backing fastening released (still held in this demonstration).',
];
write('operations.json', ops);

// ---- steps: titles and prerequisite graph enforce the displayed order
const steps = read('steps.json');
const step = (id) => steps.find((s) => s.id === id);
step('step.survey-wall').title = 'Verify wall-frame dimensions';
step('step.cut-frame').prerequisiteStepIds = ['step.remove-temp'];
step('step.position-cabinet').prerequisiteStepIds = ['step.cover-wall'];
write('steps.json', steps);

// ---- user-facing title: frame first
const listing = read('listing.json');
listing.title = 'Wall Frame & Cabinet Backing';
write('listing.json', listing);

const project = read('project.json');
project.title = 'Wall Frame & Cabinet Backing';
write('project.json', project);

console.log('applied owner corrections: 8 fixture files');
