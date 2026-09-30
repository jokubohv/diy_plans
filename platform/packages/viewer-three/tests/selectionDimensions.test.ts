import { describe, expect, it } from 'vitest';
import type { Part, PresentationRecipe } from '@diyguide/schema';
import { selectionDimensionDisplay } from '../src/selectionDimensions';

const elevation: NonNullable<PresentationRecipe['schematicElevation']> = {
  overallHeightMm: 2819.4,
  bottomPlateThicknessMm: 38.1,
  topPlateThicknessMm: 38.1,
  studPartIds: ['part.w1.stud-s06'],
  topPlatePartIds: ['part.w1.top-plate'],
  panelPartIds: [],
  contextPartIds: [],
  label: 'Schematic only',
};

function boxPart(id: string, sizeMm: [number, number, number], description: string): Part {
  return {
    id,
    name: id,
    kind: 'linear_member',
    role: 'installed',
    assemblyId: 'assembly.w1',
    trade: 'framing',
    stage: 'rough',
    ifcClass: 'IfcMember',
    ifcGlobalId: '0000000000000000000000',
    description,
    selectable: true,
    initialState: 'absent',
    geometry: { shape: 'box', sizeMm },
  };
}

describe('selectionDimensionDisplay', () => {
  it('shows stud section dimensions while keeping its cut length unresolved', () => {
    const stud = boxPart(
      'part.w1.stud-s06',
      [38.1, 88.9, 20],
      'Plan footprint only; member height is field-fit and not asserted.',
    );
    expect(selectionDimensionDisplay(stud, elevation, { unit: 'in', precisionIn: 0.125 })).toEqual({
      memberType: 'Vertical stud',
      dimensions: [
        { label: 'Displayed height', value: '108 in*' },
        { label: 'Width', value: '3.5 in' },
        { label: 'Thickness', value: '1.5 in' },
      ],
      statusLabel: 'Cut length: UNKNOWN — field-fit',
      note: '*Displayed between the plates using the 111 in reported wall-height reference—not a cut length.',
    });
  });

  it('identifies one authored horizontal top-plate board and its three dimensions', () => {
    const plate = boxPart(
      'part.w1.top-plate',
      [3981.45, 88.9, 38.1],
      'Single top plate; no cut released.',
    );
    expect(selectionDimensionDisplay(plate, elevation, { unit: 'in', precisionIn: 0.125 })).toMatchObject({
      memberType: 'Single top plate',
      dimensions: [
        { label: 'Length', value: '156.75 in' },
        { label: 'Width', value: '3.5 in' },
        { label: 'Height', value: '1.5 in' },
      ],
      statusLabel: 'Cut status: HELD — no cut released',
    });
  });
});
