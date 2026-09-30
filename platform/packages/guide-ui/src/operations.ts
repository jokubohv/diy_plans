/**
 * Plain-language descriptions derived from compiled data. Every string here is either generic
 * UI vocabulary or a direct lookup in the compiled guide; no guide-specific fact is hard-coded.
 */
import type {
  CompiledGuide,
  Connection,
  Material,
  Operation,
  OperationKind,
  QualityCheck,
  ReleaseRecord,
  ReleaseScope,
  ReleaseStatus,
  Vec3,
} from '@diyguide/schema';
import { formatLength } from './format';
import { SCOPE_LABEL } from './status';

export const OPERATION_ACTION: Record<OperationKind, string> = {
  survey: 'Survey and confirm measurements',
  prepare: 'Gather materials and tools',
  remove: 'Remove or protect',
  cut: 'Cut to size',
  position: 'Position',
  fasten: 'Fasten',
  drill: 'Drill',
  route: 'Route',
  terminate: 'Terminate',
  finish: 'Finish',
  inspect: 'Inspect',
  test: 'Test',
};

export function operationAction(kind: OperationKind): string {
  return OPERATION_ACTION[kind];
}

export const METHOD_LABEL: Record<Connection['method'], string> = {
  mechanical_anchor: 'mechanical anchor',
  screw: 'screw',
  nail: 'nail',
  bolt: 'bolt',
  adhesive: 'adhesive',
  clamp: 'clamp',
  bracket: 'bracket',
  other: 'other',
};

export const EVIDENCE_LABEL: Record<NonNullable<QualityCheck['evidenceRequired']>, string> = {
  visual: 'visual check',
  field_measurement_or_photo: 'field measurement or photo',
  photo: 'photo',
  measurement: 'measurement',
  none: 'none',
};

export function evidenceLabel(evidence: QualityCheck['evidenceRequired']): string {
  return evidence ? EVIDENCE_LABEL[evidence] : EVIDENCE_LABEL.none;
}

export function partNames(compiled: CompiledGuide, partIds: readonly string[]): string[] {
  const partsById = new Map(compiled.parts.map((part) => [part.id, part]));
  return partIds.map((id) => partsById.get(id)?.name ?? id);
}

export function toolNames(compiled: CompiledGuide, toolIds: readonly string[]): string[] {
  const toolsById = new Map(compiled.tools.map((tool) => [tool.id, tool]));
  return toolIds.map((id) => toolsById.get(id)?.name ?? id);
}

export function releaseById(compiled: CompiledGuide, releaseId: string | null | undefined): ReleaseRecord | null {
  if (!releaseId) return null;
  return compiled.project.releases.find((release) => release.id === releaseId) ?? null;
}

export function releaseScopeText(compiled: CompiledGuide, releaseId: string | null | undefined): string | null {
  const release = releaseById(compiled, releaseId);
  return release ? SCOPE_LABEL[release.scope] : null;
}

export function releaseScope(compiled: CompiledGuide, releaseId: string | null | undefined): ReleaseScope | null {
  return releaseById(compiled, releaseId)?.scope ?? null;
}

export interface FastenerSummary {
  connectionId: string;
  fromName: string;
  toName: string;
  method: Connection['method'];
  status: ReleaseStatus;
  holdReason: string | null;
  /** Only present when the connection is released (`ready`). */
  specificationName: string | null;
  /** Only present when the connection is released (`ready`). */
  quantityText: string | null;
  /** Only present when the connection is released (`ready`). */
  patternText: string | null;
  proposedPointCount: number;
}

export function fastenerQuantityText(count: number): string {
  return count === 1 ? '1 fastener' : `${count} fasteners`;
}

export function describePattern(pattern: Connection['pattern']): string | null {
  if (!pattern) return null;
  const parts: string[] = [];
  if (pattern.type) parts.push(`${pattern.type} pattern`);
  if (pattern.spacingMm != null) parts.push(`spacing ${pattern.spacingMm} mm`);
  if (pattern.edgeDistanceMm != null) parts.push(`edge distance ${pattern.edgeDistanceMm} mm`);
  if (pattern.startOffsetMm != null) parts.push(`start offset ${pattern.startOffsetMm} mm`);
  if (pattern.endOffsetMm != null) parts.push(`end offset ${pattern.endOffsetMm} mm`);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Fastener descriptions for a fasten operation. Held/conditional/absent parameters are never
 * rendered as quantities or patterns: the summary only carries a hold reason in that case.
 */
export function fastenerSummaries(
  operation: Operation,
  compiled: CompiledGuide,
): FastenerSummary[] {
  if (operation.kind !== 'fasten') return [];
  const partsById = new Map(compiled.parts.map((part) => [part.id, part]));
  const specsById = new Map(compiled.fastenerSpecs.map((spec) => [spec.id, spec]));
  const connectionsById = new Map(compiled.connections.map((connection) => [connection.id, connection]));
  const summaries: FastenerSummary[] = [];
  for (const connectionId of operation.parameters.connectionIds) {
    const connection = connectionsById.get(connectionId);
    if (!connection) continue;
    const status = connection.effectiveReleaseStatus;
    const released = status === 'ready';
    const spec = connection.fastenerSpecId
      ? specsById.get(connection.fastenerSpecId) ?? null
      : null;
    summaries.push({
      connectionId: connection.id,
      fromName: partsById.get(connection.fromPartId)?.name ?? connection.fromPartId,
      toName: partsById.get(connection.toPartId)?.name ?? connection.toPartId,
      method: connection.method,
      status,
      holdReason: connection.holdReason ?? operation.holdReason ?? null,
      specificationName: released ? spec?.name ?? null : null,
      quantityText:
        released && connection.pattern?.count != null
          ? fastenerQuantityText(connection.pattern.count)
          : null,
      patternText: released ? describePattern(connection.pattern) : null,
      proposedPointCount: connection.proposedPointsMm?.length ?? 0,
    });
  }
  return summaries;
}

export interface PrepareMaterialRow {
  materialId: string;
  name: string;
  sizeLabel: string | null;
  /** `quantityProposed` plus the material unit, from the compiled takeoff. */
  quantityText: string | null;
  /** Spare text, only when the compiled spare quantity is greater than zero. */
  spareText: string | null;
  note: string | null;
  /** True when the material id has no record in the compiled guide. */
  missing: boolean;
}

const UNIT_PLURAL: Partial<Record<Material['unit'], string>> = {
  sheet: 'sheets',
  board: 'boards',
  tube: 'tubes',
  box: 'boxes',
};

function materialQuantityText(material: Material): string {
  const unit =
    material.quantityProposed === 1
      ? material.unit
      : (UNIT_PLURAL[material.unit] ?? material.unit);
  return `${material.quantityProposed} ${unit}`;
}

/** Bill-of-material rows for a prepare operation, in `materialIds` order. */
export function prepareMaterialRows(
  operation: Operation,
  compiled: CompiledGuide,
): PrepareMaterialRow[] {
  if (operation.kind !== 'prepare') return [];
  const materialsById = new Map(compiled.materials.map((material) => [material.id, material]));
  return operation.parameters.materialIds.map((materialId) => {
    const material = materialsById.get(materialId);
    if (!material) {
      return {
        materialId,
        name: materialId,
        sizeLabel: null,
        quantityText: null,
        spareText: null,
        note: null,
        missing: true,
      };
    }
    return {
      materialId,
      name: material.name,
      sizeLabel: material.sizeLabel ?? null,
      quantityText: materialQuantityText(material),
      spareText:
        material.spareQuantity != null && material.spareQuantity > 0
          ? `${material.spareQuantity} spare`
          : null,
      note: material.notes ?? null,
      missing: false,
    };
  });
}

export interface PrepareCutRow {
  operationId: string;
  partId: string | null;
  partName: string;
  /** Length in the project display unit; never converted from an unparsable value. */
  lengthText: string | null;
  note: string | null;
  /** True when the referenced cut operation has no record in the compiled guide. */
  missing: boolean;
}

/**
 * Cut-list rows for a prepare operation: one row per cut of every referenced cut operation, in
 * `cutOperationIds` order and then in the cut operation's own cut order. A missing or non-cut
 * operation yields one explicit row instead of silently dropping the reference.
 */
export function prepareCutRows(operation: Operation, compiled: CompiledGuide): PrepareCutRow[] {
  if (operation.kind !== 'prepare') return [];
  const cutOperationIds = operation.parameters.cutOperationIds;
  if (!cutOperationIds) return [];
  const operationsById = new Map(compiled.operations.map((candidate) => [candidate.id, candidate]));
  const partsById = new Map(compiled.parts.map((part) => [part.id, part]));
  const rows: PrepareCutRow[] = [];
  for (const operationId of cutOperationIds) {
    const cutOperation = operationsById.get(operationId);
    if (!cutOperation || cutOperation.kind !== 'cut') {
      rows.push({
        operationId,
        partId: null,
        partName: operationId,
        lengthText: null,
        note: null,
        missing: true,
      });
      continue;
    }
    for (const cut of cutOperation.parameters.cuts) {
      const mm = Number.parseFloat(cut.finalLengthMm);
      rows.push({
        operationId,
        partId: cut.partId,
        partName: partsById.get(cut.partId)?.name ?? cut.partId,
        lengthText: Number.isFinite(mm)
          ? formatLength(mm, compiled.project.display)
          : cut.finalLengthMm,
        note: cut.note ?? null,
        missing: false,
      });
    }
  }
  return rows;
}

function joinNames(names: readonly string[]): string {
  return names.length > 0 ? names.join(', ') : 'none recorded';
}

function formatVec(point: Vec3): string {
  return `${point[0]}, ${point[1]}, ${point[2]} mm`;
}

/** Parameter description lines for an operation, in plain language. */
export function describeParameters(operation: Operation, compiled: CompiledGuide): string[] {
  const partsById = new Map(compiled.parts.map((part) => [part.id, part]));
  const toolsById = new Map(compiled.tools.map((tool) => [tool.id, tool]));
  const systemsById = new Map(compiled.systems.map((system) => [system.id, system]));
  const measurementsById = new Map(
    compiled.measurements.map((measurement) => [measurement.id, measurement]),
  );
  const partName = (id: string): string => partsById.get(id)?.name ?? id;
  const toolName = (id: string | null | undefined): string | null =>
    id ? toolsById.get(id)?.name ?? id : null;

  switch (operation.kind) {
    case 'survey': {
      const lines: string[] = [];
      const labels = operation.parameters.measurementIds.map(
        (id) => measurementsById.get(id)?.label ?? id,
      );
      if (labels.length > 0) lines.push(`Confirm from the approved measurements: ${joinNames(labels)}.`);
      if (operation.parameters.checkInstruction) lines.push(operation.parameters.checkInstruction);
      return lines;
    }
    case 'prepare': {
      const lines = [operation.parameters.instruction];
      if (operation.parameters.note) lines.push(operation.parameters.note);
      return lines;
    }
    case 'remove': {
      const lines = [`Disposition: ${operation.parameters.disposition}.`];
      if (operation.parameters.note) lines.push(operation.parameters.note);
      return lines;
    }
    case 'cut':
      return operation.parameters.cuts.map((cut) => {
        const tool = toolName(operation.parameters.toolId);
        const note = cut.note ? ` (${cut.note})` : '';
        return `Cut ${partName(cut.partId)} to ${cut.finalLengthMm} mm${note}${tool ? ` using ${tool}` : ''}.`;
      });
    case 'position': {
      const lines = [operation.parameters.datumNote];
      if (operation.parameters.offsetsMm) {
        const from = operation.parameters.fromPartId
          ? ` from ${partName(operation.parameters.fromPartId)}`
          : '';
        lines.push(`Offsets${from}: ${formatVec(operation.parameters.offsetsMm)}.`);
      }
      const tool = toolName(operation.parameters.toolId);
      if (tool) lines.push(`Tool: ${tool}.`);
      return lines;
    }
    case 'fasten':
      return [];
    case 'drill': {
      const lines: string[] = [];
      if (operation.parameters.holeDiameterMm != null) {
        lines.push(`Hole diameter ${operation.parameters.holeDiameterMm} mm.`);
      }
      if (operation.parameters.depthMm != null) {
        lines.push(`Hole depth ${operation.parameters.depthMm} mm.`);
      }
      if (operation.parameters.pointsMm) {
        lines.push(
          `Points: ${operation.parameters.pointsMm.map((point) => formatVec(point)).join('; ')}.`,
        );
      }
      const tool = toolName(operation.parameters.toolId);
      if (tool) lines.push(`Tool: ${tool}.`);
      return lines;
    }
    case 'route': {
      const system = systemsById.get(operation.parameters.systemId);
      const lines: string[] = [];
      if (system) lines.push(`System: ${system.name}${system.energized ? '' : ' (not energized)'}.`);
      const circuit = operation.parameters.circuitId
        ? system?.circuits.find((candidate) => candidate.id === operation.parameters.circuitId)
        : undefined;
      if (circuit) lines.push(`Circuit: ${circuit.label}.`);
      if (operation.parameters.conductorLabel) {
        lines.push(`Conductor: ${operation.parameters.conductorLabel}.`);
      }
      if (operation.parameters.demonstrationOnly) {
        lines.push('Demonstration only: this route is not an electrical design.');
      }
      return lines;
    }
    case 'terminate': {
      const system = systemsById.get(operation.parameters.systemId);
      const lines: string[] = [];
      if (system) lines.push(`System: ${system.name}.`);
      if (operation.parameters.terminalPartId) {
        lines.push(`Terminal: ${partName(operation.parameters.terminalPartId)}.`);
      }
      return lines;
    }
    case 'finish':
      return [
        `Finish level: ${operation.parameters.levelLabel}.`,
        ...(operation.parameters.passes != null ? [`Passes: ${operation.parameters.passes}.`] : []),
      ];
    case 'inspect':
      return [
        `Inspect: ${operation.parameters.inspectWhat}.`,
        `Acceptance criteria: ${operation.parameters.criteria}.`,
        `Evidence required: ${evidenceLabel(operation.parameters.evidenceRequired)}.`,
      ];
    case 'test':
      return [
        `Test: ${operation.parameters.testType}.`,
        `Expected result: ${operation.parameters.expectedResult}.`,
      ];
  }
}

/** Step indexes whose operations target the given part (used by the part card). */
export function relatedStepIndexes(compiled: CompiledGuide, partId: string): number[] {
  const indexes: number[] = [];
  compiled.steps.forEach((step, index) => {
    const targets = step.operationIds.some((operationId) => {
      const operation = compiled.operations.find((candidate) => candidate.id === operationId);
      return operation ? operation.targetPartIds.includes(partId) : false;
    });
    const part = compiled.parts.find((candidate) => candidate.id === partId);
    const visible = part ? step.visibleAssemblyIds.includes(part.assemblyId) : false;
    if (targets || visible) indexes.push(index);
  });
  return indexes;
}
