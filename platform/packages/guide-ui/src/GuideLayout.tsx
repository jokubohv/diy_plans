import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { Bounds, CompiledGuide, ReleaseStatus, Vec3 } from '@diyguide/schema';
import type {
  MeasurementResult,
  SectionPlane,
  ViewerCapabilities,
  ViewerHost,
  VisibilityState,
} from '@diyguide/viewer-core';
import type { CatalogEntry } from './data';
import { InspectControls } from './InspectControls';
import { ModelHost } from './ModelHost';
import { OperationCard } from './OperationCard';
import { PartCard } from './PartCard';
import { PartsTree } from './PartsTree';
import { SourceViewer } from './SourceViewer';
import { StepRail, stepStatusAt } from './StepRail';
import { StatusChip } from './status';
import { shortHash } from './format';
import { ViewerFallback } from './ViewerFallback';
import type { ViewerFallbackReason } from './ViewerFallback';
import { WallDimensionSummary } from './WallDimensionSummary';

export type GuideVariant = 'build' | 'inspect' | 'embed';

export type ViewerHostFactory = (compiled: CompiledGuide) => ViewerHost | Promise<ViewerHost>;

export interface GuideLayoutProps {
  variant: GuideVariant;
  catalogEntry: CatalogEntry;
  compiled: CompiledGuide;
  hostFactory?: ViewerHostFactory | null;
  viewerCapabilities?: ViewerCapabilities | null;
  reducedMotion?: boolean;
  initialStepIndex?: number;
  initialSelectedPartId?: string | null;
  fallbackReason?: ViewerFallbackReason | null;
  assetUrlFor?: (assetPath: string) => string | null;
  onExit?: () => void;
  /** Switch between guided build and inspect without leaving the release. */
  onChangeMode?: (mode: 'build' | 'inspect') => void;
  className?: string;
}

const EMPTY_VISIBILITY: VisibilityState = {
  isolatedPartIds: [],
  xrayPartIds: [],
  hiddenPartIds: [],
  showCovered: false,
};

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), count - 1);
}

function modelBounds(compiled: CompiledGuide): Bounds {
  const min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const part of compiled.parts) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis]!, part.boundsMm.min[axis]!);
      max[axis] = Math.max(max[axis]!, part.boundsMm.max[axis]!);
    }
  }
  if (!Number.isFinite(min[0])) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min, max };
}

function useViewerHost(
  factory: ViewerHostFactory | null | undefined,
  compiled: CompiledGuide,
  onError?: (message: string) => void,
): ViewerHost | null {
  const [host, setHost] = useState<ViewerHost | null>(null);
  const factoryRef = useRef(factory);
  factoryRef.current = factory;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    const create = factoryRef.current;
    if (!create) {
      setHost(null);
      return;
    }
    let cancelled = false;
    let created: ViewerHost | null = null;
    Promise.resolve(create(compiled))
      .then((instance) => {
        if (cancelled) {
          instance.dispose();
          return;
        }
        created = instance;
        setHost(instance);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onErrorRef.current?.(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
      created?.dispose();
      setHost(null);
    };
  }, [compiled]);
  return host;
}

function StepNav({
  compiled,
  stepIndex,
  onGoToStep,
}: {
  compiled: CompiledGuide;
  stepIndex: number;
  onGoToStep: (index: number) => void;
}): ReactElement {
  return (
    <div className="step-nav">
      <button
        type="button"
        data-testid="prev-step"
        disabled={stepIndex <= 0}
        onClick={() => onGoToStep(stepIndex - 1)}
      >
        Previous
      </button>
      <span className="step-nav-position">
        Step {compiled.steps.length === 0 ? 0 : stepIndex + 1} of {compiled.steps.length}
      </span>
      <button
        type="button"
        data-testid="next-step"
        disabled={stepIndex >= compiled.steps.length - 1}
        onClick={() => onGoToStep(stepIndex + 1)}
      >
        Next
      </button>
    </div>
  );
}

function HeldBanner({ reasons }: { reasons: readonly string[] }): ReactElement {
  return (
    <div className="step-banner step-banner-held" data-testid="held-banner" role="status">
      <strong>Held — do not perform this step.</strong>
      {reasons.length > 0 ? (
        <ul>
          {reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p>No hold reason was recorded.</p>
      )}
      <p>No fastener, quantity or dimension may be inferred from a held step.</p>
    </div>
  );
}

function ConditionalBanner(): ReactElement {
  return (
    <div className="step-banner step-banner-conditional" data-testid="conditional-banner" role="status">
      <strong>Conditional preview only.</strong>
      <p>
        Parameters are shown for planning; an authorized content revision must resolve the
        conditions before real work.
      </p>
    </div>
  );
}

/**
 * Build / inspect / embed layout: step rail or parts tree on the left, viewer with inspect
 * controls in the middle, instructions or part properties with the source viewer on the right.
 */
export function GuideLayout({
  variant,
  catalogEntry,
  compiled,
  hostFactory = null,
  viewerCapabilities = null,
  reducedMotion = false,
  initialStepIndex = 0,
  initialSelectedPartId = null,
  fallbackReason = null,
  assetUrlFor,
  onExit,
  onChangeMode,
  className,
}: GuideLayoutProps): ReactElement {
  const stepCount = compiled.steps.length;
  const [stepIndex, setStepIndex] = useState(() => clampIndex(initialStepIndex, stepCount));
  const [selectedPartId, setSelectedPartId] = useState<string | null>(initialSelectedPartId);
  const [selectedCitationId, setSelectedCitationId] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [sectionPlane, setSectionPlane] = useState<SectionPlane | null>(null);
  const [visibility, setVisibility] = useState<VisibilityState>(EMPTY_VISIBILITY);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);

  const host = useViewerHost(hostFactory, compiled, (message) => setViewerError(message));
  const stepIndexRef = useRef(stepIndex);
  stepIndexRef.current = stepIndex;

  const currentStep = compiled.steps[stepIndex] ?? null;
  const currentStatus: ReleaseStatus = currentStep
    ? stepStatusAt(compiled, stepIndex)
    : 'not_applicable';

  const currentHighlightPartIds = useMemo(() => {
    const ids = new Set<string>();
    if (currentStep) {
      for (const operationId of currentStep.operationIds) {
        const operation = compiled.operations.find((candidate) => candidate.id === operationId);
        if (operation) for (const partId of operation.view.highlightPartIds) ids.add(partId);
      }
    }
    return [...ids];
  }, [compiled, currentStep]);

  const currentHoldReasons = useMemo(() => {
    const reasons: string[] = [];
    if (currentStep) {
      for (const operationId of currentStep.operationIds) {
        const operation = compiled.operations.find((candidate) => candidate.id === operationId);
        if (!operation) continue;
        const status = operation.effectiveReleaseStatus ?? operation.declaredReleaseStatus;
        if (status === 'held' || status === 'superseded') {
          if (operation.holdReason) reasons.push(operation.holdReason);
        }
      }
    }
    // A step held only through an upstream dependency has no operation-level hold reason; the
    // compiled step state carries the accurate explanation and must win over a generic message.
    const stateReason = compiled.stepStates[stepIndex]?.reason ?? null;
    if (reasons.length === 0 && stateReason) reasons.push(stateReason);
    if (reasons.length === 0 && currentStep) {
      for (const operationId of currentStep.operationIds) {
        const operation = compiled.operations.find((candidate) => candidate.id === operationId);
        if (!operation) continue;
        const status = operation.effectiveReleaseStatus ?? operation.declaredReleaseStatus;
        if (status === 'held' || status === 'superseded') {
          reasons.push(`${operation.title}: an upstream dependency is held.`);
        }
      }
    }
    return reasons;
  }, [compiled, currentStep, stepIndex]);

  const sectionBounds = useMemo(() => modelBounds(compiled), [compiled]);
  const activeFallback: ViewerFallbackReason | null =
    fallbackReason ?? (viewerError !== null ? 'viewer-error' : hostFactory ? null : 'no-host');
  const selectedCitation =
    compiled.citations.find((citation) => citation.id === selectedCitationId) ?? null;

  const syncFromHost = useCallback((current: ViewerHost) => {
    const state = current.getState();
    setSectionPlane(state.sectionPlane);
    setVisibility(state.visibility);
    setMeasureMode(state.measureMode);
    setMeasurement(state.measurement);
    const firstSelection = state.selection[0];
    if (firstSelection) setSelectedPartId(firstSelection);
  }, []);

  const handleMounted = useCallback(() => {
    if (!host) return;
    host.goToStep(stepIndexRef.current, { reducedMotion });
    syncFromHost(host);
  }, [host, reducedMotion, syncFromHost]);

  const goToStep = useCallback(
    (index: number) => {
      const clamped = clampIndex(index, stepCount);
      setStepIndex(clamped);
      host?.goToStep(clamped, { reducedMotion });
    },
    [host, reducedMotion, stepCount],
  );

  const selectPart = useCallback(
    (partId: string) => {
      setSelectedPartId(partId);
      host?.select([partId]);
    },
    [host],
  );

  const openCitation = useCallback(
    (citationId: string) => {
      setSelectedCitationId((current) => (current === citationId ? null : citationId));
    },
    [],
  );

  const handleSection = useCallback(
    (plane: SectionPlane | null) => {
      setSectionPlane(plane);
      host?.setSection(plane);
    },
    [host],
  );

  const handleShowCovered = useCallback(
    (show: boolean) => {
      setVisibility((current) => ({ ...current, showCovered: show }));
      host?.setShowCovered(show);
    },
    [host],
  );

  const isolateTargets = useCallback(
    (): string[] | null =>
      visibility.isolatedPartIds.length > 0
        ? null
        : selectedPartId
          ? [selectedPartId]
          : currentHighlightPartIds,
    [visibility.isolatedPartIds.length, selectedPartId, currentHighlightPartIds],
  );

  const handleIsolate = useCallback(() => {
    const targets = isolateTargets();
    setVisibility((current) => ({ ...current, isolatedPartIds: targets ?? [] }));
    host?.isolate(targets);
  }, [host, isolateTargets]);

  const xrayTargets = useCallback(
    (): string[] | null =>
      visibility.xrayPartIds.length > 0
        ? null
        : selectedPartId
          ? [selectedPartId]
          : currentHighlightPartIds,
    [visibility.xrayPartIds.length, selectedPartId, currentHighlightPartIds],
  );

  const handleXray = useCallback(() => {
    const targets = xrayTargets();
    setVisibility((current) => ({ ...current, xrayPartIds: targets ?? [] }));
    host?.toggleXray(targets);
  }, [host, xrayTargets]);

  const handleMeasureToggle = useCallback(
    (on: boolean) => {
      setMeasureMode(on);
      host?.setMeasureMode(on);
    },
    [host],
  );

  const handleClearMeasurement = useCallback(() => {
    setMeasurement(null);
    host?.clearMeasurement();
  }, [host]);

  const handleCameraPreset = useCallback(
    (viewId: string) => {
      host?.setCamera({ presetId: viewId });
    },
    [host],
  );

  const handleSelection = useCallback((partIds: string[]) => {
    const first = partIds[0];
    setSelectedPartId(first ?? null);
  }, []);

  const handleError = useCallback((message: string) => {
    setViewerError(message);
  }, []);

  const handleReady = useCallback(() => {
    if (!host) return;
    host.goToStep(stepIndexRef.current, { reducedMotion });
  }, [host, reducedMotion]);

  const handleMeasure = useCallback((result: MeasurementResult) => {
    setMeasurement(result);
  }, []);

  const handleStep = useCallback((index: number) => {
    setStepIndex(clampIndex(index, stepCount));
  }, [stepCount]);

  const viewer: ReactElement =
    activeFallback !== null ? (
      <ViewerFallback
        reason={activeFallback}
        message={viewerError}
        compiled={compiled}
        stepIndex={stepIndex}
        assetUrlFor={assetUrlFor}
      />
    ) : (
      <ModelHost
        host={host}
        onSelection={handleSelection}
        onReady={handleReady}
        onMounted={handleMounted}
        onError={handleError}
        onMeasure={handleMeasure}
        onStep={handleStep}
      />
    );

  const controls: ReactElement = (
    <InspectControls
      capabilities={viewerCapabilities}
      sectionPlane={sectionPlane}
      visibility={visibility}
      measureMode={measureMode}
      measurement={measurement}
      views={compiled.views}
      sectionBounds={sectionBounds}
      onSection={handleSection}
      onIsolate={handleIsolate}
      onXray={handleXray}
      onShowCovered={handleShowCovered}
      onCameraPreset={handleCameraPreset}
      onMeasureToggle={handleMeasureToggle}
      onClearMeasurement={handleClearMeasurement}
    />
  );

  const sourcePanel: ReactElement | null = selectedCitation ? (
    <section className="source-panel" aria-label="Source viewer">
      <h3>Source</h3>
      <SourceViewer
        citation={selectedCitation}
        source={
          compiled.sources.find((source) => source.id === selectedCitation.sourceId) ?? null
        }
        assetUrl={(() => {
          const source = compiled.sources.find(
            (candidate) => candidate.id === selectedCitation.sourceId,
          );
          if (!source?.assetPath || !assetUrlFor) return null;
          try {
            return assetUrlFor(source.assetPath);
          } catch {
            return null;
          }
        })()}
      />
    </section>
  ) : null;

  const classes = ['guide-layout', `guide-layout-${variant}`, className].filter(Boolean).join(' ');

  if (variant === 'embed') {
    return (
      <div className={classes} data-testid="embed-root">
        <header className="guide-header">
          <h1>{catalogEntry.title}</h1>
          {currentStep ? (
            <p className="guide-step-line">
              <span data-testid="step-current-title">{currentStep.title}</span>{' '}
              <StatusChip status={currentStatus} />
            </p>
          ) : null}
        </header>
        <div className="embed-body">
          <div className="guide-viewer">
            {viewer}
            <StepNav compiled={compiled} stepIndex={stepIndex} onGoToStep={goToStep} />
          </div>
          <aside className="guide-panel">
            {currentStep ? (
              <OperationCard
                step={currentStep}
                compiled={compiled}
                selectedCitationId={selectedCitationId}
                onOpenCitation={openCitation}
              />
            ) : null}
            {sourcePanel}
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className={classes} data-testid="guide-page">
      <header className="guide-header">
        {onExit ? (
          <button type="button" className="guide-exit" data-testid="guide-exit" onClick={onExit}>
            ← Plan overview
          </button>
        ) : null}
        <h1>{catalogEntry.title}</h1>
        {onChangeMode ? (
          <div className="guide-mode-switch" role="group" aria-label="View mode">
            <button
              type="button"
              aria-pressed={variant === 'build'}
              data-testid="guide-mode-build"
              onClick={() => onChangeMode('build')}
            >
              Guided build
            </button>
            <button
              type="button"
              aria-pressed={variant === 'inspect'}
              data-testid="guide-mode-inspect"
              onClick={() => onChangeMode('inspect')}
            >
              Inspect model
            </button>
          </div>
        ) : null}
        <p className="guide-meta">
          {variant === 'inspect' ? 'Inspect model' : 'Guided build'}
          {catalogEntry.revision ? ` · revision ${catalogEntry.revision}` : ''}
          {` · release ${shortHash(catalogEntry.releaseId, 8, 6)}`}
        </p>
      </header>
      <div className="guide-grid">
        <nav className="guide-sidebar" aria-label={variant === 'inspect' ? 'Parts' : 'Build steps'}>
          <h2 className="guide-sidebar-title">{variant === 'inspect' ? 'Parts' : 'Build steps'}</h2>
          {variant === 'build' ? (
            <StepRail compiled={compiled} currentIndex={stepIndex} onSelectStep={goToStep} />
          ) : (
            <PartsTree
              compiled={compiled}
              stepIndex={stepIndex}
              selectedPartId={selectedPartId}
              onSelectPart={selectPart}
            />
          )}
        </nav>
        <main className="guide-main">
          <div className="guide-step-heading">
            <div className="guide-step-context" aria-live="polite">
              <h2 data-testid="step-current-title">
                {currentStep ? currentStep.title : 'No steps in this guide'}
              </h2>
              <StatusChip status={currentStatus} />
            </div>
            <StepNav compiled={compiled} stepIndex={stepIndex} onGoToStep={goToStep} />
          </div>
          <div
            className="step-progress"
            role="progressbar"
            aria-label="Guide progress"
            aria-valuemin={1}
            aria-valuemax={Math.max(1, compiled.steps.length)}
            aria-valuenow={Math.min(stepIndex + 1, Math.max(1, compiled.steps.length))}
          >
            <span
              className="step-progress-fill"
              style={{
                width: `${compiled.steps.length === 0 ? 0 : ((stepIndex + 1) / compiled.steps.length) * 100}%`,
              }}
            />
          </div>
          {variant === 'build' && currentStatus === 'held' ? (
            <HeldBanner reasons={currentHoldReasons} />
          ) : null}
          {variant === 'build' && currentStatus === 'conditional' ? <ConditionalBanner /> : null}
          <WallDimensionSummary compiled={compiled} />
          <div className="guide-viewer">{viewer}</div>
          {controls}
        </main>
        <aside className="guide-panel">
          {variant === 'build' ? (
            currentStep ? (
              <OperationCard
                step={currentStep}
                compiled={compiled}
                selectedCitationId={selectedCitationId}
                onOpenCitation={openCitation}
              />
            ) : null
          ) : selectedPartId ? (
            <PartCard
              compiled={compiled}
              partId={selectedPartId}
              stepIndex={stepIndex}
              onSelectStep={goToStep}
            />
          ) : (
            <p className="guide-hint" data-testid="part-select-hint">
              Select a part in the tree to see its properties.
            </p>
          )}
          {sourcePanel}
        </aside>
      </div>
    </div>
  );
}
