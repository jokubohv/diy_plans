/**
 * Length parsing contract (fraction rules pinned by tests):
 *
 * - integers and decimals: `"96"`, `"2438.4"`, `"0.5"`
 * - slash fractions are a division: `"31/2"` = 15.5, never 3.5
 * - mixed numbers: `"52 5/8"` and `"52-5/8"` = 52 + 5/8
 * - Unicode vulgar fractions are additive: `"52⅝"` = 52 + 5/8 = 52.625
 * - mm/cm/m are exact decimal scales; ft/in use the exact factor 25.4 mm per inch
 *
 * All conversions run on exact BigInt rationals. `mm` is the float (deterministic from the
 * reduced rational) and `exact` the exact decimal string when the rational terminates in base
 * 10; for non-terminating rationals the string is rounded half-up to 12 decimal places and the
 * caller should treat the float as approximate.
 */
import type { Unit } from '@diyguide/schema';

export interface ParsedLength {
  /** Millimetres as a float derived from the exact rational. */
  mm: number;
  /** Exact decimal string of the millimetre value when it terminates. */
  exact: string;
}

interface Rational {
  n: bigint;
  d: bigint;
}

const VULGAR: ReadonlyMap<string, Rational> = new Map([
  ['\u00BC', { n: 1n, d: 4n }], // ¼
  ['\u00BD', { n: 1n, d: 2n }], // ½
  ['\u00BE', { n: 3n, d: 4n }], // ¾
  ['\u2150', { n: 1n, d: 7n }], // ⅐
  ['\u2151', { n: 1n, d: 9n }], // ⅑
  ['\u2152', { n: 1n, d: 10n }], // ⅒
  ['\u2153', { n: 1n, d: 3n }], // ⅓
  ['\u2154', { n: 2n, d: 3n }], // ⅔
  ['\u2155', { n: 1n, d: 5n }], // ⅕
  ['\u2156', { n: 2n, d: 5n }], // ⅖
  ['\u2157', { n: 3n, d: 5n }], // ⅗
  ['\u2158', { n: 4n, d: 5n }], // ⅘
  ['\u2159', { n: 1n, d: 6n }], // ⅙
  ['\u215A', { n: 5n, d: 6n }], // ⅚
  ['\u215B', { n: 1n, d: 8n }], // ⅛
  ['\u215C', { n: 3n, d: 8n }], // ⅜
  ['\u215D', { n: 5n, d: 8n }], // ⅝
  ['\u215E', { n: 7n, d: 8n }], // ⅞
]);

const UNIT_FACTOR: Record<Unit, Rational> = {
  mm: { n: 1n, d: 1n },
  cm: { n: 10n, d: 1n },
  m: { n: 1000n, d: 1n },
  in: { n: 127n, d: 5n }, // 25.4 exactly
  ft: { n: 1524n, d: 5n }, // 304.8 exactly
};

const UNIT_ALIASES: Record<string, Unit> = {
  mm: 'mm',
  cm: 'cm',
  m: 'm',
  in: 'in',
  inch: 'in',
  inches: 'in',
  '"': 'in',
  ft: 'ft',
  foot: 'ft',
  feet: 'ft',
  "'": 'ft',
};

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

function rat(n: bigint, d: bigint): Rational {
  if (d === 0n) throw new Error('Division by zero in length value');
  let nn = n;
  let dd = d;
  if (dd < 0n) {
    nn = -nn;
    dd = -dd;
  }
  const g = gcd(nn, dd);
  return g === 0n ? { n: 0n, d: 1n } : { n: nn / g, d: dd / g };
}

function mul(a: Rational, b: Rational): Rational {
  return rat(a.n * b.n, a.d * b.d);
}

/** 10^k as BigInt. */
function pow10(k: number): bigint {
  return 10n ** BigInt(k);
}

function formatScaled(scaled: bigint, scale: number): string {
  const negative = scaled < 0n;
  let digits = (negative ? -scaled : scaled).toString();
  if (scale > 0) {
    digits = digits.padStart(scale + 1, '0');
    const cut = digits.length - scale;
    let head = digits.slice(0, cut);
    let tail = digits.slice(cut).replace(/0+$/, '');
    return `${negative ? '-' : ''}${head}${tail.length > 0 ? `.${tail}` : ''}`;
  }
  return `${negative ? '-' : ''}${digits}`;
}

/** Exact decimal string when terminating; otherwise half-up rounded to 12 decimals. */
export function rationalToDecimal(value: Rational): string {
  const { n, d } = value;
  if (d === 1n) return n.toString();
  let rest = d;
  let twos = 0;
  let fives = 0;
  while (rest % 2n === 0n) {
    rest /= 2n;
    twos += 1;
  }
  while (rest % 5n === 0n) {
    rest /= 5n;
    fives += 1;
  }
  if (rest === 1n) {
    const scale = Math.max(twos, fives);
    const scaled = n * 2n ** BigInt(scale - twos) * 5n ** BigInt(scale - fives);
    return formatScaled(scaled, scale);
  }
  const scale = 12;
  const negative = n < 0n;
  const absN = negative ? -n : n;
  let scaled = absN / d;
  let rem = absN % d;
  for (let i = 0; i < scale; i += 1) {
    rem *= 10n;
    scaled = scaled * 10n + rem / d;
    rem %= d;
  }
  rem *= 10n;
  if (rem / d >= 5n) scaled += 1n;
  return formatScaled(negative ? -scaled : scaled, scale);
}

function stripUnitSuffix(raw: string, unit: Unit): string {
  const match = raw.match(/^(.*?)\s*(mm|cm|m|ft|in|inch|inches|foot|feet|"|')$/i);
  if (!match) return raw;
  const suffix = match[2] ?? '';
  const alias = UNIT_ALIASES[suffix.toLowerCase()];
  if (alias !== unit) {
    throw new Error(`Length value "${raw}" carries unit "${suffix}" but declared unit is "${unit}"`);
  }
  return (match[1] ?? '').trim();
}

/** Parse a unitless numeric token (integer, decimal, fraction, mixed number or vulgar). */
export function parseNumericRational(raw: string): Rational {
  let text = raw.trim();
  if (text === '') throw new Error('Empty length value');
  let sign = 1n;
  if (text.startsWith('-')) {
    sign = -1n;
    text = text.slice(1).trim();
  }

  const vulgarMatch = text.match(/^(\d+)?\s*([\u00BC-\u00BE\u2150-\u215E])$/);
  if (vulgarMatch) {
    const whole = vulgarMatch[1] ? BigInt(vulgarMatch[1]) : 0n;
    const frac = VULGAR.get(vulgarMatch[2] ?? '');
    if (!frac) throw new Error(`Unsupported vulgar fraction in "${raw}"`);
    return rat(sign * (whole * frac.d + frac.n), frac.d);
  }

  const mixed = text.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/) ?? text.match(/^(\d+)-(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = BigInt(mixed[1] ?? '0');
    const num = BigInt(mixed[2] ?? '0');
    const den = BigInt(mixed[3] ?? '1');
    return rat(sign * (whole * den + num), den);
  }

  const slash = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slash) {
    // "31/2" is a division: 31 / 2 = 15.5 (never 3 1/2).
    return rat(sign * BigInt(slash[1] ?? '0'), BigInt(slash[2] ?? '1'));
  }

  const decimal = text.match(/^(\d+)(?:\.(\d+))?$/);
  if (decimal) {
    const fractionDigits = decimal[2]?.length ?? 0;
    const digits = `${decimal[1] ?? '0'}${decimal[2] ?? ''}`;
    return rat(sign * BigInt(digits), pow10(fractionDigits));
  }

  throw new Error(`Unsupported length value: "${raw}"`);
}

/** Parse a length value in the given unit to millimetres (exact rational + float). */
export function parseLengthToMm(value: string, unit: Unit): ParsedLength {
  const factor = UNIT_FACTOR[unit];
  if (!factor) throw new Error(`Unsupported unit: ${unit}`);
  const normalized = stripUnitSuffix(value, unit);
  const exactMm = mul(parseNumericRational(normalized), factor);
  return {
    mm: Number(exactMm.n) / Number(exactMm.d),
    exact: rationalToDecimal(exactMm),
  };
}
