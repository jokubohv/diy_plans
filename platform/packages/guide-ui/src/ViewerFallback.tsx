import type { ReactElement } from 'react';
import type { CompiledGuide, Operation, QualityCheck } from '@diyguide/schema';
import { describeParameters, evidenceLabel, operationAction, partNames, toolNames } from './operations';

export type ViewerFallbackReason = 'webgl-unavailable' | 'viewer-error' | 'no-host';

const REASON_TEXT: Record<ViewerFallbackReason, string> = {
  'webgl-unavailable':
    'This browser cannot start WebGL, so the interactive 3D model is unavailable.',
  'viewer-error': 'The interactive 3D viewer stopped with an error.',
  'no-host': 'No 3D viewer is configured for this page.',
};

export interface ViewerFallbackProps {
  reason: ViewerFallbackReason;
  message?: string | null;
  compiled: CompiledGuide;
  stepIndex: number;
  /** Resolves an authored asset path to a URL; sources without one stay listed as unavailable. */
  assetUrlFor?: (assetPath: string) => string | null;
  className?: string;
}

function resolveSafely(
  resolver: ((assetPath: string) => string | null) | undefined,
  assetPath: string,
): string | null {
  if (!resolver) return null;
  try {
    return resolver(assetPath);
  } catch {
    return null;
  }
}

/**
 * Text/2D replacement for the 3D view. Keeps the full written instructions for the current
 * step and operable source links. Used for WebGL-unavailable and viewer-error paths.
 */
export function ViewerFallback({
  reason,
  message = null,
  compiled,
  stepIndex,
  assetUrlFor,
  className,
}: ViewerFallbackProps): ReactElement {
  const step = compiled.steps[stepIndex];
  const operations: Operation[] = step
    ? compiled.operations.filter((operation) => step.operationIds.includes(operation.id))
    : [];
  const citationsById = new Map(compiled.citations.map((citation) => [citation.id, citation]));
  const sourcesById = new Map(compiled.sources.map((source) => [source.id, source]));
  const citationIds = [
    ...new Set([...(step?.citationIds ?? []), ...operations.flatMap((op) => op.citationIds)]),
  ];

  return (
    <section
      className={['viewer-fallback', className].filter(Boolean).join(' ')}
      data-testid="viewer-fallback"
      role="region"
      aria-label="Text fallback for the 3D view"
    >
      <h2>3D view unavailable</h2>
      <p className="viewer-fallback-reason">
        {REASON_TEXT[reason]}
        {message ? ` ${message}` : ''}
      </p>
      <p className="viewer-fallback-hint">
        Continue with the written instructions below; the 2D source links stay available.
      </p>

      {step ? (
        <div className="viewer-fallback-step">
          <h3>{step.title}</h3>
          {operations.length === 0 ? (
            <p>No operations are recorded for this step.</p>
          ) : (
            operations.map((operation) => {
              const checks: QualityCheck[] = [
                ...(operation.qualityChecks ?? []),
                ...(step.qualityChecks ?? []),
              ];
              const stops = [...(operation.stopConditions ?? []), ...step.stopConditions];
              return (
                <article key={operation.id} className="viewer-fallback-operation">
                  <h4>
                    {operationAction(operation.kind)}: {operation.title}
                  </h4>
                  <p>
                    Parts:{' '}
                    {partNames(compiled, operation.targetPartIds).join(', ') || 'none recorded'}
                  </p>
                  <p>
                    Tools:{' '}
                    {toolNames(compiled, [...step.toolIds]).join(', ') || 'No tools recorded'}
                  </p>
                  {describeParameters(operation, compiled).map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                  {checks.length > 0 ? (
                    <ul>
                      {checks.map((check, index) => (
                        <li key={index}>
                          {check.instruction}
                          {check.evidenceRequired
                            ? ` (evidence: ${evidenceLabel(check.evidenceRequired)})`
                            : ''}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {stops.map((stop, index) => (
                    <p key={`stop-${index}`} className="viewer-fallback-stop">
                      Stop condition: {stop}
                    </p>
                  ))}
                </article>
              );
            })
          )}
        </div>
      ) : (
        <p>No current step.</p>
      )}

      <div className="viewer-fallback-sources">
        <h3>Sources</h3>
        {citationIds.length === 0 ? (
          <p>No sources are cited for this step.</p>
        ) : (
          <ul>
            {citationIds.map((citationId) => {
              const citation = citationsById.get(citationId);
              if (!citation) {
                return <li key={citationId}>{citationId} (citation missing from the guide)</li>;
              }
              const source = sourcesById.get(citation.sourceId) ?? null;
              const assetUrl =
                source?.assetPath && source.privacy !== 'private'
                  ? resolveSafely(assetUrlFor, source.assetPath)
                  : null;
              return (
                <li key={citationId}>
                  {assetUrl && source ? (
                    <a
                      data-testid={`fallback-source-${citationId}`}
                      href={assetUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open {source.title}
                    </a>
                  ) : (
                    <span data-testid={`fallback-source-${citationId}`}>
                      Source not published: {citation.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
