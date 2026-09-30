/**
 * Operations tests: effective release statuses exactly matching the fixture table.
 *
 * Propagation uses the full rank order (architecture.md §5, reconciled 2026-09-29): a
 * conditional dependency propagates a condition and a held dependency propagates a hold.
 * `op.position-backing` (declared ready, dependency `op.cut-backing` conditional) is therefore
 * effectively conditional, while still being applied to the preview because its parameters are
 * complete. `op.inspect-backing`/`op.cover-drywall`/`op.position-cabinet` inherit the hold.
 * The frame operations are all effectively ready; the cabinet-backing chain is conditional and
 * the four held steps down the backing/cabinet/cover chain stay held.
 */
import { describe, expect, it } from 'vitest';
import type { Operation, ReleaseStatus } from '@diyguide/schema';
import {
  compileBundle,
  computeEffectiveOperationStatuses,
  effectiveOperationStatus,
  effectiveStepStatus,
  propagatesStatus,
  statusRank,
  worstStatus,
} from '../../src/index';
import { FIXTURE_DIR, loadFixture } from '../helpers';

const EXPECTED_OPERATIONS: Record<string, ReleaseStatus> = {
  'op.survey-wall': 'ready',
  'op.prepare-frame': 'ready',
  'op.remove-temp': 'ready',
  'op.cut-frame': 'ready',
  'op.layout-frame': 'ready',
  'op.assemble-frame': 'ready',
  'op.raise-frame': 'ready',
  'op.anchor-frame': 'ready',
  'op.open-doorway': 'ready',
  'op.inspect-frame': 'ready',
  'op.remove-brace': 'ready',
  'op.remove-plumb-prop': 'ready',
  'op.cut-backing': 'conditional',
  'op.position-backing': 'conditional',
  'op.fasten-backing': 'held',
  'op.inspect-backing': 'held',
  'op.route-cable': 'ready',
  'op.cover-drywall': 'held',
  'op.position-cabinet': 'held',
};

const EXPECTED_STEPS: Record<string, ReleaseStatus> = {
  'step.survey-wall': 'ready',
  'step.prepare-frame': 'ready',
  'step.remove-temp': 'ready',
  'step.cut-frame': 'ready',
  'step.layout-frame': 'ready',
  'step.assemble-frame': 'ready',
  'step.raise-frame': 'ready',
  'step.anchor-frame': 'ready',
  'step.open-doorway': 'ready',
  'step.inspect-frame': 'ready',
  'step.remove-brace': 'ready',
  'step.cut-backing': 'conditional',
  'step.position-backing': 'conditional',
  'step.fasten-backing': 'held',
  'step.inspect-backing': 'held',
  'step.route-cable': 'ready',
  'step.cover-wall': 'held',
  'step.position-cabinet': 'held',
};

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

describe('effective statuses on the fixture', () => {
  const compiled = compiledFixture();

  it('matches the fixture operation table exactly', () => {
    const actual: Record<string, ReleaseStatus> = {};
    for (const operation of compiled.operations) actual[operation.id] = operation.effectiveReleaseStatus;
    expect(actual).toEqual(EXPECTED_OPERATIONS);
  });

  it('matches the fixture step table exactly', () => {
    const actual: Record<string, ReleaseStatus> = {};
    for (const step of compiled.steps) actual[step.id] = step.effectiveReleaseStatus;
    expect(actual).toEqual(EXPECTED_STEPS);
  });

  it('propagates hold through inspect -> cover -> cabinet chains', () => {
    const byId = new Map(compiled.operations.map((op) => [op.id, op]));
    expect(effectiveOperationStatus(byId.get('op.inspect-backing')!, byId)).toBe('held');
    expect(effectiveOperationStatus(byId.get('op.cover-drywall')!, byId)).toBe('held');
    expect(effectiveOperationStatus(byId.get('op.position-cabinet')!, byId)).toBe('held');
  });

  it('propagates the condition from cut through position-backing', () => {
    const steps = new Map(compiled.steps.map((step) => [step.id, step]));
    const operations = new Map(compiled.operations.map((op) => [op.id, op]));
    expect(effectiveStepStatus(steps.get('step.position-backing')!, operations, steps)).toBe('conditional');
  });

  it('keeps connections at their declared status in P0', () => {
    const statuses = Object.fromEntries(compiled.connections.map((connection) => [connection.id, connection.effectiveReleaseStatus]));
    expect(statuses).toEqual({
      'connection.backing-a.stud-2': 'held',
      'connection.backing-b.king-left': 'held',
      'connection.frame.plate-to-stud': 'ready',
      'connection.frame.plate-to-slab': 'ready',
    });
  });
});

describe('status helpers', () => {
  it('keeps the frozen rank order', () => {
    expect(statusRank('not_applicable')).toBe(0);
    expect(statusRank('ready')).toBe(1);
    expect(statusRank('conditional')).toBe(2);
    expect(statusRank('held')).toBe(3);
    expect(statusRank('superseded')).toBe(4);
    expect(worstStatus('ready', 'conditional', 'held')).toBe('held');
    expect(worstStatus('ready', 'conditional')).toBe('conditional');
    expect(worstStatus()).toBe('not_applicable');
  });

  it('propagates conditional and stricter statuses', () => {
    expect(propagatesStatus('ready')).toBe(false);
    expect(propagatesStatus('conditional')).toBe(true);
    expect(propagatesStatus('held')).toBe(true);
    expect(propagatesStatus('superseded')).toBe(true);
  });

  it('computes operation statuses transitively and cycle-safely', () => {
    const make = (id: string, declared: ReleaseStatus, deps: string[]): Operation =>
      ({
        id,
        kind: 'survey',
        title: id,
        targetPartIds: [],
        dependencyOperationIds: deps,
        citationIds: [],
        declaredReleaseStatus: declared,
        stateEffects: [],
        view: { highlightPartIds: [], hiddenPartIds: [], recipe: {} },
        parameters: { measurementIds: [], checkInstruction: 'x' },
      }) as unknown as Operation;

    const operations = [
      make('op.a', 'held', []),
      make('op.b', 'conditional', ['op.a']),
      make('op.c', 'ready', ['op.b']),
      make('op.d', 'ready', ['op.e']),
      make('op.e', 'ready', ['op.d']), // cycle guard must not hang
      make('op.g', 'conditional', []),
      make('op.f', 'ready', ['op.g']),
    ];
    const statuses = computeEffectiveOperationStatuses(operations);
    expect(statuses.get('op.a')).toBe('held');
    expect(statuses.get('op.b')).toBe('held');
    expect(statuses.get('op.c')).toBe('held');
    expect(statuses.get('op.d')).toBe('ready');
    expect(statuses.get('op.e')).toBe('ready');
    expect(statuses.get('op.f')).toBe('conditional');
    expect(statuses.get('op.g')).toBe('conditional');
  });
});
