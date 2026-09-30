/**
 * BIM visual language for the local three.js adapter: a light neutral workspace, restrained
 * physical trade materials, CAD-style edges and a professional blue selection. Values are plain
 * hex numbers (no three.js import) so the rules stay unit-testable and reusable by UI code.
 *
 * Frozen safety semantics are preserved exactly: covered ghosts stay at 0.25, x-ray stays at 0.15
 * and the proposed/released overlay colours stay red/green (status is never colour-only; the UI,
 * wireframe rule and text carry the same distinction).
 */
import type { PartRole, PartState, Trade } from '@diyguide/schema';

/**
 * Scene presentation constants. Everything here is presentation-only: grids, backdrop and ground
 * are excluded from picking, bounds, measurement, IFC and takeoff.
 */
export const BIM_SCENE = {
  /** Screen-space background gradient, top (sky) to bottom (floor plane area). */
  backgroundTop: 0xe9eff5,
  backgroundBottom: 0xd2dbe4,
  gridMajor: 0xc8d1da,
  gridMinor: 0xd6dee6,
  gridOpacity: 0.3,
  groundShadowOpacity: 0.16,
  edge: 0x4a545e,
  edgeOpacity: 0.45,
  edgeOpacityGhost: 0.14,
  edgeOpacityXray: 0.08,
  selection: 0x1565c0,
  selectionEdgeOpacity: 0.95,
  focus: 0x436b89,
  focusEdgeOpacity: 0.68,
  selectionEmissiveIntensity: 0.16,
  /** Selection fill tint: how far the trade colour moves toward the selection blue. */
  selectionTint: 0.12,
  plannedPreview: 0x6f8295,
  plannedPreviewOpacity: 0.42,
  plannedPreviewEdgeOpacity: 0.58,
} as const;

/** Base colours by trade: physically plausible, restrained AEC materials on a light workspace. */
export const TRADE_PALETTE: Record<Trade, number> = {
  general: 0x9aa5b1,
  framing: 0xd8b98a,
  drywall: 0xf0ece4,
  electrical: 0xc9a24d,
  plumbing: 0x86a7c0,
  cabinetry: 0xc7a179,
  appliances: 0x9fa9b3,
  finishes: 0xb9a88e,
};

/** Restrained finish per trade (no physically-based env map is present, so metalness stays low). */
export interface TradeFinish {
  roughness: number;
  metalness: number;
}

export const TRADE_FINISH: Record<Trade, TradeFinish> = {
  general: { roughness: 0.85, metalness: 0.04 },
  framing: { roughness: 0.8, metalness: 0.02 },
  drywall: { roughness: 0.95, metalness: 0.0 },
  electrical: { roughness: 0.6, metalness: 0.2 },
  plumbing: { roughness: 0.55, metalness: 0.18 },
  cabinetry: { roughness: 0.7, metalness: 0.04 },
  appliances: { roughness: 0.45, metalness: 0.15 },
  finishes: { roughness: 0.8, metalness: 0.04 },
};

/** Frozen state opacity rules: covered ghosts 0.25 when shown, xray 0.15, otherwise opaque. */
export const STATE_OPACITY = {
  opaque: 1,
  coveredGhost: 0.25,
  xray: 0.15,
  plannedPreview: BIM_SCENE.plannedPreviewOpacity,
} as const;

/** Overlay colours: proposed work is red, released work is solid green (frozen contract). */
export const OVERLAY_COLORS = {
  proposed: 0xef4444,
  released: 0x22c55e,
} as const;

/** Professional selection accent used for outlines and a faint fill tint (not a neon wash). */
export const SELECTION_BLUE = BIM_SCENE.selection;

/** Backwards-compatible alias; selection is no longer an emissive highlight. */
export const HIGHLIGHT_EMISSIVE = SELECTION_BLUE;

/** Neutral tone that existing/reference/schematic objects recede toward. */
export const SUBORDINATE_TONE = 0x8e98a2;

/** Roles that are subordinate to active construction. */
export function isSubordinateRole(role: PartRole): boolean {
  return role !== 'installed';
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function channels(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function toHex(red: number, green: number, blue: number): number {
  return (clampChannel(red) << 16) | (clampChannel(green) << 8) | clampChannel(blue);
}

/** Linear per-channel blend of two hex colours (0 = base, 1 = target). */
export function blendColor(base: number, target: number, amount: number): number {
  const ratio = Math.max(0, Math.min(1, amount));
  const [b0, b1, b2] = channels(base);
  const [t0, t1, t2] = channels(target);
  return toHex(
    b0 + (t0 - b0) * ratio,
    b1 + (t1 - b1) * ratio,
    b2 + (t2 - b2) * ratio,
  );
}

/** Colour distance helper for UI/tests (0 = identical). */
export function colorDistance(a: number, b: number): number {
  const [a0, a1, a2] = channels(a);
  const [b0, b1, b2] = channels(b);
  return Math.sqrt((a0 - b0) ** 2 + (a1 - b1) ** 2 + (a2 - b2) ** 2);
}

export function tradeColor(trade: Trade): number {
  return TRADE_PALETTE[trade] ?? TRADE_PALETTE.general;
}

export function tradeFinish(trade: Trade): TradeFinish {
  return TRADE_FINISH[trade] ?? TRADE_FINISH.general;
}

export function overlayColor(state: 'proposed' | 'released'): number {
  return OVERLAY_COLORS[state];
}

export interface PartMaterialOptions {
  /** Part is in the xray set: rendered transparent. */
  xray?: boolean;
  /** Part state is `covered` and the user asked to show covered parts: ghosted. */
  coveredShown?: boolean;
  /** Part is selected or emphasized: faint blue fill tint plus a blue edge outline. */
  highlighted?: boolean;
  /** Part belongs to the active operation; quieter than an explicit user selection. */
  focused?: boolean;
  /** Opening elements render as a translucent void instead of solid material. */
  opening?: boolean;
  /** Absent geometry shown only as labeled planned context for the current operation. */
  preview?: boolean;
  /** Existing/reference/clearance part: colour recedes toward the subordinate tone. */
  subordinate?: boolean;
}

export interface PartMaterialSpec {
  color: number;
  opacity: number;
  transparent: boolean;
  wireframe: boolean;
  emissive: number;
  emissiveIntensity: number;
}

/** Resolve the render material parameters for a part in a given state. */
export function partMaterialSpec(
  trade: Trade,
  state: PartState,
  options: PartMaterialOptions = {},
): PartMaterialSpec {
  let opacity: number = STATE_OPACITY.opaque;
  if (options.xray) opacity = STATE_OPACITY.xray;
  else if (options.preview) opacity = STATE_OPACITY.plannedPreview;
  else if (state === 'covered' && options.coveredShown) opacity = STATE_OPACITY.coveredGhost;
  const highlighted = options.highlighted ?? false;
  if (highlighted) opacity = Math.max(opacity, 0.72);
  if (options.opening) {
    // Openings read as voids: translucent slate outline at the host face.
    return {
      color: 0x6b7a8c,
      opacity: Math.min(opacity, 0.35),
      transparent: true,
      wireframe: true,
      emissive: 0x000000,
      emissiveIntensity: 0,
    };
  }
  const base = tradeColor(trade);
  let color = options.subordinate ? blendColor(base, SUBORDINATE_TONE, 0.45) : base;
  if (options.preview) color = blendColor(color, BIM_SCENE.plannedPreview, 0.38);
  if (options.focused) color = blendColor(color, BIM_SCENE.focus, 0.08);
  if (highlighted) color = blendColor(color, SELECTION_BLUE, BIM_SCENE.selectionTint);
  return {
    color,
    opacity,
    transparent: opacity < 1,
    wireframe: false,
    emissive: highlighted ? SELECTION_BLUE : 0x000000,
    emissiveIntensity: highlighted ? BIM_SCENE.selectionEmissiveIntensity : 0,
  };
}

export interface PartEdgeSpec {
  visible: boolean;
  color: number;
  opacity: number;
}

/**
 * CAD-style edge rule for opaque box geometry. Edges stay crisp on the light workspace, recede for
 * ghost/xray/covered states and switch to the professional blue outline when selected so edge
 * clutter never turns into an opaque veil.
 */
export function partEdgeSpec(
  state: PartState,
  options: PartMaterialOptions = {},
): PartEdgeSpec {
  if (options.opening) return { visible: false, color: BIM_SCENE.edge, opacity: 0 };
  if (options.highlighted) {
    return { visible: true, color: SELECTION_BLUE, opacity: BIM_SCENE.selectionEdgeOpacity };
  }
  if (options.preview) {
    return {
      visible: true,
      color: BIM_SCENE.plannedPreview,
      opacity: BIM_SCENE.plannedPreviewEdgeOpacity,
    };
  }
  if (options.focused) {
    return { visible: true, color: BIM_SCENE.focus, opacity: BIM_SCENE.focusEdgeOpacity };
  }
  if (options.xray) {
    return { visible: true, color: BIM_SCENE.edge, opacity: BIM_SCENE.edgeOpacityXray };
  }
  if (state === 'covered' && options.coveredShown) {
    return { visible: true, color: BIM_SCENE.edge, opacity: BIM_SCENE.edgeOpacityGhost };
  }
  if (state === 'removed') {
    return { visible: true, color: BIM_SCENE.edge, opacity: BIM_SCENE.edgeOpacityGhost };
  }
  if (options.subordinate) {
    return { visible: true, color: BIM_SCENE.edge, opacity: BIM_SCENE.edgeOpacityGhost };
  }
  return { visible: true, color: BIM_SCENE.edge, opacity: BIM_SCENE.edgeOpacity };
}
