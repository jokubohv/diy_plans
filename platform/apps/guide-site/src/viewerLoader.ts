/**
 * Lazy boundary for the three.js viewer. The engine chunk (three.js is the largest dependency)
 * is only fetched when a guide route actually needs a live viewer, keeping the library and
 * project pages light. Non-WebGL hosts stay on the dependency-free recording host.
 */
import type { CompiledGuide } from '@diyguide/schema';
import type { ViewerCapabilities, ViewerHost } from '@diyguide/viewer-core';
import { createViewerHost } from '@diyguide/viewer-core';

/** Capabilities advertised before the engine chunk resolves; the adapter reports its own. */
export const THREE_CAPABILITIES_FALLBACK: ViewerCapabilities = {
  engine: 'three.js',
  version: 'pending',
  picking: true,
  clipping: true,
  xray: true,
  measurement: true,
  animation: true,
  overlays: true,
  canonicalUnit: 'mm',
  viewerFrame: 'Y-up metres',
};

let modulePromise: Promise<typeof import('@diyguide/viewer-three')> | null = null;

function loadViewerThree(): Promise<typeof import('@diyguide/viewer-three')> {
  modulePromise ??= import('@diyguide/viewer-three');
  return modulePromise;
}

export function preloadViewerThree(): void {
  void loadViewerThree();
}

export async function threeViewerVersion(): Promise<string> {
  const module = await loadViewerThree();
  return module.THREE_VERSION;
}

export async function createThreeHost(compiled: CompiledGuide): Promise<ViewerHost> {
  const module = await loadViewerThree();
  return createViewerHost(module.createThreeAdapter(), compiled);
}
