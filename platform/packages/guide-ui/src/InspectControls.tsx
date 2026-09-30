import type { ReactElement } from 'react';
import type { Bounds, ViewPreset } from '@diyguide/schema';
import type {
  MeasurementResult,
  SectionPlane,
  ViewerCapabilities,
  VisibilityState,
} from '@diyguide/viewer-core';

export interface InspectControlsProps {
  /** Engine capabilities; null/undefined disables the controls with an explanation. */
  capabilities?: ViewerCapabilities | null;
  sectionPlane?: SectionPlane | null;
  visibility?: VisibilityState;
  measureMode?: boolean;
  measurement?: MeasurementResult | null;
  views?: readonly ViewPreset[];
  /** World bounds used to derive the section slider range from the model. */
  sectionBounds?: Bounds | null;
  onSection?: (plane: SectionPlane | null) => void;
  onIsolate?: () => void;
  onXray?: () => void;
  onShowCovered?: (show: boolean) => void;
  onCameraPreset?: (viewId: string) => void;
  onMeasureToggle?: (on: boolean) => void;
  onClearMeasurement?: () => void;
  className?: string;
}

const EMPTY_VISIBILITY: VisibilityState = {
  isolatedPartIds: [],
  xrayPartIds: [],
  hiddenPartIds: [],
  showCovered: false,
};

/** Generic slider range used only when no model bounds were provided. */
const FALLBACK_SECTION_BOUNDS: Bounds = {
  min: [-5000, -5000, -5000],
  max: [5000, 5000, 5000],
};

interface CapabilityState {
  ok: boolean;
  reason: string | null;
}

function capabilityState(
  capabilities: ViewerCapabilities | null | undefined,
  key: 'clipping' | 'xray' | 'measurement',
  feature: string,
): CapabilityState {
  if (!capabilities) {
    return {
      ok: false,
      reason: 'Viewer capability information is unavailable, so this control is disabled.',
    };
  }
  if (!capabilities[key]) {
    return { ok: false, reason: `This viewer does not support ${feature}.` };
  }
  return { ok: true, reason: null };
}

function visibilityState(
  capabilities: ViewerCapabilities | null | undefined,
): CapabilityState {
  if (!capabilities) {
    return {
      ok: false,
      reason: 'Viewer capability information is unavailable, so this control is disabled.',
    };
  }
  return { ok: true, reason: null };
}

function DisabledReason({ reason, testid }: { reason: string | null; testid: string }): ReactElement | null {
  if (!reason) return null;
  return (
    <span className="control-reason" role="note" data-testid={testid}>
      {reason}
    </span>
  );
}

function formatMeasurement(measurement: MeasurementResult): string {
  if (measurement.kind === 'distance' && measurement.valueMm != null) {
    const rounded = Math.round(measurement.valueMm * 10) / 10;
    return `${rounded} mm`;
  }
  if (measurement.kind === 'angle' && measurement.valueDeg != null) {
    const rounded = Math.round(measurement.valueDeg * 10) / 10;
    return `${rounded}°`;
  }
  return measurement.note ?? 'no measurement';
}

/**
 * Inspect controls: section plane, isolate, x-ray, show-covered, camera presets and measurement.
 * Capabilities that the engine does not provide are disabled and explained in text.
 */
export function InspectControls({
  capabilities = null,
  sectionPlane = null,
  visibility = EMPTY_VISIBILITY,
  measureMode = false,
  measurement = null,
  views = [],
  sectionBounds = null,
  onSection,
  onIsolate,
  onXray,
  onShowCovered,
  onCameraPreset,
  onMeasureToggle,
  onClearMeasurement,
  className,
}: InspectControlsProps): ReactElement {
  const clipping = capabilityState(capabilities, 'clipping', 'section clipping');
  const xray = capabilityState(capabilities, 'xray', 'x-ray display');
  const measurementCapability = capabilityState(capabilities, 'measurement', 'measurement');
  const isolate = visibilityState(capabilities);
  const covered = visibilityState(capabilities);

  const axis = sectionPlane?.axis ?? 'z';
  const bounds = sectionBounds ?? FALLBACK_SECTION_BOUNDS;
  const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const axisMin = Math.floor(bounds.min[axisIndex] - 500);
  const axisMax = Math.ceil(bounds.max[axisIndex] + 500);
  const offset = sectionPlane?.offsetMm ?? 0;

  const isolated = visibility.isolatedPartIds.length > 0;
  const xrayOn = visibility.xrayPartIds.length > 0;

  return (
    <section className={['inspect-controls', className].filter(Boolean).join(' ')} aria-label="Inspect controls">
      <div className="control-group">
        <h3>Section</h3>
        <div className="section-axes" role="group" aria-label="Section axis">
          {(['x', 'y', 'z'] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              data-testid={`section-axis-${candidate}`}
              aria-pressed={axis === candidate}
              disabled={!clipping.ok}
              onClick={() => onSection?.({ axis: candidate, offsetMm: offset })}
            >
              {candidate.toUpperCase()}
            </button>
          ))}
        </div>
        <label className="section-slider-label">
          Offset
          <input
            type="range"
            data-testid="section-slider"
            min={axisMin}
            max={axisMax}
            step={1}
            value={offset}
            disabled={!clipping.ok}
            onChange={(event) => onSection?.({ axis, offsetMm: Number(event.currentTarget.value) })}
          />
          <output className="section-offset">{offset} mm</output>
        </label>
        {sectionPlane ? (
          <button
            type="button"
            data-testid="btn-section-clear"
            disabled={!clipping.ok}
            onClick={() => onSection?.(null)}
          >
            Clear section
          </button>
        ) : null}
        <DisabledReason reason={clipping.reason} testid="reason-section" />      </div>

      <div className="control-group">
        <h3>Visibility</h3>
        <button
          type="button"
          data-testid="btn-isolate"
          aria-pressed={isolated}
          disabled={!isolate.ok}
          onClick={() => onIsolate?.()}
        >
          Isolate selection
        </button>
        <DisabledReason reason={isolate.reason} testid="reason-isolate" />
        <button
          type="button"
          data-testid="btn-xray"
          aria-pressed={xrayOn}
          disabled={!xray.ok}
          onClick={() => onXray?.()}
        >
          X-ray selection
        </button>
        <DisabledReason reason={xray.reason} testid="reason-xray" />
        <label className="show-covered-label">
          <input
            type="checkbox"
            data-testid="btn-show-covered"
            checked={visibility.showCovered}
            disabled={!covered.ok}
            onChange={(event) => onShowCovered?.(event.currentTarget.checked)}
          />
          Show covered parts
        </label>
        <DisabledReason reason={covered.reason} testid="reason-show-covered" />
      </div>

      <div className="control-group">
        <h3>Camera</h3>
        {views.length === 0 ? (
          <p>No camera presets are recorded in the guide.</p>
        ) : (
          <div className="camera-presets">
            {views.map((view) => (
              <button
                key={view.id}
                type="button"
                data-testid={`camera-preset-${view.id}`}
                onClick={() => onCameraPreset?.(view.id)}
              >
                {view.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="control-group">
        <h3>Measure</h3>
        <button
          type="button"
          data-testid="btn-measure"
          aria-pressed={measureMode}
          disabled={!measurementCapability.ok}
          onClick={() => onMeasureToggle?.(!measureMode)}
        >
          {measureMode ? 'Stop measuring' : 'Measure'}
        </button>
        <DisabledReason reason={measurementCapability.reason} testid="reason-measure" />
        {measurement ? (
          <>
            <p className="measurement-result" data-testid="measurement-result">
              {formatMeasurement(measurement)}
              {measurement.approximate ? ' (approximate, from viewer picks)' : ''}
            </p>
            <button
              type="button"
              data-testid="btn-clear-measurement"
              onClick={() => onClearMeasurement?.()}
            >
              Clear measurement
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
