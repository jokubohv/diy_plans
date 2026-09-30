/**
 * Contract tests: fraction rules (architecture-equivalent length parsing).
 *
 * The critical pin: "31/2" is a division (15.5), never the mixed number 3 1/2.
 */
import { describe, expect, it } from 'vitest';
import { parseLengthToMm, parseNumericRational, rationalToDecimal } from '../../src/index';

describe('parseLengthToMm', () => {
  it('parses integers and decimals exactly', () => {
    expect(parseLengthToMm('96', 'in')).toEqual({ mm: 2438.4, exact: '2438.4' });
    expect(parseLengthToMm('2438.4', 'mm')).toEqual({ mm: 2438.4, exact: '2438.4' });
    expect(parseLengthToMm('0.5', 'in').mm).toBeCloseTo(12.7, 10);
  });

  it('treats a slash fraction as a division: "31/2" = 15.5 (never 3.5)', () => {
    expect(parseNumericRational('31/2')).toEqual({ n: 31n, d: 2n });
    const parsed = parseLengthToMm('31/2', 'in');
    expect(parsed.mm).toBeCloseTo(15.5 * 25.4, 9); // 393.7 mm
    expect(parsed.mm).not.toBeCloseTo(3.5 * 25.4, 3);
    expect(parsed.exact).toBe('393.7');
  });

  it('parses mixed numbers with space and hyphen', () => {
    const spaced = parseLengthToMm('52 5/8', 'in');
    const hyphen = parseLengthToMm('52-5/8', 'in');
    expect(spaced.mm).toBeCloseTo(52.625 * 25.4, 9);
    expect(spaced.exact).toBe(hyphen.exact);
    expect(spaced.exact).toBe('1336.675');
  });

  it('treats Unicode vulgar fractions as additive', () => {
    expect(parseLengthToMm('52\u215D', 'in')).toEqual(parseLengthToMm('52 5/8', 'in'));
    expect(parseLengthToMm('\u00BD', 'in').mm).toBeCloseTo(12.7, 9);
    expect(parseLengthToMm('\u215D', 'mm').mm).toBeCloseTo(0.625, 9);
  });

  it('converts ft/in with the exact 25.4 factor', () => {
    expect(parseLengthToMm('8 ft', 'ft').mm).toBe(2438.4);
    expect(parseLengthToMm('8 ft', 'ft').exact).toBe('2438.4');
    expect(parseLengthToMm('96 in', 'in').exact).toBe('2438.4');
    expect(parseLengthToMm("6'", 'ft').mm).toBe(1828.8);
  });

  it('converts mm/cm/m as exact decimal scales', () => {
    expect(parseLengthToMm('250', 'cm')).toEqual({ mm: 2500, exact: '2500' });
    expect(parseLengthToMm('2.5', 'm')).toEqual({ mm: 2500, exact: '2500' });
    expect(parseLengthToMm('-5/8', 'in').mm).toBeCloseTo(-15.875, 9);
  });

  it('rejects unsupported values and mismatched unit suffixes', () => {
    expect(() => parseLengthToMm('', 'in')).toThrow();
    expect(() => parseLengthToMm('abc', 'in')).toThrow();
    expect(() => parseLengthToMm('5/0', 'in')).toThrow();
    expect(() => parseLengthToMm('8 mm', 'in')).toThrow();
  });

  it('renders exact decimals for terminating rationals and a documented rounding otherwise', () => {
    expect(rationalToDecimal({ n: 5n, d: 8n })).toBe('0.625');
    expect(rationalToDecimal({ n: 1n, d: 3n })).toBe('0.333333333333');
    expect(parseLengthToMm('1/3', 'in').exact).toBe('8.466666666667');
  });
});
