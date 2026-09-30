/**
 * Browser capability helpers for the guide site. Kept DOM-injectable so unit tests can run in
 * plain Node without jsdom.
 */

export interface CanvasContextLike {
  getContext(type: string): unknown;
}

export interface DocumentLike {
  createElement(tagName: string): unknown;
}

export interface MatchMediaLike {
  matchMedia?(query: string): { matches: boolean } | null;
}

/**
 * True when the document can create a WebGL (2 or 1) rendering context. Any failure — thrown
 * `getContext`, missing document, blocked context — returns false so the caller can fall back
 * to the recording host and the text/2D viewer.
 */
export function detectWebGL(doc: DocumentLike | null = typeof document === 'undefined' ? null : document): boolean {
  if (!doc) return false;
  try {
    const canvas = doc.createElement('canvas') as CanvasContextLike | null;
    if (!canvas || typeof canvas.getContext !== 'function') return false;
    const context =
      canvas.getContext('webgl2') ?? canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    return context != null;
  } catch {
    return false;
  }
}

/** True when the user asked for reduced motion (used for deterministic, non-animated seeks). */
export function prefersReducedMotion(win: MatchMediaLike): boolean {
  if (typeof win.matchMedia !== 'function') return false;
  try {
    return win.matchMedia('(prefers-reduced-motion: reduce)')?.matches === true;
  } catch {
    return false;
  }
}

export interface MediaQueryListLike {
  matches: boolean;
  addEventListener?(type: 'change', listener: () => void): void;
  removeEventListener?(type: 'change', listener: () => void): void;
}

export interface MotionWindowLike extends MatchMediaLike {
  matchMedia?(query: string): MediaQueryListLike | null;
}

/**
 * Subscribe to reduced-motion changes; returns a disposer. Falls back to a no-op when the
 * environment does not support matchMedia.
 */
export function watchReducedMotion(
  win: MotionWindowLike,
  listener: (reduced: boolean) => void,
): () => void {
  if (typeof win.matchMedia !== 'function') return () => undefined;
  let query: MediaQueryListLike | null = null;
  try {
    query = win.matchMedia('(prefers-reduced-motion: reduce)');
  } catch {
    return () => undefined;
  }
  if (!query) return () => undefined;
  const handleChange = (): void => listener(query.matches);
  query.addEventListener?.('change', handleChange);
  return () => query.removeEventListener?.('change', handleChange);
}
