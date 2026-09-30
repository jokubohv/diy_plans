/**
 * R35 conversion utilities.
 *
 * Exact inch -> millimetre conversion uses the compiler's frozen fraction contract
 * (`packages/compiler/src/fraction.ts`): `31/2` is a division (15.5), mixed numbers and Unicode
 * vulgar fractions are additive, and `25.4 mm per inch` is exact. Geometry numbers are floats
 * derived from those exact rationals (software error budget <= 0.1 mm).
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { parseLengthToMm, parseNumericRational } from '../../../packages/compiler/src/fraction.ts';

export const mmPerInch = 25.4;

/** Parse an inch value (decimal, slash fraction, mixed number, Unicode fraction) to mm. */
export function inchMm(value) {
  return parseLengthToMm(String(value), 'in');
}

/** Exact decimal addition/subtraction on two decimal strings (scaled BigInt arithmetic). */
function scaleOf(value) {
  const text = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new Error(`Not a decimal string: ${value}`);
  const digits = `${match[2]}${match[3] ?? ''}`;
  const scale = (match[3] ?? '').length;
  return { n: BigInt(`${match[1]}${digits}`), scale };
}

function unscale(n, scale) {
  const negative = n < 0n;
  let digits = (negative ? -n : n).toString();
  if (scale === 0) return `${negative ? '-' : ''}${digits}`;
  digits = digits.padStart(scale + 1, '0');
  const head = digits.slice(0, digits.length - scale);
  const tail = digits.slice(digits.length - scale).replace(/0+$/, '');
  return `${negative ? '-' : ''}${head}${tail.length > 0 ? `.${tail}` : ''}`;
}

export function decimalAdd(a, b) {
  const x = scaleOf(a);
  const y = scaleOf(b);
  const scale = Math.max(x.scale, y.scale);
  const xn = x.n * 10n ** BigInt(scale - x.scale);
  const yn = y.n * 10n ** BigInt(scale - y.scale);
  return unscale(xn + yn, scale);
}

export function decimalSub(a, b) {
  return decimalAdd(a, `-${b}`);
}

/** Round a finite float to the given decimal places, returning a decimal string. */
export function round6(value) {
  if (!Number.isFinite(value)) throw new Error(`Non-finite value: ${value}`);
  const rounded = Math.round(value * 1e6) / 1e6;
  let text = rounded.toFixed(6);
  text = text.replace(/\.?0+$/, '');
  return text.length === 0 ? '0' : text;
}

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

export function fileSha256(path) {
  const buffer = readFileSync(path);
  return { sha256: sha256Hex(buffer), bytes: buffer.byteLength };
}

/** Deterministic JSON text (2-space indent, trailing newline). */
export function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Escape text for SVG text nodes. */
export function svgEscape(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Wrap plain text into lines of at most `width` characters at word boundaries. */
export function wrapText(text, width = 96) {
  const words = String(text).split(/\s+/).filter((word) => word.length > 0);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/** Read a JSON file from disk. */
export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Minimal RFC4180-ish CSV parser (comma separated, double-quoted fields). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return { header: [], rows: [] };
  const [header, ...dataRows] = rows;
  return { header, rows: dataRows.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? '']))) };
}

/** Replace a decimal inside a fraction-looking token with the parsed numeric value. */
export function parseAnyInch(value) {
  return inchMm(value).mm;
}

/** Assert helper with a clear pipeline failure message. */
export function assertEqual(actual, expected, label) {
  if (String(actual) !== String(expected)) {
    throw new Error(`R35 conversion source mismatch: ${label}: expected ${expected}, got ${actual}`);
  }
}

/** Whether a path exists and is a file. */
export function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export { parseNumericRational };
