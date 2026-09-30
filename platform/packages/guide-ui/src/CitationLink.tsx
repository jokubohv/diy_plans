import type { ReactElement } from 'react';
import type { Citation, SourceRef } from '@diyguide/schema';

export interface CitationLinkProps {
  citation: Citation;
  source?: SourceRef | null;
  active?: boolean;
  onSelect?: (citationId: string) => void;
  className?: string;
}

/** A citation chip. Clicking it asks the composition root to show the source viewer. */
export function CitationLink({
  citation,
  source = null,
  active = false,
  onSelect,
  className,
}: CitationLinkProps): ReactElement {
  const classes = ['citation-link', active ? 'is-active' : '', className].filter(Boolean).join(' ');
  const unavailable = !source || source.privacy === 'private' || !source.assetPath;
  return (
    <button
      type="button"
      className={classes}
      data-testid={`citation-link-${citation.id}`}
      aria-pressed={active}
      onClick={() => onSelect?.(citation.id)}
    >
      <span className="citation-link-label">{citation.label}</span>
      {source ? <span className="citation-link-source"> · {source.title}</span> : null}
      {unavailable ? (
        <span className="citation-link-unavailable"> · source not published</span>
      ) : null}
    </button>
  );
}
