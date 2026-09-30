/**
 * Derived presentation overlays (architecture.md §3/§5).
 *
 * Overlay ids are stable: `overlay.<operation name>.p<index>`, `.route`, `.tool`. Overlays are
 * presentation objects: never part of takeoff and never IFC products.
 *
 * Fastener points are `released` only when the operation is effectively `ready` and the owning
 * connection is effectively released (`ready`/`conditional`) with a released specification;
 * otherwise they are `proposed` (held steps may still show dashed placeholders).
 */
import type { AuthoredBundle, Connection, OverlayObject, ReleaseStatus, Vec3 } from '@diyguide/schema';

export interface OverlayInput {
  bundle: AuthoredBundle;
  operationsEffective: ReadonlyMap<string, ReleaseStatus>;
  /** World-space centre of a part (used to place tool proxies without explicit points). */
  worldCenterMm?: (partId: string) => Vec3 | null;
}

/** `op.fasten-backing` -> `fasten-backing` so ids read `overlay.fasten-backing.p1`. */
export function overlayBaseId(operationId: string): string {
  return operationId.startsWith('op.') ? operationId.slice(3) : operationId;
}

function connectionReleasable(connection: Connection): boolean {
  const effective = connection.effectiveReleaseStatus ?? connection.declaredReleaseStatus;
  if (effective !== 'ready' && effective !== 'conditional') return false;
  if (typeof connection.fastenerSpecId !== 'string' || connection.fastenerSpecId.length === 0) return false;
  return connection.pattern !== null && connection.pattern !== undefined;
}

export function deriveOverlayObjects(input: OverlayInput): OverlayObject[] {
  const { bundle, operationsEffective } = input;
  const partsById = new Map((bundle.parts ?? []).map((part) => [part.id, part]));
  const connectionsById = new Map((bundle.connections?.connections ?? []).map((connection) => [connection.id, connection]));
  const toolsById = new Map((bundle.tools ?? []).map((tool) => [tool.id, tool]));
  const overlays: OverlayObject[] = [];

  for (const op of bundle.operations ?? []) {
    const status = operationsEffective.get(op.id) ?? op.declaredReleaseStatus;
    const base = overlayBaseId(op.id);
    const params = op.parameters as unknown as Record<string, unknown>;

    if (op.kind === 'fasten') {
      const connectionIds = Array.isArray(params?.['connectionIds']) ? (params['connectionIds'] as string[]) : [];
      const connections = connectionIds.map((id) => connectionsById.get(id)).filter((c): c is Connection => c !== undefined);
      const parameterPoints = Array.isArray(params?.['pointsMm']) ? (params['pointsMm'] as Vec3[]) : [];
      let counter = 0;
      if (parameterPoints.length > 0) {
        const allReleasable = connections.length > 0 && connections.every(connectionReleasable);
        for (const point of parameterPoints) {
          counter += 1;
          const released = status === 'ready' && allReleasable;
          overlays.push({
            id: `overlay.${base}.p${counter}`,
            kind: 'fastener_point',
            operationId: op.id,
            partId: connections[0]?.fromPartId ?? op.targetPartIds[0] ?? null,
            toolId: null,
            positionMm: point,
            pathPointsMm: null,
            radiusMm: null,
            state: released ? 'released' : 'proposed',
            label: `${released ? 'Fastener point' : 'Proposed fastener point'} ${counter}`,
            inTakeoff: false,
          });
        }
      } else {
        for (const connection of connections) {
          for (const point of connection.proposedPointsMm ?? []) {
            counter += 1;
            const released = status === 'ready' && connectionReleasable(connection);
            overlays.push({
              id: `overlay.${base}.p${counter}`,
              kind: 'fastener_point',
              operationId: op.id,
              partId: connection.fromPartId ?? op.targetPartIds[0] ?? null,
              toolId: null,
              positionMm: point,
              pathPointsMm: null,
              radiusMm: null,
              state: released ? 'released' : 'proposed',
              label: `${released ? 'Fastener point' : 'Proposed fastener point'} ${counter} (${connection.id})`,
              inTakeoff: false,
            });
          }
        }
      }
    }

    if (op.kind === 'route') {
      const pathPartId = op.targetPartIds?.find((id) => partsById.get(id)?.geometry.shape === 'path') ?? null;
      const geometry = pathPartId ? partsById.get(pathPartId)?.geometry : undefined;
      const parameterPoints = Array.isArray(params?.['pathPointsMm']) ? (params['pathPointsMm'] as Vec3[]) : null;
      const pathPoints = parameterPoints && parameterPoints.length > 0
        ? parameterPoints
        : geometry?.shape === 'path'
          ? geometry.pointsMm
          : null;
      overlays.push({
        id: `overlay.${base}.route`,
        kind: 'route_path',
        operationId: op.id,
        partId: pathPartId ?? op.targetPartIds?.[0] ?? null,
        toolId: null,
        positionMm: null,
        pathPointsMm: pathPoints,
        radiusMm: geometry?.shape === 'path' ? (geometry.radiusMm ?? null) : null,
        state: status === 'ready' ? 'released' : 'proposed',
        label: `Schematic route for ${op.title}`,
        inTakeoff: false,
      });
    }

    const toolId = typeof params?.['toolId'] === 'string' && params['toolId'].length > 0 ? (params['toolId'] as string) : null;
    if (toolId) {
      // A tool proxy needs a position to be renderable: explicit fastening points, then the
      // connection's proposed points, then the first target part's world centre.
      const explicitPoints = Array.isArray(params?.['pointsMm']) ? (params['pointsMm'] as Vec3[]) : [];
      const connectionIds = Array.isArray(params?.['connectionIds']) ? (params['connectionIds'] as string[]) : [];
      let positionMm: Vec3 | null = explicitPoints[0] ?? null;
      if (!positionMm) {
        for (const connectionId of connectionIds) {
          const proposed = connectionsById.get(connectionId)?.proposedPointsMm;
          if (proposed && proposed.length > 0) {
            positionMm = proposed[0] as Vec3;
            break;
          }
        }
      }
      if (!positionMm) {
        const targetId = op.targetPartIds?.[0];
        if (targetId) positionMm = input.worldCenterMm?.(targetId) ?? null;
      }
      overlays.push({
        id: `overlay.${base}.tool`,
        kind: 'tool_proxy',
        operationId: op.id,
        partId: null,
        toolId,
        positionMm,
        pathPointsMm: null,
        radiusMm: null,
        state: status === 'ready' ? 'released' : 'proposed',
        label: `Tool for ${op.title}: ${toolsById.get(toolId)?.name ?? toolId}`,
        inTakeoff: false,
      });
    }
  }

  return overlays;
}
