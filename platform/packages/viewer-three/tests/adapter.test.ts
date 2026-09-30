import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { REVISION } from 'three';
import {
  BIM_SCENE,
  THREE_VERSION,
  colorDistance,
  createThreeAdapter,
  disposeObject3D,
  overlayColor,
  partEdgeSpec,
  partMaterialSpec,
  requirementPreviewBoxViewerSpec,
  SELECTION_BLUE,
  tradeColor,
  tradeFinish,
} from '../src/index';

describe('createThreeAdapter', () => {
  it('constructs without a DOM and reports capabilities (no load call, no WebGL)', () => {
    const adapter = createThreeAdapter();
    expect(adapter.capabilities).toEqual({
      engine: 'three.js',
      version: THREE_VERSION,
      picking: true,
      clipping: true,
      xray: true,
      measurement: true,
      animation: true,
      overlays: true,
      canonicalUnit: 'mm',
      viewerFrame: 'Y-up metres',
    });
    expect(THREE_VERSION).toBe(REVISION);
    adapter.dispose();
    adapter.dispose();
  });

  it('measures canonical points without a renderer', () => {
    const adapter = createThreeAdapter();
    expect(adapter.measure([
      [0, 0, 0],
      [1000, 0, 0],
    ])).toMatchObject({
      kind: 'distance',
      valueMm: 1000,
      valueDeg: null,
      approximate: true,
    });
    const angle = adapter.measure([
      [1000, 0, 0],
      [0, 0, 0],
      [0, 1000, 0],
    ]);
    expect(angle?.kind).toBe('angle');
    expect(angle?.valueDeg).toBeCloseTo(90, 9);
    expect(adapter.measure([[0, 0, 0]])).toBeNull();
    adapter.dispose();
  });

  it('exposes the state opacity and overlay colour rules', () => {
    expect(partMaterialSpec('framing', 'covered', { coveredShown: true }).opacity).toBe(0.25);
    expect(partMaterialSpec('framing', 'covered', { coveredShown: false }).opacity).toBe(1);
    expect(partMaterialSpec('framing', 'installed', { xray: true }).opacity).toBe(0.15);
    const highlighted = partMaterialSpec('framing', 'installed', { highlighted: true });
    expect(highlighted.emissive).toBe(SELECTION_BLUE);
    expect(highlighted.emissiveIntensity).toBeLessThanOrEqual(0.2);
    const highlightedPreview = partMaterialSpec('framing', 'absent', {
      preview: true,
      highlighted: true,
    });
    expect(highlightedPreview.opacity).toBeGreaterThan(
      partMaterialSpec('framing', 'absent', { preview: true }).opacity,
    );
    expect(overlayColor('proposed')).toBe(0xef4444);
    expect(overlayColor('released')).toBe(0x22c55e);
  });

  it('uses a light, restrained BIM palette with state-aware CAD edges', () => {
    expect(BIM_SCENE.backgroundTop).toBeGreaterThan(0xd0d0d0);
    expect(colorDistance(BIM_SCENE.backgroundTop, tradeColor('framing'))).toBeGreaterThan(45);
    expect(tradeFinish('drywall')).toMatchObject({ roughness: 0.95, metalness: 0 });

    const standard = partEdgeSpec('installed');
    const selected = partEdgeSpec('installed', { highlighted: true });
    const xray = partEdgeSpec('installed', { xray: true });
    const preview = partMaterialSpec('framing', 'absent', { preview: true });
    const previewEdge = partEdgeSpec('absent', { preview: true });
    expect(standard.visible).toBe(true);
    expect(selected.color).toBe(SELECTION_BLUE);
    expect(selected.opacity).toBeGreaterThan(standard.opacity);
    expect(xray.opacity).toBeLessThan(standard.opacity);
    expect(preview.transparent).toBe(true);
    expect(preview.opacity).toBe(BIM_SCENE.plannedPreviewOpacity);
    expect(previewEdge.opacity).toBe(BIM_SCENE.plannedPreviewEdgeOpacity);
    expect(partEdgeSpec('installed', { opening: true }).visible).toBe(false);
  });

  it('maps presentation-only requirement boxes without changing canonical axes or units', () => {
    const spec = requirementPreviewBoxViewerSpec({
      id: 'preview.ex1-target',
      label: 'EX1 target',
      centerMm: [469.9, 1657.35, 20],
      sizeMm: [939.8, 304.8, 20],
      style: 'target',
    });
    expect(spec.center[0]).toBeCloseTo(0.4699, 9);
    expect(spec.center[1]).toBeCloseTo(0.02, 9);
    expect(spec.center[2]).toBeCloseTo(-1.65735, 9);
    expect(spec.size[0]).toBeCloseTo(0.9398, 9);
    expect(spec.size[1]).toBeCloseTo(0.02, 9);
    expect(spec.size[2]).toBeCloseTo(0.3048, 9);
  });

  it('disposes geometries and materials for meshes, edges and nested groups', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial(),
    );
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial(),
    );
    mesh.add(edges);
    group.add(mesh);
    const spies = [
      vi.spyOn(mesh.geometry, 'dispose'),
      vi.spyOn(mesh.material, 'dispose'),
      vi.spyOn(edges.geometry, 'dispose'),
      vi.spyOn(edges.material, 'dispose'),
    ];
    disposeObject3D(group);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });
});
