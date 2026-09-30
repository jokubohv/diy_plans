/**
 * Local development ViewerAdapter implementation using three.js (Y-up metres) over the
 * canonical Z-up millimetre model. This is a P0 comparison implementation, not the final
 * engine decision (docs/architecture.md section 8).
 *
 * Frame conversion happens exactly once, at this boundary: part world matrices go through
 * canonicalMatrixToViewer, picked points come back through viewerToCanonical and cameras and
 * section planes go through their dedicated frame helpers.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  CompiledGuide,
  OverlayObject,
  Part,
  PartState,
  PartStateEntry,
  PresentationRecipe,
  Vec3,
} from '@diyguide/schema';
import { measureCanonicalPoints } from '@diyguide/viewer-core';
import type {
  ApplyOptions,
  LoadInput,
  MeasurementResult,
  OverlayState,
  PickPoint,
  ProjectCamera,
  SectionPlane,
  ViewerAdapter,
  ViewerCapabilities,
  VisibilityState,
} from '@diyguide/viewer-core';
import {
  canonicalCameraToViewer,
  canonicalMatrixToViewer,
  canonicalPointToViewer,
  canonicalSectionToThreePlane,
  canonicalToViewer,
  viewerToCanonical,
  canonicalAxisToViewer,
  matrixRotationAboutPivot,
} from './frame';
import {
  BIM_SCENE,
  isSubordinateRole,
  overlayColor,
  partEdgeSpec,
  partMaterialSpec,
  tradeFinish,
} from './materials';
import { selectionDimensionDisplay } from './selectionDimensions';

/** three.js revision shipped by the workspace dependency (see architecture evidence README). */
export const THREE_VERSION = THREE.REVISION;

const ANIMATION_MS = 400;
const MM = 0.001;
const FASTENER_POINT_RADIUS_M = 0.02;
const ROUTE_RADIUS_FALLBACK_MM = 12;
const TOOL_PROXY_SIZE_M = 0.08;

type RequirementPreviewBox = NonNullable<PresentationRecipe['requirementPreview']>['boxes'][number];

/** Convert one canonical Z-up requirement box into a scene-level three.js Y-up box specification. */
export function requirementPreviewBoxViewerSpec(box: RequirementPreviewBox): {
  center: Vec3;
  size: Vec3;
} {
  return {
    center: canonicalPointToViewer(box.centerMm),
    size: [box.sizeMm[0] * MM, box.sizeMm[2] * MM, box.sizeMm[1] * MM],
  };
}

/**
 * Dispose every geometry/material in a subtree (meshes, lines, line segments, points, sprites).
 * Exported so disposal can be unit-tested without a WebGL context.
 */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((child) => {
    const geometry = (child as Partial<THREE.Mesh>).geometry;
    if (geometry && typeof geometry.dispose === 'function') geometry.dispose();
    const material = (child as Partial<THREE.Mesh>).material;
    if (Array.isArray(material)) {
      for (const entry of material) entry?.dispose?.();
    } else if (material && typeof material.dispose === 'function') {
      material.dispose();
    }
  });
}

/**
 * Screen-space cool-gray gradient backdrop (1x2 DataTexture stretched full screen). A light
 * neutral workspace reads as a professional BIM viewport; the texture is disposed with the scene.
 */
function createBackgroundTexture(): THREE.DataTexture {
  const top = new THREE.Color(BIM_SCENE.backgroundTop);
  const bottom = new THREE.Color(BIM_SCENE.backgroundBottom);
  const toByte = (value: number): number => Math.round(value * 255);
  const rows = [
    // DataTexture row 0 maps to texture v=0 (the bottom of the screen).
    [toByte(bottom.r), toByte(bottom.g), toByte(bottom.b), 255],
    [toByte(top.r), toByte(top.g), toByte(top.b), 255],
  ];
  const data = new Uint8Array(rows.flat());
  const texture = new THREE.DataTexture(data, 1, 2, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createThreeAdapter(): ViewerAdapter {
  type CompiledPart = CompiledGuide['parts'][number];

  const capabilities: ViewerCapabilities = {
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
  };

  let compiled: CompiledGuide | null = null;
  let container: HTMLElement | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let controls: OrbitControls | null = null;
  let viewportChrome: HTMLElement | null = null;
  let viewportPreviewLabel: HTMLElement | null = null;
  let viewportSelectionDimensions: HTMLElement | null = null;
  let fullscreenDocument: Document | null = null;
  let fullscreenChangeHandler: (() => void) | null = null;
  let fullscreenKeyHandler: ((event: KeyboardEvent) => void) | null = null;
  let fallbackFullscreen = false;
  let resizeObserver: ResizeObserver | null = null;
  let rafId: number | null = null;
  let disposed = false;

  const partsById = new Map<string, CompiledPart>();
  const partObjects = new Map<string, THREE.Object3D>();
  const partMeshes = new Map<string, THREE.Mesh[]>();
  const partEdgeMaterials = new Map<string, THREE.LineBasicMaterial[]>();
  const baseMeshPoses = new Map<THREE.Mesh, { position: THREE.Vector3; scale: THREE.Vector3 }>();
  const baseMatrices = new Map<string, THREE.Matrix4>();
  let stateByPart = new Map<string, PartState>();
  let visibility: VisibilityState = {
    isolatedPartIds: [],
    xrayPartIds: [],
    hiddenPartIds: [],
    showCovered: false,
  };
  const selectedPartIds = new Set<string>();
  const emphasizedPartIds = new Set<string>();
  const revealedPartIds = new Set<string>();
  let selectionMode: 'select' | 'measure' = 'select';

  let overlayGroup: THREE.Group | null = null;
  let requirementPreviewGroup: THREE.Group | null = null;
  let routeTubes: Array<{ partId: string | null; mesh: THREE.Mesh }> = [];
  let fastenerMeshes: Array<{ overlayId: string; state: 'proposed' | 'released'; mesh: THREE.Mesh }> = [];
  let toolProxyMesh: THREE.Mesh | null = null;
  let shadowLight: THREE.DirectionalLight | null = null;
  let backgroundTexture: THREE.DataTexture | null = null;
  let currentSchematicElevation: NonNullable<PresentationRecipe['schematicElevation']> | null = null;
  let navigationFloorY = 0;

  interface PendingAnimation {
    startedAt: number;
    durationMs: number;
    translatePartId: string | null;
    offsetViewer: THREE.Vector3 | null;
    revealPartId: string | null;
  }
  let animation: PendingAnimation | null = null;

  const selectionHandlers = new Set<(partIds: string[]) => void>();
  const pickHandlers = new Set<(point: PickPoint) => void>();
  const errorHandlers = new Set<(message: string, detail?: string) => void>();
  const readyHandlers = new Set<() => void>();

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  function createPartMaterial(part: Part): THREE.MeshStandardMaterial {
    const spec = partMaterialSpec(part.trade, part.initialState, {
      opening: part.kind === 'opening',
      subordinate: part.kind !== 'opening' && isSubordinateRole(part.role),
    });
    const finish = tradeFinish(part.trade);
    return new THREE.MeshStandardMaterial({
      color: spec.color,
      opacity: spec.opacity,
      transparent: spec.transparent,
      wireframe: spec.wireframe,
      emissive: spec.emissive,
      emissiveIntensity: spec.emissiveIntensity,
      roughness: finish.roughness,
      metalness: finish.metalness,
      side: THREE.DoubleSide,
    });
  }

  function buildPartMeshes(part: Part): THREE.Mesh[] {
    // Frame contract (architecture.md section 2): the part group matrix already applies the
    // canonical (Z-up mm) -> viewer (Y-up m) conversion S * M. Geometry is therefore built in
    // canonical millimetres inside the group; only scene-level overlays convert points.
    const geometry = part.geometry;
    if (geometry.shape === 'box') {
      const [sizeX, sizeY, sizeZ] = geometry.sizeMm;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(sizeX, sizeY, sizeZ),
        createPartMaterial(part),
      );
      if (part.kind !== 'opening') {
        // Crisp CAD-style silhouette edges. Presentation-only: non-pickable, excluded from
        // takeoff/IFC, and state-aware in applyRenderPolicy.
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(mesh.geometry, 30),
          new THREE.LineBasicMaterial({
            color: BIM_SCENE.edge,
            transparent: true,
            opacity: BIM_SCENE.edgeOpacity,
            depthWrite: false,
          }),
        );
        edges.userData.isPresentation = true;
        edges.raycast = () => {};
        mesh.add(edges);
      }
      return [mesh];
    }
    if (geometry.shape === 'path') {
      if (geometry.pointsMm.length < 2) return [];
      const points = geometry.pointsMm.map((point) => new THREE.Vector3(point[0], point[1], point[2]));
      const curve =
        points.length === 2
          ? new THREE.LineCurve3(points[0]!, points[1]!)
          : new THREE.CatmullRomCurve3(points);
      const radius = geometry.radiusMm ?? ROUTE_RADIUS_FALLBACK_MM;
      const tube = new THREE.TubeGeometry(curve, Math.max(8, (points.length - 1) * 8), radius, 8, false);
      return [new THREE.Mesh(tube, createPartMaterial(part))];
    }
    // markers are typically presentation overlays, but a part with marker geometry still needs
    // a pickable object.
    const markerRadius = geometry.markerRadiusMm ?? ROUTE_RADIUS_FALLBACK_MM;
    return geometry.pointsMm.map((point) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(markerRadius, 12, 8),
        createPartMaterial(part),
      );
      mesh.position.set(point[0], point[1], point[2]);
      return mesh;
    });
  }

  function buildParts(guide: CompiledGuide): void {
    if (!scene) return;
    for (const part of guide.parts) {
      partsById.set(part.id, part);
      const object = new THREE.Group();
      object.matrixAutoUpdate = false;
      object.matrix.fromArray(canonicalMatrixToViewer(part.worldTransform));
      object.updateMatrixWorld(true);
      object.userData.partId = part.id;
      const meshes = buildPartMeshes(part);
      for (const mesh of meshes) {
        mesh.userData.partId = part.id;
        baseMeshPoses.set(mesh, {
          position: mesh.position.clone(),
          scale: mesh.scale.clone(),
        });
        object.add(mesh);
      }
      const edgeMaterials: THREE.LineBasicMaterial[] = [];
      for (const mesh of meshes) {
        for (const child of mesh.children) {
          if (
            child instanceof THREE.LineSegments &&
            child.material instanceof THREE.LineBasicMaterial
          ) {
            edgeMaterials.push(child.material);
          }
        }
      }
      if (edgeMaterials.length > 0) partEdgeMaterials.set(part.id, edgeMaterials);
      partObjects.set(part.id, object);
      partMeshes.set(part.id, meshes);
      baseMatrices.set(part.id, object.matrix.clone());
      scene.add(object);
    }
  }

  function modelBounds(): THREE.Box3 {
    const bounds = new THREE.Box3();
    for (const part of partsById.values()) {
      const { min, max } = part.boundsMm;
      const corners: Vec3[] = [
        [min[0], min[1], min[2]],
        [min[0], min[1], max[2]],
        [min[0], max[1], min[2]],
        [min[0], max[1], max[2]],
        [max[0], min[1], min[2]],
        [max[0], min[1], max[2]],
        [max[0], max[1], min[2]],
        [max[0], max[1], max[2]],
      ];
      for (const corner of corners) {
        bounds.expandByPoint(new THREE.Vector3(...canonicalPointToViewer(corner)));
      }
    }
    if (currentSchematicElevation) {
      const elevatedIds = new Set([
        ...currentSchematicElevation.studPartIds,
        ...currentSchematicElevation.topPlatePartIds,
        ...(currentSchematicElevation.panelPartIds ?? []),
        ...(currentSchematicElevation.contextPartIds ?? []),
      ]);
      for (const partId of elevatedIds) {
        const part = partsById.get(partId);
        if (!part) continue;
        for (const z of [0, currentSchematicElevation.overallHeightMm]) {
          bounds.expandByPoint(
            new THREE.Vector3(
              ...canonicalPointToViewer([part.boundsMm.min[0], part.boundsMm.min[1], z]),
            ),
          );
          bounds.expandByPoint(
            new THREE.Vector3(
              ...canonicalPointToViewer([part.boundsMm.max[0], part.boundsMm.max[1], z]),
            ),
          );
        }
      }
    }
    return bounds;
  }

  /** Bounds of the current visual focus, falling back to all visible parts and then the model. */
  function navigationBounds(): THREE.Box3 {
    const boundsFor = (partIds: Iterable<string>): THREE.Box3 => {
      const bounds = new THREE.Box3();
      for (const partId of partIds) {
        const object = partObjects.get(partId);
        if (!object || !isEffectivelyVisible(object)) continue;
        const meshes = partMeshes.get(partId) ?? [];
        if (!meshes.some((mesh) => isEffectivelyVisible(mesh))) continue;
        bounds.expandByObject(object, true);
      }
      return bounds;
    };
    const focused = boundsFor(emphasizedPartIds);
    if (!focused.isEmpty()) return focused;
    const visible = boundsFor(partObjects.keys());
    return visible.isEmpty() ? modelBounds() : visible;
  }

  function resetMeshPresentationPoses(): void {
    for (const [mesh, pose] of baseMeshPoses) {
      mesh.position.copy(pose.position);
      mesh.scale.copy(pose.scale);
      mesh.userData.isSchematicElevation = false;
      mesh.userData.isNonCanonicalPresentation = false;
      mesh.updateMatrix();
    }
  }

  /**
   * Raise plan-footprint boxes only for the interactive schematic view. Source bounds and group
   * matrices are untouched, so dimensions, picking coordinates, takeoff and IFC stay canonical.
   */
  function applySchematicElevation(
    elevation: NonNullable<PresentationRecipe['schematicElevation']>,
  ): void {
    const poseBox = (partId: string, bottomMm: number, topMm: number): void => {
      const part = partsById.get(partId);
      if (!part || part.geometry.shape !== 'box') return;
      const originalHeight = part.geometry.sizeMm[2];
      if (originalHeight <= 0 || topMm <= bottomMm) return;
      const sourceCenterZ = (part.boundsMm.min[2] + part.boundsMm.max[2]) / 2;
      const targetCenterZ = (bottomMm + topMm) / 2;
      for (const mesh of partMeshes.get(partId) ?? []) {
        const base = baseMeshPoses.get(mesh);
        if (!base) continue;
        mesh.position.copy(base.position);
        mesh.position.z += targetCenterZ - sourceCenterZ;
        mesh.scale.copy(base.scale);
        mesh.scale.z *= (topMm - bottomMm) / originalHeight;
        mesh.userData.isSchematicElevation = true;
        mesh.userData.isNonCanonicalPresentation = true;
        mesh.updateMatrix();
      }
    };

    const studBottom = elevation.bottomPlateThicknessMm;
    const studTop = elevation.overallHeightMm - elevation.topPlateThicknessMm;
    for (const partId of elevation.studPartIds) poseBox(partId, studBottom, studTop);
    for (const partId of elevation.topPlatePartIds) {
      poseBox(partId, studTop, elevation.overallHeightMm);
    }
    for (const partId of elevation.panelPartIds ?? []) {
      poseBox(partId, 0, elevation.overallHeightMm);
    }
    for (const partId of elevation.contextPartIds ?? []) {
      poseBox(partId, 0, elevation.overallHeightMm);
    }
  }

  function applyBoxTransforms(
    transforms: NonNullable<PresentationRecipe['boxTransforms']>,
  ): void {
    for (const transform of transforms) {
      for (const mesh of partMeshes.get(transform.partId) ?? []) {
        const base = baseMeshPoses.get(mesh);
        if (!base) continue;
        mesh.position.copy(base.position);
        if (transform.offsetMm) {
          mesh.position.x += transform.offsetMm[0];
          mesh.position.y += transform.offsetMm[1];
          mesh.position.z += transform.offsetMm[2];
        }
        mesh.scale.copy(base.scale);
        if (transform.scale) {
          mesh.scale.x *= transform.scale[0];
          mesh.scale.y *= transform.scale[1];
          mesh.scale.z *= transform.scale[2];
        }
        mesh.userData.isNonCanonicalPresentation = true;
        mesh.updateMatrix();
      }
    }
  }

  function fitAll(): void {
    if (!camera || !controls) return;
    const bounds = navigationBounds();
    camera.up.set(0, 1, 0);
    if (bounds.isEmpty()) {
      camera.position.set(3, 2.5, 3);
      controls.target.set(0, 0, 0);
    } else {
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const radius = Math.max(size.length() * 0.5, 0.5);
      // Fit against the tighter of vertical/horizontal FOV so the model keeps comfortable margins
      // at every aspect ratio, with a stable near/far range that cannot clip while orbiting.
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const distance = (radius / Math.tan(Math.min(vFov, hFov) / 2)) * 1.15;
      const direction = new THREE.Vector3(1, 0.75, 1).normalize();
      camera.position.copy(center).addScaledVector(direction, distance);
      camera.near = Math.max(0.005, radius * 0.005);
      camera.far = Math.max(distance * 20, radius * 200);
      camera.updateProjectionMatrix();
      controls.target.copy(center);
      controls.minDistance = Math.max(0.1, radius * 0.05);
      controls.maxDistance = Math.max(10, distance * 8);
    }
    controls.update();
  }

  /**
   * Return to an upright, human-height orbit without changing the model or its canonical data.
   * Horizontal direction is retained when practical, so the button works as a stable transition
   * from plan/elevation views as well as from a user-created orbit.
   */
  function setEyeLevel(): void {
    if (!camera || !controls) return;
    const bounds = navigationBounds();
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const horizontalSize = Math.max(size.x, size.z, 1);
    const eyeHeight = Math.min(Math.max(size.y * 0.58, 1.25), 1.7);
    const lookHeight = Math.min(Math.max(size.y * 0.45, 0.9), 1.4);
    const target = new THREE.Vector3(center.x, navigationFloorY + lookHeight, center.z);
    const horizontalDirection = camera.position.clone().sub(controls.target);
    horizontalDirection.y = 0;
    if (horizontalDirection.lengthSq() < 0.01) horizontalDirection.set(1, 0, 1);
    horizontalDirection.normalize();
    const distance = Math.min(Math.max(horizontalSize * 0.72, 1.6), 6);

    camera.up.set(0, 1, 0);
    camera.position.copy(target).addScaledVector(horizontalDirection, distance);
    camera.position.y = navigationFloorY + eyeHeight;
    controls.target.copy(target);
    camera.near = Math.max(0.005, distance / 500);
    camera.far = Math.max(distance * 25, horizontalSize * 100);
    camera.updateProjectionMatrix();
    controls.update();
  }

  /** Keep orbit/pan interaction above the presentation floor while still permitting look-up. */
  function constrainNavigationToFloor(): void {
    if (!camera || !controls) return;
    controls.target.y = Math.max(controls.target.y, navigationFloorY);
    camera.position.y = Math.max(camera.position.y, navigationFloorY + 0.04);
  }

  function updateViewportSelectionDimensions(): void {
    if (!viewportSelectionDimensions || !compiled) return;
    const partId = selectedPartIds.values().next().value as string | undefined;
    const part = partId ? partsById.get(partId) : null;
    const dimensionDisplay = part
      ? selectionDimensionDisplay(part, currentSchematicElevation, compiled.project.display)
      : null;
    if (!part || !dimensionDisplay) {
      viewportSelectionDimensions.hidden = true;
      viewportSelectionDimensions.replaceChildren();
      return;
    }

    const doc = viewportSelectionDimensions.ownerDocument;
    const heading = doc.createElement('div');
    heading.className = 'viewer-selection-heading';
    const headingText = doc.createElement('div');
    const kicker = doc.createElement('span');
    kicker.className = 'viewer-selection-kicker';
    kicker.textContent = dimensionDisplay.memberType;
    const name = doc.createElement('strong');
    name.className = 'viewer-selection-name';
    name.textContent = part.name;
    headingText.append(kicker, name);
    const selectedMark = doc.createElement('span');
    selectedMark.className = 'viewer-selection-mark';
    selectedMark.textContent = 'Selected';
    heading.append(headingText, selectedMark);

    const dimensions = doc.createElement('dl');
    dimensions.className = 'viewer-selection-grid';
    for (const dimension of dimensionDisplay.dimensions) {
      const item = doc.createElement('div');
      const label = doc.createElement('dt');
      label.textContent = dimension.label;
      const value = doc.createElement('dd');
      value.textContent = dimension.value;
      item.append(label, value);
      dimensions.appendChild(item);
    }

    const details: HTMLElement[] = [];
    if (dimensionDisplay.statusLabel) {
      const status = doc.createElement('p');
      status.className = 'viewer-selection-status';
      status.textContent = dimensionDisplay.statusLabel;
      details.push(status);
    }
    if (dimensionDisplay.note) {
      const note = doc.createElement('p');
      note.className = 'viewer-selection-note';
      note.textContent = dimensionDisplay.note;
      details.push(note);
    }
    viewportSelectionDimensions.replaceChildren(heading, dimensions, ...details);
    viewportSelectionDimensions.hidden = false;
  }

  /** Accessible viewport chrome stays outside WebGL and never participates in model interaction. */
  function mountViewportChrome(): void {
    if (!container || viewportChrome) return;
    const doc = container.ownerDocument;
    const chrome = doc.createElement('div');
    chrome.className = 'viewer-viewport-chrome';

    const toolbar = doc.createElement('div');
    toolbar.className = 'viewer-viewport-tools';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', '3D view controls');

    const fitButton = doc.createElement('button');
    fitButton.type = 'button';
    fitButton.className = 'viewer-fit-button';
    fitButton.dataset.testid = 'viewer-fit-model';
    fitButton.textContent = 'Fit model';
    fitButton.title = 'Fit the complete model in the viewport';
    fitButton.addEventListener('click', fitAll);
    toolbar.appendChild(fitButton);

    const eyeLevelButton = doc.createElement('button');
    eyeLevelButton.type = 'button';
    eyeLevelButton.className = 'viewer-fit-button';
    eyeLevelButton.dataset.testid = 'viewer-eye-level';
    eyeLevelButton.textContent = 'Eye level';
    eyeLevelButton.title = 'Return to a floor-anchored, upright room view';
    eyeLevelButton.addEventListener('click', setEyeLevel);
    toolbar.appendChild(eyeLevelButton);

    const fullscreenButton = doc.createElement('button');
    fullscreenButton.type = 'button';
    fullscreenButton.className = 'viewer-fit-button';
    fullscreenButton.dataset.testid = 'viewer-fullscreen';
    fullscreenButton.textContent = 'Full screen';
    fullscreenButton.title = 'Expand the interactive 3D plan to fill the screen';

    const syncFullscreenButton = (): void => {
      const expanded = doc.fullscreenElement === container || fallbackFullscreen;
      fullscreenButton.textContent = expanded ? 'Exit full screen' : 'Full screen';
      fullscreenButton.title = expanded
        ? 'Return the interactive 3D plan to the guide'
        : 'Expand the interactive 3D plan to fill the screen';
      fullscreenButton.setAttribute('aria-pressed', String(expanded));
    };
    const setFallbackFullscreen = (enabled: boolean): void => {
      fallbackFullscreen = enabled;
      container?.classList.toggle('viewer-canvas--fullscreen-fallback', enabled);
      doc.documentElement.classList.toggle('viewer-fullscreen-lock', enabled);
      syncFullscreenButton();
    };
    fullscreenButton.addEventListener('click', () => {
      if (!container) return;
      if (doc.fullscreenElement === container) {
        void doc.exitFullscreen?.();
        return;
      }
      if (fallbackFullscreen) {
        setFallbackFullscreen(false);
        return;
      }
      if (typeof container.requestFullscreen === 'function') {
        void container.requestFullscreen().catch(() => setFallbackFullscreen(true));
        return;
      }
      setFallbackFullscreen(true);
    });
    fullscreenDocument = doc;
    fullscreenChangeHandler = () => {
      if (fallbackFullscreen && doc.fullscreenElement === container) {
        setFallbackFullscreen(false);
      } else {
        syncFullscreenButton();
      }
    };
    fullscreenKeyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && fallbackFullscreen) setFallbackFullscreen(false);
    };
    doc.addEventListener('fullscreenchange', fullscreenChangeHandler);
    doc.addEventListener('keydown', fullscreenKeyHandler);
    syncFullscreenButton();
    toolbar.appendChild(fullscreenButton);

    const axisCue = doc.createElement('div');
    axisCue.className = 'viewer-axis-cue';
    axisCue.setAttribute('role', 'img');
    axisCue.setAttribute('aria-label', 'Model orientation: canonical Z axis is up');
    axisCue.innerHTML =
      '<span class="viewer-axis-cue-mark" aria-hidden="true"><span class="viewer-axis-cue-z">Z</span><span class="viewer-axis-cue-x">X</span></span><span class="viewer-axis-cue-label">Z up</span>';

    const previewLabel = doc.createElement('div');
    previewLabel.className = 'viewer-preview-label';
    previewLabel.dataset.testid = 'viewer-preview-label';
    previewLabel.setAttribute('role', 'status');
    previewLabel.textContent = 'Planned wall / doorway preview — not installed';
    previewLabel.hidden = true;

    const navigationHint = doc.createElement('div');
    navigationHint.className = 'viewer-navigation-hint';
    navigationHint.textContent = 'Drag: slow orbit · Right-drag: floor pan · Wheel: move in/out';

    const selectionDimensions = doc.createElement('section');
    selectionDimensions.className = 'viewer-selection-dimensions';
    selectionDimensions.dataset.testid = 'viewer-selection-dimensions';
    selectionDimensions.setAttribute('role', 'status');
    selectionDimensions.setAttribute('aria-live', 'polite');
    selectionDimensions.setAttribute('aria-label', 'Selected part dimensions');
    selectionDimensions.hidden = true;

    chrome.append(toolbar, axisCue, selectionDimensions, previewLabel, navigationHint);
    container.appendChild(chrome);
    viewportChrome = chrome;
    viewportPreviewLabel = previewLabel;
    viewportSelectionDimensions = selectionDimensions;
  }

  /** Presentation-only workspace: ground shadow catcher + understated scale grid. */
  function configurePresentation(): void {
    if (!scene || !shadowLight) return;
    const bounds = modelBounds();
    const center = bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
    const size = bounds.isEmpty() ? new THREE.Vector3(2, 2, 2) : bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.5, 0.5);
    const groundY = bounds.isEmpty() ? 0 : bounds.min.y - 0.001;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(40, size.x * 6), Math.max(40, size.z * 6)),
      new THREE.ShadowMaterial({ opacity: BIM_SCENE.groundShadowOpacity }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(center.x, groundY, center.z);
    ground.receiveShadow = true;
    ground.userData.isPresentation = true;
    ground.raycast = () => {};
    scene.add(ground);

    const divisions = Math.max(20, Math.ceil(Math.max(size.x, size.z) * 3));
    const grid = new THREE.GridHelper(
      divisions,
      divisions,
      BIM_SCENE.gridMajor,
      BIM_SCENE.gridMinor,
    );
    const gridMaterial = grid.material as THREE.LineBasicMaterial;
    gridMaterial.transparent = true;
    gridMaterial.opacity = BIM_SCENE.gridOpacity;
    gridMaterial.depthWrite = false;
    grid.position.set(center.x, groundY + 0.002, center.z);
    grid.userData.isPresentation = true;
    grid.raycast = () => {};
    scene.add(grid);

    shadowLight.target.position.copy(center);
    shadowLight.position
      .copy(center)
      .add(new THREE.Vector3(4, 7, 5).normalize().multiplyScalar(Math.max(radius * 4, 6)));
    shadowLight.target.updateMatrixWorld();
    const shadowCamera = shadowLight.shadow.camera;
    shadowCamera.left = -radius * 1.8;
    shadowCamera.right = radius * 1.8;
    shadowCamera.top = radius * 1.8;
    shadowCamera.bottom = -radius * 1.8;
    shadowCamera.near = 0.1;
    shadowCamera.far = radius * 12 + 20;
    shadowCamera.updateProjectionMatrix();
  }

  function clearOverlays(): void {
    if (!overlayGroup) return;
    if (scene) scene.remove(overlayGroup);
    disposeObject3D(overlayGroup);
    overlayGroup = null;
    routeTubes = [];
    fastenerMeshes = [];
    toolProxyMesh = null;
  }

  function clearRequirementPreview(): void {
    if (!requirementPreviewGroup) return;
    if (scene) scene.remove(requirementPreviewGroup);
    disposeObject3D(requirementPreviewGroup);
    requirementPreviewGroup = null;
  }

  function applyRequirementPreview(
    preview: NonNullable<PresentationRecipe['requirementPreview']> | null,
  ): void {
    clearRequirementPreview();
    if (!scene || !preview) return;
    const group = new THREE.Group();
    group.userData.isRequirementPreview = true;
    const styles = {
      context: { color: 0x718497, opacity: 0.025, edgeOpacity: 0.48 },
      target: { color: 0x536f85, opacity: 0.075, edgeOpacity: 0.96 },
      extension: { color: 0x607f96, opacity: 0.2, edgeOpacity: 0.82 },
    } as const;

    for (const box of preview.boxes) {
      const spec = requirementPreviewBoxViewerSpec(box);
      const style = styles[box.style];
      const geometry = new THREE.BoxGeometry(...spec.size);
      const material = new THREE.MeshStandardMaterial({
        color: style.color,
        emissive: style.color,
        emissiveIntensity: 0.08,
        opacity: style.opacity,
        transparent: true,
        wireframe: false,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...spec.center);
      mesh.userData.isPresentation = true;
      mesh.userData.requirementPreviewId = box.id;
      mesh.userData.label = box.label;
      mesh.renderOrder = 1000;
      mesh.raycast = () => {};
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 30),
        new THREE.LineBasicMaterial({
          color: 0x42596c,
          opacity: style.edgeOpacity,
          transparent: true,
          depthWrite: false,
          depthTest: false,
        }),
      );
      edges.userData.isPresentation = true;
      edges.raycast = () => {};
      mesh.add(edges);
      group.add(mesh);
    }
    requirementPreviewGroup = group;
    scene.add(group);
  }

  function setOverlays(overlayState: OverlayState): void {
    if (!scene) return;
    clearOverlays();
    const group = new THREE.Group();
    group.userData.isOverlayGroup = true;
    const overlaysById = new Map<string, OverlayObject>(
      (compiled?.overlays ?? []).map((overlay) => [overlay.id, overlay]),
    );

    for (const point of overlayState.fastenerPoints) {
      const color = overlayColor(point.state);
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
        wireframe: point.state === 'proposed',
        roughness: 0.5,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(FASTENER_POINT_RADIUS_M, 12, 8),
        material,
      );
      mesh.position.set(...canonicalPointToViewer(point.positionMm));
      mesh.userData.overlayId = point.overlayId;
      fastenerMeshes.push({ overlayId: point.overlayId, state: point.state, mesh });
      group.add(mesh);
    }

    for (const route of overlayState.routePaths) {
      if (route.pathPointsMm.length < 2) continue;
      const points = route.pathPointsMm.map(
        (point) => new THREE.Vector3(...canonicalPointToViewer(point)),
      );
      const curve =
        points.length === 2
          ? new THREE.LineCurve3(points[0]!, points[1]!)
          : new THREE.CatmullRomCurve3(points);
      const radiusMm = overlaysById.get(route.overlayId)?.radiusMm ?? ROUTE_RADIUS_FALLBACK_MM;
      const color = overlayColor(route.state);
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        roughness: 0.6,
        metalness: 0.1,
      });
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(8, (points.length - 1) * 8), radiusMm * MM, 8, false),
        material,
      );
      tube.userData.overlayId = route.overlayId;
      routeTubes.push({
        partId: overlaysById.get(route.overlayId)?.partId ?? null,
        mesh: tube,
      });
      group.add(tube);
    }

    if (overlayState.toolProxy) {
      const material = new THREE.MeshStandardMaterial({
        color: 0x60a5fa,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
      });
      toolProxyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(TOOL_PROXY_SIZE_M, TOOL_PROXY_SIZE_M, TOOL_PROXY_SIZE_M),
        material,
      );
      toolProxyMesh.position.set(...canonicalPointToViewer(overlayState.toolProxy.positionMm));
      toolProxyMesh.userData.overlayId = overlayState.toolProxy.overlayId;
      group.add(toolProxyMesh);
    }

    overlayGroup = group;
    scene.add(group);
  }

  function setTubeReveal(tube: { mesh: THREE.Mesh }, fraction: number): void {
    const index = tube.mesh.geometry.index;
    if (!index) return;
    const clamped = Math.min(1, Math.max(0, fraction));
    const count = clamped <= 0 ? 0 : Math.max(1, Math.floor(index.count * clamped));
    tube.mesh.geometry.setDrawRange(0, count);
  }

  function clearFastenerEmphasis(): void {
    for (const entry of fastenerMeshes) {
      entry.mesh.scale.setScalar(1);
      const material = entry.mesh.material;
      if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity = 0.4;
    }
  }

  function emphasizeFastenerPoints(proposed: boolean): void {
    const target = proposed ? 'proposed' : 'released';
    for (const entry of fastenerMeshes) {
      if (entry.state !== target) continue;
      entry.mesh.scale.setScalar(1.6);
      const material = entry.mesh.material;
      if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity = 1.4;
    }
  }

  function applyRenderPolicy(): void {
    for (const [partId, object] of partObjects) {
      const part = partsById.get(partId);
      if (!part) continue;
      const partState = stateByPart.get(partId) ?? part.initialState;
      const isolated =
        visibility.isolatedPartIds.length === 0 || visibility.isolatedPartIds.includes(partId);
      const hidden = visibility.hiddenPartIds.includes(partId);
      const highlighted = selectedPartIds.has(partId);
      // A tree selection must remain findable even when a covering layer or the current step would
      // otherwise hide it. This is presentation-only and never changes the canonical part state.
      object.visible = (isolated && !hidden) || highlighted;

      const xray = visibility.xrayPartIds.includes(partId);
      const coveredShown = partState === 'covered' && visibility.showCovered;
      const preview = partState === 'absent' && (revealedPartIds.has(partId) || highlighted);
      const focused = emphasizedPartIds.has(partId);
      const opening = part.kind === 'opening';
      const subordinate = !opening && isSubordinateRole(part.role);
      const spec = partMaterialSpec(part.trade, partState, {
        xray,
        coveredShown,
        highlighted,
        focused,
        opening,
        preview,
        subordinate,
      });
      for (const mesh of partMeshes.get(partId) ?? []) {
        const material = mesh.material;
        if (material instanceof THREE.MeshStandardMaterial) {
          material.color.setHex(spec.color);
          material.opacity = spec.opacity;
          material.transparent = spec.transparent;
          material.wireframe = spec.wireframe;
          material.emissive.setHex(spec.emissive);
          material.emissiveIntensity = spec.emissiveIntensity;
          material.depthWrite = !spec.transparent;
          material.depthTest = !highlighted;
          material.needsUpdate = true;
        }
        mesh.renderOrder = highlighted ? 1000 : 0;
        // Selective shadows: transparent/ghost/x-ray parts never cast, so edges stay readable.
        mesh.castShadow = spec.opacity >= 1 && !spec.transparent;
        mesh.receiveShadow = true;
      }
      const edgeSpec = partEdgeSpec(partState, {
        xray,
        coveredShown,
        highlighted,
        focused,
        opening,
        preview,
        subordinate,
      });
      for (const edgeMaterial of partEdgeMaterials.get(partId) ?? []) {
        edgeMaterial.color.setHex(edgeSpec.color);
        edgeMaterial.opacity = edgeSpec.opacity;
        edgeMaterial.visible = edgeSpec.visible;
        edgeMaterial.transparent = true;
        edgeMaterial.depthWrite = false;
        edgeMaterial.depthTest = !highlighted;
        edgeMaterial.needsUpdate = true;
      }
    }
  }

  function applyState(snapshot: PartStateEntry[], options: ApplyOptions): void {
    animation = null;
    stateByPart = new Map(snapshot.map((row) => [row.partId, row.state]));
    const requirementPreview = options.recipe?.requirementPreview ?? null;
    // Floor-plane requirement previews take precedence over cumulative schematic wall elevation;
    // otherwise the elevated wall volumes can conceal the held clearance footprint.
    currentSchematicElevation = requirementPreview
      ? null
      : options.recipe?.schematicElevation ?? null;
    revealedPartIds.clear();
    for (const partId of options.recipe?.reveal ?? []) revealedPartIds.add(partId);
    if (viewportPreviewLabel) {
      const schematicElevation = requirementPreview ? null : options.recipe?.schematicElevation;
      const hasAbsentPreview = [...revealedPartIds].some(
        (partId) => (stateByPart.get(partId) ?? partsById.get(partId)?.initialState) === 'absent',
      );
      viewportPreviewLabel.textContent =
        requirementPreview?.label ??
        schematicElevation?.label ??
        'Planned wall / doorway preview — not installed';
      viewportPreviewLabel.hidden = !requirementPreview && !schematicElevation && !hasAbsentPreview;
      viewportPreviewLabel.classList.toggle(
        'viewer-preview-label--requirement',
        requirementPreview !== null,
      );
    }
    applyRequirementPreview(requirementPreview);

    // Presentation pose (e.g. assembly laid flat). Presentation-only, applied on top of every
    // part's base transform so every seek reconstructs the same pose deterministically.
    const layFlat = options.recipe?.layFlat ?? null;
    const posedBase = new Map<string, THREE.Matrix4>();
    const poseMatrix = layFlat
      ? new THREE.Matrix4().fromArray(
          matrixRotationAboutPivot(
            canonicalAxisToViewer(layFlat.axis),
            layFlat.angleDeg,
            canonicalPointToViewer(layFlat.pivotMm),
          ),
        )
      : null;
    const posedPartIds = new Set(layFlat?.partIds ?? []);
    for (const [partId, base] of baseMatrices) {
      if (poseMatrix && posedPartIds.has(partId)) {
        posedBase.set(partId, new THREE.Matrix4().multiplyMatrices(poseMatrix, base));
      } else {
        posedBase.set(partId, base);
      }
    }

    // Deterministic seek: reset every part to its (posed) base transform first.
    for (const [partId, object] of partObjects) {
      const base = posedBase.get(partId);
      if (!base) continue;
      object.matrix.copy(base);
      object.updateMatrixWorld(true);
    }
    resetMeshPresentationPoses();
    if (options.recipe?.boxTransforms) applyBoxTransforms(options.recipe.boxTransforms);
    if (options.recipe?.schematicElevation && !requirementPreview) {
      applySchematicElevation(options.recipe.schematicElevation);
    }
    for (const object of partObjects.values()) object.updateMatrixWorld(true);
    for (const tube of routeTubes) setTubeReveal(tube, 1);
    clearFastenerEmphasis();

    emphasizedPartIds.clear();
    for (const partId of options.focusPartIds ?? []) emphasizedPartIds.add(partId);

    const reduce = !options.animate || options.reducedMotion;
    const translate = options.recipe?.translateFrom ?? null;
    const revealPartId = options.recipe?.routePath?.partId ?? null;
    const revealTube = revealPartId
      ? routeTubes.find((tube) => tube.partId === revealPartId) ?? null
      : null;

    const animateTranslate =
      !reduce && translate !== null && partObjects.has(translate.partId);
    if (animateTranslate && translate) {
      const object = partObjects.get(translate.partId)!;
      const base = posedBase.get(translate.partId)!;
      const offset = new THREE.Vector3(...canonicalToViewer(translate.offsetMm));
      object.matrix.copy(base);
      object.matrix.elements[12] = (base.elements[12] ?? 0) + offset.x;
      object.matrix.elements[13] = (base.elements[13] ?? 0) + offset.y;
      object.matrix.elements[14] = (base.elements[14] ?? 0) + offset.z;
      object.updateMatrixWorld(true);
    }

    const animateReveal = !reduce && revealTube !== null;
    if (animateReveal && revealTube) setTubeReveal(revealTube, 0);

    if (options.recipe?.showFastenerPoints) {
      emphasizeFastenerPoints(options.recipe.showFastenerPoints.proposed ?? false);
    }

    if (animateTranslate || animateReveal) {
      animation = {
        startedAt: performance.now(),
        durationMs: ANIMATION_MS,
        translatePartId: animateTranslate && translate ? translate.partId : null,
        offsetViewer:
          animateTranslate && translate
            ? new THREE.Vector3(...canonicalToViewer(translate.offsetMm))
            : null,
        revealPartId: animateReveal && revealTube ? revealTube.partId : null,
      };
    }

    applyRenderPolicy();
    updateViewportSelectionDimensions();
  }

  function updateAnimation(now: number): void {
    if (!animation) return;
    const progress = Math.min(1, Math.max(0, (now - animation.startedAt) / animation.durationMs));
    const eased = progress * progress * (3 - 2 * progress);
    if (animation.translatePartId && animation.offsetViewer) {
      const object = partObjects.get(animation.translatePartId);
      const base = baseMatrices.get(animation.translatePartId);
      if (object && base) {
        object.matrix.copy(base);
        object.matrix.elements[12] =
          (base.elements[12] ?? 0) + (1 - eased) * animation.offsetViewer.x;
        object.matrix.elements[13] =
          (base.elements[13] ?? 0) + (1 - eased) * animation.offsetViewer.y;
        object.matrix.elements[14] =
          (base.elements[14] ?? 0) + (1 - eased) * animation.offsetViewer.z;
        object.updateMatrixWorld(true);
      }
    }
    if (animation.revealPartId) {
      const tube = routeTubes.find((candidate) => candidate.partId === animation?.revealPartId);
      if (tube) setTubeReveal(tube, eased);
    }
    if (progress >= 1) animation = null;
  }

  function isEffectivelyVisible(object: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (!current.visible) return false;
      current = current.parent;
    }
    return true;
  }

  function findPartId(object: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      const partId: unknown = current.userData.partId;
      if (typeof partId === 'string') return partId;
      current = current.parent;
    }
    return null;
  }

  function isNonCanonicalPresentation(object: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData.isNonCanonicalPresentation === true) return true;
      current = current.parent;
    }
    return false;
  }

  function pickAt(event: PointerEvent, includeOverlays: boolean): PickPoint | null {
    if (!renderer || !camera) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointerNdc, camera);
    const targets: THREE.Object3D[] = [...partObjects.values()];
    if (includeOverlays && overlayGroup) targets.push(overlayGroup);
    const hits = raycaster.intersectObjects(targets, true);
    for (const hit of hits) {
      if (!isEffectivelyVisible(hit.object)) continue;
      // The elevated mesh is only a labelled viewing aid. Do not let measurement mode pass
      // through it and silently report a canonical point on unrelated geometry behind it.
      if (includeOverlays && isNonCanonicalPresentation(hit.object)) return null;
      return {
        pointMm: viewerToCanonical([hit.point.x, hit.point.y, hit.point.z]),
        partId: findPartId(hit.object),
      };
    }
    return null;
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const measure = selectionMode === 'measure';
    const hit = pickAt(event, measure);
    if (!hit) return;
    if (!measure && hit.partId) {
      selectedPartIds.clear();
      selectedPartIds.add(hit.partId);
      applyRenderPolicy();
      updateViewportSelectionDimensions();
      for (const handler of [...selectionHandlers]) handler([hit.partId]);
    }
    for (const handler of [...pickHandlers]) handler(hit);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!renderer || selectionMode !== 'select') return;
    const hit = pickAt(event, false);
    renderer.domElement.style.cursor = hit ? 'pointer' : '';
  }

  function attachPointerHandlers(): void {
    if (!renderer) return;
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
  }

  function detachPointerHandlers(): void {
    if (!renderer) return;
    renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
    renderer.domElement.removeEventListener('pointermove', handlePointerMove);
  }

  function startLoop(): void {
    const loop = (): void => {
      if (disposed) return;
      rafId = requestAnimationFrame(loop);
      updateAnimation(performance.now());
      controls?.update();
      constrainNavigationToFloor();
      if (renderer && scene && camera) renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(loop);
  }

  function setCamera(input: ProjectCamera | { fit: 'all' }): void {
    if ('fit' in input) {
      fitAll();
      return;
    }
    if (!camera || !controls) return;
    const viewerCamera = canonicalCameraToViewer(input);
    camera.position.set(
      viewerCamera.positionMm[0],
      viewerCamera.positionMm[1],
      viewerCamera.positionMm[2],
    );
    controls.target.set(viewerCamera.targetMm[0], viewerCamera.targetMm[1], viewerCamera.targetMm[2]);
    camera.up.set(...(viewerCamera.upMm ?? [0, 1, 0]));
    if (viewerCamera.fov !== undefined) camera.fov = viewerCamera.fov;
    const presetDistance = camera.position.distanceTo(controls.target);
    camera.near = Math.max(0.005, presetDistance / 500);
    camera.far = Math.max(presetDistance * 20, 100);
    camera.updateProjectionMatrix();
    controls.update();
  }

  function setSection(plane: SectionPlane | null): void {
    if (!renderer) return;
    if (!plane) {
      renderer.clippingPlanes = [];
      return;
    }
    const spec = canonicalSectionToThreePlane(plane);
    renderer.clippingPlanes = [
      new THREE.Plane(new THREE.Vector3(spec.normal[0], spec.normal[1], spec.normal[2]), spec.constant),
    ];
  }

  async function load(input: LoadInput): Promise<void> {
    if (disposed) throw new Error('viewer-three adapter is disposed');
    if (renderer) return;
    compiled = input.compiled;
    container = input.container;
    const width = Math.max(1, container.clientWidth || 640);
    const height = Math.max(1, container.clientHeight || 480);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    try {
      renderer.shadowMap.enabled = true;
      // r186 removed PCFSoftShadowMap; filtered PCF remains the portable WebGL fallback.
      renderer.shadowMap.type = THREE.PCFShadowMap;
    } catch {
      // Safe fallback: shadow support can be unavailable on very small WebGL stacks.
      renderer.shadowMap.enabled = false;
    }
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      for (const handler of [...errorHandlers]) handler('WebGL context lost');
    });
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    backgroundTexture = createBackgroundTexture();
    scene.background = backgroundTexture;
    camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 1000);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.rotateSpeed = 0.28;
    controls.zoomSpeed = 0.65;
    controls.panSpeed = 0.55;
    controls.screenSpacePanning = false;
    controls.minPolarAngle = 0.06;
    controls.maxPolarAngle = Math.PI / 2 + 0.34;
    controls.zoomToCursor = true;

    // Bright-workspace lighting: hemisphere fill, soft directional key (shadow-casting), fill/rim.
    scene.add(new THREE.HemisphereLight(0xeaf1f8, 0xb9b2a6, 0.55));
    scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    const keyLight = new THREE.DirectionalLight(0xfff2e0, 2.2);
    keyLight.position.set(4, 7, 5);
    keyLight.castShadow = renderer.shadowMap.enabled;
    const shadowSize = renderer.capabilities.maxTextureSize >= 2048 ? 2048 : 1024;
    keyLight.shadow.mapSize.set(shadowSize, shadowSize);
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);
    scene.add(keyLight.target);
    shadowLight = keyLight;
    const fillLight = new THREE.DirectionalLight(0xc9dcf2, 0.55);
    fillLight.position.set(-5, 3, -4);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.35);
    rimLight.position.set(-3, 5, 6);
    scene.add(rimLight);

    buildParts(compiled);
    navigationFloorY = modelBounds().min.y;
    fitAll();
    configurePresentation();
    mountViewportChrome();
    attachPointerHandlers();
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (!renderer || !camera || !container) return;
        const nextWidth = Math.max(1, container.clientWidth);
        const nextHeight = Math.max(1, container.clientHeight);
        renderer.setSize(nextWidth, nextHeight);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
      });
      resizeObserver.observe(container);
    }
    startLoop();
    for (const handler of [...readyHandlers]) handler();
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    if (rafId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
    rafId = null;
    detachPointerHandlers();
    resizeObserver?.disconnect();
    resizeObserver = null;
    controls?.dispose();
    controls = null;
    if (fullscreenDocument && fullscreenChangeHandler) {
      fullscreenDocument.removeEventListener('fullscreenchange', fullscreenChangeHandler);
    }
    if (fullscreenDocument && fullscreenKeyHandler) {
      fullscreenDocument.removeEventListener('keydown', fullscreenKeyHandler);
    }
    if (fallbackFullscreen) {
      container?.classList.remove('viewer-canvas--fullscreen-fallback');
      fullscreenDocument?.documentElement.classList.remove('viewer-fullscreen-lock');
    }
    fullscreenDocument = null;
    fullscreenChangeHandler = null;
    fullscreenKeyHandler = null;
    fallbackFullscreen = false;
    viewportChrome?.remove();
    viewportChrome = null;
    viewportPreviewLabel = null;
    viewportSelectionDimensions = null;
    if (backgroundTexture) {
      backgroundTexture.dispose();
      backgroundTexture = null;
    }
    if (scene) disposeObject3D(scene);
    renderer?.dispose();
    renderer?.domElement.remove();
    renderer = null;
    scene = null;
    camera = null;
    container = null;
    overlayGroup = null;
    requirementPreviewGroup = null;
    routeTubes = [];
    fastenerMeshes = [];
    toolProxyMesh = null;
    shadowLight = null;
    currentSchematicElevation = null;
    animation = null;
    partObjects.clear();
    partMeshes.clear();
    partEdgeMaterials.clear();
    baseMeshPoses.clear();
    baseMatrices.clear();
    partsById.clear();
    revealedPartIds.clear();
    stateByPart = new Map();
    selectionHandlers.clear();
    pickHandlers.clear();
    errorHandlers.clear();
    readyHandlers.clear();
  }

  return {
    capabilities,
    load,
    dispose,
    select(partIds: string[]) {
      selectedPartIds.clear();
      for (const partId of partIds) selectedPartIds.add(partId);
      applyRenderPolicy();
      updateViewportSelectionDimensions();
    },
    onSelection(handler) {
      selectionHandlers.add(handler);
      return () => selectionHandlers.delete(handler);
    },
    onPick(handler) {
      pickHandlers.add(handler);
      return () => pickHandlers.delete(handler);
    },
    onError(handler) {
      errorHandlers.add(handler);
      return () => errorHandlers.delete(handler);
    },
    onReady(handler) {
      readyHandlers.add(handler);
      return () => readyHandlers.delete(handler);
    },
    setCamera,
    setSection,
    setVisibility(state: VisibilityState) {
      visibility = {
        isolatedPartIds: [...state.isolatedPartIds],
        xrayPartIds: [...state.xrayPartIds],
        hiddenPartIds: [...state.hiddenPartIds],
        showCovered: state.showCovered,
      };
      applyRenderPolicy();
    },
    setOverlays,
    applyState,
    measure(pointsMm: Vec3[]): MeasurementResult | null {
      return measureCanonicalPoints(pointsMm);
    },
    setSelectionMode(mode: 'select' | 'measure') {
      selectionMode = mode;
      if (renderer) renderer.domElement.style.cursor = '';
    },
    setEmphasis(partIds: string[], style: 'highlight' | 'none') {
      if (style === 'highlight') {
        for (const partId of partIds) emphasizedPartIds.add(partId);
      } else if (partIds.length === 0) {
        emphasizedPartIds.clear();
      } else {
        for (const partId of partIds) emphasizedPartIds.delete(partId);
      }
      applyRenderPolicy();
    },
  };
}
