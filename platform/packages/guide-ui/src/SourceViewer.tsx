import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Citation, SourceRef } from '@diyguide/schema';

export interface SourceViewBox {
  width: number;
  height: number;
}

/**
 * Default coordinate system for published source pages. The P0 fixture sheets use a 1000x700
 * viewBox; callers can override it per source. This is a presentation convention, not guide data.
 */
export const DEFAULT_SOURCE_VIEWBOX: SourceViewBox = { width: 1000, height: 700 };

export interface SourceViewerProps {
  citation: Citation;
  source?: SourceRef | null;
  /** Resolved URL of the source page asset (see resolveGuideAssetUrl). */
  assetUrl?: string | null;
  viewBox?: SourceViewBox;
  /** Force the unavailable state (e.g. when the site cannot serve assets). */
  unavailable?: boolean;
  className?: string;
}

/** Reason the source cannot be shown, or null when it can. */
export function sourceUnavailableReason(
  source: SourceRef | null | undefined,
  assetUrl: string | null | undefined,
): string | null {
  if (!source) return 'The source record for this citation is missing from the compiled guide.';
  if (source.privacy === 'private') {
    return 'This source is private and is not published with the guide.';
  }
  if (!source.assetPath) return 'This source has no published page asset.';
  if (!assetUrl) return 'The source page could not be located next to the compiled guide.';
  return null;
}

export interface RegionViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Zoomed viewBox around a citation region: the region plus proportional padding, clamped to the
 * sheet. Keeps the authored evidence legible instead of rendering a full technical sheet at
 * thumbnail scale. Pure function so the crop behaviour is unit-testable.
 */
export function regionViewBox(
  region: { x: number; y: number; width: number; height: number },
  sheet: SourceViewBox,
  paddingRatio = 0.18,
): RegionViewBox {
  const pad = Math.max(region.width, region.height) * paddingRatio;
  const x = Math.max(0, region.x - pad);
  const y = Math.max(0, region.y - pad);
  const width = Math.min(sheet.width - x, region.width + pad * 2);
  const height = Math.min(sheet.height - y, region.height + pad * 2);
  return { x, y, width, height };
}

function viewBoxAttribute(box: RegionViewBox): string {
  return `${box.x} ${box.y} ${box.width} ${box.height}`;
}

/**
 * Renders a published source page with the citation region highlighted, or an explicit
 * "source unavailable" state. When the citation authors a region the viewer zooms to it (with a
 * toggle back to the full sheet); works without WebGL.
 */
export function SourceViewer({
  citation,
  source = null,
  assetUrl = null,
  viewBox = DEFAULT_SOURCE_VIEWBOX,
  unavailable = false,
  className,
}: SourceViewerProps): ReactElement {
  const [loadFailed, setLoadFailed] = useState(false);
  const [showFullSheet, setShowFullSheet] = useState(false);
  const reason = unavailable
    ? 'This source viewer is not available in this view.'
    : sourceUnavailableReason(source, assetUrl);
  const classes = ['source-viewer', className].filter(Boolean).join(' ');
  const focused = citation.region ? regionViewBox(citation.region, viewBox) : null;
  const activeBox: RegionViewBox = { x: 0, y: 0, ...viewBox };
  const shown = focused && !showFullSheet ? focused : activeBox;
  const focusedLabel =
    focused && !showFullSheet ? ` — focused on ${citation.label}` : ' — full sheet';

  if (reason !== null || loadFailed) {
    return (
      <div className={classes} data-testid="source-viewer" data-state="unavailable">
        <h4 className="source-viewer-title">{citation.label}</h4>
        <p className="source-viewer-unavailable" role="note">
          Source unavailable.{' '}
          {loadFailed ? 'The source page failed to load.' : reason}
        </p>
        {citation.excerpt ? (
          <p className="source-viewer-excerpt">Excerpt: {citation.excerpt}</p>
        ) : null}
      </div>
    );
  }

  return (
    <figure className={classes} data-testid="source-viewer" data-state="ready">
      <svg
        className="source-viewer-page"
        viewBox={viewBoxAttribute(shown)}
        data-viewbox={viewBoxAttribute(shown)}
        role="img"
        aria-label={`Source page: ${source?.title ?? citation.label}${focusedLabel}`}
      >
        <image
          href={assetUrl ?? undefined}
          x={0}
          y={0}
          width={viewBox.width}
          height={viewBox.height}
          onError={() => setLoadFailed(true)}
        />
        {citation.region ? (
          <rect
            className="source-viewer-region"
            data-testid="source-viewer-region"
            x={citation.region.x}
            y={citation.region.y}
            width={citation.region.width}
            height={citation.region.height}
            fill="none"
          />
        ) : null}
      </svg>
      <figcaption className="source-viewer-caption">
        {source?.title ?? 'Source'} · {citation.label}
      </figcaption>
      {citation.region ? (
        <button
          type="button"
          className="source-viewer-toggle"
          data-testid="source-viewer-toggle"
          aria-pressed={showFullSheet}
          onClick={() => setShowFullSheet((current) => !current)}
        >
          {showFullSheet ? 'Zoom to the cited region' : 'Show the full sheet'}
        </button>
      ) : (
        <p className="source-viewer-note">This citation does not specify a highlighted region.</p>
      )}
    </figure>
  );
}
