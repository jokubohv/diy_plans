/**
 * R35 sequence test: the owner-corrected dependency topology (p8/p11 + p15 before p16; p16 before
 * p9/p12; p13/p14 practice releasing nothing; p7 ready logistics), the release parity and the
 * G1-G7 gates.
 */
import { describe, expect, it } from 'vitest';
import type { Operation, ReleaseStatus } from '@diyguide/schema';
import {
  compileR35,
  findOperation,
  findStep,
  jsonPointer,
  operationClosure,
  readManualJson,
  stepClosure,
} from './helpers';

const READY_OPERATIONS = [
  'op.survey-finished-faces',
  'op.survey-trim',
  'op.protect-route',
  'op.stage-tools',
  'op.prepare-practice',
  'op.cut-practice',
  'op.fit-practice-frame',
  'op.read-connector-card',
  'op.drive-practice-screws',
];

const CONDITIONAL_OPERATIONS = ['op.layout-w1-plates', 'op.layout-w2-plates', 'op.review-connector'];

const READY_STEPS = ['step.p4-survey', 'step.p5-trim-survey', 'step.p7-setup', 'step.p13-practice', 'step.p14-sd9112'];
const CONDITIONAL_STEPS = ['step.p8-w1-layout', 'step.p11-w2-layout', 'step.p10-connector'];

describe('R35 dependency topology', () => {
  const { compiled } = compileR35();
  const operations = compiled.operations as (Operation & { effectiveReleaseStatus: ReleaseStatus })[];
  const steps = compiled.steps;

  it('keeps the audible page order out of the dependency order: p8/p11/p15 precede p16, p16 precedes p9/p12', () => {
    for (const plateOp of ['op.set-bottom-plates', 'op.restrain-top-plates']) {
      const closure = operationClosure(plateOp, operations);
      expect(closure.has('op.layout-w1-plates'), plateOp).toBe(true);
      expect(closure.has('op.layout-w2-plates'), plateOp).toBe(true);
      expect(closure.has('op.review-slab-base'), plateOp).toBe(true);
      expect(closure.has('op.review-connector'), plateOp).toBe(true);
    }
    const w1Closure = operationClosure('op.fit-w1-studs', operations);
    expect(w1Closure.has('op.set-bottom-plates')).toBe(true);
    expect(w1Closure.has('op.restrain-top-plates')).toBe(true);
    const w2Closure = operationClosure('op.fit-w2-frame', operations);
    expect(w2Closure.has('op.fasten-w1-studs')).toBe(true);
    expect(w2Closure.has('op.restrain-top-plates')).toBe(true);
    expect(w2Closure.has('op.set-bottom-plates')).toBe(true);

    const p16Steps = ['step.p16-base-plates', 'step.p16-top-restraint'];
    for (const stepId of p16Steps) {
      const closure = stepClosure(stepId, steps);
      for (const required of ['step.p8-w1-layout', 'step.p11-w2-layout', 'step.p15-slab', 'step.p10-connector']) {
        expect(closure.has(required), `${stepId} <- ${required}`).toBe(true);
      }
    }
    expect(stepClosure('step.p9-w1-studs', steps).has('step.p16-top-restraint')).toBe(true);
    expect(stepClosure('step.p12-w2-frame', steps).has('step.p9-w1-studs')).toBe(true);
    // The practice technique precedes its first house use.
    expect(operationClosure('op.fasten-w1-studs', operations).has('op.drive-practice-screws')).toBe(true);
  });

  it('does not let page-5 held trim removal block or gate the ready survey work', () => {
    const trimRemoval = findOperation(operations, 'op.remove-trim-selective');
    expect(trimRemoval.declaredReleaseStatus).toBe('held');
    for (const readyOp of READY_OPERATIONS) {
      const closure = operationClosure(readyOp, operations);
      expect(closure.has('op.remove-trim-selective'), readyOp).toBe(false);
    }
    const trimSurvey = findOperation(operations, 'op.survey-trim');
    expect(trimSurvey.declaredReleaseStatus).toBe('ready');
    expect(trimSurvey.parameters).toMatchObject({ evidenceRequired: 'photo' });
  });

  it('keeps the p13/p14 practice strictly on loose stock and away from house operations', () => {
    for (const id of ['op.prepare-practice', 'op.cut-practice', 'op.fit-practice-frame', 'op.read-connector-card', 'op.drive-practice-screws']) {
      const operation = findOperation(operations, id);
      expect(operation.declaredReleaseStatus, id).toBe('ready');
      expect(operation.releaseId, id).toBe('release.r35.practice');
      for (const target of operation.targetPartIds) {
        expect(target.startsWith('part.practice.'), `${id} targets ${target}`).toBe(true);
      }
      for (const effect of operation.stateEffects) {
        expect(effect.partId.startsWith('part.practice.'), `${id} effects ${effect.partId}`).toBe(true);
      }
    }
    const practiceConnection = compiled.connections.find((connection) => connection.id === 'connection.practice.angle-scrap');
    expect(practiceConnection?.declaredReleaseStatus).toBe('conditional');
    // No ready operation mutates a house part state.
    for (const operation of operations) {
      if (operation.effectiveReleaseStatus !== 'ready') continue;
      for (const effect of operation.stateEffects) {
        expect(effect.partId.startsWith('part.practice.'), `${operation.id} would mutate ${effect.partId}`).toBe(true);
      }
    }
  });

  it('keeps page-7 protection/inventory/handling actions ready under the survey/logistics scope', () => {
    const setup = findStep(steps, 'step.p7-setup');
    expect(setup.declaredReleaseStatus).toBe('ready');
    expect(compiled.steps.find((step) => step.id === 'step.p7-setup')?.effectiveReleaseStatus).toBe('ready');
    const protect = findOperation(operations, 'op.protect-route');
    const stage = findOperation(operations, 'op.stage-tools');
    expect(protect.declaredReleaseStatus).toBe('ready');
    expect(protect.releaseId).toBe('release.r35.survey');
    expect(stage.declaredReleaseStatus).toBe('ready');
    expect(stage.releaseId).toBe('release.r35.survey');
    expect(setup.operationIds).toEqual(['op.protect-route', 'op.stage-tools']);
  });

  it('applies exactly the survey/practice/conditional-marking steps to the preview', () => {
    const applied = compiled.stepStates.filter((state) => state.applied).map((state) => state.stepId);
    expect(applied.sort()).toEqual([...READY_STEPS, ...CONDITIONAL_STEPS].sort());
    for (const state of compiled.stepStates) {
      if (!state.applied) continue;
      for (const entry of state.after) {
        expect(['covered', 'installed']).not.toContain(entry.state);
      }
    }
  });
});

describe('R35 release parity', () => {
  const { compiled, bundle } = compileR35();
  const operations = compiled.operations as (Operation & { effectiveReleaseStatus: ReleaseStatus })[];
  const sourceReleases = jsonPointer<Record<string, string>>(readManualJson(), '/releases');

  it('matches the JSON releases dictionary exactly for the mandatory scopes', () => {
    const records = new Map(compiled.project.releases.map((release) => [release.id, release]));
    const expectations: [string, string, ReleaseStatus][] = [
      ['release.r35.survey', sourceReleases['survey_and_removable_floor_tape'] as string, 'ready'],
      ['release.r35.practice', sourceReleases['practice_on_loose_scrap'] as string, 'ready'],
      ['release.r35.frame-cuts', sourceReleases['frame_cuts'] as string, 'held'],
      ['release.r35.slab-drilling', sourceReleases['slab_drilling'] as string, 'held'],
      ['release.r35.truss-attachment', sourceReleases['truss_attachment'] as string, 'held'],
      ['release.r35.existing-opening', sourceReleases['existing_opening'] as string, 'held'],
      ['release.r35.drywall-closeup', sourceReleases['drywall_closeup'] as string, 'held'],
      ['release.r35.fixture-loading', sourceReleases['fixture_loading'] as string, 'held'],
      ['release.r35.trim-removal', sourceReleases['selective_existing_trim_removal'] as string, 'held'],
      ['release.r35.baseboard', sourceReleases['new_baseboard_installation'] as string, 'held'],
    ];
    for (const [id, sourceState, expected] of expectations) {
      expect(records.get(id)?.state, `${id} (${sourceState})`).toBe(expected);
    }
    expect(records.get('release.r35.trim-removal')?.evidence).toMatch(/non-destructive trim survey ready/);
    expect(records.get('release.r35.baseboard')?.evidence).toMatch(/finished drywall\/cabinet fit/);
  });

  it('keeps only survey and practice scopes ready', () => {
    const ready = operations.filter((operation) => operation.effectiveReleaseStatus === 'ready').map((operation) => operation.id).sort();
    expect(ready).toEqual([...READY_OPERATIONS].sort());
    for (const id of READY_OPERATIONS) {
      const operation = findOperation(operations, id);
      expect(['release.r35.survey', 'release.r35.practice']).toContain(operation.releaseId);
    }
    const conditional = operations.filter((operation) => operation.effectiveReleaseStatus === 'conditional').map((operation) => operation.id).sort();
    expect(conditional).toEqual([...CONDITIONAL_OPERATIONS].sort());
    const held = operations.filter((operation) => operation.effectiveReleaseStatus === 'held');
    expect(held.length).toBe(operations.length - READY_OPERATIONS.length - CONDITIONAL_OPERATIONS.length);
    // No step may become ready through propagation.
    const readySteps = compiled.steps.filter((step) => step.effectiveReleaseStatus === 'ready').map((step) => step.id).sort();
    expect(readySteps).toEqual([...READY_STEPS].sort());
    const conditionalSteps = compiled.steps.filter((step) => step.effectiveReleaseStatus === 'conditional').map((step) => step.id).sort();
    expect(conditionalSteps).toEqual([...CONDITIONAL_STEPS].sort());
  });

  it('propagates every hold downstream (cuts, drilling, truss, opening, close-up, loading)', () => {
    const expectations: [string, string][] = [
      ['op.fit-w1-studs', 'held'],
      ['op.fasten-w1-studs', 'held'],
      ['op.set-bottom-plates', 'held'],
      ['op.restrain-top-plates', 'held'],
      ['op.anchor-base-plates', 'held'],
      ['op.open-ex1-passage', 'held'],
      ['op.hang-drywall', 'held'],
      ['op.inspect-drywall', 'held'],
      ['op.finish-drywall', 'held'],
      ['op.install-baseboard', 'held'],
      ['op.dry-fit-fixtures', 'held'],
      ['op.set-refrigerator', 'held'],
      ['op.review-slab-base', 'held'],
      ['op.fit-backing-blocks', 'held'],
      ['op.fasten-backing-blocks', 'held'],
    ];
    for (const [id, expected] of expectations) {
      expect(findOperation(operations, id).effectiveReleaseStatus, id).toBe(expected);
    }
  });

  it('keeps G1-G7 as held gates that no ready step or checkbox satisfies', () => {
    const gateIds = ['g1-layout', 'g2-floor', 'g3-frame', 'g4-ex1', 'g5-fixtures', 'g6-closeup', 'g7-finish'];
    for (const key of gateIds) {
      const operation = findOperation(operations, `op.gate-${key}`);
      expect(operation.kind).toBe('inspect');
      expect(operation.declaredReleaseStatus).toBe('held');
      expect(operation.effectiveReleaseStatus).toBe('held');
      const parameters = operation.parameters as { evidenceRequired: string };
      expect(parameters.evidenceRequired).not.toBe('none');
      const issue = compiled.issues.find((candidate) => candidate.id === `issue.r35.gate-${key}`);
      expect(issue?.status).toBe('open');
    }
    const gateStep = findStep(compiled.steps, 'step.p28-gates');
    expect(gateStep.effectiveReleaseStatus).toBe('held');
    const dispositions = bundle.acceptance.issueDispositions;
    for (const key of gateIds) {
      const disposition = dispositions.find((candidate) => candidate.issueId === `issue.r35.gate-${key}`);
      expect(disposition?.disposition, key).toBe('held_open');
    }
    // No ready operation claims gate completion.
    for (const id of READY_OPERATIONS) {
      const operation = findOperation(operations, id);
      expect(JSON.stringify(operation).includes('gate-'), id).toBe(false);
    }
  });
});
