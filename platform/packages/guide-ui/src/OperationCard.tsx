import type { ReactElement } from 'react';
import type {
  CompiledGuide,
  Operation,
  QualityCheck,
  ReleaseStatus,
  Step,
} from '@diyguide/schema';
import { CitationLink } from './CitationLink';
import {
  describeParameters,
  evidenceLabel,
  fastenerSummaries,
  METHOD_LABEL,
  operationAction,
  partNames,
  prepareCutRows,
  prepareMaterialRows,
  releaseById,
  toolNames,
} from './operations';
import { SCOPE_LABEL, StatusChip } from './status';

export interface OperationCardProps {
  step: Step & { effectiveReleaseStatus?: ReleaseStatus };
  compiled: CompiledGuide;
  selectedCitationId?: string | null;
  onOpenCitation?: (citationId: string) => void;
  className?: string;
}

function isHeld(status: ReleaseStatus): boolean {
  return status === 'held' || status === 'superseded';
}

function operationToolIds(operation: Operation): string[] {
  switch (operation.kind) {
    case 'cut':
    case 'position':
    case 'drill':
    case 'fasten':
      return operation.parameters.toolId ? [operation.parameters.toolId] : [];
    case 'prepare':
      return operation.parameters.toolIds;
    default:
      return [];
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function operationStatus(operation: Operation & { effectiveReleaseStatus?: ReleaseStatus }): ReleaseStatus {
  return operation.effectiveReleaseStatus ?? operation.declaredReleaseStatus;
}

function CheckList({
  title,
  checks,
}: {
  title: string;
  checks: readonly QualityCheck[];
}): ReactElement | null {
  if (checks.length === 0) return null;
  return (
    <div className="operation-checks">
      <h5>{title}</h5>
      <ul>
        {checks.map((check, index) => (
          <li key={index}>
            {check.instruction}
            {check.evidenceRequired ? (
              <span className="operation-check-evidence"> (evidence: {evidenceLabel(check.evidenceRequired)})</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Preparation blocks: the bill of materials (materialIds order) and — when the operation
 * references cut operations — the cut list in the project display unit. Every value comes from
 * the compiled guide; missing records are shown explicitly instead of being invented.
 */
function PrepareBlocks({
  operation,
  compiled,
}: {
  operation: Operation & { effectiveReleaseStatus?: ReleaseStatus };
  compiled: CompiledGuide;
}): ReactElement | null {
  if (operation.kind !== 'prepare') return null;
  const materialRows = prepareMaterialRows(operation, compiled);
  const cutRows = prepareCutRows(operation, compiled);
  const hasCutList = operation.parameters.cutOperationIds != null;
  return (
    <div className="operation-prepare">
      <h5>Materials</h5>
      <ul className="prepare-bom" data-testid="prepare-bom">
        {materialRows.length === 0 ? (
          <li className="prepare-empty">No materials are recorded for this operation.</li>
        ) : (
          materialRows.map((row) => (
            <li key={row.materialId} data-testid={`prepare-bom-row-${row.materialId}`}>
              <span className="prepare-material-name">{row.name}</span>
              {row.sizeLabel ? (
                <span className="prepare-material-size"> · {row.sizeLabel}</span>
              ) : null}
              {row.quantityText ? (
                <span className="prepare-material-quantity"> · Qty {row.quantityText}</span>
              ) : null}
              {row.spareText ? (
                <span className="prepare-material-spare"> · {row.spareText}</span>
              ) : null}
              {row.missing ? (
                <span className="prepare-material-missing">
                  {' '}
                  (this material is not recorded in the compiled guide)
                </span>
              ) : null}
              {row.note ? <p className="prepare-material-note">{row.note}</p> : null}
            </li>
          ))
        )}
      </ul>
      {hasCutList ? (
        <>
          <h5>Cut list</h5>
          <ul className="prepare-cut-list" data-testid="prepare-cut-list">
            {cutRows.length === 0 ? (
              <li className="prepare-empty">No cuts are recorded for this operation.</li>
            ) : (
              cutRows.map((row, index) => (
                <li
                  key={`${row.operationId}-${row.partId ?? 'missing'}-${index}`}
                  data-testid={`prepare-cut-row-${row.operationId}-${row.partId ?? 'missing'}`}
                >
                  {row.missing ? (
                    <span className="prepare-cut-missing">
                      Cut operation {row.operationId} is not recorded in the compiled guide.
                    </span>
                  ) : (
                    <>
                      <span className="prepare-cut-part">{row.partName}</span>
                      <span className="prepare-cut-length"> · {row.lengthText}</span>
                      {row.note ? <span className="prepare-cut-note"> · {row.note}</span> : null}
                    </>
                  )}
                </li>
              ))
            )}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** Prominent step-level summary so the user sees stock, tools and every cut before instructions. */
function StepCutPlan({
  operations,
  step,
  compiled,
}: {
  operations: Array<Operation & { effectiveReleaseStatus?: ReleaseStatus }>;
  step: OperationCardProps['step'];
  compiled: CompiledGuide;
}): ReactElement | null {
  const prepareOperations = operations.filter(
    (operation) => operation.kind === 'prepare' && operation.parameters.cutOperationIds != null,
  );
  if (prepareOperations.length === 0) return null;

  const materialRows = prepareOperations.flatMap((operation) =>
    prepareMaterialRows(operation, compiled),
  );
  const uniqueMaterials = materialRows.filter(
    (row, index) => materialRows.findIndex((candidate) => candidate.materialId === row.materialId) === index,
  );
  const cutRows = prepareOperations.flatMap((operation) => prepareCutRows(operation, compiled));
  const uniqueCuts = cutRows.filter(
    (row, index) =>
      cutRows.findIndex(
        (candidate) =>
          candidate.operationId === row.operationId && candidate.partId === row.partId,
      ) === index,
  );
  const operationsById = new Map(compiled.operations.map((operation) => [operation.id, operation]));
  const cutOperationIds = unique(uniqueCuts.map((row) => row.operationId));
  const dedicatedPrepareOperations = cutOperationIds.flatMap((cutOperationId) => {
    const candidates = compiled.operations.filter(
      (operation) =>
        operation.kind === 'prepare' &&
        operation.parameters.cutOperationIds?.includes(cutOperationId),
    );
    candidates.sort(
      (left, right) =>
        (left.kind === 'prepare' ? left.parameters.toolIds.length : 0) -
        (right.kind === 'prepare' ? right.parameters.toolIds.length : 0),
    );
    return candidates.slice(0, 1);
  });
  const toolIds = unique([
    ...dedicatedPrepareOperations.flatMap((operation) => operationToolIds(operation)),
    ...cutOperationIds.flatMap((operationId) => {
      const cutOperation = operationsById.get(operationId);
      return cutOperation ? operationToolIds(cutOperation) : [];
    }),
  ]);
  const tools = toolNames(compiled, toolIds);
  const notes = unique(
    prepareOperations
      .map((operation) => (operation.kind === 'prepare' ? operation.parameters.note : null))
      .filter((note): note is string => typeof note === 'string' && note.length > 0),
  );

  return (
    <section className="step-cut-plan" data-testid="step-cut-plan" aria-label="Before you cut">
      <header className="step-cut-plan-header">
        <div>
          <span className="step-cut-plan-kicker">Before you cut</span>
          <h4>Use this stock and cut only the highlighted parts</h4>
        </div>
        <StatusChip status={step.effectiveReleaseStatus ?? step.declaredReleaseStatus} />
      </header>
      <p className="step-cut-plan-intro">
        The listed parts are highlighted in the 3D view. Confirm the material, tool and release
        status before marking or starting the saw.
      </p>
      <dl className="step-cut-plan-use">
        <dt>Use</dt>
        <dd>
          {uniqueMaterials.length > 0
            ? uniqueMaterials
                .map((row) =>
                  [row.name, row.sizeLabel, row.quantityText ? `Qty ${row.quantityText}` : null]
                    .filter(Boolean)
                    .join(' · '),
                )
                .join('; ')
            : 'No stock is recorded.'}
        </dd>
        <dt>Tools</dt>
        <dd>{tools.join(', ') || 'No tools recorded.'}</dd>
      </dl>
      {notes.map((note) => (
        <p key={note} className="step-cut-plan-warning" role="note">
          {note}
        </p>
      ))}
      <ol className="step-cut-plan-list">
        {uniqueCuts.map((row, index) => {
          const cutOperation = operationsById.get(row.operationId);
          const status = cutOperation
            ? operationStatus(cutOperation)
            : ('held' as ReleaseStatus);
          return (
            <li
              key={`${row.operationId}-${row.partId ?? 'missing'}-${index}`}
              data-testid={`step-cut-plan-row-${row.operationId}-${row.partId ?? 'missing'}`}
              data-status={status}
            >
              <span className="step-cut-plan-number">{index + 1}</span>
              <span className="step-cut-plan-part">{row.partName}</span>
              <strong className="step-cut-plan-length">
                {row.lengthText ?? 'Length not recorded'}
              </strong>
              <StatusChip status={status} />
              {row.note ? <span className="step-cut-plan-note">{row.note}</span> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function OperationSection({
  operation,
  step,
  compiled,
  selectedCitationId,
  onOpenCitation,
}: {
  operation: Operation & { effectiveReleaseStatus?: ReleaseStatus };
  step: OperationCardProps['step'];
  compiled: CompiledGuide;
  selectedCitationId: string | null;
  onOpenCitation?: (citationId: string) => void;
}): ReactElement {
  const status = operationStatus(operation);
  const citationsById = new Map(compiled.citations.map((citation) => [citation.id, citation]));
  const sourcesById = new Map(compiled.sources.map((source) => [source.id, source]));
  const parameters = describeParameters(operation, compiled);
  const fasteners = fastenerSummaries(operation, compiled);
  const toolIds = unique([...step.toolIds, ...operationToolIds(operation)]);
  const release = releaseById(compiled, operation.releaseId);
  const normalize = (text: string): string =>
    text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.;]+$/, '');
  const checks: QualityCheck[] = [];
  const seenChecks = new Set<string>();
  for (const check of [...(operation.qualityChecks ?? []), ...(step.qualityChecks ?? [])]) {
    const key = normalize(check.instruction);
    if (seenChecks.has(key)) continue;
    seenChecks.add(key);
    checks.push(check);
  }
  const stopConditions: string[] = [];
  const seenStops = new Set<string>();
  for (const condition of [...(operation.stopConditions ?? []), ...(step.stopConditions ?? [])]) {
    const key = normalize(condition);
    if (seenStops.has(key)) continue;
    seenStops.add(key);
    stopConditions.push(condition);
  }
  const citationIds = unique([...operation.citationIds, ...step.citationIds]);

  return (
    <article className="operation-section" data-testid={`operation-${operation.id}`}>
      <header className="operation-header">
        <h4>{operation.title}</h4>
        <StatusChip status={status} />
      </header>
      <p className="operation-action">
        {operationAction(operation.kind)}: {operation.title}
      </p>

      {isHeld(status) ? (
        <p className="operation-hold-reason" data-testid={`hold-reason-${operation.id}`} role="note">
          <strong>Held.</strong>{' '}
          {operation.holdReason ?? 'No hold reason was recorded for this operation.'}
        </p>
      ) : null}
      {status === 'conditional' ? (
        <p className="operation-conditional-note" data-testid={`conditional-note-${operation.id}`} role="note">
          Conditional preview only: these parameters stay preview-only until an authorized content
          revision resolves the conditions.
        </p>
      ) : null}

      {parameters.length > 0 ? (
        <ul className="operation-parameters">
          {parameters.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      ) : null}

      <PrepareBlocks operation={operation} compiled={compiled} />

      <dl className="operation-meta">
        <dt>Parts</dt>
        <dd>{partNames(compiled, operation.targetPartIds).join(', ') || 'none recorded'}</dd>
        <dt>Tools</dt>
        <dd>{toolNames(compiled, toolIds).join(', ') || 'No tools recorded'}</dd>
      </dl>

      {operation.kind === 'fasten' ? (
        <div className="operation-fasteners">
          <h5>Fasteners</h5>
          {fasteners.length === 0 ? (
            <p>No connections are recorded for this operation.</p>
          ) : (
            <ul>
              {fasteners.map((fastener) => (
                <li key={fastener.connectionId} data-testid={`fastener-summary-${fastener.connectionId}`}>
                  <p className="fastener-connection">
                    {fastener.fromName} → {fastener.toName} ({METHOD_LABEL[fastener.method]}){' '}
                    <StatusChip status={fastener.status} />
                  </p>
                  {fastener.status === 'ready' ? (
                    <>
                      {fastener.specificationName ? (
                        <p className="fastener-specification">
                          Specification: {fastener.specificationName}
                        </p>
                      ) : null}
                      {fastener.quantityText ? (
                        <p
                          className="fastener-quantity"
                          data-testid={`fastener-quantity-${fastener.connectionId}`}
                        >
                          {fastener.quantityText}
                        </p>
                      ) : null}
                      {fastener.patternText ? (
                        <p className="fastener-pattern">Pattern: {fastener.patternText}</p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="fastener-proposed">
                        Proposed connection location only — the fastener specification is not
                        released; this is a placeholder, not an instruction.
                      </p>
                      {fastener.holdReason ? (
                        <p className="fastener-hold-reason">Hold reason: {fastener.holdReason}</p>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <CheckList title="Quality checks" checks={checks} />

      {stopConditions.length > 0 ? (
        <div className="operation-stops">
          <h5>Stop conditions</h5>
          <ul>
            {stopConditions.map((condition, index) => (
              <li key={index}>{condition}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="operation-release">
        Release:{' '}
        {release
          ? `${release.id} (${SCOPE_LABEL[release.scope]} · ${release.state})`
          : 'no release recorded'}
      </p>

      {citationIds.length > 0 ? (
        <div className="operation-citations">
          <h5>Citations</h5>
          <ul className="citation-list">
            {citationIds.map((citationId) => {
              const citation = citationsById.get(citationId);
              if (!citation) {
                return <li key={citationId}>{citationId} (citation missing from the guide)</li>;
              }
              return (
                <li key={citationId}>
                  <CitationLink
                    citation={citation}
                    source={sourcesById.get(citation.sourceId) ?? null}
                    active={citationId === selectedCitationId}
                    onSelect={onOpenCitation}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

/**
 * Instruction card for the current step: title, plain-language action, parts, tools, fasteners
 * (released specifications only), quality checks, stop conditions, citations and release scope.
 */
export function OperationCard({
  step,
  compiled,
  selectedCitationId = null,
  onOpenCitation,
  className,
}: OperationCardProps): ReactElement {
  const operations = compiled.operations.filter((operation) =>
    step.operationIds.includes(operation.id),
  );
  const stepStatus = step.effectiveReleaseStatus ?? step.declaredReleaseStatus;
  const classes = ['operation-card', className].filter(Boolean).join(' ');
  return (
    <section className={classes} data-testid={`operation-card-${step.id}`} aria-label={`Instructions: ${step.title}`}>
      <header className="operation-card-header">
        <h3>{step.title}</h3>
        <StatusChip status={stepStatus} />
      </header>
      <StepCutPlan operations={operations} step={step} compiled={compiled} />
      {operations.length === 0 ? (
        <p className="operation-card-empty">No operations are recorded for this step.</p>
      ) : (
        operations.map((operation) => (
          <OperationSection
            key={operation.id}
            operation={operation}
            step={step}
            compiled={compiled}
            selectedCitationId={selectedCitationId}
            onOpenCitation={onOpenCitation}
          />
        ))
      )}
    </section>
  );
}
