import { describe, expect, it } from 'vitest';
import type { PartState } from '@diyguide/schema';
import {
  PART_STATE_VISIBILITY,
  mergedRecipeForStep,
  overlaysForStep,
  stateAtStep,
  stateLabel,
  visiblePartIds,
} from '../src/stepState';
import { createFixture } from './fixture';

describe('PART_STATE_VISIBILITY', () => {
  it('pins the frozen state mapping', () => {
    expect(PART_STATE_VISIBILITY).toEqual({
      absent: 'hidden',
      removed: 'hidden',
      covered: 'covered',
      existing: 'visible',
      cut: 'visible',
      positioned: 'visible',
      installed: 'visible',
    });
  });
});

describe('stateLabel', () => {
  it('returns human text for every state', () => {
    expect(stateLabel('absent')).toBe('not yet installed');
    expect(stateLabel('existing')).toBe('existing');
    expect(stateLabel('removed')).toBe('removed');
    expect(stateLabel('cut')).toBe('cut to size');
    expect(stateLabel('positioned')).toBe('positioned');
    expect(stateLabel('installed')).toBe('installed');
    expect(stateLabel('covered')).toBe('covered');
  });
});

describe('visiblePartIds', () => {
  const compiled = createFixture();

  it('maps snapshot states to visible ids in compiled.parts order', () => {
    const s0 = stateAtStep(compiled, 0).after;
    expect(visiblePartIds(compiled, s0, { showCovered: false })).toEqual([
      'part.existing.wall',
      'part.temp.brace',
    ]);
    const s2 = stateAtStep(compiled, 2).after;
    expect(visiblePartIds(compiled, s2, { showCovered: false })).toEqual([
      'part.existing.wall',
      'part.backing',
    ]);
  });

  it('hides removed and absent parts and applies extra hidden ids', () => {
    const s2 = stateAtStep(compiled, 2).after;
    expect(
      visiblePartIds(compiled, s2, {
        showCovered: false,
        extraHiddenPartIds: ['part.existing.wall'],
      }),
    ).toEqual(['part.backing']);
    const s1 = stateAtStep(compiled, 1).after;
    expect(visiblePartIds(compiled, s1, { showCovered: false })).toEqual(['part.existing.wall']);
  });

  it('can reveal absent parts as presentation-only context without overriding explicit hides', () => {
    const s1 = stateAtStep(compiled, 1).after;
    expect(
      visiblePartIds(compiled, s1, {
        showCovered: false,
        extraVisiblePartIds: ['part.backing'],
      }),
    ).toEqual(['part.existing.wall', 'part.backing']);
    expect(
      visiblePartIds(compiled, s1, {
        showCovered: false,
        extraVisiblePartIds: ['part.backing'],
        extraHiddenPartIds: ['part.backing'],
      }),
    ).toEqual(['part.existing.wall']);
  });

  it('shows covered parts only when showCovered is set', () => {
    const s4 = stateAtStep(compiled, 4).after;
    expect(visiblePartIds(compiled, s4, { showCovered: false })).toEqual(['part.existing.wall']);
    expect(visiblePartIds(compiled, s4, { showCovered: true })).toEqual([
      'part.existing.wall',
      'part.backing',
      'part.drywall',
    ]);
  });

  it('falls back to initialState for parts missing from the snapshot and ignores unknown ids', () => {
    const visible = visiblePartIds(compiled, [{ partId: 'part.unknown', state: 'installed' }], {
      showCovered: false,
    });
    expect(visible).toEqual(['part.existing.wall', 'part.temp.brace']);
  });
});

describe('stateAtStep', () => {
  const compiled = createFixture();

  it('returns the requested step state', () => {
    const state = stateAtStep(compiled, 2);
    expect(state.stepId).toBe('step.position-backing');
    expect(state.index).toBe(2);
    expect(state.applied).toBe(true);
    expect(state.after).toEqual(compiled.stepStates[2]!.after);
  });

  it('throws for out-of-range indexes', () => {
    expect(() => stateAtStep(compiled, 5)).toThrow(RangeError);
    expect(() => stateAtStep(compiled, -1)).toThrow(RangeError);
    expect(() => stateAtStep(compiled, 1.5)).toThrow(RangeError);
  });

  it('returns a defensive copy that cannot mutate the compiled guide', () => {
    const state = stateAtStep(compiled, 0);
    expect(state).not.toBe(compiled.stepStates[0]);
    state.after[0]!.state = 'installed';
    state.overlayIds.push('overlay.bogus');
    expect(compiled.stepStates[0]!.after[0]!.state).toBe('existing');
    expect(compiled.stepStates[0]!.overlayIds).toEqual([]);
  });
});

describe('overlaysForStep', () => {
  const compiled = createFixture();

  it('selects overlays by step overlayIds and preserves declared order', () => {
    expect(overlaysForStep(compiled, 0)).toEqual([]);
    const fasten = overlaysForStep(compiled, 3);
    expect(fasten.map((overlay) => overlay.id)).toEqual(['overlay.fasten-backing.p1']);
    expect(fasten[0]).toMatchObject({ kind: 'fastener_point', state: 'proposed' });
    const cover = overlaysForStep(compiled, 4);
    expect(cover.map((overlay) => overlay.id)).toEqual([
      'overlay.route.cable',
      'overlay.dimension.1',
    ]);
  });

  it('returns copies, not references into the compiled guide', () => {
    const [overlay] = overlaysForStep(compiled, 3);
    expect(overlay).not.toBe(compiled.overlays[0]);
    overlay!.label = 'mutated';
    expect(compiled.overlays[0]!.label).toBe('Proposed fastener');
  });

  it('throws for out-of-range indexes', () => {
    expect(() => overlaysForStep(compiled, 99)).toThrow(RangeError);
  });
});

describe('mergedRecipeForStep', () => {
  it('merges non-empty recipe fields of the step operations', () => {
    const compiled = createFixture();
    expect(mergedRecipeForStep(compiled, 0)).toEqual({});
    expect(mergedRecipeForStep(compiled, 2)).toEqual({
      reveal: ['part.backing'],
      translateFrom: { partId: 'part.backing', offsetMm: [-250, 0, 0] },
    });
  });

  it('lets later operations win per field and keeps earlier fields', () => {
    const compiled = createFixture();
    expect(mergedRecipeForStep(compiled, 4)).toEqual({
      cutaway: { enabled: true },
      routePath: { partId: 'part.drywall' },
    });
  });

  it('never lets an empty field overwrite an earlier value', () => {
    const compiled = createFixture();
    const later = compiled.steps[4]!.operationIds[1]!;
    const laterOperation = compiled.operations.find((operation) => operation.id === later)!;
    laterOperation.view.recipe.reveal = [];
    const earlier = compiled.steps[4]!.operationIds[0]!;
    const earlierOperation = compiled.operations.find((operation) => operation.id === earlier)!;
    earlierOperation.view.recipe.reveal = ['part.drywall'];
    expect(mergedRecipeForStep(compiled, 4).reveal).toEqual(['part.drywall']);
  });

  it('keeps a held step preview recipe (proposed fastener points)', () => {
    const compiled = createFixture();
    expect(mergedRecipeForStep(compiled, 3)).toEqual({
      showFastenerPoints: { connectionId: 'conn.backing-stud', proposed: true },
    });
  });

  it('throws for out-of-range indexes', () => {
    const compiled = createFixture();
    expect(() => mergedRecipeForStep(compiled, 5)).toThrow(RangeError);
  });
});

describe('held-step preview', () => {
  it('keeps the backing at positioned when the fasten step is not applied', () => {
    const compiled = createFixture();
    const positionStep = stateAtStep(compiled, 2);
    const fastenStep = stateAtStep(compiled, 3);
    expect(fastenStep.applied).toBe(false);
    expect(fastenStep.status).toBe('held');
    expect(fastenStep.reason).not.toBeNull();
    expect(fastenStep.after).toEqual(positionStep.after);
    const backing = fastenStep.after.find((row) => row.partId === 'part.backing');
    expect(backing?.state).toBe('positioned');
    // The held step may still show proposed connection locations as placeholders.
    const overlays = overlaysForStep(compiled, 3);
    expect(overlays).toHaveLength(1);
    expect(overlays[0]!.state).toBe('proposed');
  });

  it('would only install the backing when the held operation were applied', () => {
    const compiled = createFixture();
    const fastenOperation = compiled.operations.find(
      (operation) => operation.id === 'op.fasten-backing',
    )!;
    expect(fastenOperation.stateEffects).toContainEqual({
      partId: 'part.backing',
      fromState: 'positioned',
      toState: 'installed',
    });
    const states = stateAtStep(compiled, 3).after;
    expect(states.some((row) => row.state === 'installed')).toBe(false);
  });
});

describe('state coverage conventions', () => {
  it('uses the canonical PartState union exhaustively', () => {
    const states: PartState[] = [
      'absent',
      'existing',
      'removed',
      'cut',
      'positioned',
      'installed',
      'covered',
    ];
    for (const state of states) {
      expect(typeof stateLabel(state)).toBe('string');
      expect(PART_STATE_VISIBILITY[state]).toBeDefined();
    }
  });
});
