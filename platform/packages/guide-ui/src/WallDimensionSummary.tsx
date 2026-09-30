import type { ReactElement } from 'react';
import type { CompiledGuide, ReleaseStatus } from '@diyguide/schema';
import { formatLength, formatLengthValue } from './format';
import { StatusChip } from './status';

const SQ_MM_PER_SQ_FT = 304.8 * 304.8;

interface DimensionMetric {
  label: string;
  value: string;
  detail: string;
  status: ReleaseStatus;
}

function measurementMm(compiled: CompiledGuide, id: string): number | null {
  const measurement = compiled.measurements.find((candidate) => candidate.id === id);
  if (!measurement) return null;
  const value = Number.parseFloat(measurement.canonicalMm);
  return Number.isFinite(value) ? value : null;
}

function squareFeet(widthMm: number, heightMm: number): string {
  return `${((widthMm * heightMm) / SQ_MM_PER_SQ_FT).toFixed(1)} sq ft`;
}

/**
 * Compact plan metrics derived only from cited compiled measurements and authored panel widths.
 * Returns null for guides that do not carry the Pantry W1/W2 measurement set.
 */
export function wallDimensionMetrics(compiled: CompiledGuide): DimensionMetric[] {
  const w1Length = measurementMm(compiled, 'measurement.w1.plate-156.75');
  const w2Length = measurementMm(compiled, 'measurement.w2.plate-53.125');
  const height = measurementMm(compiled, 'measurement.ceiling.reported');
  const insideWidth = measurementMm(compiled, 'measurement.w1.finished-inside');
  const clearDepth = measurementMm(compiled, 'measurement.w1.clear-depth-derived');
  const outsideDepth = measurementMm(compiled, 'measurement.w1.outside-depth-trial');
  if (
    w1Length == null ||
    w2Length == null ||
    height == null ||
    insideWidth == null ||
    clearDepth == null ||
    outsideDepth == null
  ) {
    return [];
  }

  const panelWidthsMm = compiled.parts.flatMap((part) => {
    if (!part.id.startsWith('part.drywall.') || part.geometry.shape !== 'box') return [];
    return [Math.max(part.geometry.sizeMm[0], part.geometry.sizeMm[1])];
  });
  const drywallWidthMm = panelWidthsMm.reduce((sum, width) => sum + width, 0);
  const pair = (firstMm: number, secondMm: number): string =>
    `${formatLengthValue(firstMm, compiled.project.display)} × ${formatLength(
      secondMm,
      compiled.project.display,
    )}`;

  return [
    {
      label: 'W1 frame',
      value: formatLength(w1Length, compiled.project.display),
      detail: `${formatLength(height, compiled.project.display)} schematic height · ${squareFeet(
        w1Length,
        height,
      )} per face`,
      status: 'conditional',
    },
    {
      label: 'W2 frame',
      value: formatLength(w2Length, compiled.project.display),
      detail: `${formatLength(height, compiled.project.display)} schematic height · ${squareFeet(
        w2Length,
        height,
      )} per face`,
      status: 'conditional',
    },
    {
      label: 'Clear wall-to-wall',
      value: pair(insideWidth, clearDepth),
      detail: `${formatLength(outsideDepth, compiled.project.display)} EX1-to-W1 outside trial`,
      status: 'conditional',
    },
    {
      label: 'Clear floor area',
      value: squareFeet(insideWidth, clearDepth),
      detail: 'Derived from the conditional 149 in × 63.5 in clear dimensions',
      status: 'conditional',
    },
    {
      label: 'Four drywall faces',
      value: squareFeet(drywallWidthMm, height),
      detail: `${panelWidthsMm.length} pieces · reported 111 in height only`,
      status: 'held',
    },
  ];
}

export function WallDimensionSummary({ compiled }: { compiled: CompiledGuide }): ReactElement | null {
  const metrics = wallDimensionMetrics(compiled);
  if (metrics.length === 0) return null;
  return (
    <section className="wall-dimension-summary" data-testid="wall-dimension-summary" aria-label="Wall dimensions and area">
      <header>
        <div>
          <span className="wall-dimension-kicker">Plan dimensions</span>
          <h3>Walls, clear space and area</h3>
        </div>
        <span className="wall-dimension-basis">Schematic / field verification required</span>
      </header>
      <div className="wall-dimension-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className="wall-dimension-metric" data-status={metric.status}>
            <div className="wall-dimension-metric-head">
              <span>{metric.label}</span>
              <StatusChip status={metric.status} />
            </div>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>
      <p className="wall-dimension-warning">
        The 111 in height is a reported viewing reference, not a stud, plate or drywall cut. Areas
        derived from it are planning estimates until field heights are accepted.
      </p>
    </section>
  );
}
