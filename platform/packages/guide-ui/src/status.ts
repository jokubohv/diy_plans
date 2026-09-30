/**
 * Release status display helpers. Statuses are never communicated by colour alone: every chip
 * carries an icon glyph, a text label and a machine-readable `data-status` attribute.
 *
 * This module stays a `.ts` file (per packet C) and builds its element with `createElement`.
 */
import { createElement } from 'react';
import type { ReactElement } from 'react';
import type { ReleaseScope, ReleaseStatus } from '@diyguide/schema';

export const RELEASE_STATUSES: readonly ReleaseStatus[] = [
  'ready',
  'conditional',
  'held',
  'superseded',
  'not_applicable',
];

/** Frozen propagation rank from docs/architecture.md section 5 (higher wins). */
export const STATUS_RANK: Record<ReleaseStatus, number> = {
  not_applicable: 0,
  ready: 1,
  conditional: 2,
  held: 3,
  superseded: 4,
};

export const STATUS_LABEL: Record<ReleaseStatus, string> = {
  ready: 'Ready',
  conditional: 'Conditional',
  held: 'Held',
  superseded: 'Superseded',
  not_applicable: 'Not applicable',
};

/** Distinct glyphs so status is never colour-only. */
export const STATUS_ICON: Record<ReleaseStatus, string> = {
  ready: '\u2713',
  conditional: '\u25d0',
  held: '\u2298',
  superseded: '\u21ba',
  not_applicable: '\u2013',
};

export const STATUS_DESCRIPTION: Record<ReleaseStatus, string> = {
  ready: 'Ready: performed in the guide for its declared scope.',
  conditional: 'Conditional: preview only until conditions are resolved by an authorized revision.',
  held: 'Held: not applied; no quantity or value may be inferred.',
  superseded: 'Superseded: replaced by a later record; must not be used.',
  not_applicable: 'Not applicable.',
};

export const SCOPE_LABEL: Record<ReleaseScope, string> = {
  demonstration_only: 'Demonstration only',
  practice_on_loose_scrap: 'Practice on loose scrap only',
  site_installation: 'Site installation',
  design_review: 'Design review',
};

export function statusRank(status: ReleaseStatus): number {
  return STATUS_RANK[status];
}

/** Highest-ranked status, or null when there is nothing to rank. */
export function worstStatus(statuses: readonly ReleaseStatus[]): ReleaseStatus | null {
  let worst: ReleaseStatus | null = null;
  for (const status of statuses) {
    if (worst === null || STATUS_RANK[status] > STATUS_RANK[worst]) worst = status;
  }
  return worst;
}

export function isReleaseStatus(value: unknown): value is ReleaseStatus {
  return typeof value === 'string' && (RELEASE_STATUSES as readonly string[]).includes(value);
}

export function statusLabel(status: ReleaseStatus): string {
  return STATUS_LABEL[status];
}

export interface StatusChipProps {
  status: ReleaseStatus;
  /** Optional release scope shown after the status text. */
  scope?: ReleaseScope | null;
  /** Override the standard label. */
  label?: string;
  /** Tooltip/description override. */
  detail?: string | null;
  className?: string;
}

export function StatusChip({
  status,
  scope,
  label,
  detail,
  className,
}: StatusChipProps): ReactElement {
  const text = label ?? STATUS_LABEL[status];
  const description = detail ?? STATUS_DESCRIPTION[status];
  const classes = ['status-chip', `status-chip-${status}`, className].filter(Boolean).join(' ');
  return createElement(
    'span',
    {
      className: classes,
      'data-testid': 'status-chip',
      'data-status': status,
      'data-scope': scope ?? undefined,
      title: description,
    },
    createElement(
      'span',
      {
        className: 'status-chip-icon',
        'data-icon': STATUS_ICON[status],
        'aria-hidden': 'true',
      },
      STATUS_ICON[status],
    ),
    createElement('span', { className: 'status-chip-label' }, text),
    scope ? createElement('span', { className: 'status-chip-scope' }, ` · ${SCOPE_LABEL[scope]}`) : null,
  );
}
