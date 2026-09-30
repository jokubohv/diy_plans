/**
 * U4 candidate harness page.
 *
 * Loads one IFC file (query param) with the real `@thatopen/components` stack, renders it with
 * the local `@thatopen/fragments` worker and the local `web-ifc` WASM, and exposes
 * `window.__u4` so the Playwright compositor proof can (a) wait for a real first frame,
 * (b) read pixel-level probe data, and (c) resolve canonical guide `partId`s through the
 * published `id-map.json` and each product's `Pset_DiyGuide`.
 *
 * Local-only rules (packet U4): the upstream defaults fetch the fragments worker and the WASM
 * from unpkg.com, so both are replaced with assets emitted by the local Vite build:
 *   - `@thatopen/fragments/worker?url` -> `FragmentsManager.init(localWorkerUrl)`
 *   - `web-ifc/web-ifc.wasm?url`       -> `IfcLoader.settings.wasm` (single-threaded WASM)
 *
 * Query parameters:
 *   ifc=<url>       IFC file to render (required)
 *   idmap=<url>     published id-map.json for that release (required)
 *   model=<name>    fragments model id / report label (default "u4-model")
 *   slug=<slug>     release slug for the report (optional)
 *   releaseId=<id>  release id for the report (optional)
 */
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import { IFCOPENINGELEMENT } from 'web-ifc';
import type { FragmentsModel, ItemsDataConfig } from '@thatopen/fragments';
import workerAssetUrl from '@thatopen/fragments/worker?url';
import wasmAssetUrl from 'web-ifc/web-ifc.wasm?url';
import {
  buildIdentityIndex,
  extractGuidePartId,
  resolveIdentity,
  summarizeIdentity,
  type IdMapDocument,
  type IdentityResolution,
  type IdentitySummary,
  type ModelIdentityAccess,
} from '../identity';
import { assertLocalAssetUrl, wasmDirectoryFromAssetUrl } from '../localAssets';

const BACKGROUND_HEX = 0x10161d;

/** Local-only item data request: built-in attributes + GlobalId + the IsDefinedBy relation. */
const ITEM_DATA_CONFIG: Partial<ItemsDataConfig> = {
  attributesDefault: true,
  attributes: ['GlobalId'],
  relations: { IsDefinedBy: { attributes: true, relations: true } },
};

export interface U4Probe {
  ready: boolean;
  failed: string | null;
  failedStack?: string;
  readyMs: number | null;
  bootMs: number;
  slug: string | null;
  releaseId: string | null;
  ifcUrl: string;
  ifcBytes: number;
  idMapUrl: string;
  idMapParts: number;
  idMapDuplicates: { partIds: string[]; globalIds: string[] };
  versions: { three: string; components: string; componentsReleaseConstant: string };
  localAssets: {
    workerUrl: string;
    workerMode: 'local-asset';
    wasmDir: string;
    wasmSingleThreaded: boolean;
  };
  importPolicy: string[];
  scene: {
    background: string;
    modelId: string;
    tiles: number;
    itemsWithGeometry: number | null;
    categories: string[];
    webgl2: boolean;
    maxTextureSize: number;
  };
  errors: string[];
  resolve(partIds: string[]): Promise<IdentityResolution[]>;
  resolveAll(): Promise<{ summary: IdentitySummary; resolutions: IdentityResolution[]; elapsedMs: number }>;
  sampleItemData(partId: string): Promise<unknown>;
  crossCheckGuid(guid: string): Promise<Record<string, number[]> | null>;
}

declare global {
  interface Window {
    __u4?: U4Probe;
  }
}

function requireParam(params: URLSearchParams, name: string): string {
  const value = params.get(name);
  if (!value) throw new Error(`missing required query parameter "${name}"`);
  return value;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`fetch ${url} failed: ${response.status} ${response.statusText}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`fetch ${url} failed: ${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

function nextFrame(): Promise<void> {
  return new Promise((resolvePromise) => requestAnimationFrame(() => resolvePromise()));
}

async function boot(): Promise<U4Probe> {
  const bootStart = performance.now();
  const params = new URLSearchParams(window.location.search);
  const ifcUrl = requireParam(params, 'ifc');
  const idMapUrl = requireParam(params, 'idmap');
  const modelId = params.get('model') ?? 'u4-model';

  const container = document.querySelector<HTMLElement>('#viewer');
  if (!container) throw new Error('#viewer container is missing');

  const components = new OBC.Components();
  const worlds = components.get(OBC.Worlds);
  const world = worlds.create<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>();
  world.scene = new OBC.SimpleScene(components);
  world.scene.setup();
  world.scene.three.background = new THREE.Color(BACKGROUND_HEX);
  world.renderer = new OBC.SimpleRenderer(components, container, { antialias: true });
  world.renderer.showLogo = false;
  world.camera = new OBC.SimpleCamera(components);
  components.init();

  const fragments = components.get(OBC.FragmentsManager);
  const workerUrl = assertLocalAssetUrl(workerAssetUrl, 'fragments worker');
  fragments.init(workerUrl);
  world.camera.controls.addEventListener('update', () => {
    void fragments.core.update();
  });

  const loader = components.get(OBC.IfcLoader);
  await loader.setup({ autoSetWasm: false });
  const wasmDir = wasmDirectoryFromAssetUrl(assertLocalAssetUrl(wasmAssetUrl, 'web-ifc wasm'));
  loader.settings.wasm = { path: wasmDir, absolute: true };

  const idMap = await fetchJson<IdMapDocument>(idMapUrl);
  const index = buildIdentityIndex(idMap);
  const ifcBytes = await fetchBytes(ifcUrl);

  const model: FragmentsModel = await loader.load(ifcBytes, true, modelId, {
    instanceCallback: (importer) => {
      // @thatopen/fragments 3.4.7 deliberately excludes IfcOpeningElement from its default
      // element class set (the class is commented out in IfcImporter.ifcClasses.elements).
      // The platform publishes the doorway opening as a first-class guide part, so the
      // public importer API is used to import it, keeping the identity contract whole.
      importer.classes.elements.add(IFCOPENINGELEMENT);
    },
  });
  world.scene.three.add(model.object);
  model.useCamera(world.camera.three);

  // Deterministic opening view: fit the model's own bounding box without a camera transition.
  const box = model.box.clone();
  const camera = world.camera.three;
  if (!box.isEmpty() && camera instanceof THREE.PerspectiveCamera) {
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const fov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(fov / 2) * camera.aspect);
    const distance = (sphere.radius / Math.sin(Math.min(fov, hFov) / 2)) * 1.15;
    const direction = new THREE.Vector3(1, 0.75, 1).normalize();
    const target = sphere.center;
    const position = target.clone().addScaledVector(direction, Math.max(distance, sphere.radius * 2, 1));
    await world.camera.controls.setLookAt(
      position.x,
      position.y,
      position.z,
      target.x,
      target.y,
      target.z,
      false,
    );
  } else {
    await world.camera.fitToItems();
  }

  // Wait for the worker to stream geometry tiles and the renderer to show them.
  let tiles = 0;
  let visible = 0;
  const settleStart = performance.now();
  while (performance.now() - settleStart < 30_000) {
    await fragments.core.update(true);
    await nextFrame();
    tiles = model.tiles.size;
    visible = model.visibleItems.size;
    if (tiles > 0 && visible > 0) break;
  }

  const categories = await model.getCategories();
  let itemsWithGeometry: number | null = null;
  try {
    itemsWithGeometry = (await model.getItemsIdsWithGeometry()).length;
  } catch {
    itemsWithGeometry = null;
  }

  const access: ModelIdentityAccess = {
    modelId: model.modelId,
    getLocalIdsByGuids: (guids) => model.getLocalIdsByGuids(guids),
    getPsetDiyGuidePartId: async (localId) => {
      const data = await model.getItemsData([localId], ITEM_DATA_CONFIG);
      return extractGuidePartId(data);
    },
  };

  const probe: U4Probe = {
    ready: false,
    failed: null,
    readyMs: null,
    bootMs: performance.now() - bootStart,
    slug: params.get('slug'),
    releaseId: params.get('releaseId'),
    ifcUrl,
    ifcBytes: ifcBytes.byteLength,
    idMapUrl,
    idMapParts: idMap.parts.length,
    idMapDuplicates: {
      partIds: index.duplicatePartIds,
      globalIds: index.duplicateGlobalIds,
    },
    versions: {
      three: THREE.REVISION,
      components: '3.4.8',
      // Upstream ships a stale constant: it still reports 2.4.3 in @thatopen/components 3.4.8.
      componentsReleaseConstant: OBC.Components.release,
    },
    localAssets: {
      workerUrl,
      workerMode: 'local-asset',
      wasmDir,
      wasmSingleThreaded: !globalThis.crossOriginIsolated,
    },
    importPolicy: [
      'default importer classes',
      'IfcOpeningElement added back via the public IfcImporter.classes.elements set (fragments 3.4.7 excludes it by default)',
    ],
    scene: {
      background: `#${BACKGROUND_HEX.toString(16).padStart(6, '0')}`,
      modelId: model.modelId,
      tiles,
      itemsWithGeometry,
      categories,
      webgl2: world.renderer.three.capabilities.isWebGL2,
      maxTextureSize: world.renderer.three.capabilities.maxTextureSize,
    },
    errors: [],
    resolve: (partIds) => resolveIdentity(index, access, partIds),
    resolveAll: async () => {
      const started = performance.now();
      const allPartIds = idMap.parts.map((part) => part.partId);
      const chunkSize = 8;
      const resolutions: IdentityResolution[] = [];
      for (let offset = 0; offset < allPartIds.length; offset += chunkSize) {
        const chunk = allPartIds.slice(offset, offset + chunkSize);
        resolutions.push(...(await resolveIdentity(index, access, chunk)));
      }
      return {
        summary: summarizeIdentity(resolutions),
        resolutions,
        elapsedMs: performance.now() - started,
      };
    },
    sampleItemData: async (partId) => {
      const entry = index.byPartId.get(partId);
      if (!entry) throw new Error(`partId not in id-map: ${partId}`);
      const [localId] = await model.getLocalIdsByGuids([entry.ifcGlobalId]);
      if (localId === null || localId === undefined) throw new Error(`no fragment for ${partId}`);
      return model.getItemsData([localId], ITEM_DATA_CONFIG);
    },
    crossCheckGuid: async (guid) => {
      const map = await fragments.guidsToModelIdMap([guid]);
      if (!map || Object.keys(map).length === 0) return null;
      return Object.fromEntries(
        Object.entries(map).map(([modelId, localIds]) => [modelId, [...localIds]]),
      );
    },
  };
  window.__u4 = probe;

  // Ready only after a real frame with visible geometry has been produced.
  await nextFrame();
  probe.readyMs = performance.now();
  probe.ready = true;
  return probe;
}

const probeErrors: string[] = [];
window.addEventListener('error', (event) => {
  probeErrors.push(event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  probeErrors.push(`unhandled rejection: ${String(event.reason)}`);
});

boot().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  const stack = cause instanceof Error ? cause.stack ?? message : message;
  const probe: Partial<U4Probe> = {
    ready: false,
    failed: message,
    failedStack: stack,
    errors: [...probeErrors],
  };
  window.__u4 = { ...(window.__u4 ?? {}), ...probe } as U4Probe;
  // Surface the failure as a console error so the compositor proof fails loudly instead of
  // timing out on a silent blank page.
  console.error(`U4 harness boot failed: ${message}\n${stack}`);
});
