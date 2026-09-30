/**
 * Operations tests: the authored frame-first build sequence.
 *
 * Pins the 15-step graph: the wall frame phase comes first (starting with the survey), every
 * cabinet-backing step transitively depends on `step.inspect-frame`, the frame cut list matches
 * the authored `finalLengthMm` values, and the held set is exactly the four preview-only steps.
 */
import { describe, expect, it } from 'vitest';
import type { AuthoredBundle, Step } from '@diyguide/schema';
import { compileBundle } from '../../src/index';
import { errorCodes, FIXTURE_DIR, loadFixture, validateMutation } from '../helpers';

function compiledFixture() {
  const load = loadFixture();
  const { compiled, report } = compileBundle({
    bundle: load.bundle,
    files: load.files,
    rawFiles: load.rawFiles,
    bundleDir: FIXTURE_DIR,
  });
  if (!compiled || !report.ok) throw new Error('fixture did not compile');
  return compiled;
}

function orderedSteps(steps: readonly Step[]): Step[] {
  return [...steps].sort((a, b) => a.sequence - b.sequence);
}

/** Transitive prerequisite closure of a step (excluding the step itself). */
function prerequisiteClosure(stepId: string, byId: ReadonlyMap<string, Step>): Set<string> {
  const result = new Set<string>();
  const stack = [...(byId.get(stepId)?.prerequisiteStepIds ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    const step = byId.get(id);
    if (step) stack.push(...step.prerequisiteStepIds);
  }
  return result;
}

describe('fixture build sequence', () => {
  const compiled = compiledFixture();
  const ordered = orderedSteps(compiled.steps);

  it('runs the phases frame-first and starts with the survey', () => {
    expect(ordered).toHaveLength(18);
    expect(ordered[0]!.id).toBe('step.survey-wall');
    expect(ordered[0]!.operationIds).toEqual(['op.survey-wall']);
    expect(ordered.map((step) => step.phaseLabel)).toEqual([
      ...Array(11).fill('Wall frame'),
      ...Array(4).fill('Cabinet backing'),
      ...Array(3).fill('Services & finish'),
    ]);
    // The wall-frame phase distinguishes cutting/layout/assembly from raising, anchoring,
    // opening the doorway and inspection.
    expect(ordered.slice(3, 11).map((step) => step.id)).toEqual([
      'step.cut-frame',
      'step.layout-frame',
      'step.assemble-frame',
      'step.raise-frame',
      'step.anchor-frame',
      'step.open-doorway',
      'step.inspect-frame',
      'step.remove-brace',
    ]);
    // Sequences strictly increase and every step carries the same sequence order as the array.
    for (let i = 0; i < ordered.length; i += 1) {
      expect(ordered[i]!.sequence).toBe((i + 1) * 10);
    }
  });

  it('keeps every cabinet-backing step behind the frame inspection', () => {
    const byId = new Map(compiled.steps.map((step) => [step.id, step]));
    const cabinetBacking = ordered.filter((step) => step.phaseLabel === 'Cabinet backing');
    expect(cabinetBacking.map((step) => step.id)).toEqual([
      'step.cut-backing',
      'step.position-backing',
      'step.fasten-backing',
      'step.inspect-backing',
    ]);
    // The first backing step depends on the brace removal that follows the frame inspection.
    expect(cabinetBacking[0]!.prerequisiteStepIds).toEqual(['step.remove-brace']);
    for (const step of cabinetBacking) {
      expect(prerequisiteClosure(step.id, byId).has('step.inspect-frame'), step.id).toBe(true);
    }
    // The route and cover steps also wait for the frame inspection.
    expect(prerequisiteClosure('step.route-cable', byId).has('step.inspect-frame')).toBe(true);
    expect(prerequisiteClosure('step.cover-wall', byId).has('step.inspect-frame')).toBe(true);
  });

  it('matches the authored frame cut list', () => {
    const cutFrame = compiled.operations.find((operation) => operation.id === 'op.cut-frame');
    if (cutFrame?.kind !== 'cut') throw new Error('op.cut-frame is not a cut operation');
    expect(cutFrame.parameters.cuts.map((cut) => cut.partId)).toEqual([
      'part.wall-a.bottom-plate',
      'part.wall-a.top-plate',
      'part.wall-a.stud-1',
      'part.wall-a.stud-2',
      'part.wall-a.stud-3',
      'part.wall-a.stud-4',
      'part.wall-a.king-left',
      'part.wall-a.king-right',
      'part.wall-a.jack-left',
      'part.wall-a.jack-right',
      'part.wall-a.header-ply-a',
      'part.wall-a.header-ply-b',
      'part.wall-a.header-spacer',
      'part.wall-a.cripple-1',
      'part.wall-a.cripple-2',
      'part.demo.temp-racking-brace',
      'part.demo.temp-plumb-prop',
    ]);
    expect(cutFrame.parameters.cuts.map((cut) => cut.finalLengthMm)).toEqual([
      '2438.400',
      '2438.400',
      '2362.200',
      '2362.200',
      '2362.200',
      '2362.200',
      '2362.200',
      '2362.200',
      '2032.000',
      '2032.000',
      '1104.900',
      '1104.900',
      '1104.900',
      '190.500',
      '190.500',
      '1336.200',
      '2425.900',
    ]);
    // The continuous sole plate is used at full length; the doorway section is removed later.
    expect(cutFrame.parameters.cuts[0]!.note).toContain('not pre-cut');
    // The prepare step points the UI at exactly this cut list.
    const prepare = compiled.operations.find((operation) => operation.id === 'op.prepare-frame');
    if (prepare?.kind !== 'prepare') throw new Error('op.prepare-frame is not a prepare operation');
    expect(prepare.parameters.cutOperationIds).toEqual(['op.cut-frame']);
  });

  it('pins the held step set to exactly the four preview-only steps', () => {
    const held = compiled.steps
      .filter((step) => step.effectiveReleaseStatus === 'held')
      .map((step) => step.id)
      .sort();
    expect(held).toEqual([
      'step.cover-wall',
      'step.fasten-backing',
      'step.inspect-backing',
      'step.position-cabinet',
    ]);
  });

  it('enforces the displayed order in the dependency graph, not only in sequence numbers', () => {
    const byId = new Map(compiled.steps.map((step) => [step.id, step]));
    // Cutting must not bypass the temporary-protection removal...
    expect(prerequisiteClosure('step.cut-frame', byId)).toContain('step.remove-temp');
    // ...and the cabinet must wait for the wall covering (which itself waits for the backing
    // inspection and the cable route).
    const cabinetClosure = prerequisiteClosure('step.position-cabinet', byId);
    expect(cabinetClosure).toContain('step.cover-wall');
    expect(cabinetClosure).toContain('step.route-cable');
    expect(cabinetClosure).toContain('step.inspect-backing');
    expect(cabinetClosure).toContain('step.assemble-frame');
  });

  it('keeps the frame quantities consistent between the BOM, pattern and fastener points', () => {
    const byId = new Map(compiled.operations.map((operation) => [operation.id, operation]));
    const prepare = byId.get('op.prepare-frame')!;
    if (prepare.kind !== 'prepare') throw new Error('op.prepare-frame must be a prepare operation');
    const assemble = byId.get('op.assemble-frame')!;
    if (assemble.kind !== 'fasten') throw new Error('op.assemble-frame must be a fasten operation');
    const anchor = byId.get('op.anchor-frame')!;
    if (anchor.kind !== 'fasten') throw new Error('op.anchor-frame must be a fasten operation');
    const screwMaterial = compiled.materials.find((material) => material.id === 'material.fastener.frame-screw')!;
    const anchorMaterial = compiled.materials.find((material) => material.id === 'material.fastener.frame-anchor')!;
    const screwConnection = compiled.connections.find((candidate) => candidate.id === 'connection.frame.plate-to-stud')!;
    const anchorConnection = compiled.connections.find((candidate) => candidate.id === 'connection.frame.plate-to-slab')!;

    const screwPoints = assemble.parameters.pointsMm ?? [];
    const anchorPoints = anchor.parameters.pointsMm ?? [];
    const perJoint = screwConnection.pattern?.count ?? 0;
    const JOINT_LOCATIONS = 20; // 14 plate joints + 2 header joints + 4 cripple ends

    expect(perJoint).toBe(2);
    expect(screwPoints).toHaveLength(JOINT_LOCATIONS * perJoint); // 40 screws
    expect(screwMaterial.quantityProposed).toBe(screwPoints.length);
    expect(prepare.parameters.materialIds).toContain('material.fastener.frame-screw');

    expect(anchorConnection.pattern?.count).toBe(3);
    expect(anchorPoints).toHaveLength(3);
    expect(anchorMaterial.quantityProposed).toBe(anchorPoints.length);
    expect(prepare.parameters.materialIds).toContain('material.fastener.frame-anchor');

    // 16 screws on the bottom plate, 12 on the top plate, 4 header joints, 8 cripple ends.
    const zValues = screwPoints.map((point) => point[2]);
    expect(zValues.filter((z) => Math.abs(z - 38.1) < 1e-9)).toHaveLength(16);
    expect(zValues.filter((z) => Math.abs(z - 2438.4) < 1e-9)).toHaveLength(12);
    expect(zValues.filter((z) => Math.abs(z - 2110.1) < 1e-9)).toHaveLength(2);
    expect(zValues.filter((z) => Math.abs(z - 2170.1) < 1e-9)).toHaveLength(2);
    expect(zValues.filter((z) => Math.abs(z - 2219.8) < 1e-9)).toHaveLength(4);
    expect(zValues.filter((z) => Math.abs(z - 2390.3) < 1e-9)).toHaveLength(4);
  });
});

describe('prepare parameter contract', () => {
  const prepareParams = (bundle: AuthoredBundle) => {
    const prepare = bundle.operations.find((operation) => operation.id === 'op.prepare-frame');
    if (!prepare) throw new Error('missing op.prepare-frame');
    return prepare.parameters as unknown as { materialIds: string[]; toolIds: string[]; cutOperationIds?: string[] };
  };

  it('reports an unknown material id as DANGLING_REF', () => {
    const report = validateMutation((bundle) => {
      prepareParams(bundle).materialIds = ['material.does-not-exist'];
    });
    expect(report.ok).toBe(false);
    expect(errorCodes(report)).toEqual(['DANGLING_REF']);
  });

  it('reports a cutOperationId that resolves to a non-cut operation as INVALID_CUT_OPERATION_REF', () => {
    const report = validateMutation((bundle) => {
      prepareParams(bundle).cutOperationIds = ['op.survey-wall'];
    });
    expect(report.ok).toBe(false);
    expect(errorCodes(report)).toEqual(['INVALID_CUT_OPERATION_REF']);
  });
});
