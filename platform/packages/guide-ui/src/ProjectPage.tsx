import { useState } from 'react';
import type { ReactElement } from 'react';
import type { CompiledGuide, ReleaseStatus } from '@diyguide/schema';
import type { CatalogEntry } from './data';
import { canonicalMmText, measurementValueText, projectTypeLabel, shortHash } from './format';
import { effectiveStepStatus, phaseGroups } from './phases';
import type { GuideMode } from './router';
import { StatusChip } from './status';

export interface ProjectPageProps {
  catalogEntry: CatalogEntry;
  compiled: CompiledGuide;
  /** Optional thumbnail for the project hero (resolved by the site). */
  thumbnailUrl?: string | null;
  /** Open the guided build / inspect model for this plan. */
  onOpenGuide?: (mode: GuideMode) => void;
  className?: string;
}

function countStepsByStatus(compiled: CompiledGuide): Record<ReleaseStatus, number> {
  const counts: Record<ReleaseStatus, number> = {
    ready: 0,
    conditional: 0,
    held: 0,
    superseded: 0,
    not_applicable: 0,
  };
  for (const step of compiled.steps) {
    counts[step.effectiveReleaseStatus ?? step.declaredReleaseStatus] += 1;
  }
  return counts;
}

/**
 * Project overview: description, dimension summary from compiled measurements in the project
 * display unit, held/conditional counts, revision/acceptance and the release pinning note.
 */
export function ProjectPage({
  catalogEntry,
  compiled,
  thumbnailUrl = null,
  onOpenGuide,
  className,
}: ProjectPageProps): ReactElement {
  const [copied, setCopied] = useState(false);
  const project = compiled.project;
  const display = project.display;
  const counts = countStepsByStatus(compiled);
  const openIssues = compiled.issues.filter((issue) => issue.status === 'open').length;
  const acceptance = compiled.meta.acceptanceStatus;
  const scopeText =
    catalogEntry.scope === 'build_guide'
      ? 'Build guide'
      : catalogEntry.scope === 'concept'
        ? 'Concept'
        : null;
  const classes = ['project-page', className].filter(Boolean).join(' ');
  const typeLabel = projectTypeLabel(catalogEntry.projectType);
  const releaseShort = shortHash(catalogEntry.releaseId, 10, 6);

  async function copyReleaseId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(catalogEntry.releaseId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className={classes} data-testid="project-page">
      <div className="project-hero">
        <div className="project-hero-media">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" />
          ) : (
            <div className="project-hero-media-empty" aria-hidden="true">
              No preview image
            </div>
          )}
        </div>
        <header className="project-header">
          <p className="project-kicker">
            {typeLabel} · Revision {catalogEntry.revision ?? '—'} ·{' '}
            {scopeText ?? 'Concept'} · Acceptance {acceptance}
          </p>
          <h1>{project.title}</h1>
          <p className="project-description">{project.description}</p>
          <div className="project-modes" role="group" aria-label="Open this plan">
            <button
              type="button"
              className="mode-button"
              data-testid="mode-build"
              onClick={() => onOpenGuide?.('build')}
            >
              Open guided build
            </button>
            <button
              type="button"
              className="mode-button mode-button-secondary"
              data-testid="mode-inspect"
              onClick={() => onOpenGuide?.('inspect')}
            >
              Inspect model
            </button>
          </div>
        </header>
      </div>

      <section className="panel project-summary" aria-label="Safety and release summary">
        <div className="project-summary-head">
          <h2>Safety &amp; release status</h2>
          <div className="stat-tiles">
            <div className="stat-tile stat-tile-ready">
              <span className="stat-tile-value">{counts.ready}</span>
              <span className="stat-tile-label">ready steps</span>
            </div>
            <div className="stat-tile stat-tile-conditional">
              <span className="stat-tile-value">{counts.conditional}</span>
              <span className="stat-tile-label">conditional</span>
            </div>
            <div className="stat-tile stat-tile-held">
              <span className="stat-tile-value">{counts.held}</span>
              <span className="stat-tile-label">held</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-value">{openIssues}</span>
              <span className="stat-tile-label">open issues</span>
            </div>
          </div>
        </div>
        <div className="project-summary-messages">
          {counts.held > 0 ? (
            <p className="project-banner project-banner-held" data-testid="held-banner" role="status">
              <strong>
                {counts.held} held step{counts.held === 1 ? '' : 's'} in this plan.
              </strong>{' '}
              Held steps are shown as previews only and must not be built.
            </p>
          ) : null}
          {counts.conditional > 0 ? (
            <p
              className="project-banner project-banner-conditional"
              data-testid="conditional-banner"
              role="status"
            >
              <strong>
                {counts.conditional} conditional step{counts.conditional === 1 ? '' : 's'}.
              </strong>{' '}
              Conditional work is preview only until an authorized revision resolves the conditions.
            </p>
          ) : null}
          {counts.ready === 0 && counts.held === 0 && counts.conditional === 0 ? (
            <p className="project-banner">No steps are published for this plan yet.</p>
          ) : null}
        </div>
      </section>

      {compiled.steps.length > 0 ? (
        <section
          className="panel project-build-sequence"
          data-testid="build-sequence"
          aria-label="Build sequence"
        >
          <h2>Build sequence</h2>
          <p className="project-build-sequence-intro">
            Steps as published, grouped by phase in build order.
          </p>
          <ol className="build-sequence-phases">
            {phaseGroups(compiled).map((group) => (
              <li
                key={group.slug}
                className="build-sequence-phase"
                data-testid={`phase-${group.slug}`}
                data-status={group.status}
              >
                <div className="build-sequence-phase-head">
                  <h3>{group.label}</h3>
                  <span className="build-sequence-phase-count">
                    {group.steps.length} {group.steps.length === 1 ? 'step' : 'steps'}
                  </span>
                  <StatusChip status={group.status} />
                </div>
                {group.status === 'held' || group.status === 'superseded' ? (
                  <p className="build-sequence-phase-note">
                    Held steps in this phase are previews only and must not be built.
                  </p>
                ) : null}
                {group.status === 'conditional' ? (
                  <p className="build-sequence-phase-note">
                    Conditional work in this phase is preview only until an authorized revision
                    resolves the conditions.
                  </p>
                ) : null}
                <ol className="build-sequence-steps">
                  {group.steps.map(({ index, step }) => (
                    <li key={step.id} className="build-sequence-step">
                      <span className="build-sequence-step-title">{step.title}</span>
                      <StatusChip status={effectiveStepStatus(compiled, index)} />
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="project-columns">
        <section className="panel project-dimensions" aria-label="Dimensions">
          <h2>Dimensions</h2>
          <dl className="measurement-list">
            {compiled.measurements.map((measurement) => {
              const mmText = canonicalMmText(measurement.canonicalMm);
              const displayText = measurementValueText(measurement, display);
              const originalText = `${measurement.original.display}`;
              return (
                <div className="measurement-row" key={measurement.id}>
                  <dt>
                    {measurement.label} <StatusChip status={measurement.declaredReleaseStatus} />
                  </dt>
                  <dd>
                    <span className="measurement-value">{displayText}</span>
                    {originalText !== displayText ? (
                      <span className="measurement-original"> · original {originalText}</span>
                    ) : null}
                    <span className="measurement-canonical" title={measurement.canonicalMm}>
                      {' '}
                      · {mmText} mm
                    </span>
                    {measurement.evidenceStatus === 'conflicted' ? (
                      <span className="measurement-conflict-tag"> · conflicted evidence</span>
                    ) : null}
                    {measurement.conflictNote ? (
                      <p className="measurement-conflict">{measurement.conflictNote}</p>
                    ) : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>

        <div className="project-side">
          <section
            className="panel project-release-pin"
            data-testid="release-pin-note"
            aria-label="Pinned release"
          >
            <h2>Pinned release</h2>
            <p>
              This session is pinned to release <code title={catalogEntry.releaseId}>{releaseShort}</code>
              {catalogEntry.revision ? ` (revision ${catalogEntry.revision})` : ''}. The site will not
              switch releases under you while you work.
            </p>
            <button type="button" className="copy-button" onClick={() => void copyReleaseId()}>
              {copied ? 'Copied' : 'Copy full release id'}
            </button>
            <p className="project-release-detail">
              Release id <code>{catalogEntry.releaseId}</code>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
