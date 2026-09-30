/**
 * Canonical identity contract for the candidate engine.
 *
 * The platform never trusts an engine's transient object ids. A canonical guide `partId` must
 * resolve through the published `id-map.json` (`partId` <-> `ifcGlobalId`) and be confirmed by
 * the product's own `Pset_DiyGuide.partId` property:
 *
 *   partId -> id-map -> ifcGlobalId -> fragment local id -> Pset_DiyGuide.partId == partId
 *
 * This module is pure and engine-agnostic: the fragment lookup is injected as
 * `ModelIdentityAccess` so the resolution rules are unit-testable, and the harness supplies the
 * real `@thatopen/fragments` implementation.
 */

export interface IdMapPart {
  partId: string;
  ifcGlobalId: string;
  ifcClass: string;
}

export interface IdMapDocument {
  version?: string;
  parts: IdMapPart[];
}

export interface IdentityIndex {
  /** Canonical part id -> published id-map row. */
  byPartId: Map<string, IdMapPart>;
  /** IFC GlobalId -> published id-map row. */
  byGlobalId: Map<string, IdMapPart>;
  duplicatePartIds: string[];
  duplicateGlobalIds: string[];
}

/** Build lookup tables from a published id-map; duplicates are reported, first wins. */
export function buildIdentityIndex(idMap: IdMapDocument): IdentityIndex {
  const byPartId = new Map<string, IdMapPart>();
  const byGlobalId = new Map<string, IdMapPart>();
  const duplicatePartIds: string[] = [];
  const duplicateGlobalIds: string[] = [];
  for (const entry of idMap.parts) {
    if (byPartId.has(entry.partId)) duplicatePartIds.push(entry.partId);
    else byPartId.set(entry.partId, entry);
    if (byGlobalId.has(entry.ifcGlobalId)) duplicateGlobalIds.push(entry.ifcGlobalId);
    else byGlobalId.set(entry.ifcGlobalId, entry);
  }
  return { byPartId, byGlobalId, duplicatePartIds, duplicateGlobalIds };
}

export type IdentityStatus =
  /** GlobalId, fragment item and Pset_DiyGuide.partId all agree with the id-map. */
  | 'resolved'
  /** The id-map has no row for the requested partId. */
  | 'not-in-id-map'
  /** The IFC GlobalId from the id-map has no geometry/entity in the loaded fragments. */
  | 'missing-fragment'
  /** The fragment item carries no Pset_DiyGuide.partId. */
  | 'pset-missing'
  /** Pset_DiyGuide.partId disagrees with the id-map — an engine/id-map divergence. */
  | 'pset-mismatch';

export interface IdentityResolution {
  partId: string;
  ifcGlobalId: string | null;
  ifcClass: string | null;
  modelId: string;
  localId: number | null;
  psetPartId: string | null;
  status: IdentityStatus;
}

/** The engine-side lookups the resolver needs (implemented over `@thatopen/fragments`). */
export interface ModelIdentityAccess {
  readonly modelId: string;
  /** IFC GlobalId -> fragment local id (`null` when the model has no such entity). */
  getLocalIdsByGuids(guids: string[]): Promise<(number | null)[]>;
  /** Fragment local id -> `Pset_DiyGuide.partId` (or `null` when absent). */
  getPsetDiyGuidePartId(localId: number): Promise<string | null>;
}

/**
 * Resolve canonical part ids against the id-map and the loaded model. Results preserve the
 * requested order; a part only reports `resolved` when the IFC property set confirms the
 * canonical id (never on a transient engine id alone).
 */
export async function resolveIdentity(
  index: IdentityIndex,
  access: ModelIdentityAccess,
  partIds: readonly string[],
): Promise<IdentityResolution[]> {
  const entries = partIds.map((partId) => index.byPartId.get(partId) ?? null);
  const present = entries.filter((entry): entry is IdMapPart => entry !== null);
  const localIds = await access.getLocalIdsByGuids(present.map((entry) => entry.ifcGlobalId));

  const resolutions: IdentityResolution[] = [];
  let cursor = 0;
  for (const [index, entry] of entries.entries()) {
    if (entry === null) {
      resolutions.push({
        partId: partIds[index] ?? '',
        ifcGlobalId: null,
        ifcClass: null,
        modelId: access.modelId,
        localId: null,
        psetPartId: null,
        status: 'not-in-id-map',
      });
      continue;
    }
    const localId = localIds[cursor] ?? null;
    cursor += 1;
    if (localId === null) {
      resolutions.push({
        partId: entry.partId,
        ifcGlobalId: entry.ifcGlobalId,
        ifcClass: entry.ifcClass,
        modelId: access.modelId,
        localId: null,
        psetPartId: null,
        status: 'missing-fragment',
      });
      continue;
    }
    const psetPartId = await access.getPsetDiyGuidePartId(localId);
    resolutions.push({
      partId: entry.partId,
      ifcGlobalId: entry.ifcGlobalId,
      ifcClass: entry.ifcClass,
      modelId: access.modelId,
      localId,
      psetPartId,
      status:
        psetPartId === null
          ? 'pset-missing'
          : psetPartId === entry.partId
            ? 'resolved'
            : 'pset-mismatch',
    });
  }
  return resolutions;
}

export interface IdentitySummary {
  total: number;
  resolved: number;
  byStatus: Record<IdentityStatus, number>;
  allResolved: boolean;
}

export function summarizeIdentity(resolutions: readonly IdentityResolution[]): IdentitySummary {
  const byStatus: Record<IdentityStatus, number> = {
    resolved: 0,
    'not-in-id-map': 0,
    'missing-fragment': 0,
    'pset-missing': 0,
    'pset-mismatch': 0,
  };
  for (const resolution of resolutions) byStatus[resolution.status] += 1;
  const resolved = byStatus.resolved;
  return {
    total: resolutions.length,
    resolved,
    byStatus,
    allResolved: resolutions.length > 0 && resolved === resolutions.length,
  };
}

const PSET_NAME = 'Pset_DiyGuide';
const PART_ID_PROPERTY = 'partId';
const MAX_DEPTH = 32;

/** Unwrap an item attribute (`{ value, type }`), a bare scalar, or one nested wrapper. */
function attributeValue(input: unknown): unknown {
  if (input === null || typeof input !== 'object') return input;
  const record = input as Record<string, unknown>;
  if ('value' in record) {
    const inner = record['value'];
    if (inner !== null && typeof inner === 'object') {
      const nested = inner as Record<string, unknown>;
      if ('value' in nested) return nested['value'];
    }
    return inner;
  }
  return input;
}

function findPropertyValue(properties: unknown, name: string, depth: number, seen: WeakSet<object>): string | null {
  if (properties === null || typeof properties !== 'object') return null;
  const candidates = Array.isArray(properties) ? properties : [properties];
  for (const candidate of candidates) {
    if (candidate === null || typeof candidate !== 'object') continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const record = candidate as Record<string, unknown>;
    if (attributeValue(record['Name']) !== name) continue;
    const value =
      attributeValue(record['NominalValue']) ??
      attributeValue(record['value']) ??
      attributeValue(record['Value']);
    if (typeof value === 'string' && value.length > 0) return value;
    if (value !== null && value !== undefined) return String(value);
  }
  // Some serializers nest the property list deeper than one level.
  if (depth < MAX_DEPTH) {
    for (const candidate of candidates) {
      if (candidate === null || typeof candidate !== 'object' || seen.has(candidate)) continue;
      const record = candidate as Record<string, unknown>;
      for (const nested of Object.values(record)) {
        if (nested === null || typeof nested !== 'object' || seen.has(nested)) continue;
        const found = findPropertyValue(nested, name, depth + 1, seen);
        if (found !== null) return found;
      }
    }
  }
  return null;
}

/**
 * Extract `Pset_DiyGuide.partId` from a fragments `ItemData` value.
 *
 * The serializer shape (`ItemData = { [name]: { value, type } | ItemData[] }`) is walked
 * tolerantly: the extractor only accepts a `partId` that sits inside an item whose `Name` is
 * `Pset_DiyGuide`, so an unrelated `partId`-named property elsewhere in the graph can never be
 * mistaken for the canonical one. Cycles are guarded with a visited set.
 */
export function extractGuidePartId(data: unknown): string | null {
  const seen = new WeakSet<object>();
  function walk(node: unknown, depth: number): string | null {
    if (depth > MAX_DEPTH || node === null || typeof node !== 'object') return null;
    if (seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = walk(child, depth + 1);
        if (found !== null) return found;
      }
      return null;
    }
    const record = node as Record<string, unknown>;
    if (attributeValue(record['Name']) === PSET_NAME) {
      const partId = findPropertyValue(record['HasProperties'], PART_ID_PROPERTY, depth + 1, seen);
      if (partId !== null) return partId;
    }
    for (const value of Object.values(record)) {
      const found = walk(value, depth + 1);
      if (found !== null) return found;
    }
    return null;
  }
  return walk(data, 0);
}
