import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import type { MeasurementResult, ViewerHost } from '@diyguide/viewer-core';

/** One mount per host, even across React StrictMode double effects. */
const mountPromises = new WeakMap<ViewerHost, Promise<void>>();

export interface ModelHostProps {
  host: ViewerHost | null;
  onSelection?: (partIds: string[]) => void;
  onReady?: () => void;
  /** Fired after the host reports itself mounted (host.mount resolved). */
  onMounted?: () => void;
  onError?: (message: string) => void;
  onMeasure?: (result: MeasurementResult) => void;
  onStep?: (index: number) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Mounts a ViewerHost into a container div, forwards host events and exposes the frozen
 * `viewer-canvas` testid. The host is created and disposed by the composition root; this
 * component only mounts it (once per host).
 */
export function ModelHost({
  host,
  onSelection,
  onReady,
  onMounted,
  onError,
  onMeasure,
  onStep,
  ariaLabel = 'Interactive 3D model',
  className,
}: ModelHostProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callbacksRef = useRef({ onSelection, onReady, onMounted, onError, onMeasure, onStep });
  callbacksRef.current = { onSelection, onReady, onMounted, onError, onMeasure, onStep };

  useEffect(() => {
    const container = containerRef.current;
    if (!host || !container) return;
    const unsubscribes = [
      host.on('selection', (partIds) => callbacksRef.current.onSelection?.(partIds)),
      host.on('ready', () => callbacksRef.current.onReady?.()),
      host.on('error', (message) => callbacksRef.current.onError?.(message)),
      host.on('measure', (result) => callbacksRef.current.onMeasure?.(result)),
      host.on('step', (index) => callbacksRef.current.onStep?.(index)),
    ];
    const alreadyMounted = host.getState().mounted;
    if (!alreadyMounted) {
      let promise = mountPromises.get(host);
      if (!promise) {
        promise = host.mount(container);
        mountPromises.set(host, promise);
      }
      promise.then(
        () => callbacksRef.current.onMounted?.(),
        (error: unknown) =>
          callbacksRef.current.onError?.(error instanceof Error ? error.message : String(error)),
      );
    } else {
      callbacksRef.current.onMounted?.();
    }
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [host]);

  return (
    <div
      ref={containerRef}
      data-testid="viewer-canvas"
      className={['viewer-canvas', className].filter(Boolean).join(' ')}
      role="application"
      aria-label={ariaLabel}
    />
  );
}
