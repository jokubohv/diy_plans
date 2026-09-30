import { describe, expect, it } from 'vitest';
import type { MeasurementResult, ApplyOptions, VisibilityState } from '../src/types';
import type { HostCall, RecordingHost } from '../src/recordingHost';
import { createRecordingHost } from '../src/recordingHost';
import { mergedRecipeForStep, stateAtStep } from '../src/stepState';
import { createFixture } from './fixture';

const CONTAINER = { name: 'fixture-container' } as unknown as HTMLElement;

function callsOf(host: RecordingHost, method: string): HostCall[] {
  return host.calls.filter((call) => call.method === method);
}

function lastCall(host: RecordingHost, method: string): HostCall {
  const calls = callsOf(host, method);
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1]!;
}

function lastApplyOptions(host: RecordingHost): ApplyOptions {
  return lastCall(host, 'applyState').args[1] as ApplyOptions;
}

function lastVisibility(host: RecordingHost): VisibilityState {
  return lastCall(host, 'setVisibility').args[0] as VisibilityState;
}

async function mountedHost(): Promise<RecordingHost> {
  const host = createRecordingHost(createFixture());
  await host.mount(CONTAINER);
  return host;
}

describe('createViewerHost via recording adapter', () => {
  it('mounts by loading the compiled guide into the container and forwards ready', async () => {
    const host = createRecordingHost(createFixture());
    const readyEvents: number[] = [];
    host.on('ready', () => readyEvents.push(1));
    const mounting = host.mount(CONTAINER);
    expect(host.getState().mounted).toBe(false);
    host.emitReady();
    await mounting;
    expect(host.getState().mounted).toBe(true);
    expect(host.getState().ready).toBe(true);
    expect(host.getState().failed).toBe(false);
    expect(readyEvents).toEqual([1]);
    const loadInput = callsOf(host, 'load')[0]!.args[0] as {
      compiled: unknown;
      container: unknown;
    };
    expect(loadInput.container).toBe(CONTAINER);
    expect(loadInput.compiled).toBe(host.compiled);
  });

  it('forwards adapter selection and error events into host state', async () => {
    const host = await mountedHost();
    const selections: string[][] = [];
    const errors: string[] = [];
    host.on('selection', (partIds) => selections.push(partIds));
    host.on('error', (message) => errors.push(message));
    host.emitSelection(['part.backing', 'part.stud.a']);
    expect(host.getState().selection).toEqual(['part.backing', 'part.stud.a']);
    expect(selections).toEqual([['part.backing', 'part.stud.a']]);
    host.emitError('webgl context lost');
    expect(host.getState().failed).toBe(true);
    expect(errors).toEqual(['webgl context lost']);
  });

  it('disposes the adapter once and refuses to mount afterwards', async () => {
    const host = await mountedHost();
    host.dispose();
    host.dispose();
    expect(callsOf(host, 'dispose')).toHaveLength(1);
    await expect(host.mount(CONTAINER)).rejects.toThrow(/disposed/);
  });
});

describe('step navigation determinism', () => {
  it('records the same applyState call when the same step is visited again', async () => {
    const host = await mountedHost();
    const stepEvents: number[] = [];
    host.on('step', (index) => stepEvents.push(index));

    host.goToStep(4);
    const firstVisit = callsOf(host, 'applyState').slice();
    host.goToStep(2);
    host.goToStep(4);
    const secondVisit = callsOf(host, 'applyState').slice(2);

    expect(secondVisit).toEqual(firstVisit);
    expect(stepEvents).toEqual([4, 2, 4]);
  });

  it('applies the step after snapshot and merged recipe', async () => {
    const host = await mountedHost();
    host.goToStep(4);
    const applyCall = callsOf(host, 'applyState')[0]!;
    expect(applyCall.args[0]).toEqual(stateAtStep(host.compiled, 4).after);
    const options = applyCall.args[1] as ApplyOptions;
    expect(options.recipe).toEqual(mergedRecipeForStep(host.compiled, 4));
    expect(options.focusPartIds).toEqual([]);
  });

  it('applies the step camera preset when the step declares one', async () => {
    const host = await mountedHost();
    host.goToStep(0);
    expect(lastCall(host, 'setCamera').args[0]).toEqual({
      positionMm: [2000, -2000, 1800],
      targetMm: [500, 0, 1000],
      upMm: [0, 0, 1],
      fov: 50,
    });
    host.goToStep(2);
    expect(lastCall(host, 'setCamera').args[0]).toEqual({
      positionMm: [1600, -600, 1100],
      targetMm: [1000, 50, 900],
      fov: 35,
    });
  });

  it('frames the whole model once on mount', async () => {
    const host = await mountedHost();
    expect(callsOf(host, 'setCamera')[0]!.args[0]).toEqual({ fit: 'all' });
  });

  it('passes step operation highlights as focusPartIds', async () => {
    const host = await mountedHost();
    host.goToStep(2);
    expect(lastApplyOptions(host).focusPartIds).toEqual(['part.backing']);
  });

  it('keeps recipe reveal parts visible as non-canonical presentation context', async () => {
    const compiled = createFixture();
    compiled.operations[0]!.view.recipe.reveal = ['part.backing'];
    const host = createRecordingHost(compiled);
    await host.mount(CONTAINER);
    host.goToStep(0);
    expect(lastVisibility(host).hiddenPartIds).not.toContain('part.backing');
    expect(lastApplyOptions(host).recipe?.reveal).toEqual(['part.backing']);
  });

  it('clamps out-of-range indexes instead of throwing', async () => {
    const host = await mountedHost();
    host.goToStep(99);
    expect(host.getState().currentStepIndex).toBe(4);
    host.goToStep(-5);
    expect(host.getState().currentStepIndex).toBe(0);
  });

  it('animates forward applied steps only, never on reduced motion or held steps', async () => {
    const host = await mountedHost();
    host.goToStep(0);
    expect(lastApplyOptions(host).animate).toBe(true);
    expect(lastApplyOptions(host).reducedMotion).toBe(false);

    host.goToStep(1);
    expect(lastApplyOptions(host).animate).toBe(true);

    // Backward movement is an instantaneous deterministic seek.
    host.goToStep(0);
    expect(lastApplyOptions(host).animate).toBe(false);

    // Forward to a held (not applied) step must not animate.
    host.goToStep(3);
    expect(lastApplyOptions(host).animate).toBe(false);

    host.goToStep(4, { reducedMotion: true });
    expect(lastApplyOptions(host).animate).toBe(false);
    expect(lastApplyOptions(host).reducedMotion).toBe(true);

    // Re-entering the same step is not a forward move.
    host.goToStep(4);
    expect(lastApplyOptions(host).animate).toBe(false);
  });
});

describe('visibility', () => {
  it('recomputes hiddenPartIds from the step snapshot and step view hiddenPartIds', async () => {
    const host = await mountedHost();
    host.goToStep(0);
    expect(lastVisibility(host).hiddenPartIds).toEqual([
      'part.stud.a',
      'part.backing',
      'part.drywall',
      'part.cabinet',
    ]);
    host.goToStep(2);
    expect(lastVisibility(host).hiddenPartIds).toEqual([
      'part.existing.wall',
      'part.temp.brace',
      'part.stud.a',
      'part.drywall',
      'part.cabinet',
    ]);
  });

  it('keeps isolate/xray toggles across step navigation', async () => {
    const host = await mountedHost();
    host.goToStep(0);
    host.isolate(['part.backing']);
    expect(lastVisibility(host).isolatedPartIds).toEqual(['part.backing']);
    host.toggleXray(['part.stud.a']);
    expect(lastVisibility(host).xrayPartIds).toEqual(['part.stud.a']);

    host.goToStep(2);
    expect(lastVisibility(host).isolatedPartIds).toEqual(['part.backing']);
    expect(lastVisibility(host).xrayPartIds).toEqual(['part.stud.a']);

    host.isolate(null);
    expect(lastVisibility(host).isolatedPartIds).toEqual([]);
    host.toggleXray(null);
    expect(lastVisibility(host).xrayPartIds).toEqual([]);
  });

  it('recomputes covered visibility without changing the step', async () => {
    const host = await mountedHost();
    host.goToStep(4);
    expect(lastVisibility(host).showCovered).toBe(false);
    expect(lastVisibility(host).hiddenPartIds).toEqual([
      'part.temp.brace',
      'part.stud.a',
      'part.backing',
      'part.drywall',
      'part.cabinet',
    ]);

    host.setShowCovered(true);
    expect(host.getState().currentStepIndex).toBe(4);
    expect(lastVisibility(host).showCovered).toBe(true);
    expect(lastVisibility(host).hiddenPartIds).toEqual([
      'part.temp.brace',
      'part.stud.a',
      'part.cabinet',
    ]);

    host.setShowCovered(false);
    expect(lastVisibility(host).hiddenPartIds).toContain('part.backing');
    expect(lastVisibility(host).hiddenPartIds).toContain('part.drywall');
  });

  it('applies and clears a section plane', async () => {
    const host = await mountedHost();
    host.setSection({ axis: 'z', offsetMm: 1200 });
    expect(host.getState().sectionPlane).toEqual({ axis: 'z', offsetMm: 1200 });
    expect(lastCall(host, 'setSection').args[0]).toEqual({ axis: 'z', offsetMm: 1200 });
    host.setSection(null);
    expect(lastCall(host, 'setSection').args[0]).toBeNull();
  });
});

describe('selection', () => {
  it('selects, highlights and clears through the adapter', async () => {
    const host = await mountedHost();
    const selections: string[][] = [];
    host.on('selection', (partIds) => selections.push(partIds));
    host.select(['part.backing']);
    expect(host.getState().selection).toEqual(['part.backing']);
    expect(lastCall(host, 'select').args[0]).toEqual(['part.backing']);
    expect(lastCall(host, 'setEmphasis').args).toEqual([['part.backing'], 'highlight']);
    expect(selections).toEqual([['part.backing']]);

    host.select([]);
    expect(host.getState().selection).toEqual([]);
    expect(lastCall(host, 'setEmphasis').args).toEqual([[], 'none']);
    expect(selections.at(-1)).toEqual([]);
  });
});

describe('camera', () => {
  it('resolves preset ids against compiled.views with canonical values', async () => {
    const host = await mountedHost();
    host.setCamera({ presetId: 'view.iso' });
    expect(lastCall(host, 'setCamera').args[0]).toEqual({
      positionMm: [2000, -2000, 1800],
      targetMm: [500, 0, 1000],
      upMm: [0, 0, 1],
      fov: 50,
    });
    host.setCamera({ presetId: 'view.fasten' });
    expect(lastCall(host, 'setCamera').args[0]).toEqual({
      positionMm: [1600, -600, 1100],
      targetMm: [1000, 50, 900],
      fov: 35,
    });
  });

  it('passes through fit:all and explicit cameras', async () => {
    const host = await mountedHost();
    host.setCamera({ fit: 'all' });
    expect(lastCall(host, 'setCamera').args[0]).toEqual({ fit: 'all' });
    host.setCamera({ positionMm: [1, 2, 3], targetMm: [4, 5, 6], fov: 60 });
    expect(lastCall(host, 'setCamera').args[0]).toEqual({
      positionMm: [1, 2, 3],
      targetMm: [4, 5, 6],
      fov: 60,
    });
  });

  it('reports unknown presets without calling the adapter', async () => {
    const host = await mountedHost();
    const errors: string[] = [];
    host.on('error', (message) => errors.push(message));
    const before = callsOf(host, 'setCamera').length;
    host.setCamera({ presetId: 'view.missing' });
    expect(callsOf(host, 'setCamera')).toHaveLength(before);
    expect(errors).toEqual(['unknown camera preset: view.missing']);
  });
});

describe('measurement', () => {
  it('accumulates picks, measures at two points and restarts on a third', async () => {
    const host = await mountedHost();
    const measurements: MeasurementResult[] = [];
    host.on('measure', (result) => measurements.push(result));

    host.setMeasureMode(true);
    expect(lastCall(host, 'setSelectionMode').args[0]).toBe('measure');

    host.pick({ pointMm: [0, 0, 0], partId: null });
    expect(host.getState().measurePointsMm).toEqual([[0, 0, 0]]);
    expect(callsOf(host, 'measure')).toHaveLength(0);

    host.pick({ pointMm: [3000, 0, 0], partId: 'part.existing.wall' });
    expect(callsOf(host, 'measure')).toHaveLength(1);
    expect(lastCall(host, 'measure').args[0]).toEqual([
      [0, 0, 0],
      [3000, 0, 0],
    ]);
    expect(measurements).toHaveLength(1);
    expect(measurements[0]).toMatchObject({
      kind: 'distance',
      valueMm: 3000,
      valueDeg: null,
      approximate: true,
    });
    expect(host.getState().measurement?.valueMm).toBe(3000);

    // A third click starts a new pair instead of extending the old one.
    host.pick({ pointMm: [1, 0, 0], partId: null });
    expect(host.getState().measurePointsMm).toEqual([[1, 0, 0]]);
    host.pick({ pointMm: [5, 0, 0], partId: null });
    expect(measurements.at(-1)?.valueMm).toBe(4);

    host.clearMeasurement();
    expect(host.getState().measurePointsMm).toEqual([]);
    expect(host.getState().measurement).toBeNull();

    host.setMeasureMode(false);
    expect(lastCall(host, 'setSelectionMode').args[0]).toBe('select');
  });

  it('ignores picks outside measure mode', async () => {
    const host = await mountedHost();
    host.pick({ pointMm: [1, 2, 3], partId: 'part.backing' });
    expect(host.getState().measurePointsMm).toEqual([]);
  });
});

describe('overlays', () => {
  it('maps step overlays into the adapter OverlayState', async () => {
    const host = await mountedHost();
    host.goToStep(3);
    expect(lastCall(host, 'setOverlays').args[0]).toEqual({
      fastenerPoints: [
        {
          overlayId: 'overlay.fasten-backing.p1',
          positionMm: [1000, 69, 900],
          state: 'proposed',
          label: 'Proposed fastener',
        },
      ],
      routePaths: [],
      toolProxy: null,
    });
    host.goToStep(4);
    expect(lastCall(host, 'setOverlays').args[0]).toEqual({
      fastenerPoints: [],
      routePaths: [
        {
          overlayId: 'overlay.route.cable',
          pathPointsMm: [
            [0, 0, 300],
            [2200, 0, 300],
          ],
          state: 'released',
          label: 'Cable route (schematic)',
        },
      ],
      toolProxy: null,
    });
  });
});

describe('getState', () => {
  it('returns defensive copies of every mutable field', async () => {
    const host = await mountedHost();
    host.goToStep(4);
    host.select(['part.backing']);
    host.setMeasureMode(true);
    host.pick({ pointMm: [1, 2, 3], partId: null });
    const snapshot = host.getState();
    snapshot.selection.push('bogus');
    snapshot.visibility.hiddenPartIds.push('bogus');
    snapshot.visibility.isolatedPartIds.push('bogus');
    snapshot.measurePointsMm.push([9, 9, 9]);
    if (snapshot.sectionPlane) snapshot.sectionPlane.offsetMm = 999;
    const fresh = host.getState();
    expect(fresh.selection).toEqual(['part.backing']);
    expect(fresh.visibility.hiddenPartIds).not.toContain('bogus');
    expect(fresh.visibility.isolatedPartIds).not.toContain('bogus');
    expect(fresh.measurePointsMm).toEqual([[1, 2, 3]]);
  });
});
