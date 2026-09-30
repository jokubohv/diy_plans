import { Fragment, useRef } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import type { CompiledGuide, ReleaseStatus } from '@diyguide/schema';
import { effectiveStepStatus, phaseGroups } from './phases';
import { StatusChip } from './status';

export interface StepRailProps {
  compiled: CompiledGuide;
  currentIndex: number;
  onSelectStep: (index: number) => void;
  className?: string;
}

/** Effective status shown for a step: compiled field wins, then the step state, then declared. */
export function stepStatusAt(compiled: CompiledGuide, index: number): ReleaseStatus {
  return effectiveStepStatus(compiled, index);
}

/**
 * Ordered build steps with status chips and keyboard navigation
 * (ArrowUp/Down move the selection, Home/End jump, Enter activates). Steps are grouped under
 * their phase label; the phase header rows are visual only, so the option order — and with it
 * the keyboard index maths — is unchanged.
 */
export function StepRail({
  compiled,
  currentIndex,
  onSelectStep,
  className,
}: StepRailProps): ReactElement {
  const listRef = useRef<HTMLOListElement | null>(null);
  const stepCount = compiled.steps.length;
  const groups = phaseGroups(compiled);

  function select(index: number): void {
    if (stepCount === 0) return;
    const clamped = Math.min(Math.max(index, 0), stepCount - 1);
    onSelectStep(clamped);
    const list = listRef.current;
    const nodes = list?.querySelectorAll<HTMLElement>('[role="option"]');
    nodes?.[clamped]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLLIElement>, index: number): void {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        select(index - 1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        select(index + 1);
        break;
      case 'Home':
        event.preventDefault();
        select(0);
        break;
      case 'End':
        event.preventDefault();
        select(stepCount - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelectStep(index);
        break;
      default:
        break;
    }
  }

  return (
    <nav
      className={['step-rail', className].filter(Boolean).join(' ')}
      data-testid="step-rail"
      aria-label="Build steps"
    >
      <ol className="step-rail-list" role="listbox" aria-label="Build steps" ref={listRef}>
        {groups.map((group) => (
          <Fragment key={group.slug}>
            <li
              className="step-rail-phase-header"
              data-testid={`phase-header-${group.slug}`}
              aria-hidden="true"
            >
              <span className="step-rail-phase-label">{group.label}</span>
              <span className="step-rail-phase-count">
                {group.steps.length} {group.steps.length === 1 ? 'step' : 'steps'}
              </span>
            </li>
            {group.steps.map(({ index, step }) => {
              const current = index === currentIndex;
              const status = stepStatusAt(compiled, index);
              const classes = ['step-rail-item', current ? 'is-current' : '']
                .filter(Boolean)
                .join(' ');
              return (
                <li
                  key={step.id}
                  role="option"
                  aria-selected={current}
                  tabIndex={current ? 0 : -1}
                  className={classes}
                  data-testid={`step-rail-item-${step.id}`}
                  data-current={current ? 'true' : 'false'}
                  onClick={() => onSelectStep(index)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                >
                  <span className="step-rail-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="step-rail-title">{step.title}</span>
                  <StatusChip status={status} />
                </li>
              );
            })}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
