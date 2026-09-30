/**
 * R35 dimensions test: fraction/rational parsing, the exact dimension chains and the safety rails
 * (111 in is never a cut; unknown widths never become cut locations).
 */
import { describe, expect, it } from 'vitest';
import { parseLengthToMm, parseNumericRational } from '../../src/fraction';
import { compileR35, readWorkJson } from './helpers';

function mmOf(value: string, unit: 'in' | 'mm' = 'in'): number {
  return parseLengthToMm(value, unit).mm;
}

describe('R35 fraction and rational parsing', () => {
  it('parses "31/2" as a division (15.5), never as a mixed number', () => {
    expect(parseLengthToMm('31/2', 'in').mm).toBeCloseTo(mmOf('15.5'), 9);
    expect(parseLengthToMm('31/2', 'in').exact).toBe('393.7');
    expect(parseLengthToMm('31/2', 'in').mm).not.toBeCloseTo(mmOf('3.5'), 6);
  });

  it('parses Unicode and mixed fractions additively', () => {
    expect(parseLengthToMm('52⅝', 'in').mm).toBeCloseTo(mmOf('52.625'), 9);
    expect(parseLengthToMm('52 5/8', 'in').mm).toBeCloseTo(mmOf('52.625'), 9);
    expect(parseLengthToMm('52-5/8', 'in').mm).toBeCloseTo(mmOf('52.625'), 9);
    expect(parseLengthToMm('149½', 'in').mm).toBeCloseTo(mmOf('149.5'), 9);
    expect(parseLengthToMm('157⅜', 'in').mm).toBeCloseTo(mmOf('157.375'), 9);
    expect(parseLengthToMm('56⅝', 'in').mm).toBeCloseTo(mmOf('56.625'), 9);
    expect(parseNumericRational('595/4').n).toBe(595n);
  });

  it('satisfies the SRC-R35-01 regression arithmetic', () => {
    expect(mmOf('-4') + mmOf('19.5')).toBeCloseTo(mmOf('15.5'), 6);
    expect(mmOf('52.625') - mmOf('15.5')).toBeCloseTo(mmOf('37.125'), 6);
    const csvSeam = parseLengthToMm('31/2', 'in').mm;
    expect(csvSeam).toBeCloseTo(mmOf('15.5'), 9);
  });
});

describe('R35 dimension chains', () => {
  const { bundle } = compileR35();
  const byId = new Map(bundle.measurements.map((measurement) => [measurement.id, Number(measurement.canonicalMm)]));
  const value = (id: string): number => {
    const found = byId.get(id);
    if (found === undefined) throw new Error(`Missing measurement ${id}`);
    return found;
  };

  it('derives the depth chain: 68 - 4.5 = 63.5', () => {
    expect(value('measurement.w1.outside-depth-trial') - value('measurement.w1.finished-thickness-candidate')).toBeCloseTo(value('measurement.w1.clear-depth-derived'), 6);
  });

  it('derives the W1 plate comparison: 149 + 0.5 + 7.25 = 156.75', () => {
    const sum = value('measurement.w1.finished-inside') + value('measurement.w2.pantry-board') + value('measurement.w2.core-thickness');
    expect(sum).toBeCloseTo(value('measurement.w1.plate-156.75'), 6);
  });

  it('derives the outside finished-plane comparison 157.375 from the wall geometry', () => {
    expect(value('measurement.w1.outside-plane-157.375')).toBeCloseTo(value('measurement.w1.plate-156.75') + value('measurement.w2.room-board'), 6);
  });

  it('derives the W2 layer chain and both plate comparisons', () => {
    expect(value('measurement.w2.pantry-board') + value('measurement.w2.core-thickness') + value('measurement.w2.room-board')).toBeCloseTo(value('measurement.w2.section-sum'), 6);
    // 63.5 - 10.875 + 0.5 = 53.125 (the reported 10 7/8-in projection)
    expect(value('measurement.w1.clear-depth-derived') - value('measurement.column.projection') + value('measurement.w2.pantry-board')).toBeCloseTo(value('measurement.w2.plate-53.125'), 6);
    // With the A3 11-in projection the comparison is 53 in.
    expect(value('measurement.w1.clear-depth-derived') - mmOf('11') + value('measurement.w2.pantry-board')).toBeCloseTo(value('measurement.w2.plate-53'), 6);
  });

  it('derives the cabinet chain: 3.25 + 37 + 0.75 + 106.5 + 0.75 + 0.75 = 149 and the 108-in row', () => {
    const chain =
      value('measurement.cabinets.left-space') +
      value('measurement.fridge.clear-bay') +
      value('measurement.cabinets.divider') +
      value('measurement.cabinets.combined') +
      value('measurement.cabinets.filler-f1') +
      value('measurement.cabinets.filler-f2');
    expect(chain).toBeCloseTo(value('measurement.w1.finished-inside'), 6);
    expect(value('measurement.cabinets.combined') + value('measurement.cabinets.filler-f1') + value('measurement.cabinets.filler-f2')).toBeCloseTo(value('measurement.cabinets.base-row'), 6);
    expect(value('measurement.cabinets.base-row')).toBeCloseTo(mmOf('108'), 6);
  });

  it('derives the counter/upper conditional design values', () => {
    expect(value('measurement.upper.bottom-elevation') - value('measurement.counter.top-elevation')).toBeCloseTo(value('measurement.counter-upper.clearance'), 6);
    expect(value('measurement.counter-upper.clearance')).toBeCloseTo(mmOf('26'), 6);
    expect(value('measurement.upper.u1u2-height')).toBeCloseTo(mmOf('34'), 6);
    expect(value('measurement.upper.u3-height')).toBeCloseTo(mmOf('24'), 6);
  });

  it('derives the backing net length from the published mix', () => {
    const mix = 20 * mmOf('14.5') + 2 * mmOf('13.75') + 3 * mmOf('3.25');
    expect(mix).toBeCloseTo(value('measurement.backing.net-length'), 6);
  });

  it('keeps every authored canonical value at the exact 25.4 mm/in factor', () => {
    for (const measurement of bundle.measurements) {
      if (measurement.original.unit !== 'in') continue;
      const expected = parseLengthToMm(measurement.original.value, 'in');
      expect(Number(measurement.canonicalMm), measurement.id).toBeCloseTo(expected.mm, 6);
    }
  });
});

describe('R35 cutting safety rails', () => {
  const { bundle, compiled } = compileR35();

  it('models exactly one cut operation and it is loose-stock practice only', () => {
    const cutOperations = compiled.operations.filter((operation) => operation.kind === 'cut');
    expect(cutOperations.map((operation) => operation.id)).toEqual(['op.cut-practice']);
    for (const operation of cutOperations) {
      for (const target of operation.targetPartIds) expect(target.startsWith('part.practice.')).toBe(true);
    }
  });

  it('never derives a cut from the reported 111-in ceiling', () => {
    const ceiling = bundle.measurements.find((measurement) => measurement.id === 'measurement.ceiling.reported');
    expect(ceiling?.declaredReleaseStatus).toBe('not_applicable');
    expect(ceiling?.conflictNote ?? '').toMatch(/not a stud cut|not field-verified/i);
    const ceilingMm = Number(ceiling?.canonicalMm);
    expect(ceilingMm).toBeCloseTo(2819.4, 6);
    for (const operation of compiled.operations) {
      const text = JSON.stringify(operation.parameters);
      expect(text.includes('2819.4'), `${operation.id} must not use the 111-in report`).toBe(false);
      if (operation.kind === 'cut') {
        for (const cut of operation.parameters.cuts) {
          expect(Number(cut.finalLengthMm)).not.toBeCloseTo(2819.4, 3);
        }
      }
    }
    // No readiness claim anywhere for a cut of a house member.
    for (const operation of compiled.operations) {
      if (operation.kind !== 'cut') continue;
      for (const target of operation.targetPartIds) {
        expect(target.startsWith('part.practice.'), `${operation.id} targets ${target}`).toBe(true);
      }
    }
  });

  it('keeps unknown cabinet widths null and never turns the nominal labels into cut locations', () => {
    const measurementIds = new Set(bundle.measurements.map((measurement) => measurement.id));
    for (const forbidden of ['measurement.cabinets.b1-width', 'measurement.cabinets.b2-width', 'measurement.cabinets.b3-width']) {
      expect(measurementIds.has(forbidden), forbidden).toBe(false);
    }
    const combined = bundle.measurements.find((measurement) => measurement.id === 'measurement.cabinets.combined');
    expect(combined?.conflictNote ?? '').toMatch(/individual widths unknown|not measured widths/i);
    for (const part of bundle.parts) {
      expect(/fixture\.b[123]/.test(part.id), part.id).toBe(false);
    }
    // No operation may claim a split cut location for the unmeasured boxes.
    for (const operation of compiled.operations) {
      const text = JSON.stringify(operation.parameters);
      expect(text.includes('"individualWidths"')).toBe(false);
    }
  });

  it('keeps the W2 room-face seam regression values consistent with the CSV rows', () => {
    const seam = bundle.measurements.find((measurement) => measurement.id === 'measurement.drywall.seam-w2r');
    expect(Number(seam?.canonicalMm)).toBeCloseTo(mmOf('15.5'), 6);
    expect(seam?.conflictNote ?? '').toMatch(/31\/2|15 1\/2|15.5/);
    const csv = readWorkJson<{ files: { file: string; rows: { id: string; disposition: string }[] }[] }>('reconciliation.json');
    const panels = csv.files.find((file) => file.file.endsWith('drywall-panel-schedule-R34-CONCEPT.csv'));
    expect(panels?.rows.filter((row) => ['W2-R-01', 'W2-R-02'].includes(row.id)).length).toBe(2);
  });
});
