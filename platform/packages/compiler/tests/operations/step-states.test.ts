/**
 * Operations tests: step state history exactly matching the fixture table.
 *
 * The build is frame-first: the frame members start `absent`, are cut, positioned and installed
 * flat, then raised, anchored, the doorway is opened and the frame inspected before the temporary
 * brace is removed and the backing blocks reach `positioned`. The held `step.fasten-backing` must
 * NOT be applied, so the blocks stay `positioned` through inspect/cover/cabinet, and the drywall
 * cover panel stays `absent`.
 */
import { describe, expect, it } from 'vitest';
import type { PartState, StepState } from '@diyguide/schema';
import { buildStepStates, compileBundle, deriveOverlayObjects } from '../../src/index';
import { FIXTURE_DIR, loadFixture } from '../helpers';

const FRAME_MEMBER_IDS = [
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
];
const TEMP_MEMBER_IDS = ['part.demo.temp-racking-brace', 'part.demo.temp-plumb-prop'];

function fixtureStepStates(): { stepStates: StepState[]; load: ReturnType<typeof loadFixture> } {
  const load = loadFixture();
  const { compiled } = compileBundle({
    bundle: load.bundle,
    files: load.files,
    rawFiles: load.rawFiles,
    bundleDir: FIXTURE_DIR,
  });
  if (!compiled) throw new Error('fixture did not compile');
  return { stepStates: compiled.stepStates, load };
}

const stateOf = (rows: StepState['after'], partId: string): PartState | undefined =>
  rows.find((row) => row.partId === partId)?.state;

describe('stepStates history', () => {
  it('covers all 32 parts in every snapshot, starting from initialState', () => {
    const { stepStates, load } = fixtureStepStates();
    expect(stepStates).toHaveLength(18);
    for (const state of stepStates) {
      expect(state.before).toHaveLength(32);
      expect(state.after).toHaveLength(32);
    }
    const firstBefore = stepStates[0]!.before;
    for (const part of load.bundle!.parts) {
      expect(stateOf(firstBefore, part.id)).toBe(part.initialState);
    }
    // The frame parts start absent; the frame operations build them.
    expect(stateOf(firstBefore, 'part.wall-a.bottom-plate')).toBe('absent');
    expect(stateOf(firstBefore, 'part.wall-a.stud-1')).toBe('absent');
    expect(stateOf(firstBefore, 'part.demo.temp-racking-brace')).toBe('absent');
    expect(stateOf(firstBefore, 'part.demo.temp-plumb-prop')).toBe('absent');
    expect(stateOf(firstBefore, 'part.wall-a.backing-a')).toBe('absent');
  });

  it('chains before = previous after', () => {
    const { stepStates } = fixtureStepStates();
    for (let i = 1; i < stepStates.length; i += 1) {
      expect(stepStates[i]!.before).toEqual(stepStates[i - 1]!.after);
    }
  });

  it('applies the expected steps and skips the held ones', () => {
    const { stepStates } = fixtureStepStates();
    const applied = stepStates.map((state) => [state.stepId, state.applied, state.status]);
    expect(applied).toEqual([
      ['step.survey-wall', true, 'ready'],
      ['step.prepare-frame', true, 'ready'],
      ['step.remove-temp', true, 'ready'],
      ['step.cut-frame', true, 'ready'],
      ['step.layout-frame', true, 'ready'],
      ['step.assemble-frame', true, 'ready'],
      ['step.raise-frame', true, 'ready'],
      ['step.anchor-frame', true, 'ready'],
      ['step.open-doorway', true, 'ready'],
      ['step.inspect-frame', true, 'ready'],
      ['step.remove-brace', true, 'ready'],
      ['step.cut-backing', true, 'conditional'],
      ['step.position-backing', true, 'conditional'],
      ['step.fasten-backing', false, 'held'],
      ['step.inspect-backing', false, 'held'],
      ['step.route-cable', true, 'ready'],
      ['step.cover-wall', false, 'held'],
      ['step.position-cabinet', false, 'held'],
    ]);
    for (const state of stepStates) {
      if (state.applied) expect(state.reason, state.stepId).toBeNull();
      else expect(state.reason, state.stepId).toBeTruthy();
    }
  });

  it('applies the architectural history exactly', () => {
    const { stepStates } = fixtureStepStates();
    const after = (stepId: string): StepState['after'] => {
      const state = stepStates.find((candidate) => candidate.stepId === stepId);
      if (!state) throw new Error(`missing stepState ${stepId}`);
      return state.after;
    };

    // survey and prepare: no state changes; the frame is still absent
    expect(stateOf(after('step.survey-wall'), 'part.wall-a.bottom-plate')).toBe('absent');
    expect(stateOf(after('step.prepare-frame'), 'part.wall-a.bottom-plate')).toBe('absent');
    expect(stateOf(after('step.prepare-frame'), 'part.wall-a.backing-a')).toBe('absent');
    // remove-temp: temp panel removed
    expect(stateOf(after('step.remove-temp'), 'part.demo.temp-panel')).toBe('removed');
    // cut-frame: every frame member and both temporary members absent -> cut
    for (const partId of [...FRAME_MEMBER_IDS, ...TEMP_MEMBER_IDS]) {
      expect(stateOf(after('step.cut-frame'), partId), partId).toBe('cut');
    }
    // layout-frame: frame members cut -> positioned (temporary members stay cut aside)
    for (const partId of FRAME_MEMBER_IDS) {
      expect(stateOf(after('step.layout-frame'), partId), partId).toBe('positioned');
    }
    for (const partId of TEMP_MEMBER_IDS) {
      expect(stateOf(after('step.layout-frame'), partId), partId).toBe('cut');
    }
    // assemble-frame: positioned -> installed, and the opening becomes real
    for (const partId of FRAME_MEMBER_IDS) {
      expect(stateOf(after('step.assemble-frame'), partId), partId).toBe('installed');
    }
    expect(stateOf(after('step.assemble-frame'), 'part.wall-a.opening')).toBe('installed');
    // raise-frame: racking brace and plumb prop are fitted; the frame stays installed
    for (const partId of TEMP_MEMBER_IDS) {
      expect(stateOf(after('step.raise-frame'), partId), partId).toBe('installed');
    }
    expect(stateOf(after('step.raise-frame'), 'part.wall-a.stud-1')).toBe('installed');
    // anchor-frame: no state change; the continuous plate is still one installed part
    expect(stateOf(after('step.anchor-frame'), 'part.wall-a.bottom-plate')).toBe('installed');
    // open-doorway: the continuous plate is replaced by the two remaining segments
    expect(stateOf(after('step.open-doorway'), 'part.wall-a.bottom-plate')).toBe('removed');
    expect(stateOf(after('step.open-doorway'), 'part.wall-a.bottom-plate-left')).toBe('installed');
    expect(stateOf(after('step.open-doorway'), 'part.wall-a.bottom-plate-right')).toBe('installed');
    expect(stateOf(after('step.inspect-frame'), 'part.wall-a.header-ply-a')).toBe('installed');
    // remove-brace: both temporary members are stored; the frame stays installed
    for (const partId of TEMP_MEMBER_IDS) {
      expect(stateOf(after('step.remove-brace'), partId), partId).toBe('removed');
    }
    // cut-backing: conditional preview applied
    expect(stateOf(after('step.cut-backing'), 'part.wall-a.backing-a')).toBe('cut');
    expect(stateOf(after('step.position-backing'), 'part.wall-a.backing-a')).toBe('positioned');
    expect(stateOf(after('step.position-backing'), 'part.wall-a.backing-b')).toBe('positioned');
    // fasten-backing (held) NOT applied: blocks stay positioned
    expect(stateOf(after('step.fasten-backing'), 'part.wall-a.backing-a')).toBe('positioned');
    expect(stateOf(after('step.inspect-backing'), 'part.wall-a.backing-a')).toBe('positioned');
    // route-cable: cable/box/terminal installed
    expect(stateOf(after('step.route-cable'), 'part.demo.cable')).toBe('installed');
    expect(stateOf(after('step.route-cable'), 'part.demo.junction-box')).toBe('installed');
    expect(stateOf(after('step.route-cable'), 'part.demo.terminal')).toBe('installed');
    // cover-wall and position-cabinet (held) NOT applied: cover stays absent, framing installed
    expect(stateOf(after('step.cover-wall'), 'part.wall-a.cover-panel')).toBe('absent');
    expect(stateOf(after('step.cover-wall'), 'part.wall-a.stud-1')).toBe('installed');
    expect(stateOf(after('step.position-cabinet'), 'part.cabinet.envelope')).toBe('absent');
    expect(stateOf(after('step.position-cabinet'), 'part.wall-a.backing-a')).toBe('positioned');
  });

  it('attaches overlay ids of each step operations', () => {
    const { stepStates } = fixtureStepStates();
    const cutFrame = stepStates.find((state) => state.stepId === 'step.cut-frame')!;
    expect(cutFrame.overlayIds).toEqual(['overlay.cut-frame.tool']);
    const layout = stepStates.find((state) => state.stepId === 'step.layout-frame')!;
    expect(layout.overlayIds).toEqual(['overlay.layout-frame.tool']);
    const assemble = stepStates.find((state) => state.stepId === 'step.assemble-frame')!;
    expect(assemble.overlayIds).toEqual([
      ...Array.from({ length: 40 }, (_, index) => `overlay.assemble-frame.p${index + 1}`),
      'overlay.assemble-frame.tool',
    ]);
    const raise = stepStates.find((state) => state.stepId === 'step.raise-frame')!;
    expect(raise.overlayIds).toEqual(['overlay.raise-frame.tool']);
    const removeBrace = stepStates.find((state) => state.stepId === 'step.remove-brace')!;
    expect(removeBrace.overlayIds).toEqual([]);
    const anchor = stepStates.find((state) => state.stepId === 'step.anchor-frame')!;
    expect(anchor.overlayIds).toEqual([
      'overlay.anchor-frame.p1',
      'overlay.anchor-frame.p2',
      'overlay.anchor-frame.p3',
      'overlay.anchor-frame.tool',
    ]);
    const fasten = stepStates.find((state) => state.stepId === 'step.fasten-backing')!;
    expect(fasten.overlayIds).toEqual([
      'overlay.fasten-backing.p1',
      'overlay.fasten-backing.p2',
      'overlay.fasten-backing.p3',
      'overlay.fasten-backing.p4',
    ]);
    const route = stepStates.find((state) => state.stepId === 'step.route-cable')!;
    expect(route.overlayIds).toEqual(['overlay.route-cable.route']);
    expect(stepStates[0]!.overlayIds).toEqual([]);
    expect(stepStates.find((state) => state.stepId === 'step.prepare-frame')!.overlayIds).toEqual([]);
    expect(stepStates.find((state) => state.stepId === 'step.remove-brace')!.overlayIds).toEqual([]);
  });

  it('derives equivalent step states from the public buildStepStates input', () => {
    const load = loadFixture();
    const compiledOps = new Map(
      (load.bundle!.operations ?? []).map((op) => [op.id, op]),
    );
    const operationsEffective = new Map(
      compileBundle({ bundle: load.bundle, files: load.files, rawFiles: load.rawFiles, bundleDir: FIXTURE_DIR }).compiled!.operations.map(
        (op) => [op.id, op.effectiveReleaseStatus],
      ),
    );
    const overlays = deriveOverlayObjects({ bundle: load.bundle!, operationsEffective });
    const direct = buildStepStates({ bundle: load.bundle!, operationsEffective, overlays });
    const { stepStates } = fixtureStepStates();
    expect(direct).toEqual(stepStates);
    expect(compiledOps.size).toBe(19);
  });
});
