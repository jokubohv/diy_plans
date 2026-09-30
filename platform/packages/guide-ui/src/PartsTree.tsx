import { useRef } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import type { CompiledGuide, Part, PartState } from '@diyguide/schema';
import { stateLabel } from '@diyguide/viewer-core';

export interface PartsTreeProps {
  compiled: CompiledGuide;
  /** Step index used to look up the preview state snapshot. */
  stepIndex: number;
  selectedPartId?: string | null;
  onSelectPart?: (partId: string) => void;
  className?: string;
}

interface TradeGroup {
  trade: string;
  parts: Part[];
}

interface AssemblyGroup {
  assemblyId: string;
  assemblyName: string;
  trades: TradeGroup[];
}

/** State of every part at a step (snapshot after the step, falling back to the initial state). */
export function partsStateAt(compiled: CompiledGuide, stepIndex: number): Map<string, PartState> {
  const stateByPart = new Map<string, PartState>();
  for (const part of compiled.parts) stateByPart.set(part.id, part.initialState);
  const stepState = compiled.stepStates[stepIndex];
  if (stepState) {
    for (const entry of stepState.after) stateByPart.set(entry.partId, entry.state);
  }
  return stateByPart;
}

export function groupParts(compiled: CompiledGuide): AssemblyGroup[] {
  const groups: AssemblyGroup[] = [];
  for (const assembly of compiled.assemblies) {
    const parts = compiled.parts.filter((part) => part.assemblyId === assembly.id);
    if (parts.length === 0) continue;
    const trades: TradeGroup[] = [];
    for (const part of parts) {
      const existing = trades.find((group) => group.trade === part.trade);
      if (existing) existing.parts.push(part);
      else trades.push({ trade: part.trade, parts: [part] });
    }
    groups.push({ assemblyId: assembly.id, assemblyName: assembly.name, trades });
  }
  // Parts that reference an unknown assembly still have to be reachable.
  const knownAssemblies = new Set(groups.map((group) => group.assemblyId));
  const orphans = compiled.parts.filter((part) => !knownAssemblies.has(part.assemblyId));
  if (orphans.length > 0) {
    const trades: TradeGroup[] = [];
    for (const part of orphans) {
      const existing = trades.find((group) => group.trade === part.trade);
      if (existing) existing.parts.push(part);
      else trades.push({ trade: part.trade, parts: [part] });
    }
    groups.push({ assemblyId: '(unknown)', assemblyName: 'Unassigned parts', trades });
  }
  return groups;
}

/**
 * Parts grouped by assembly and then trade, with tree semantics and keyboard access
 * (ArrowUp/Down/Home/End move, Enter/Space select).
 */
export function PartsTree({
  compiled,
  stepIndex,
  selectedPartId = null,
  onSelectPart,
  className,
}: PartsTreeProps): ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stateByPart = partsStateAt(compiled, stepIndex);
  const groups = groupParts(compiled);

  function focusRelative(partId: string, move: number | 'first' | 'last'): void {
    const root = rootRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-part-node="true"]'));
    if (nodes.length === 0) return;
    if (move === 'first') {
      nodes[0]?.focus();
      return;
    }
    if (move === 'last') {
      nodes[nodes.length - 1]?.focus();
      return;
    }
    const current = nodes.findIndex((node) => node.dataset.partId === partId);
    const target = Math.min(Math.max((current === -1 ? 0 : current) + move, 0), nodes.length - 1);
    nodes[target]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLLIElement>, partId: string): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusRelative(partId, 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusRelative(partId, -1);
        break;
      case 'Home':
        event.preventDefault();
        focusRelative(partId, 'first');
        break;
      case 'End':
        event.preventDefault();
        focusRelative(partId, 'last');
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelectPart?.(partId);
        break;
      default:
        break;
    }
  }

  return (
    <div
      className={['parts-tree', className].filter(Boolean).join(' ')}
      data-testid="parts-tree"
      tabIndex={0}
      aria-label="Parts list (scrollable)"
      ref={rootRef}
    >
      <ul role="tree" aria-label="Parts by assembly and trade">
        {groups.map((group) => (
          <li key={group.assemblyId} role="treeitem" aria-expanded="true" className="parts-tree-group">
            <span className="parts-tree-label">{group.assemblyName}</span>
            <ul role="group">
              {group.trades.map((tradeGroup) => (
                <li
                  key={`${group.assemblyId}:${tradeGroup.trade}`}
                  role="treeitem"
                  aria-expanded="true"
                  className="parts-tree-group"
                >
                  <span className="parts-tree-label">{tradeGroup.trade}</span>
                  <ul role="group">
                    {tradeGroup.parts.map((part) => {
                      const selected = part.id === selectedPartId;
                      const state = stateByPart.get(part.id) ?? part.initialState;
                      return (
                        <li
                          key={part.id}
                          role="treeitem"
                          aria-selected={selected}
                          tabIndex={selected ? 0 : -1}
                          className={['parts-tree-part', selected ? 'is-selected' : ''].filter(Boolean).join(' ')}
                          data-testid={`part-node-${part.id}`}
                          data-part-node="true"
                          data-part-id={part.id}
                          onClick={() => onSelectPart?.(part.id)}
                          onKeyDown={(event) => handleKeyDown(event, part.id)}
                        >
                          <span className="parts-tree-part-name">{part.name}</span>
                          <span className="parts-tree-part-state">{stateLabel(state)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
