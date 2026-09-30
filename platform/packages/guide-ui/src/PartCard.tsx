import type { ReactElement } from 'react';
import type { CompiledGuide } from '@diyguide/schema';
import { stateLabel } from '@diyguide/viewer-core';
import { boundsSizeText, formatLength, formatLengthValue } from './format';
import { METHOD_LABEL, relatedStepIndexes } from './operations';
import { StatusChip } from './status';

export interface PartCardProps {
  compiled: CompiledGuide;
  partId: string;
  /** Step index used for the preview state shown next to the properties. */
  stepIndex?: number;
  onSelectStep?: (index: number) => void;
  className?: string;
}

/**
 * Properties of the selected part, its connections with release statuses and the steps that
 * involve it. Everything is looked up in the compiled guide.
 */
export function PartCard({
  compiled,
  partId,
  stepIndex = 0,
  onSelectStep,
  className,
}: PartCardProps): ReactElement | null {
  const part = compiled.parts.find((candidate) => candidate.id === partId);
  if (!part) return null;
  const material = part.materialId
    ? compiled.materials.find((candidate) => candidate.id === part.materialId) ?? null
    : null;
  const assembly = compiled.assemblies.find((candidate) => candidate.id === part.assemblyId) ?? null;
  const stepState = compiled.stepStates[stepIndex];
  const stateEntry = stepState?.after.find((entry) => entry.partId === partId);
  const state = stateEntry?.state ?? part.initialState;
  const partsById = new Map(compiled.parts.map((candidate) => [candidate.id, candidate]));
  const connections = compiled.connections.filter(
    (connection) => connection.fromPartId === partId || connection.toPartId === partId,
  );
  const relatedSteps = relatedStepIndexes(compiled, partId);
  const classes = ['part-card', className].filter(Boolean).join(' ');
  const isPlate = part.kind === 'linear_member' && /(?:top|bottom)-plate/.test(part.id);
  const memberSizes =
    isPlate && part.geometry.shape === 'box'
      ? [...part.geometry.sizeMm].sort((left, right) => right - left)
      : null;
  const schematicHeight = compiled.measurements.find(
    (measurement) => measurement.id === 'measurement.ceiling.reported',
  );

  return (
    <section className={classes} data-testid="part-properties" aria-label={`Part: ${part.name}`}>
      <header className="part-card-header">
        <h3>{part.name}</h3>
        <p className="part-card-class">{part.ifcClass}</p>
      </header>
      {memberSizes ? (
        <div className="part-size-summary" data-testid="part-size-summary">
          <div>
            <span>Candidate length</span>
            <strong>{formatLength(memberSizes[0]!, compiled.project.display)}</strong>
          </div>
          <div>
            <span>Actual section</span>
            <strong>
              {formatLengthValue(memberSizes[1]!, compiled.project.display)} ×{' '}
              {formatLength(memberSizes[2]!, compiled.project.display)}
            </strong>
          </div>
          {part.id.includes('top-plate') && schematicHeight ? (
            <div>
              <span>Displayed elevation</span>
              <strong>{schematicHeight.original.display} schematic</strong>
            </div>
          ) : null}
        </div>
      ) : null}
      <dl className="part-card-properties">
        <dt>Part id</dt>
        <dd className="part-card-part-id">{part.id}</dd>
        <dt>State at this step</dt>
        <dd>{stateLabel(state)}</dd>
        <dt>Stage / trade</dt>
        <dd>
          {part.stage} / {part.trade}
        </dd>
        <dt>Assembly</dt>
        <dd>{assembly?.name ?? part.assemblyId}</dd>
        <dt>Material</dt>
        <dd>{material ? material.name : 'No material recorded'}</dd>
        <dt>Model X × Y × Z</dt>
        <dd>{boundsSizeText(part.boundsMm, compiled.project.display)}</dd>
        <dt>Description</dt>
        <dd>{part.description}</dd>
        {part.takeoff?.note ? (
          <>
            <dt>Cut / takeoff status</dt>
            <dd>{part.takeoff.note}</dd>
          </>
        ) : null}
        <dt>IFC GlobalId</dt>
        <dd className="part-card-ifc-id">{part.ifcGlobalId}</dd>
      </dl>

      <div className="part-card-connections">
        <h4>Connections</h4>
        {connections.length === 0 ? (
          <p>No connections are recorded for this part.</p>
        ) : (
          <ul>
            {connections.map((connection) => {
              const status = connection.effectiveReleaseStatus;
              const otherId =
                connection.fromPartId === partId ? connection.toPartId : connection.fromPartId;
              return (
                <li key={connection.id} data-testid={`part-connection-${connection.id}`}>
                  <p className="part-connection-line">
                    {partsById.get(otherId)?.name ?? otherId} ({METHOD_LABEL[connection.method]}){' '}
                    <StatusChip status={status} />
                  </p>
                  {status !== 'ready' && connection.holdReason ? (
                    <p className="part-connection-hold">Hold reason: {connection.holdReason}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="part-card-steps">
        <h4>Related steps</h4>
        {relatedSteps.length === 0 ? (
          <p>No steps reference this part.</p>
        ) : (
          <ul>
            {relatedSteps.map((index) => {
              const step = compiled.steps[index];
              if (!step) return null;
              return (
                <li key={step.id}>
                  <button type="button" className="part-step-link" onClick={() => onSelectStep?.(index)}>
                    {step.title}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
