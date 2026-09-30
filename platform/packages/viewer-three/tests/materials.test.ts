import { describe, expect, it } from 'vitest';
import type { Trade } from '@diyguide/schema';
import {
  BIM_SCENE,
  OVERLAY_COLORS,
  SELECTION_BLUE,
  STATE_OPACITY,
  SUBORDINATE_TONE,
  TRADE_FINISH,
  TRADE_PALETTE,
  blendColor,
  colorDistance,
  isSubordinateRole,
  overlayColor,
  partEdgeSpec,
  partMaterialSpec,
  tradeColor,
  tradeFinish,
} from '../src/index';

const TRADES = Object.keys(TRADE_PALETTE) as Trade[];

function channels(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function luminance(hex: number): number {
  const [red, green, blue] = channels(hex);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function spread(hex: number): number {
  const values = channels(hex);
  return Math.max(...values) - Math.min(...values);
}

describe('BIM workspace visual language', () => {
  it('uses a light, cool, neutral workspace with an understated grid', () => {
    expect(luminance(BIM_SCENE.backgroundTop)).toBeGreaterThan(220);
    expect(luminance(BIM_SCENE.backgroundBottom)).toBeGreaterThan(190);
    for (const stop of [BIM_SCENE.backgroundTop, BIM_SCENE.backgroundBottom]) {
      const [red, , blue] = channels(stop);
      expect(blue, 'background is cool, not warm').toBeGreaterThanOrEqual(red);
    }
    // The grid must never dominate or moire: it stays close to the background tone and faint.
    expect(colorDistance(BIM_SCENE.gridMajor, BIM_SCENE.backgroundBottom)).toBeLessThan(60);
    expect(BIM_SCENE.gridOpacity).toBeLessThanOrEqual(0.4);
    // Edges are thin, dark and neutral.
    expect(luminance(BIM_SCENE.edge)).toBeLessThan(130);
    expect(spread(BIM_SCENE.edge)).toBeLessThan(40);
  });

  it('keeps every trade colour physically restrained and readable on the light canvas', () => {
    for (const trade of TRADES) {
      const color = tradeColor(trade);
      expect(luminance(color), `${trade} luminance`).toBeGreaterThan(80);
      expect(luminance(color), `${trade} luminance`).toBeLessThan(250);
      expect(spread(color), `${trade} saturation is restrained`).toBeLessThan(150);
    }
    // All construction trades keep clear contrast against the workspace; gypsum is the lightest
    // material and relies on its dark CAD edge for separation.
    for (const trade of ['framing', 'cabinetry', 'appliances', 'general', 'electrical'] as Trade[]) {
      expect(colorDistance(tradeColor(trade), BIM_SCENE.backgroundBottom)).toBeGreaterThan(60);
    }
    expect(colorDistance(tradeColor('drywall'), BIM_SCENE.backgroundBottom)).toBeGreaterThan(30);
  });

  it('switches selection to a professional blue outline, not an emissive neon wash', () => {
    const [red, green, blue] = channels(SELECTION_BLUE);
    expect(blue).toBeGreaterThan(red + 60);
    expect(blue).toBeGreaterThan(green + 40);
    expect(luminance(SELECTION_BLUE)).toBeLessThan(150);
    const highlighted = partMaterialSpec('framing', 'installed', { highlighted: true });
    expect(highlighted.emissive).toBe(SELECTION_BLUE);
    expect(highlighted.emissiveIntensity).toBeLessThanOrEqual(0.2);
    expect(colorDistance(highlighted.color, tradeColor('framing'))).toBeLessThan(60);
    const edge = partEdgeSpec('installed', { highlighted: true });
    expect(edge).toEqual({ visible: true, color: SELECTION_BLUE, opacity: 0.95 });
  });

  it('keeps crisp edges for opaque parts and recedes for ghost/xray/opening states', () => {
    expect(partEdgeSpec('installed')).toEqual({
      visible: true,
      color: BIM_SCENE.edge,
      opacity: BIM_SCENE.edgeOpacity,
    });
    expect(partEdgeSpec('installed', { xray: true }).opacity).toBe(BIM_SCENE.edgeOpacityXray);
    expect(partEdgeSpec('covered', { coveredShown: true }).opacity).toBe(
      BIM_SCENE.edgeOpacityGhost,
    );
    expect(partEdgeSpec('removed').opacity).toBe(BIM_SCENE.edgeOpacityGhost);
    expect(partEdgeSpec('installed', { subordinate: true }).opacity).toBe(
      BIM_SCENE.edgeOpacityGhost,
    );
    expect(partEdgeSpec('installed', { opening: true }).visible).toBe(false);
    // Opaque edges stay visible (thin neutral lines) but never fully opaque, so intersections
    // cannot build up an opaque veil.
    expect(BIM_SCENE.edgeOpacity).toBeGreaterThanOrEqual(0.3);
    expect(BIM_SCENE.edgeOpacity).toBeLessThan(0.8);
  });

  it('keeps finishes restrained because no environment map is present', () => {
    for (const trade of TRADES) {
      const finish = tradeFinish(trade);
      expect(finish.roughness).toBeGreaterThanOrEqual(0.3);
      expect(finish.roughness).toBeLessThanOrEqual(1);
      expect(finish.metalness).toBeLessThanOrEqual(0.25);
      expect(TRADE_FINISH[trade]).toEqual(finish);
    }
    expect(tradeFinish('drywall').roughness).toBeGreaterThanOrEqual(0.9);
    expect(tradeFinish('appliances').roughness).toBeLessThan(0.6);
  });

  it('preserves the frozen opacity and overlay colour semantics', () => {
    expect(STATE_OPACITY.opaque).toBe(1);
    expect(STATE_OPACITY.coveredGhost).toBe(0.25);
    expect(STATE_OPACITY.xray).toBe(0.15);
    // Planned/held work is previewed translucent and marked, never applied as installed.
    expect(STATE_OPACITY.plannedPreview).toBeLessThan(1);
    expect(partMaterialSpec('framing', 'absent', { preview: true }).opacity).toBe(
      BIM_SCENE.plannedPreviewOpacity,
    );
    expect(OVERLAY_COLORS).toEqual({ proposed: 0xef4444, released: 0x22c55e });
    expect(overlayColor('proposed')).not.toBe(overlayColor('released'));
    expect(partMaterialSpec('drywall', 'covered', { coveredShown: true }).opacity).toBe(0.25);
    expect(partMaterialSpec('drywall', 'installed', { xray: true }).opacity).toBe(0.15);
    expect(partMaterialSpec('drywall', 'installed').opacity).toBe(1);
  });

  it('recedes existing/reference/clearance objects toward a subordinate tone', () => {
    expect(isSubordinateRole('installed')).toBe(false);
    expect(isSubordinateRole('existing')).toBe(true);
    expect(isSubordinateRole('removed')).toBe(true);
    expect(isSubordinateRole('clearance')).toBe(true);
    const base = tradeColor('framing');
    const spec = partMaterialSpec('framing', 'installed', { subordinate: true });
    expect(spec.color).toBe(blendColor(base, SUBORDINATE_TONE, 0.45));
    expect(colorDistance(spec.color, base)).toBeGreaterThan(30);
    expect(colorDistance(spec.color, base)).toBeLessThan(colorDistance(SUBORDINATE_TONE, base));
  });
});
