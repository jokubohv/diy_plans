/**
 * Operations tests: overlay derivation on the corrected frame fixture.
 *
 * Released frame fastening (40 screws over 20 joints) and anchoring (3 permanent-segment anchors)
 * come from the authored operation points; the held backing connections contribute four proposed
 * points; tool proxies fall back to the first target part's world centre when no points exist.
 */
import { describe, expect, it } from 'vitest';
import { compileBundle } from '../../src/index';
import { FIXTURE_DIR, loadFixture } from '../helpers';

function compiledFixture() {
  const load = loadFixture();
  const { compiled, report } = compileBundle({
    bundle: load.bundle,
    files: load.files,
    rawFiles: load.rawFiles,
    bundleDir: FIXTURE_DIR,
  });
  if (!compiled || !report.ok) throw new Error('fixture did not compile');
  return compiled;
}

const compiled = compiledFixture();

const ANCHOR_POINTS = [
  [499.4, 126.45, 38.1],
  [1109, 126.45, 38.1],
  [2667, 126.45, 38.1],
];

const PROPOSED_BACKING_POINTS = [
  [753.4, 43.9, 1066.8],
  [1159.8, 43.9, 1066.8],
  [1159.8, 43.9, 1066.8],
  [1534.45, 43.9, 1066.8],
];

describe('derived overlays', () => {
  it('emits the stable overlay id set in operation order', () => {
    const expected = [
      'overlay.cut-frame.tool',
      'overlay.layout-frame.tool',
      ...Array.from({ length: 40 }, (_, index) => `overlay.assemble-frame.p${index + 1}`),
      'overlay.assemble-frame.tool',
      'overlay.raise-frame.tool',
      'overlay.anchor-frame.p1',
      'overlay.anchor-frame.p2',
      'overlay.anchor-frame.p3',
      'overlay.anchor-frame.tool',
      'overlay.cut-backing.tool',
      'overlay.position-backing.tool',
      'overlay.fasten-backing.p1',
      'overlay.fasten-backing.p2',
      'overlay.fasten-backing.p3',
      'overlay.fasten-backing.p4',
      'overlay.route-cable.route',
    ];
    expect(compiled.overlays.map((overlay) => overlay.id)).toEqual(expected);
    expect(compiled.overlays).toHaveLength(55);
  });

  it('releases the 40 frame screw points at the authored joints', () => {
    const points = compiled.overlays.filter(
      (overlay) => overlay.operationId === 'op.assemble-frame' && overlay.kind === 'fastener_point',
    );
    expect(points).toHaveLength(40);
    expect(points.map((point) => point.state)).toEqual(Array(40).fill('released'));
    // Representative joints: first bottom-plate pair, first top-plate pair, header and cripple.
    expect(points[0]!.positionMm).toEqual([366.05, 86.45, 38.1]);
    expect(points[1]!.positionMm).toEqual([366.05, 166.45, 38.1]);
    expect(points[16]!.positionMm).toEqual([366.05, 86.45, 2438.4]);
    expect(points[28]!.positionMm).toEqual([1572.55, 101.05, 2110.1]);
    expect(points[39]!.positionMm).toEqual([2226.6, 151.45, 2390.3]);
    for (const point of points) {
      expect(point.partId).toBe('part.wall-a.bottom-plate');
      expect(point.inTakeoff).toBe(false);
      expect(point.label.toLowerCase()).toContain('fastener point');
      expect(point.label.toLowerCase()).not.toContain('proposed');
    }
  });

  it('releases the three permanent-segment anchor points', () => {
    const points = compiled.overlays.filter(
      (overlay) => overlay.operationId === 'op.anchor-frame' && overlay.kind === 'fastener_point',
    );
    expect(points).toHaveLength(3);
    expect(points.map((point) => point.state)).toEqual(Array(3).fill('released'));
    expect(points.map((point) => point.positionMm)).toEqual(ANCHOR_POINTS);
    for (const point of points) expect(point.inTakeoff).toBe(false);
  });

  it('keeps the held backing points proposed at the connection locations', () => {
    const points = compiled.overlays.filter((overlay) => overlay.operationId === 'op.fasten-backing');
    expect(points).toHaveLength(4);
    expect(points.map((point) => point.state)).toEqual(Array(4).fill('proposed'));
    expect(points.map((point) => point.positionMm)).toEqual(PROPOSED_BACKING_POINTS);
    // Each pair belongs to its own connection's block.
    expect(points.map((point) => point.partId)).toEqual([
      'part.wall-a.backing-a',
      'part.wall-a.backing-a',
      'part.wall-a.backing-b',
      'part.wall-a.backing-b',
    ]);
    for (const point of points) {
      expect(point.kind).toBe('fastener_point');
      expect(point.inTakeoff).toBe(false);
      expect(point.label.toLowerCase()).toContain('proposed');
    }
  });

  it('releases the ready route path and keeps overlay geometry off takeoff', () => {
    const route = compiled.overlays.find((overlay) => overlay.id === 'overlay.route-cable.route')!;
    expect(route.kind).toBe('route_path');
    expect(route.state).toBe('released');
    expect(route.partId).toBe('part.demo.cable');
    expect(route.radiusMm).toBe(12.7);
    expect(route.pathPointsMm).toEqual([
      [152.4, 120, 1651],
      [152.4, 120, 2159],
      [990.6, 120, 2159],
      [990.6, 120, 1727.2],
    ]);
    for (const overlay of compiled.overlays) expect(overlay.inTakeoff).toBe(false);
  });

  it('emits released tool proxies with sensible positions', () => {
    // No explicit points: proxies fall back to the first target part's world centre
    // (continuous bottom plate: assembly (347, 82, 0) + local (1219.2, 44.45, 19.05)).
    const cutTool = compiled.overlays.find((overlay) => overlay.id === 'overlay.cut-frame.tool')!;
    expect(cutTool.toolId).toBe('tool.miter-saw');
    expect(cutTool.state).toBe('released');
    expect(cutTool.positionMm).toEqual([1566.2, 126.45, 19.05]);

    const layoutTool = compiled.overlays.find((overlay) => overlay.id === 'overlay.layout-frame.tool')!;
    expect(layoutTool.toolId).toBe('tool.pencil');
    expect(layoutTool.positionMm).toEqual([1566.2, 126.45, 19.05]);

    const assembleTool = compiled.overlays.find((overlay) => overlay.id === 'overlay.assemble-frame.tool')!;
    expect(assembleTool.toolId).toBe('tool.driver');
    expect(assembleTool.positionMm).toEqual([366.05, 86.45, 38.1]);

    const raiseTool = compiled.overlays.find((overlay) => overlay.id === 'overlay.raise-frame.tool')!;
    expect(raiseTool.toolId).toBe('tool.level');
    expect(raiseTool.positionMm).toEqual([1566.2, 126.45, 19.05]);

    const anchorTool = compiled.overlays.find((overlay) => overlay.id === 'overlay.anchor-frame.tool')!;
    expect(anchorTool.toolId).toBe('tool.drill');
    expect(anchorTool.positionMm).toEqual(ANCHOR_POINTS[0]);
  });

  it('keeps the conditional backing tool proxies proposed', () => {
    const cutTool = compiled.overlays.find((overlay) => overlay.id === 'overlay.cut-backing.tool')!;
    expect(cutTool.toolId).toBe('tool.miter-saw');
    expect(cutTool.state).toBe('proposed'); // conditional preview
    const positionTool = compiled.overlays.find((overlay) => overlay.id === 'overlay.position-backing.tool')!;
    expect(positionTool.toolId).toBe('tool.level');
    expect(positionTool.state).toBe('proposed'); // conditional: inherits the condition from op.cut-backing
    // Block A world centre = assembly (347, 82, 0) + local (609.6, -19.05, 1066.8).
    const position = positionTool.positionMm!;
    expect(position[0]).toBeCloseTo(956.6, 3);
    expect(position[1]).toBeCloseTo(62.95, 3);
    expect(position[2]).toBeCloseTo(1066.8, 3);
  });
});
