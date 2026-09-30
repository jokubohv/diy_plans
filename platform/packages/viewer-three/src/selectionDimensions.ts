import type { Part, PresentationRecipe, Project } from '@diyguide/schema';

type SchematicElevation = NonNullable<PresentationRecipe['schematicElevation']>;
type DisplaySettings = Project['display'];

export interface SelectionDimension {
  label: string;
  value: string;
}

export interface SelectionDimensionDisplay {
  memberType: string;
  dimensions: SelectionDimension[];
  statusLabel: string | null;
  note: string | null;
}

const MM_PER_UNIT: Record<DisplaySettings['unit'], number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
  ft: 304.8,
};

function decimalsForStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0;
  for (let decimals = 0; decimals <= 6; decimals += 1) {
    const scaled = step * 10 ** decimals;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return decimals;
  }
  return 6;
}

function formatLength(mm: number, display: DisplaySettings): string {
  const step = (display.precisionIn * 25.4) / MM_PER_UNIT[display.unit];
  const value = mm / MM_PER_UNIT[display.unit];
  const quantized = Math.round(value / step) * step;
  const fixed = quantized.toFixed(decimalsForStep(step));
  const number = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  return `${number} ${display.unit}`;
}

function authoredStatus(part: Part): string | null {
  const text = `${part.description} ${part.takeoff?.note ?? ''}`;
  if (/field-fit|height (?:and connection )?held/i.test(text)) return 'Cut length: UNKNOWN — field-fit';
  if (/no cut released/i.test(text)) return 'Cut status: HELD — no cut released';
  return null;
}

/**
 * Construction-oriented dimensions for an authored box. Schematic heights come only from the
 * active labelled presentation recipe; canonical geometry and cut status remain untouched.
 */
export function selectionDimensionDisplay(
  part: Part,
  elevation: SchematicElevation | null,
  display: DisplaySettings,
): SelectionDimensionDisplay | null {
  if (part.geometry.shape !== 'box') return null;
  const [sizeX, sizeY, sizeZ] = part.geometry.sizeMm;
  const planSizes = [sizeX, sizeY].sort((left, right) => right - left);
  const statusLabel = authoredStatus(part);
  const isStud = elevation?.studPartIds.includes(part.id) ?? /\.stud-s/i.test(part.id);
  const isTopPlate = /top-plate/i.test(part.id);
  const isBottomPlate = /bottom-plate/i.test(part.id);
  const isPanel =
    elevation?.panelPartIds?.includes(part.id) ??
    (part.kind === 'panel' || part.kind === 'layered_surface');

  if (isStud) {
    const displayedHeightMm = elevation
      ? elevation.overallHeightMm -
        elevation.bottomPlateThicknessMm -
        elevation.topPlateThicknessMm
      : null;
    return {
      memberType: 'Vertical stud',
      dimensions: [
        {
          label: 'Displayed height',
          value: displayedHeightMm == null ? 'UNKNOWN' : `${formatLength(displayedHeightMm, display)}*`,
        },
        { label: 'Width', value: formatLength(planSizes[0]!, display) },
        { label: 'Thickness', value: formatLength(planSizes[1]!, display) },
      ],
      statusLabel: statusLabel ?? 'Cut length: UNKNOWN',
      note:
        displayedHeightMm == null
          ? 'No displayed stud height is active. The cut length remains field-fit.'
          : `*Displayed between the plates using the ${formatLength(
              elevation!.overallHeightMm,
              display,
            )} reported wall-height reference—not a cut length.`,
    };
  }

  if (isTopPlate || isBottomPlate) {
    return {
      memberType: isTopPlate ? 'Single top plate' : 'Bottom / sole plate',
      dimensions: [
        { label: 'Length', value: formatLength(planSizes[0]!, display) },
        { label: 'Width', value: formatLength(planSizes[1]!, display) },
        { label: 'Height', value: formatLength(sizeZ, display) },
      ],
      statusLabel,
      note: isTopPlate
        ? 'One horizontal top-plate board is authored for this wall; the two outline lines are its edges.'
        : 'Horizontal plate at the floor line.',
    };
  }

  if (isPanel) {
    const displayedHeightMm = elevation?.panelPartIds?.includes(part.id)
      ? elevation.overallHeightMm
      : sizeZ;
    return {
      memberType: part.kind === 'layered_surface' ? 'Layered surface' : 'Panel',
      dimensions: [
        { label: 'Width', value: formatLength(planSizes[0]!, display) },
        {
          label: elevation?.panelPartIds?.includes(part.id) ? 'Displayed height' : 'Height',
          value: `${formatLength(displayedHeightMm, display)}${
            elevation?.panelPartIds?.includes(part.id) ? '*' : ''
          }`,
        },
        { label: 'Thickness', value: formatLength(planSizes[1]!, display) },
      ],
      statusLabel,
      note: elevation?.panelPartIds?.includes(part.id)
        ? '*Schematic height only; verify the field height before cutting.'
        : null,
    };
  }

  return {
    memberType: 'Selected box',
    dimensions: [
      { label: 'X', value: formatLength(sizeX, display) },
      { label: 'Y', value: formatLength(sizeY, display) },
      { label: 'Z', value: formatLength(sizeZ, display) },
    ],
    statusLabel,
    note: null,
  };
}
