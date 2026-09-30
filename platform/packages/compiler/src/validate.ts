/**
 * Bundle validation (architecture.md §6).
 *
 * Enforces the frozen compiler validation table: schema validity for the 17 authored files,
 * global id uniqueness, reference resolution, citations, asset safety/existence, ready-operation
 * parameter completeness, the connection/fastener rules, conflicted measurements, dependency
 * cycles, prerequisite scheduling, superseded dependencies, cover-before-inspection coverage,
 * builder capabilities, acceptance rejection and the takeoff double-count warning.
 *
 * All checks return GuideError lists; nothing throws for ordinary invalid content.
 */
import {
  AUTHORED_FILE_NAMES,
  findUnsupportedCapabilities,
  validateAuthoredFile,
  type AuthoredBundle,
  type AuthoredFileName,
  type Capability,
  type Operation,
  type Part,
  type SchemaIssue,
} from '@diyguide/schema';
import { existsSync, statSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';
import { guideError, type GuideError } from './errors';
import { ifcGuidForPart } from './guid';
import { toRawFiles, type LoadedFile } from './load';

/** Capabilities provided by builder 0.1.0 (architecture.md §6, frozen). */
export const SUPPORTED_CAPABILITIES: Capability[] = [
  { name: 'woodFraming', version: 1 },
  { name: 'drywall', version: 1 },
  { name: 'cabinetry', version: 1 },
  { name: 'electricalUS', version: 1 },
  { name: 'demonstrationOverlays', version: 1 },
];

export const COMPILER_NAME = 'diy-guide-compiler';
export const COMPILER_VERSION = '0.1.0';

export interface ValidationReport {
  /** True when there are no blocking errors (warnings do not block). */
  ok: boolean;
  blockingCount: number;
  warningCount: number;
  errors: GuideError[];
  warnings: GuideError[];
}

export interface ValidateInput {
  bundle: AuthoredBundle | null;
  files?: Partial<Record<AuthoredFileName, LoadedFile>>;
  rawFiles?: Partial<Record<AuthoredFileName, unknown>>;
  bundleDir: string;
  loadErrors?: GuideError[];
}

const FILE_ROOTS: Record<AuthoredFileName, string> = {
  'manifest.json': 'manifest',
  'project.json': 'project',
  'datums.json': 'datums',
  'measurements.json': 'measurements',
  'sources.json': 'sources',
  'assemblies.json': 'assemblies',
  'parts.json': 'parts',
  'connections.json': 'connections',
  'materials.json': 'materials',
  'tools.json': 'tools',
  'systems.json': 'systems',
  'operations.json': 'operations',
  'steps.json': 'steps',
  'views.json': 'views',
  'issues.json': 'issues',
  'acceptance.json': 'acceptance',
  'listing.json': 'listing',
};

function toJsonPath(root: string, instancePath: string): string {
  let path = `$.${root}`;
  for (const segment of instancePath.split('/').filter((s) => s.length > 0)) {
    path += /^\d+$/.test(segment) ? `[${segment}]` : `.${segment}`;
  }
  return path;
}

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isDecimalString = (value: unknown): value is string => typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value);
const isVec3 = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number' && Number.isFinite(n));
const isVec3List = (value: unknown, min = 1): boolean => Array.isArray(value) && value.length >= min && value.every(isVec3);

/**
 * Missing/incomplete required parameters for an operation, expressed as authored json paths.
 * Shared by validation (`READY_OP_MISSING_PARAMETERS`) and step-state application.
 */
export function operationMissingParameters(op: Operation): string[] {
  const missing: string[] = [];
  const params = op.parameters as unknown as Record<string, unknown> | null | undefined;
  switch (op.kind) {
    case 'survey': {
      if (!Array.isArray(params?.['measurementIds']) || (params?.['measurementIds'] as unknown[]).length === 0) {
        missing.push('parameters.measurementIds');
      }
      if (!nonEmptyString(params?.['checkInstruction'])) missing.push('parameters.checkInstruction');
      break;
    }
    case 'prepare': {
      if (!Array.isArray(params?.['materialIds']) || (params?.['materialIds'] as unknown[]).length === 0) {
        missing.push('parameters.materialIds');
      }
      if (!Array.isArray(params?.['toolIds']) || (params?.['toolIds'] as unknown[]).length === 0) {
        missing.push('parameters.toolIds');
      }
      if (!nonEmptyString(params?.['instruction'])) missing.push('parameters.instruction');
      break;
    }
    case 'remove': {
      if (!nonEmptyString(params?.['disposition'])) missing.push('parameters.disposition');
      break;
    }
    case 'cut': {
      const cuts = params?.['cuts'];
      if (!Array.isArray(cuts) || cuts.length === 0) {
        missing.push('parameters.cuts');
      } else {
        cuts.forEach((cut, index) => {
          const record = cut as Record<string, unknown>;
          if (!nonEmptyString(record?.['partId'])) missing.push(`parameters.cuts[${index}].partId`);
          if (!isDecimalString(record?.['finalLengthMm'])) missing.push(`parameters.cuts[${index}].finalLengthMm`);
        });
      }
      break;
    }
    case 'position': {
      if (!nonEmptyString(params?.['datumNote'])) missing.push('parameters.datumNote');
      break;
    }
    case 'fasten': {
      if (!Array.isArray(params?.['connectionIds']) || (params?.['connectionIds'] as unknown[]).length === 0) {
        missing.push('parameters.connectionIds');
      }
      if (params?.['proposed'] !== true && !isVec3List(params?.['pointsMm'])) {
        missing.push('parameters.pointsMm');
      }
      break;
    }
    case 'drill': {
      if (typeof params?.['holeDiameterMm'] !== 'number') missing.push('parameters.holeDiameterMm');
      if (typeof params?.['depthMm'] !== 'number') missing.push('parameters.depthMm');
      if (!isVec3List(params?.['pointsMm'])) missing.push('parameters.pointsMm');
      break;
    }
    case 'route': {
      if (!nonEmptyString(params?.['systemId'])) missing.push('parameters.systemId');
      if (!isVec3List(params?.['pathPointsMm'], 2)) missing.push('parameters.pathPointsMm');
      if (typeof params?.['demonstrationOnly'] !== 'boolean') missing.push('parameters.demonstrationOnly');
      break;
    }
    case 'terminate': {
      if (!nonEmptyString(params?.['systemId'])) missing.push('parameters.systemId');
      if (!Array.isArray(params?.['diagramCitationIds']) || (params?.['diagramCitationIds'] as unknown[]).length === 0) {
        missing.push('parameters.diagramCitationIds');
      }
      break;
    }
    case 'finish': {
      if (!nonEmptyString(params?.['levelLabel'])) missing.push('parameters.levelLabel');
      break;
    }
    case 'inspect': {
      if (!nonEmptyString(params?.['inspectWhat'])) missing.push('parameters.inspectWhat');
      if (!nonEmptyString(params?.['criteria'])) missing.push('parameters.criteria');
      if (!nonEmptyString(params?.['evidenceRequired'])) missing.push('parameters.evidenceRequired');
      break;
    }
    case 'test': {
      if (!nonEmptyString(params?.['testType'])) missing.push('parameters.testType');
      if (!nonEmptyString(params?.['expectedResult'])) missing.push('parameters.expectedResult');
      break;
    }
  }
  return missing;
}

export function operationParametersComplete(op: Operation): { ok: boolean; missing: string[] } {
  const missing = operationMissingParameters(op);
  return { ok: missing.length === 0, missing };
}

function isUnsafeAssetPath(assetPath: string): boolean {
  if (!nonEmptyString(assetPath)) return true;
  if (isAbsolute(assetPath)) return true;
  if (assetPath.includes('\\')) return true;
  if (assetPath.startsWith('~')) return true;
  const segments = assetPath.split('/');
  if (segments.some((segment) => segment === '..' || segment.length === 0)) return true;
  return false;
}

interface AssetCheck {
  relPath: string | null | undefined;
  privacy: string;
  objectId: string;
  jsonPath: string;
  required: boolean;
}

function checkAsset(bundleDir: string, check: AssetCheck): GuideError[] {
  const errors: GuideError[] = [];
  const relPath = check.relPath;
  if (!nonEmptyString(relPath)) {
    if (check.required) {
      errors.push(
        guideError({
          code: 'MISSING_FILE',
          file: 'sources.json',
          jsonPath: check.jsonPath,
          objectId: check.objectId,
          expected: 'bundle-relative asset path',
          actual: 'missing',
        }),
      );
    }
    return errors;
  }
  if (isUnsafeAssetPath(relPath)) {
    errors.push(
      guideError({
        code: 'UNSAFE_PATH',
        file: 'sources.json',
        jsonPath: check.jsonPath,
        objectId: check.objectId,
        expected: 'bundle-relative path without ".." and without absolute segments',
        actual: relPath,
      }),
    );
    return errors;
  }
  const root = resolve(bundleDir);
  const abs = resolve(root, relPath);
  if (abs !== root && !abs.startsWith(`${root}${sep}`)) {
    errors.push(
      guideError({
        code: 'UNSAFE_PATH',
        file: 'sources.json',
        jsonPath: check.jsonPath,
        objectId: check.objectId,
        expected: 'asset path inside the bundle directory',
        actual: relPath,
      }),
    );
    return errors;
  }
  if (!check.required) return errors; // private sources are never required to be present
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    errors.push(
      guideError({
        code: 'MISSING_FILE',
        file: 'sources.json',
        jsonPath: check.jsonPath,
        objectId: check.objectId,
        expected: 'asset file exists on disk',
        actual: relPath,
      }),
    );
  }
  return errors;
}

interface IdIndex {
  all: Set<string>;
  byCollection: Map<string, Set<string>>;
  first: Map<string, { file: string; jsonPath: string }>;
}

function buildIdIndex(bundle: AuthoredBundle): { index: IdIndex; duplicates: GuideError[] } {
  const index: IdIndex = { all: new Set(), byCollection: new Map(), first: new Map() };
  const duplicates: GuideError[] = [];

  const register = (collection: string, id: string | null | undefined, file: AuthoredFileName, jsonPath: string): void => {
    if (!nonEmptyString(id)) return;
    if (!index.byCollection.has(collection)) index.byCollection.set(collection, new Set());
    index.byCollection.get(collection)!.add(id);
    index.all.add(id);
    const first = index.first.get(id);
    if (first) {
      duplicates.push(
        guideError({
          code: 'DUPLICATE_ID',
          file,
          jsonPath,
          objectId: id,
          expected: 'globally unique id across all collections',
          actual: `already used at ${first.file}${first.jsonPath}`,
        }),
      );
      return;
    }
    index.first.set(id, { file, jsonPath });
  };

  bundle.project?.releases?.forEach((release, i) => register('releases', release?.id, 'project.json', `$.project.releases[${i}].id`));
  bundle.datums?.forEach((datum, i) => register('datums', datum?.id, 'datums.json', `$.datums[${i}].id`));
  bundle.measurements?.forEach((m, i) => register('measurements', m?.id, 'measurements.json', `$.measurements[${i}].id`));
  bundle.sources?.sources?.forEach((s, i) => register('sources', s?.id, 'sources.json', `$.sources.sources[${i}].id`));
  bundle.sources?.citations?.forEach((c, i) => register('citations', c?.id, 'sources.json', `$.sources.citations[${i}].id`));
  bundle.assemblies?.forEach((a, i) => register('assemblies', a?.id, 'assemblies.json', `$.assemblies[${i}].id`));
  bundle.parts?.forEach((p, i) => register('parts', p?.id, 'parts.json', `$.parts[${i}].id`));
  bundle.materials?.forEach((m, i) => register('materials', m?.id, 'materials.json', `$.materials[${i}].id`));
  bundle.tools?.forEach((t, i) => register('tools', t?.id, 'tools.json', `$.tools[${i}].id`));
  bundle.systems?.forEach((s, i) => {
    register('systems', s?.id, 'systems.json', `$.systems[${i}].id`);
    s?.circuits?.forEach((c, j) => register('circuits', c?.id, 'systems.json', `$.systems[${i}].circuits[${j}].id`));
  });
  bundle.connections?.connections?.forEach((c, i) => register('connections', c?.id, 'connections.json', `$.connections.connections[${i}].id`));
  bundle.connections?.fastenerSpecs?.forEach((f, i) => register('fastenerSpecs', f?.id, 'connections.json', `$.connections.fastenerSpecs[${i}].id`));
  bundle.operations?.forEach((o, i) => register('operations', o?.id, 'operations.json', `$.operations[${i}].id`));
  bundle.steps?.forEach((s, i) => register('steps', s?.id, 'steps.json', `$.steps[${i}].id`));
  bundle.views?.forEach((v, i) => register('views', v?.id, 'views.json', `$.views[${i}].id`));
  bundle.issues?.forEach((issue, i) => register('issues', issue?.id, 'issues.json', `$.issues[${i}].id`));

  return { index, duplicates };
}

function checkRef(
  index: IdIndex,
  collection: string,
  id: string | null | undefined,
  file: AuthoredFileName,
  jsonPath: string,
  objectId: string | null,
): GuideError | null {
  if (!nonEmptyString(id)) return null;
  const known = collection === 'any' ? index.all.has(id) : index.byCollection.get(collection)?.has(id) === true;
  if (known) return null;
  return guideError({
    code: 'DANGLING_REF',
    file,
    jsonPath,
    objectId,
    expected: collection === 'any' ? 'existing id in the bundle' : `existing ${collection} id`,
    actual: id,
  });
}

function findNestedCycles(ids: string[], edgesOf: (id: string) => string[]): string[][] {
  const known = new Set(ids);
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const id of ids) {
    const targets = edgesOf(id).filter((target) => known.has(target));
    outgoing.set(id, targets);
    for (const target of targets) indegree.set(target, (indegree.get(target) ?? 0) + 1);
  }
  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  const removed = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    removed.add(id);
    for (const target of outgoing.get(id) ?? []) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  const remaining = ids.filter((id) => !removed.has(id));
  const remainingSet = new Set(remaining);
  const groups: string[][] = [];
  const visited = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const id of remaining) {
    const neighbors = new Set<string>([...(outgoing.get(id) ?? []).filter((t) => remainingSet.has(t))]);
    for (const other of remaining) {
      if ((outgoing.get(other) ?? []).includes(id)) neighbors.add(other);
    }
    adjacency.set(id, [...neighbors]);
  }
  for (const id of remaining) {
    if (visited.has(id)) continue;
    const group: string[] = [];
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      group.push(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) stack.push(next);
      }
    }
    groups.push(group.sort());
  }
  return groups;
}

/** Operations reachable from `startId` through dependencies (excluding the start itself). */
function dependencyClosure(startId: string, byId: Map<string, Operation>): Operation[] {
  const result: Operation[] = [];
  const seen = new Set<string>([startId]);
  const stack = [...(byId.get(startId)?.dependencyOperationIds ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const op = byId.get(id);
    if (!op) continue;
    result.push(op);
    for (const dep of op.dependencyOperationIds ?? []) stack.push(dep);
  }
  return result;
}

function referenceErrors(bundle: AuthoredBundle, index: IdIndex): GuideError[] {
  const errors: GuideError[] = [];
  const add = (error: GuideError | null): void => {
    if (error) errors.push(error);
  };
  const parts = bundle.parts ?? [];
  const assemblies = bundle.assemblies ?? [];
  const operations = bundle.operations ?? [];
  const steps = bundle.steps ?? [];
  const assembliesById = new Map(assemblies.map((a) => [a.id, a]));
  const systemsById = new Map((bundle.systems ?? []).map((s) => [s.id, s]));

  (bundle.project?.releases ?? []).forEach((release, i) => {
    (release?.affectedIds ?? []).forEach((id, j) => {
      add(checkRef(index, 'any', id, 'project.json', `$.project.releases[${i}].affectedIds[${j}]`, release?.id ?? null));
    });
  });

  (bundle.measurements ?? []).forEach((m, i) => {
    (m?.citationIds ?? []).forEach((id, j) => add(checkRef(index, 'citations', id, 'measurements.json', `$.measurements[${i}].citationIds[${j}]`, m?.id ?? null)));
    (m?.derivedFromMeasurementIds ?? []).forEach((id, j) =>
      add(checkRef(index, 'measurements', id, 'measurements.json', `$.measurements[${i}].derivedFromMeasurementIds[${j}]`, m?.id ?? null)),
    );
  });

  (bundle.sources?.citations ?? []).forEach((citation, i) => {
    add(checkRef(index, 'sources', citation?.sourceId, 'sources.json', `$.sources.citations[${i}].sourceId`, citation?.id ?? null));
  });

  assemblies.forEach((assembly, i) => {
    add(checkRef(index, 'assemblies', assembly?.parentId ?? null, 'assemblies.json', `$.assemblies[${i}].parentId`, assembly?.id ?? null));
  });

  parts.forEach((part, i) => {
    add(checkRef(index, 'assemblies', part?.assemblyId, 'parts.json', `$.parts[${i}].assemblyId`, part?.id ?? null));
    if (part?.materialId !== null && part?.materialId !== undefined) {
      add(checkRef(index, 'materials', part.materialId, 'parts.json', `$.parts[${i}].materialId`, part?.id ?? null));
    }
  });

  (bundle.connections?.connections ?? []).forEach((connection, i) => {
    add(checkRef(index, 'parts', connection?.fromPartId, 'connections.json', `$.connections.connections[${i}].fromPartId`, connection?.id ?? null));
    add(checkRef(index, 'parts', connection?.toPartId, 'connections.json', `$.connections.connections[${i}].toPartId`, connection?.id ?? null));
    add(checkRef(index, 'fastenerSpecs', connection?.fastenerSpecId ?? null, 'connections.json', `$.connections.connections[${i}].fastenerSpecId`, connection?.id ?? null));
    (connection?.citationIds ?? []).forEach((id, j) =>
      add(checkRef(index, 'citations', id, 'connections.json', `$.connections.connections[${i}].citationIds[${j}]`, connection?.id ?? null)),
    );
  });

  (bundle.connections?.fastenerSpecs ?? []).forEach((spec, i) => {
    (spec?.citationIds ?? []).forEach((id, j) =>
      add(checkRef(index, 'citations', id, 'connections.json', `$.connections.fastenerSpecs[${i}].citationIds[${j}]`, spec?.id ?? null)),
    );
  });

  (bundle.materials ?? []).forEach((material, i) => {
    (material?.citationIds ?? []).forEach((id, j) => add(checkRef(index, 'citations', id, 'materials.json', `$.materials[${i}].citationIds[${j}]`, material?.id ?? null)));
  });

  (bundle.tools ?? []).forEach((tool, i) => {
    (tool?.citationIds ?? []).forEach((id, j) => add(checkRef(index, 'citations', id, 'tools.json', `$.tools[${i}].citationIds[${j}]`, tool?.id ?? null)));
  });

  (bundle.systems ?? []).forEach((system, i) => {
    (system?.citationIds ?? []).forEach((id, j) => add(checkRef(index, 'citations', id, 'systems.json', `$.systems[${i}].citationIds[${j}]`, system?.id ?? null)));
    (system?.circuits ?? []).forEach((circuit, j) => {
      (circuit?.citationIds ?? []).forEach((id, k) =>
        add(checkRef(index, 'citations', id, 'systems.json', `$.systems[${i}].circuits[${j}].citationIds[${k}]`, circuit?.id ?? null)),
      );
    });
  });

  operations.forEach((op, i) => {
    const objectId = op?.id ?? null;
    (op?.targetPartIds ?? []).forEach((id, j) => add(checkRef(index, 'parts', id, 'operations.json', `$.operations[${i}].targetPartIds[${j}]`, objectId)));
    (op?.dependencyOperationIds ?? []).forEach((id, j) =>
      add(checkRef(index, 'operations', id, 'operations.json', `$.operations[${i}].dependencyOperationIds[${j}]`, objectId)),
    );
    (op?.citationIds ?? []).forEach((id, j) => add(checkRef(index, 'citations', id, 'operations.json', `$.operations[${i}].citationIds[${j}]`, objectId)));
    (op?.qualityChecks ?? []).forEach((check, j) => {
      (check?.citationIds ?? []).forEach((id, k) =>
        add(checkRef(index, 'citations', id, 'operations.json', `$.operations[${i}].qualityChecks[${j}].citationIds[${k}]`, objectId)),
      );
    });
    (op?.view?.highlightPartIds ?? []).forEach((id, j) => add(checkRef(index, 'parts', id, 'operations.json', `$.operations[${i}].view.highlightPartIds[${j}]`, objectId)));
    (op?.view?.hiddenPartIds ?? []).forEach((id, j) => add(checkRef(index, 'parts', id, 'operations.json', `$.operations[${i}].view.hiddenPartIds[${j}]`, objectId)));
    add(checkRef(index, 'views', op?.view?.cameraPresetId ?? null, 'operations.json', `$.operations[${i}].view.cameraPresetId`, objectId));
    const recipe = op?.view?.recipe;
    (recipe?.reveal ?? []).forEach((id, j) => add(checkRef(index, 'parts', id, 'operations.json', `$.operations[${i}].view.recipe.reveal[${j}]`, objectId)));
    (recipe?.ghostPrevious ?? []).forEach((id, j) => add(checkRef(index, 'parts', id, 'operations.json', `$.operations[${i}].view.recipe.ghostPrevious[${j}]`, objectId)));
    (recipe?.schematicElevation?.studPartIds ?? []).forEach((id, j) => add(checkRef(index, 'parts', id, 'operations.json', `$.operations[${i}].view.recipe.schematicElevation.studPartIds[${j}]`, objectId)));
    (recipe?.schematicElevation?.topPlatePartIds ?? []).forEach((id, j) => add(checkRef(index, 'parts', id, 'operations.json', `$.operations[${i}].view.recipe.schematicElevation.topPlatePartIds[${j}]`, objectId)));
    (recipe?.schematicElevation?.panelPartIds ?? []).forEach((id, j) => add(checkRef(index, 'parts', id, 'operations.json', `$.operations[${i}].view.recipe.schematicElevation.panelPartIds[${j}]`, objectId)));
    (recipe?.schematicElevation?.contextPartIds ?? []).forEach((id, j) => add(checkRef(index, 'parts', id, 'operations.json', `$.operations[${i}].view.recipe.schematicElevation.contextPartIds[${j}]`, objectId)));
    (recipe?.boxTransforms ?? []).forEach((transform, j) => add(checkRef(index, 'parts', transform.partId, 'operations.json', `$.operations[${i}].view.recipe.boxTransforms[${j}].partId`, objectId)));
    (recipe?.requirementPreview?.measurementIds ?? []).forEach((id, j) => add(checkRef(index, 'measurements', id, 'operations.json', `$.operations[${i}].view.recipe.requirementPreview.measurementIds[${j}]`, objectId)));
    add(checkRef(index, 'parts', recipe?.translateFrom?.partId ?? null, 'operations.json', `$.operations[${i}].view.recipe.translateFrom.partId`, objectId));
    add(checkRef(index, 'connections', recipe?.showFastenerPoints?.connectionId ?? null, 'operations.json', `$.operations[${i}].view.recipe.showFastenerPoints.connectionId`, objectId));
    add(checkRef(index, 'connections', recipe?.driveFasteners?.connectionId ?? null, 'operations.json', `$.operations[${i}].view.recipe.driveFasteners.connectionId`, objectId));
    add(checkRef(index, 'parts', recipe?.routePath?.partId ?? null, 'operations.json', `$.operations[${i}].view.recipe.routePath.partId`, objectId));

    const params = op?.parameters as unknown as Record<string, unknown> | undefined;
    switch (op?.kind) {
      case 'survey': {
        ((params?.['measurementIds'] as string[] | undefined) ?? []).forEach((id, j) =>
          add(checkRef(index, 'measurements', id, 'operations.json', `$.operations[${i}].parameters.measurementIds[${j}]`, objectId)),
        );
        break;
      }
      case 'prepare': {
        ((params?.['materialIds'] as string[] | undefined) ?? []).forEach((id, j) =>
          add(checkRef(index, 'materials', id, 'operations.json', `$.operations[${i}].parameters.materialIds[${j}]`, objectId)),
        );
        ((params?.['toolIds'] as string[] | undefined) ?? []).forEach((id, j) =>
          add(checkRef(index, 'tools', id, 'operations.json', `$.operations[${i}].parameters.toolIds[${j}]`, objectId)),
        );
        ((params?.['cutOperationIds'] as string[] | undefined) ?? []).forEach((id, j) => {
          add(checkRef(index, 'operations', id, 'operations.json', `$.operations[${i}].parameters.cutOperationIds[${j}]`, objectId));
          const cutOperation = operations.find((candidate) => candidate?.id === id);
          if (cutOperation && cutOperation.kind !== 'cut') {
            errors.push(
              guideError({
                code: 'INVALID_CUT_OPERATION_REF',
                file: 'operations.json',
                jsonPath: `$.operations[${i}].parameters.cutOperationIds[${j}]`,
                objectId,
                expected: 'cutOperationIds entry resolves to a cut operation',
                actual: `${id} is kind ${cutOperation.kind}`,
              }),
            );
          }
        });
        break;
      }
      case 'cut': {
        const cuts = (params?.['cuts'] as { partId?: string; toolId?: string }[] | undefined) ?? [];
        cuts.forEach((cut, j) => add(checkRef(index, 'parts', cut?.partId, 'operations.json', `$.operations[${i}].parameters.cuts[${j}].partId`, objectId)));
        add(checkRef(index, 'tools', (params?.['toolId'] as string | null | undefined) ?? null, 'operations.json', `$.operations[${i}].parameters.toolId`, objectId));
        break;
      }
      case 'position': {
        add(checkRef(index, 'parts', (params?.['fromPartId'] as string | null | undefined) ?? null, 'operations.json', `$.operations[${i}].parameters.fromPartId`, objectId));
        add(checkRef(index, 'tools', (params?.['toolId'] as string | null | undefined) ?? null, 'operations.json', `$.operations[${i}].parameters.toolId`, objectId));
        break;
      }
      case 'fasten': {
        ((params?.['connectionIds'] as string[] | undefined) ?? []).forEach((id, j) =>
          add(checkRef(index, 'connections', id, 'operations.json', `$.operations[${i}].parameters.connectionIds[${j}]`, objectId)),
        );
        add(checkRef(index, 'tools', (params?.['toolId'] as string | null | undefined) ?? null, 'operations.json', `$.operations[${i}].parameters.toolId`, objectId));
        break;
      }
      case 'drill': {
        add(checkRef(index, 'tools', (params?.['toolId'] as string | null | undefined) ?? null, 'operations.json', `$.operations[${i}].parameters.toolId`, objectId));
        break;
      }
      case 'route': {
        const systemId = params?.['systemId'] as string | undefined;
        add(checkRef(index, 'systems', systemId, 'operations.json', `$.operations[${i}].parameters.systemId`, objectId));
        const circuitId = (params?.['circuitId'] as string | null | undefined) ?? null;
        if (circuitId !== null && nonEmptyString(systemId)) {
          const system = systemsById.get(systemId);
          const hasCircuit = system?.circuits?.some((circuit) => circuit.id === circuitId) === true;
          if (!hasCircuit) {
            errors.push(
              guideError({
                code: 'DANGLING_REF',
                file: 'operations.json',
                jsonPath: `$.operations[${i}].parameters.circuitId`,
                objectId,
                expected: `circuit ${circuitId} of system ${systemId}`,
                actual: circuitId,
              }),
            );
          }
        }
        break;
      }
      case 'terminate': {
        const systemId = params?.['systemId'] as string | undefined;
        add(checkRef(index, 'systems', systemId, 'operations.json', `$.operations[${i}].parameters.systemId`, objectId));
        add(checkRef(index, 'parts', (params?.['terminalPartId'] as string | null | undefined) ?? null, 'operations.json', `$.operations[${i}].parameters.terminalPartId`, objectId));
        ((params?.['diagramCitationIds'] as string[] | undefined) ?? []).forEach((id, j) =>
          add(checkRef(index, 'citations', id, 'operations.json', `$.operations[${i}].parameters.diagramCitationIds[${j}]`, objectId)),
        );
        break;
      }
      default:
        break;
    }
  });

  steps.forEach((step, i) => {
    const objectId = step?.id ?? null;
    (step?.prerequisiteStepIds ?? []).forEach((id, j) => add(checkRef(index, 'steps', id, 'steps.json', `$.steps[${i}].prerequisiteStepIds[${j}]`, objectId)));
    (step?.operationIds ?? []).forEach((id, j) => add(checkRef(index, 'operations', id, 'steps.json', `$.steps[${i}].operationIds[${j}]`, objectId)));
    (step?.visibleAssemblyIds ?? []).forEach((id, j) => add(checkRef(index, 'assemblies', id, 'steps.json', `$.steps[${i}].visibleAssemblyIds[${j}]`, objectId)));
    (step?.toolIds ?? []).forEach((id, j) => add(checkRef(index, 'tools', id, 'steps.json', `$.steps[${i}].toolIds[${j}]`, objectId)));
    (step?.citationIds ?? []).forEach((id, j) => add(checkRef(index, 'citations', id, 'steps.json', `$.steps[${i}].citationIds[${j}]`, objectId)));
    (step?.qualityChecks ?? []).forEach((check, j) => {
      (check?.citationIds ?? []).forEach((id, k) =>
        add(checkRef(index, 'citations', id, 'steps.json', `$.steps[${i}].qualityChecks[${j}].citationIds[${k}]`, objectId)),
      );
    });
  });

  (bundle.issues ?? []).forEach((issue, i) => {
    (issue?.affectedIds ?? []).forEach((id, j) => add(checkRef(index, 'any', id, 'issues.json', `$.issues[${i}].affectedIds[${j}]`, issue?.id ?? null)));
    (issue?.sourceRefIds ?? []).forEach((id, j) => {
      const citationError = checkRef(index, 'citations', id, 'issues.json', `$.issues[${i}].sourceRefIds[${j}]`, issue?.id ?? null);
      if (citationError) {
        // A sourceRefId may name a citation or a source; only report when neither resolves.
        const sourceError = checkRef(index, 'sources', id, 'issues.json', `$.issues[${i}].sourceRefIds[${j}]`, issue?.id ?? null);
        add(sourceError);
      }
    });
  });

  (bundle.acceptance?.issueDispositions ?? []).forEach((disposition, i) => {
    add(checkRef(index, 'issues', disposition?.issueId, 'acceptance.json', `$.acceptance.issueDispositions[${i}].issueId`, null));
  });

  // Assembly parent cycles
  const assemblyIds = [...assembliesById.keys()];
  const cycles = findNestedCycles(assemblyIds, (id) => {
    const parent = assembliesById.get(id)?.parentId;
    return parent ? [parent] : [];
  });
  for (const group of cycles) {
    errors.push(
      guideError({
        code: 'CYCLIC_DEPENDENCY',
        file: 'assemblies.json',
        jsonPath: '$.assemblies',
        objectId: group[0] ?? null,
        expected: 'finite assembly parent chain',
        actual: `cycle: ${group.join(' -> ')}`,
      }),
    );
  }

  // Part identity contract: ifcGlobalId must equal the deterministic value for the authored id.
  parts.forEach((part, i) => {
    if (!nonEmptyString(part?.id)) return;
    const computed = ifcGuidForPart(part.id);
    if (part.ifcGlobalId !== computed) {
      errors.push(
        guideError({
          code: 'SCHEMA_INVALID',
          file: 'parts.json',
          jsonPath: `$.parts[${i}].ifcGlobalId`,
          objectId: part.id,
          expected: `ifcGlobalId ${computed} (uuidv5 + IFC compression of the part id)`,
          actual: String(part.ifcGlobalId),
        }),
      );
    }
  });

  // Keep referenced maps alive for future checks (no-op, documents intent).
  return errors;
}

function citationErrors(bundle: AuthoredBundle): GuideError[] {
  const errors: GuideError[] = [];
  const missing = (file: AuthoredFileName, jsonPath: string, objectId: string | null): void => {
    errors.push(
      guideError({
        code: 'MISSING_CITATION',
        file,
        jsonPath,
        objectId,
        expected: 'at least one citation or derivation for a construction-significant fact',
        actual: 'citationIds is empty',
      }),
    );
  };

  (bundle.measurements ?? []).forEach((m, i) => {
    if ((m?.citationIds?.length ?? 0) === 0 && (m?.derivedFromMeasurementIds?.length ?? 0) === 0) {
      missing('measurements.json', `$.measurements[${i}].citationIds`, m?.id ?? null);
    }
  });
  (bundle.connections?.connections ?? []).forEach((c, i) => {
    if ((c?.citationIds?.length ?? 0) === 0) missing('connections.json', `$.connections.connections[${i}].citationIds`, c?.id ?? null);
  });
  (bundle.connections?.fastenerSpecs ?? []).forEach((s, i) => {
    if ((s?.citationIds?.length ?? 0) === 0) missing('connections.json', `$.connections.fastenerSpecs[${i}].citationIds`, s?.id ?? null);
  });
  (bundle.materials ?? []).forEach((m, i) => {
    if ((m?.citationIds?.length ?? 0) === 0) missing('materials.json', `$.materials[${i}].citationIds`, m?.id ?? null);
  });
  (bundle.tools ?? []).forEach((t, i) => {
    if ((t?.citationIds?.length ?? 0) === 0) missing('tools.json', `$.tools[${i}].citationIds`, t?.id ?? null);
  });
  (bundle.systems ?? []).forEach((s, i) => {
    if ((s?.citationIds?.length ?? 0) === 0) missing('systems.json', `$.systems[${i}].citationIds`, s?.id ?? null);
    (s?.circuits ?? []).forEach((c, j) => {
      if ((c?.citationIds?.length ?? 0) === 0) missing('systems.json', `$.systems[${i}].circuits[${j}].citationIds`, c?.id ?? null);
    });
  });
  (bundle.operations ?? []).forEach((op, i) => {
    if ((op?.citationIds?.length ?? 0) === 0) missing('operations.json', `$.operations[${i}].citationIds`, op?.id ?? null);
  });
  (bundle.steps ?? []).forEach((step, i) => {
    if ((step?.citationIds?.length ?? 0) === 0) missing('steps.json', `$.steps[${i}].citationIds`, step?.id ?? null);
  });
  return errors;
}

function assetErrors(bundle: AuthoredBundle, bundleDir: string): GuideError[] {
  const errors: GuideError[] = [];
  (bundle.sources?.sources ?? []).forEach((source, i) => {
    const privacy = source?.privacy ?? 'private';
    errors.push(
      ...checkAsset(bundleDir, {
        relPath: source?.assetPath ?? null,
        privacy,
        objectId: source?.id ?? 'source',
        jsonPath: `$.sources.sources[${i}].assetPath`,
        required: privacy === 'public' || privacy === 'excerpt_only',
      }),
    );
  });
  errors.push(
    ...checkAsset(bundleDir, {
      relPath: bundle.listing?.thumbnailAssetPath ?? null,
      privacy: 'public',
      objectId: bundle.listing?.slug ?? 'listing',
      jsonPath: '$.listing.thumbnailAssetPath',
      required: true,
    }),
  );
  return errors;
}

function parameterErrors(bundle: AuthoredBundle): GuideError[] {
  const errors: GuideError[] = [];
  const connectionsById = new Map((bundle.connections?.connections ?? []).map((connection) => [connection.id, connection]));

  (bundle.connections?.connections ?? []).forEach((connection, i) => {
    const declared = connection?.declaredReleaseStatus;
    if ((declared === 'ready' || declared === 'conditional') && !nonEmptyString(connection?.fastenerSpecId)) {
      errors.push(
        guideError({
          code: 'MISSING_CONNECTION_SPEC',
          file: 'connections.json',
          jsonPath: `$.connections.connections[${i}].fastenerSpecId`,
          objectId: connection?.id ?? null,
          expected: 'a released connection names a fastenerSpecId',
          actual: `declaredReleaseStatus=${declared}, fastenerSpecId=${String(connection?.fastenerSpecId)}`,
        }),
      );
    }
  });

  (bundle.operations ?? []).forEach((op, i) => {
    if (op?.declaredReleaseStatus !== 'ready') return;
    const missing = operationMissingParameters(op);
    if (missing.length > 0) {
      errors.push(
        guideError({
          code: 'READY_OP_MISSING_PARAMETERS',
          file: 'operations.json',
          jsonPath: `$.operations[${i}].parameters`,
          objectId: op?.id ?? null,
          expected: 'declared-ready operation has complete required parameters',
          actual: `missing: ${missing.join(', ')}`,
        }),
      );
    }
    if (op.kind === 'fasten') {
      const params = op.parameters as unknown as Record<string, unknown>;
      const connectionIds = Array.isArray(params?.['connectionIds']) ? (params['connectionIds'] as string[]) : [];
      connectionIds.forEach((connectionId, j) => {
        const connection = connectionsById.get(connectionId);
        if (!connection) return;
        const problems: string[] = [];
        if (!nonEmptyString(connection.fastenerSpecId)) problems.push('fastenerSpecId is null/empty');
        if (!connection.pattern || !nonEmptyString(connection.pattern.type)) problems.push('pattern is null/empty');
        if (connection.declaredReleaseStatus !== 'ready' && connection.declaredReleaseStatus !== 'conditional') {
          problems.push(`declaredReleaseStatus=${connection.declaredReleaseStatus}`);
        }
        if (problems.length > 0) {
          errors.push(
            guideError({
              code: 'MISSING_FASTENER_PATTERN',
              file: 'operations.json',
              jsonPath: `$.operations[${i}].parameters.connectionIds[${j}]`,
              objectId: op?.id ?? null,
              expected: 'referenced connection has fastenerSpecId, pattern and declared release status ready|conditional',
              actual: `${connectionId}: ${problems.join('; ')}`,
              sourceRefIds: connection.citationIds ?? [],
            }),
          );
        }
      });
    }
  });
  return errors;
}

function conflictErrors(bundle: AuthoredBundle): GuideError[] {
  const errors: GuideError[] = [];
  (bundle.measurements ?? []).forEach((measurement, i) => {
    if (measurement?.evidenceStatus !== 'conflicted') return;
    const openIssue = (bundle.issues ?? []).some(
      (issue) => issue?.status === 'open' && (issue?.affectedIds ?? []).includes(measurement.id),
    );
    if (!openIssue) {
      errors.push(
        guideError({
          code: 'CONFLICTED_MEASUREMENT_WITHOUT_ISSUE',
          file: 'measurements.json',
          jsonPath: `$.measurements[${i}].evidenceStatus`,
          objectId: measurement?.id ?? null,
          expected: 'conflicted measurement is tracked by an open issue',
          actual: 'no open issue with this measurement in affectedIds',
        }),
      );
    }
  });
  return errors;
}

function dependencyErrors(bundle: AuthoredBundle): GuideError[] {
  const errors: GuideError[] = [];
  const operations = bundle.operations ?? [];
  const steps = bundle.steps ?? [];
  const operationsById = new Map(operations.map((op) => [op.id, op]));
  const stepsById = new Map(steps.map((step) => [step.id, step]));

  const operationCycles = findNestedCycles(
    operations.map((op) => op.id),
    (id) => operationsById.get(id)?.dependencyOperationIds ?? [],
  );
  for (const group of operationCycles) {
    errors.push(
      guideError({
        code: 'CYCLIC_DEPENDENCY',
        file: 'operations.json',
        jsonPath: '$.operations',
        objectId: group[0] ?? null,
        expected: 'operation dependency graph is acyclic',
        actual: `cycle: ${group.join(' -> ')}`,
      }),
    );
  }

  const stepCycles = findNestedCycles(
    steps.map((step) => step.id),
    (id) => stepsById.get(id)?.prerequisiteStepIds ?? [],
  );
  for (const group of stepCycles) {
    errors.push(
      guideError({
        code: 'CYCLIC_DEPENDENCY',
        file: 'steps.json',
        jsonPath: '$.steps',
        objectId: group[0] ?? null,
        expected: 'step prerequisite graph is acyclic',
        actual: `cycle: ${group.join(' -> ')}`,
      }),
    );
  }

  steps.forEach((step, i) => {
    (step?.prerequisiteStepIds ?? []).forEach((prereqId, j) => {
      const prereq = stepsById.get(prereqId);
      if (!prereq) return;
      if (prereq.sequence >= step.sequence) {
        errors.push(
          guideError({
            code: 'SCHEDULE_INCONSISTENT',
            file: 'steps.json',
            jsonPath: `$.steps[${i}].prerequisiteStepIds[${j}]`,
            objectId: step?.id ?? null,
            expected: `prerequisite ${prereqId} sequence < ${step.sequence}`,
            actual: `prerequisite sequence ${prereq.sequence}`,
          }),
        );
      }
    });
  });

  operations.forEach((op, i) => {
    (op?.dependencyOperationIds ?? []).forEach((depId, j) => {
      const dep = operationsById.get(depId);
      if (dep?.declaredReleaseStatus === 'superseded') {
        errors.push(
          guideError({
            code: 'SUPERSEDED_DEPENDENCY',
            file: 'operations.json',
            jsonPath: `$.operations[${i}].dependencyOperationIds[${j}]`,
            objectId: op?.id ?? null,
            expected: 'required dependency is not superseded',
            actual: `${depId} is superseded`,
          }),
        );
      }
    });
    const params = op?.parameters as unknown as Record<string, unknown> | undefined;
    if (op?.kind === 'fasten') {
      ((params?.['connectionIds'] as string[] | undefined) ?? []).forEach((connectionId, j) => {
        const connection = (bundle.connections?.connections ?? []).find((c) => c.id === connectionId);
        if (connection?.declaredReleaseStatus === 'superseded') {
          errors.push(
            guideError({
              code: 'SUPERSEDED_DEPENDENCY',
              file: 'operations.json',
              jsonPath: `$.operations[${i}].parameters.connectionIds[${j}]`,
              objectId: op?.id ?? null,
              expected: 'required connection dependency is not superseded',
              actual: `${connectionId} is superseded`,
            }),
          );
        }
      });
    }
  });

  steps.forEach((step, i) => {
    (step?.prerequisiteStepIds ?? []).forEach((prereqId, j) => {
      const prereq = stepsById.get(prereqId);
      if (prereq?.declaredReleaseStatus === 'superseded') {
        errors.push(
          guideError({
            code: 'SUPERSEDED_DEPENDENCY',
            file: 'steps.json',
            jsonPath: `$.steps[${i}].prerequisiteStepIds[${j}]`,
            objectId: step?.id ?? null,
            expected: 'prerequisite step is not superseded',
            actual: `${prereqId} is superseded`,
          }),
        );
      }
    });
  });

  return errors;
}

function coverageErrors(bundle: AuthoredBundle): GuideError[] {
  const errors: GuideError[] = [];
  const operations = bundle.operations ?? [];
  const parts = bundle.parts ?? [];
  const partsById = new Map(parts.map((part) => [part.id, part]));
  const operationsById = new Map(operations.map((op) => [op.id, op]));

  operations.forEach((op, i) => {
    const coveredPartIds = [...new Set((op?.stateEffects ?? []).filter((effect) => effect?.toState === 'covered').map((effect) => effect.partId))];
    if (coveredPartIds.length === 0) return;
    const closure = dependencyClosure(op.id, operationsById);
    const inspectOps = closure.filter(
      (candidate) =>
        candidate.kind === 'inspect' &&
        (candidate.parameters as { evidenceRequired?: string }).evidenceRequired !== undefined &&
        (candidate.parameters as { evidenceRequired?: string }).evidenceRequired !== 'none',
    );
    const uncoveredAssemblies = new Set<string>();
    for (const partId of coveredPartIds) {
      const part = partsById.get(partId);
      if (!part) continue;
      const assemblyId = part.assemblyId;
      const inspected = inspectOps.some((inspect) =>
        (inspect.targetPartIds ?? []).some((targetId) => partsById.get(targetId)?.assemblyId === assemblyId),
      );
      if (!inspected) uncoveredAssemblies.add(assemblyId);
    }
    for (const assemblyId of uncoveredAssemblies) {
      errors.push(
        guideError({
          code: 'COVERAGE_BEFORE_INSPECTION',
          file: 'operations.json',
          jsonPath: `$.operations[${i}].stateEffects`,
          objectId: op?.id ?? null,
          expected: `dependency closure contains an inspect operation with evidenceRequired != none for ${assemblyId}`,
          actual: `no inspection of ${assemblyId} before covering its parts`,
        }),
      );
    }
  });
  return errors;
}

function capabilityErrors(bundle: AuthoredBundle): GuideError[] {
  const required = bundle.manifest?.capabilities ?? [];
  return findUnsupportedCapabilities(required, SUPPORTED_CAPABILITIES).map((capability) =>
    guideError({
      code: 'UNSUPPORTED_CAPABILITY',
      file: 'manifest.json',
      jsonPath: '$.manifest.capabilities',
      objectId: capability.name,
      expected: `builder 0.1.0 provides capability ${capability.name} >= ${capability.version}`,
      actual: `unsupported capability ${capability.name}:${capability.version}`,
    }),
  );
}

function acceptanceErrors(bundle: AuthoredBundle): GuideError[] {
  if (bundle.acceptance?.status === 'rejected') {
    return [
      guideError({
        code: 'ACCEPTANCE_REJECTED',
        file: 'acceptance.json',
        jsonPath: '$.acceptance.status',
        objectId: null,
        expected: 'acceptance accepted or pending',
        actual: 'rejected',
      }),
    ];
  }
  return [];
}

function takeoffWarnings(bundle: AuthoredBundle): GuideError[] {
  const warnings: GuideError[] = [];
  const parts = bundle.parts ?? [];
  const assembliesById = new Map((bundle.assemblies ?? []).map((assembly) => [assembly.id, assembly]));
  const includedByAssembly = new Map<string, Part[]>();
  for (const part of parts) {
    if (part?.takeoff?.include !== true) continue;
    const list = includedByAssembly.get(part.assemblyId) ?? [];
    list.push(part);
    includedByAssembly.set(part.assemblyId, list);
  }
  const ancestors = (assemblyId: string): string[] => {
    const chain: string[] = [];
    const seen = new Set<string>();
    let current = assembliesById.get(assemblyId)?.parentId ?? null;
    while (current && !seen.has(current)) {
      seen.add(current);
      chain.push(current);
      current = assembliesById.get(current)?.parentId ?? null;
    }
    return chain;
  };
  const seen = new Set<string>();
  for (const [assemblyId, includedParts] of includedByAssembly) {
    const materials = new Set(includedParts.map((part) => part.materialId).filter((id): id is string => nonEmptyString(id)));
    if (materials.size === 0) continue;
    for (const ancestorId of ancestors(assemblyId)) {
      for (const ancestorPart of includedByAssembly.get(ancestorId) ?? []) {
        const materialId = ancestorPart.materialId;
        if (!nonEmptyString(materialId) || !materials.has(materialId)) continue;
        const key = `${ancestorId}|${materialId}|${assemblyId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        warnings.push(
          guideError({
            code: 'TAKEOFF_DOUBLE_COUNT',
            file: 'parts.json',
            jsonPath: '$.parts',
            objectId: ancestorPart.id,
            expected: 'material counted once across an assembly and its child assemblies',
            actual: `material ${materialId} included by both ${ancestorId} and ${assemblyId}`,
          }),
        );
      }
    }
  }
  return warnings;
}

/** Run every frozen validation rule over a loaded bundle. */
export function validateBundle(input: ValidateInput): ValidationReport {
  const blocking: GuideError[] = [];
  const warnings: GuideError[] = [];
  const collect = (list: GuideError[]): void => {
    for (const error of list) {
      if (error.severity === 'blocking') blocking.push(error);
      else warnings.push(error);
    }
  };

  collect(input.loadErrors ?? []);
  const bundle = input.bundle;
  if (!bundle) {
    return { ok: blocking.length === 0, blockingCount: blocking.length, warningCount: warnings.length, errors: blocking, warnings };
  }

  // 1. Schema validity of every authored file.
  const rawFiles = input.rawFiles ?? toRawFiles(bundle);
  for (const fileName of AUTHORED_FILE_NAMES) {
    const raw = rawFiles[fileName];
    if (raw === undefined) continue; // loader already reported this file
    const result = validateAuthoredFile(fileName, raw);
    for (const issue of result.issues) {
      blocking.push(schemaIssueError(fileName, issue));
    }
  }

  const { index, duplicates } = buildIdIndex(bundle);
  collect(duplicates);
  collect(referenceErrors(bundle, index));
  collect(citationErrors(bundle));
  collect(assetErrors(bundle, input.bundleDir));
  collect(parameterErrors(bundle));
  collect(conflictErrors(bundle));
  collect(dependencyErrors(bundle));
  collect(coverageErrors(bundle));
  collect(capabilityErrors(bundle));
  collect(acceptanceErrors(bundle));
  collect(takeoffWarnings(bundle));

  return {
    ok: blocking.length === 0,
    blockingCount: blocking.length,
    warningCount: warnings.length,
    errors: blocking,
    warnings,
  };
}

function schemaIssueError(file: AuthoredFileName, issue: SchemaIssue): GuideError {
  return guideError({
    code: 'SCHEMA_INVALID',
    file,
    jsonPath: toJsonPath(FILE_ROOTS[file], issue.instancePath),
    objectId: null,
    expected: 'schema-valid authored document',
    actual: `${issue.instancePath} ${issue.message} (${issue.keyword})`,
  });
}
