/**
 * Identity contract tests: canonical partId -> id-map -> ifcGlobalId -> fragment local id ->
 * Pset_DiyGuide.partId. No engine is imported here; the fragment side is a fake
 * `ModelIdentityAccess`, and the real `@thatopen/fragments` wiring is proven by the browser
 * compositor run.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  buildIdentityIndex,
  extractGuidePartId,
  resolveIdentity,
  summarizeIdentity,
  type IdMapDocument,
  type ModelIdentityAccess,
} from '../src/index';

const ID_MAP: IdMapDocument = {
  version: '0.1.0',
  parts: [
    { partId: 'part.existing.slab', ifcGlobalId: '2TU1INEqTLnxpIUfFc3Vn3', ifcClass: 'IfcSlab' },
    { partId: 'part.wall-a.stud-1', ifcGlobalId: '2fUbmG3d5UvuLEjggLCe8D', ifcClass: 'IfcMember' },
    { partId: 'part.wall-a.top-plate', ifcGlobalId: '3l_FcKjBLQxPWKmuPgDjZu', ifcClass: 'IfcPlate' },
  ],
};

/** ItemData shape emitted by `@thatopen/fragments` (`{ [name]: { value, type } | ItemData[] }`). */
const SAMPLE_ITEM_DATA = {
  GlobalId: { value: '2fUbmG3d5UvuLEjggLCe8D', type: 'IfcGloballyUniqueId' },
  IsDefinedBy: [
    {
      type: 'IFCRELDEFINESBYPROPERTIES',
      RelatingPropertyDefinition: {
        Name: { value: 'Pset_DiyGuide', type: 'IfcIdentifier' },
        HasProperties: [
          { Name: { value: 'role' }, NominalValue: { value: 'installed', type: 'IfcLabel' } },
          {
            Name: { value: 'partId' },
            NominalValue: { value: 'part.wall-a.stud-1', type: 'IfcLabel' },
          },
        ],
      },
    },
  ],
};

describe('buildIdentityIndex', () => {
  it('indexes by partId and by ifcGlobalId', () => {
    const index = buildIdentityIndex(ID_MAP);
    expect([...index.byPartId.keys()]).toEqual([
      'part.existing.slab',
      'part.wall-a.stud-1',
      'part.wall-a.top-plate',
    ]);
    expect(index.byGlobalId.get('3l_FcKjBLQxPWKmuPgDjZu')?.partId).toBe('part.wall-a.top-plate');
  });

  it('reports duplicates and keeps the first row', () => {
    const index = buildIdentityIndex({
      parts: [
        { partId: 'part.a', ifcGlobalId: 'g1', ifcClass: 'IfcMember' },
        { partId: 'part.a', ifcGlobalId: 'g2', ifcClass: 'IfcMember' },
        { partId: 'part.b', ifcGlobalId: 'g1', ifcClass: 'IfcPlate' },
      ],
    });
    expect(index.duplicatePartIds).toEqual(['part.a']);
    expect(index.duplicateGlobalIds).toEqual(['g1']);
    expect(index.byPartId.get('part.a')?.ifcGlobalId).toBe('g1');
  });
});

describe('extractGuidePartId', () => {
  it('finds partId inside Pset_DiyGuide through a real fragments-style relation tree', () => {
    expect(extractGuidePartId(SAMPLE_ITEM_DATA)).toBe('part.wall-a.stud-1');
  });

  it('accepts an array of items and a bare pset object', () => {
    expect(extractGuidePartId([{ Name: { value: 'Pset_Other' } }, SAMPLE_ITEM_DATA])).toBe(
      'part.wall-a.stud-1',
    );
    expect(
      extractGuidePartId({
        Name: { value: 'Pset_DiyGuide' },
        HasProperties: [{ Name: { value: 'partId' }, NominalValue: { value: 'part.direct' } }],
      }),
    ).toBe('part.direct');
  });

  it('never returns a partId from a different property set', () => {
    expect(
      extractGuidePartId({
        Name: { value: 'Pset_WallCommon' },
        HasProperties: [{ Name: { value: 'partId' }, NominalValue: { value: 'part.decoy' } }],
      }),
    ).toBeNull();
  });

  it('returns null when the property set, property or value is missing', () => {
    expect(extractGuidePartId({ Name: { value: 'Pset_DiyGuide' }, HasProperties: [] })).toBeNull();
    expect(
      extractGuidePartId({ Name: { value: 'Pset_DiyGuide' }, HasProperties: [{ Name: { value: 'role' } }] }),
    ).toBeNull();
    expect(extractGuidePartId({ GlobalId: { value: 'abc' } })).toBeNull();
    expect(extractGuidePartId(null)).toBeNull();
    expect(extractGuidePartId('Pset_DiyGuide')).toBeNull();
  });

  it('survives cyclic data without hanging', () => {
    const cyclic: Record<string, unknown> = { Name: { value: 'Pset_Other' } };
    cyclic['self'] = cyclic;
    expect(extractGuidePartId(cyclic)).toBeNull();
  });
});

function fakeAccess(
  overrides: Partial<ModelIdentityAccess> = {},
): ModelIdentityAccess & { psetCalls: number[] } {
  const psetCalls: number[] = [];
  const localIdFor = (guid: string): number | null => {
    const index = ID_MAP.parts.findIndex((part) => part.ifcGlobalId === guid);
    return index < 0 ? null : index + 1;
  };
  return {
    modelId: 'model:test',
    getLocalIdsByGuids: vi.fn(async (guids: string[]) => guids.map(localIdFor)),
    getPsetDiyGuidePartId: vi.fn(async (localId: number) => {
      psetCalls.push(localId);
      return ID_MAP.parts[localId - 1]?.partId ?? null;
    }),
    psetCalls,
    ...overrides,
  };
}

describe('resolveIdentity', () => {
  it('resolves every part through guid -> local id -> Pset_DiyGuide', async () => {
    const index = buildIdentityIndex(ID_MAP);
    const access = fakeAccess();
    const resolutions = await resolveIdentity(index, access, ID_MAP.parts.map((part) => part.partId));
    expect(resolutions.map((row) => row.status)).toEqual(['resolved', 'resolved', 'resolved']);
    expect(resolutions[1]).toMatchObject({
      partId: 'part.wall-a.stud-1',
      ifcGlobalId: '2fUbmG3d5UvuLEjggLCe8D',
      ifcClass: 'IfcMember',
      modelId: 'model:test',
      localId: 2,
      psetPartId: 'part.wall-a.stud-1',
    });
    expect(access.getLocalIdsByGuids).toHaveBeenCalledTimes(1);
  });

  it('reports unknown partIds without touching the model', async () => {
    const index = buildIdentityIndex(ID_MAP);
    const access = fakeAccess();
    const resolutions = await resolveIdentity(index, access, ['part.not-published']);
    expect(resolutions[0]).toMatchObject({ status: 'not-in-id-map', ifcGlobalId: null, localId: null });
    expect(access.getPsetDiyGuidePartId).not.toHaveBeenCalled();
  });

  it('reports a missing fragment when the GlobalId is absent from the model', async () => {
    const index = buildIdentityIndex(ID_MAP);
    const access = fakeAccess({
      getLocalIdsByGuids: vi.fn(async (guids: string[]) => guids.map(() => null)),
    });
    const resolutions = await resolveIdentity(index, access, ['part.existing.slab']);
    expect(resolutions[0]).toMatchObject({ status: 'missing-fragment', localId: null });
  });

  it('reports pset-missing and pset-mismatch distinctly', async () => {
    const index = buildIdentityIndex(ID_MAP);
    const missing = fakeAccess({ getPsetDiyGuidePartId: vi.fn(async () => null) });
    expect((await resolveIdentity(index, missing, ['part.existing.slab']))[0]?.status).toBe(
      'pset-missing',
    );
    const mismatch = fakeAccess({ getPsetDiyGuidePartId: vi.fn(async () => 'part.other') });
    expect((await resolveIdentity(index, mismatch, ['part.existing.slab']))[0]?.status).toBe(
      'pset-mismatch',
    );
  });

  it('preserves the requested order and pairs Guid lookups correctly across mixed rows', async () => {
    const index = buildIdentityIndex(ID_MAP);
    const access = fakeAccess();
    const resolutions = await resolveIdentity(index, access, [
      'part.wall-a.top-plate',
      'part.not-published',
      'part.existing.slab',
    ]);
    expect(resolutions.map((row) => row.partId)).toEqual([
      'part.wall-a.top-plate',
      'part.not-published',
      'part.existing.slab',
    ]);
    expect(resolutions.map((row) => row.status)).toEqual([
      'resolved',
      'not-in-id-map',
      'resolved',
    ]);
    expect(resolutions[0]?.ifcGlobalId).toBe('3l_FcKjBLQxPWKmuPgDjZu');
    expect(resolutions[2]?.ifcGlobalId).toBe('2TU1INEqTLnxpIUfFc3Vn3');
  });
});

describe('summarizeIdentity', () => {
  it('counts statuses and requires a non-empty all-resolved set', async () => {
    const index = buildIdentityIndex(ID_MAP);
    const access = fakeAccess();
    const resolutions = await resolveIdentity(index, access, [
      'part.existing.slab',
      'part.unknown',
    ]);
    const summary = summarizeIdentity(resolutions);
    expect(summary).toMatchObject({ total: 2, resolved: 1, allResolved: false });
    expect(summary.byStatus['not-in-id-map']).toBe(1);
    expect(summarizeIdentity([]).allResolved).toBe(false);
  });
});
