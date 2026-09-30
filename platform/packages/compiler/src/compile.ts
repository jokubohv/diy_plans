/**
 * Compilation: authored bundle -> CompiledGuide (architecture.md §6).
 *
 * Resolves world transforms and bounds through the assembly chain, computes effective release
 * statuses, step states and derived overlays, then attaches stats, idMap and meta
 * (`sourceSetHash` + `contentHash`). The result self-validates against the frozen compiled schema;
 * a schema failure there is a compiler bug and throws.
 */
import {
  formatSchemaIssues,
  validateCompiledGuide,
  type AuthoredBundle,
  type AuthoredFileName,
  type CompiledGuide,
  type CompiledStats,
  type IdMap,
  type Mat4,
  type OverlayObject,
  type Part,
  type StepState,
} from '@diyguide/schema';
import type { GuideError } from './errors';
import { contentHashOfCompiled, sourceSetHashFor } from './hash';
import type { LoadedFile } from './load';
import { deriveOverlayObjects } from './overlays';
import { buildStepStates } from './states';
import { computeEffectiveOperationStatuses, computeEffectiveStepStatuses } from './status';
import { geometryWorldBounds, identityMat4, multiplyMat4, placementToMatrix } from './transform';
import { COMPILER_NAME, COMPILER_VERSION, validateBundle, type ValidationReport } from './validate';

export interface CompileInput {
  bundle: AuthoredBundle | null;
  files?: Partial<Record<AuthoredFileName, LoadedFile>>;
  rawFiles?: Partial<Record<AuthoredFileName, unknown>>;
  loadErrors?: GuideError[];
  bundleDir: string;
}

export interface CompileResult {
  /** Null when validation found blocking errors (or the bundle could not be loaded). */
  compiled: CompiledGuide | null;
  report: ValidationReport;
}

/** Validate then compile; blocking errors leave `compiled` null. */
export function compileBundle(input: CompileInput): CompileResult {
  const report = validateBundle({
    bundle: input.bundle,
    files: input.files,
    rawFiles: input.rawFiles,
    loadErrors: input.loadErrors,
    bundleDir: input.bundleDir,
  });
  if (!input.bundle || !report.ok) return { compiled: null, report };
  return { compiled: buildCompiledGuide(input.bundle, input.bundleDir, input.files ?? {}), report };
}

export function buildCompiledGuide(
  bundle: AuthoredBundle,
  bundleDir: string,
  files: Partial<Record<AuthoredFileName, LoadedFile>>,
): CompiledGuide {
  const assembliesById = new Map((bundle.assemblies ?? []).map((assembly) => [assembly.id, assembly]));
  const assemblyWorldMemo = new Map<string, Mat4>();
  const assemblyWorld = (assemblyId: string): Mat4 => {
    const cached = assemblyWorldMemo.get(assemblyId);
    if (cached) return cached;
    const assembly = assembliesById.get(assemblyId);
    if (!assembly) {
      const identity = identityMat4();
      assemblyWorldMemo.set(assemblyId, identity);
      return identity;
    }
    const parentWorld = assembly.parentId ? assemblyWorld(assembly.parentId) : identityMat4();
    const world = multiplyMat4(parentWorld, placementToMatrix(assembly.placement));
    assemblyWorldMemo.set(assemblyId, world);
    return world;
  };

  const parts: (Part & { worldTransform: Mat4; boundsMm: { min: [number, number, number]; max: [number, number, number] } })[] =
    (bundle.parts ?? []).map((part) => {
      const worldTransform = multiplyMat4(assemblyWorld(part.assemblyId), placementToMatrix(part.placement));
      return { ...part, worldTransform, boundsMm: geometryWorldBounds(part.geometry, worldTransform) };
    });
  const resolvedPartsById = new Map(parts.map((part) => [part.id, part]));

  const operationsEffective = computeEffectiveOperationStatuses(bundle.operations ?? []);
  const stepsEffective = computeEffectiveStepStatuses(bundle.steps ?? [], bundle.operations ?? []);

  const connections = (bundle.connections?.connections ?? []).map((connection) => ({
    ...connection,
    effectiveReleaseStatus: connection.declaredReleaseStatus,
  }));
  const operations = (bundle.operations ?? []).map((operation) => ({
    ...operation,
    effectiveReleaseStatus: operationsEffective.get(operation.id) ?? operation.declaredReleaseStatus,
  }));
  const steps = (bundle.steps ?? []).map((step) => ({
    ...step,
    effectiveReleaseStatus: stepsEffective.get(step.id) ?? step.declaredReleaseStatus,
  }));

  const overlays: OverlayObject[] = deriveOverlayObjects({
    bundle,
    operationsEffective,
    worldCenterMm: (partId) => {
      const resolved = resolvedPartsById.get(partId);
      if (!resolved) return null;
      return [resolved.worldTransform[12] ?? 0, resolved.worldTransform[13] ?? 0, resolved.worldTransform[14] ?? 0];
    },
  });
  const stepStates: StepState[] = buildStepStates({ bundle, operationsEffective, overlays });

  const statusCounts = { ready: 0, conditional: 0, held: 0, superseded: 0 };
  for (const operation of operations) {
    const status = operation.effectiveReleaseStatus;
    if (status in statusCounts) statusCounts[status as keyof typeof statusCounts] += 1;
  }

  const stats: CompiledStats = {
    partCount: parts.length,
    selectablePartCount: parts.filter((part) => part.selectable === true).length,
    takeoffPartCount: parts.filter((part) => part.takeoff?.include === true).length,
    operationCount: operations.length,
    stepCount: steps.length,
    readyOperationCount: statusCounts.ready,
    conditionalOperationCount: statusCounts.conditional,
    heldOperationCount: statusCounts.held,
    openIssueCount: (bundle.issues ?? []).filter((issue) => issue.status === 'open').length,
    overlayCount: overlays.length,
    sourceCount: bundle.sources?.sources?.length ?? 0,
  };

  const idMap: IdMap = {
    version: '0.1.0',
    parts: parts.map((part) => ({ partId: part.id, ifcGlobalId: part.ifcGlobalId, ifcClass: part.ifcClass })),
  };

  const publicAssetPaths = (bundle.sources?.sources ?? [])
    .filter((source) => source.privacy === 'public' && typeof source.assetPath === 'string')
    .map((source) => source.assetPath as string);
  const sourceSetHash = sourceSetHashFor(
    bundleDir,
    files as Record<string, LoadedFile>,
    publicAssetPaths,
  );

  const content = {
    schema: 'diy-guide-compiled' as const,
    schemaVersion: '0.1.0' as const,
    project: bundle.project,
    datums: bundle.datums,
    sources: bundle.sources?.sources ?? [],
    citations: bundle.sources?.citations ?? [],
    measurements: bundle.measurements,
    assemblies: bundle.assemblies,
    parts,
    materials: bundle.materials,
    tools: bundle.tools,
    systems: bundle.systems,
    connections,
    fastenerSpecs: bundle.connections?.fastenerSpecs ?? [],
    operations,
    steps,
    views: bundle.views,
    issues: bundle.issues,
    overlays,
    stepStates,
    stats,
    idMap,
  };

  const contentHash = contentHashOfCompiled(content as unknown as Record<string, unknown>);
  const meta = {
    contentVersion: bundle.manifest.contentVersion,
    packageRevision: bundle.manifest.packageRevision,
    sourceSetHash,
    contentHash,
    minimumBuilderVersion: bundle.manifest.minimumBuilderVersion,
    capabilities: bundle.manifest.capabilities,
    compiler: { name: COMPILER_NAME, version: COMPILER_VERSION },
    acceptanceStatus: bundle.acceptance.status,
  };

  const compiled = { ...content, meta } as unknown as CompiledGuide;
  const validation = validateCompiledGuide(compiled);
  if (!validation.valid) {
    throw new Error(
      `Compiler bug: compiled guide failed schema validation:\n${formatSchemaIssues(validation.issues).join('\n')}`,
    );
  }
  return compiled;
}
