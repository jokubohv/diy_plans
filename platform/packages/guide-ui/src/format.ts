/**
 * Length display formatting. All compiled lengths are canonical millimetres; the project's
 * `display.unit`/`display.precisionIn` decide how they are shown. No length is ever hard-coded.
 */
import type { Bounds, Measurement, Project, Unit } from '@diyguide/schema';

export type DisplaySettings = Project['display'];

const MM_PER_UNIT: Record<Unit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

export function convertFromMm(mm: number, unit: Unit): number {
  return mm / MM_PER_UNIT[unit];
}

/** `precisionIn` is the smallest displayed increment expressed in inches. */
export function precisionStepInUnit(unit: Unit, precisionIn: number): number {
  return (precisionIn * 25.4) / MM_PER_UNIT[unit];
}

function decimalsForStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  for (let decimals = 0; decimals <= 6; decimals += 1) {
    const scaled = step * 10 ** decimals;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return decimals;
  }
  return 6;
}

export function quantize(value: number, step: number): number {
  if (!Number.isFinite(value)) return value;
  if (!Number.isFinite(step) || step <= 0) return value;
  const decimals = decimalsForStep(step);
  const factor = 10 ** decimals;
  return Math.round(Math.round(value / step) * step * factor) / factor;
}

export function formatNumber(value: number, step: number): string {
  const decimals = decimalsForStep(step);
  const fixed = value.toFixed(decimals);
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
}

/** Formatted magnitude in the display unit, without the unit suffix (e.g. `96`). */
export function formatLengthValue(mm: number, display: DisplaySettings): string {
  const step = precisionStepInUnit(display.unit, display.precisionIn);
  return formatNumber(quantize(convertFromMm(mm, display.unit), step), step);
}

/** Formatted length with unit suffix (e.g. `96 in`). */
export function formatLength(mm: number, display: DisplaySettings): string {
  return `${formatLengthValue(mm, display)} ${display.unit}`;
}

/**
 * Measurement value in the project display unit. Falls back to the raw canonical string when a
 * measurement carries a non-numeric canonical value (never invents a conversion).
 */
export function measurementValueText(
  measurement: Measurement,
  display: DisplaySettings,
): string {
  const mm = Number.parseFloat(measurement.canonicalMm);
  if (!Number.isFinite(mm)) return `${measurement.canonicalMm} ${display.unit}`;
  return formatLength(mm, display);
}

/** Axis-aligned box size in the project display unit, e.g. `1.5 × 3.5 × 93 in`. */
export function boundsSizeText(bounds: Bounds, display: DisplaySettings): string {
  const sizes: number[] = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  return `${sizes.map((size) => formatLengthValue(size, display)).join(' × ')} ${display.unit}`;
}

export function formatPoint(point: readonly [number, number, number]): string {
  return `${point[0]}, ${point[1]}, ${point[2]} mm`;
}

/** Short, copy-friendly form of a `sha256:<hex>` identifier: `sha256:28352a24…765f6dd5`. */
export function shortHash(value: string | null | undefined, head = 8, tail = 8): string {
  if (!value) return '';
  const hex = value.startsWith('sha256:') ? value.slice('sha256:'.length) : value;
  if (hex.length <= head + tail + 1) return value;
  return `${value.startsWith('sha256:') ? 'sha256:' : ''}${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

/** Canonical millimetres for display, trimmed of meaningless trailing decimals. */
export function canonicalMmText(canonicalMm: string, maxDecimals = 1): string {
  const value = Number.parseFloat(canonicalMm);
  if (!Number.isFinite(value)) return canonicalMm;
  return formatNumber(value, 10 ** -maxDecimals);
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  fixture_demo: 'Demonstration',
  pantry: 'Pantry',
  wall: 'Wall',
  closet: 'Closet',
  cabinet: 'Cabinet',
  bathroom: 'Bathroom',
  flooring: 'Flooring',
  deck: 'Deck',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  other: 'Other',
};

/** User-facing label for a project type enum; unknown types fall back to the raw value. */
export function projectTypeLabel(projectType: string | null | undefined): string {
  if (!projectType) return 'Plan';
  return PROJECT_TYPE_LABELS[projectType] ?? projectType.replace(/_/g, ' ');
}
