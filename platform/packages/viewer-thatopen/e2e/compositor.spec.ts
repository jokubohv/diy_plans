/**
 * U4 compositor proof: the candidate engine must produce real, non-empty pixels for the
 * published P0 fixture and the R35 pantry IFC, and it must honour the platform identity
 * contract (`partId` <-> `id-map.json` <-> `Pset_DiyGuide`).
 *
 * Per model:
 *   - 3 cold-load runs in fresh browser contexts with the HTTP cache disabled (each timing is
 *     reported; the median is derived, never cherry-picked);
 *   - the canvas is screenshotted and the PNG is decoded in Node on every run (a WebGL drawing
 *     buffer cannot be read back reliably in-page); non-empty model pixels are asserted;
 *   - console errors, unhandled page errors and non-local request origins fail the run (this is
 *     also how the "no cloud fetch" rule is proven: the upstream defaults would call unpkg.com);
 *   - run 1 additionally resolves every published `partId` through the id-map and the product's
 *     own `Pset_DiyGuide`, saves the PNG and the raw item-data sample;
 *   - the JSON report is written to U4_EVIDENCE_DIR (default: the run-1 evidence directory).
 *
 * The release ids are resolved from `catalog.json` at runtime. If the published release tree has
 * no `model/project.ifc` (true for pantry-r35 in the current data tree), the spec renders the
 * deterministic `tools/ifc/generate_ifc.py` output from U4_MODELS_DIR and records that source
 * explicitly; it never fabricates a result.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, release as osRelease, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import { PNG } from 'pngjs';

const packageDir = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const platformRoot = resolve(packageDir, '..', '..');
const evidenceDir =
  process.env.U4_EVIDENCE_DIR ??
  join(platformRoot, 'work', '3d-platform', 'evidence', 'p0', 'u4-thatopen', 'run-1');
const modelsDir = process.env.U4_MODELS_DIR ?? join(evidenceDir, 'models');

const RUN_COUNT = 3;
const BACKGROUND_DISTANCE = 30;
const MODEL_SLUGS = ['p0-fixture', 'pantry-r35'] as const;

interface CatalogEntry {
  slug: string;
  title: string;
  releaseId: string;
  revision: string;
}

interface ModelSource {
  ifcUrl: string;
  idMapUrl: string;
  source: 'published-release' | 'regenerated-into-evidence';
  note: string | null;
  sha256: string;
  bytes: number;
}

interface PixelStats {
  width: number;
  height: number;
  sampled: number;
  modelPixels: number;
  coverage: number;
  uniqueColors: number;
  background: { red: number; green: number; blue: number };
  backgroundPatchDistance: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number } | null;
}

interface ProbeSnapshot {
  ready: boolean;
  failed: string | null;
  failedStack?: string;
  readyMs: number | null;
  bootMs: number;
  ifcBytes: number;
  idMapParts: number;
  versions: { three: string; components: string; componentsReleaseConstant: string };
  localAssets: {
    workerUrl: string;
    workerMode: string;
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
}

interface IdentityCapture {
  summary: {
    total: number;
    resolved: number;
    allResolved: boolean;
    byStatus: Record<string, number>;
  };
  resolutions: Array<{
    partId: string;
    ifcGlobalId: string | null;
    ifcClass: string | null;
    modelId: string;
    localId: number | null;
    psetPartId: string | null;
    status: string;
  }>;
  elapsedMs: number;
  samplePartId: string | null;
  sample: unknown;
  crossCheck: Record<string, number[]> | null;
}

interface RunCapture {
  readyMs: number;
  bootMs: number;
  resourceBytes: number;
  responseCount: number;
  probe: ProbeSnapshot;
  pixelStats: PixelStats;
  identity: IdentityCapture | null;
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
  requestOrigins: string[];
  png: Buffer;
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`invalid background colour: ${hex}`);
  const value = Number.parseInt(match[1]!, 16);
  return { red: (value >> 16) & 0xff, green: (value >> 8) & 0xff, blue: value & 0xff };
}

/**
 * Decode the canvas PNG and count pixels that differ from the flat harness background.
 * A 16x16 top-left patch anchors the observed background so a rendering regression cannot pass
 * by matching a coincidentally similar configured colour.
 */
function pixelStatsFromPng(buffer: Buffer, backgroundHex: string): PixelStats {
  const png = PNG.sync.read(buffer);
  const configured = hexToRgb(backgroundHex);
  const patch = Math.min(16, png.width, png.height);
  let patchRed = 0;
  let patchGreen = 0;
  let patchBlue = 0;
  for (let y = 0; y < patch; y += 1) {
    for (let x = 0; x < patch; x += 1) {
      const index = (y * png.width + x) * 4;
      patchRed += png.data[index] ?? 0;
      patchGreen += png.data[index + 1] ?? 0;
      patchBlue += png.data[index + 2] ?? 0;
    }
  }
  const background = {
    red: Math.round(patchRed / (patch * patch)),
    green: Math.round(patchGreen / (patch * patch)),
    blue: Math.round(patchBlue / (patch * patch)),
  };
  const backgroundPatchDistance = Math.hypot(
    background.red - configured.red,
    background.green - configured.green,
    background.blue - configured.blue,
  );

  let modelPixels = 0;
  const colors = new Set<number>();
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (y * png.width + x) * 4;
      const red = png.data[index] ?? 0;
      const green = png.data[index + 1] ?? 0;
      const blue = png.data[index + 2] ?? 0;
      colors.add((red << 16) | (green << 8) | blue);
      const distance = Math.hypot(red - background.red, green - background.green, blue - background.blue);
      if (distance > BACKGROUND_DISTANCE) {
        modelPixels += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return {
    width: png.width,
    height: png.height,
    sampled: png.width * png.height,
    modelPixels,
    coverage: modelPixels / (png.width * png.height),
    uniqueColors: colors.size,
    background,
    backgroundPatchDistance,
    bbox: maxX < 0 ? null : { minX, minY, maxX, maxY },
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

async function catalogEntry(request: APIRequestContext, slug: string): Promise<CatalogEntry> {
  const response = await request.get('/data/catalog.json');
  expect(response.ok(), 'catalog.json must be served').toBeTruthy();
  const catalog = (await response.json()) as { entries: CatalogEntry[] };
  const entry = catalog.entries.find((candidate) => candidate.slug === slug);
  expect(entry, `catalog entry for slug ${slug}`).toBeTruthy();
  return entry!;
}

async function resolveModelSource(
  request: APIRequestContext,
  entry: CatalogEntry,
): Promise<ModelSource> {
  const idMapUrl = `/data/releases/${entry.slug}/${entry.releaseId}/id-map.json`;
  const publishedIfc = `/data/releases/${entry.slug}/${entry.releaseId}/model/project.ifc`;
  const published = await request.head(publishedIfc);
  const ifcUrl =
    published.status() === 200
      ? publishedIfc
      : `/u4-models/${entry.slug}/${entry.releaseId}/model/project.ifc`;

  const response = await request.get(ifcUrl);
  expect(
    response.ok(),
    `${entry.slug}: no renderable IFC. Published ${publishedIfc} returned ${published.status()}; ` +
      `regenerated ${ifcUrl} returned ${response.status()}. Run scripts/u4-candidate.sh to ` +
      `regenerate the deterministic IFC into U4_MODELS_DIR.`,
  ).toBeTruthy();
  const bytes = await response.body();
  const idMapResponse = await request.get(idMapUrl);
  expect(idMapResponse.ok(), `${entry.slug}: id-map.json must be served`).toBeTruthy();

  return {
    ifcUrl,
    idMapUrl,
    source: published.status() === 200 ? 'published-release' : 'regenerated-into-evidence',
    note:
      published.status() === 200
        ? null
        : 'published release tree has no model/project.ifc; the deterministic output of ' +
          'tools/ifc/generate_ifc.py (checked with tools/ifc/check_ifc.py) is used',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.byteLength,
  };
}

function harnessUrl(source: ModelSource, entry: CatalogEntry, modelId: string): string {
  const params = new URLSearchParams({
    ifc: source.ifcUrl,
    idmap: source.idMapUrl,
    model: modelId,
    slug: entry.slug,
    releaseId: entry.releaseId,
  });
  return `/?${params.toString()}`;
}

async function runOnce(
  browser: Browser,
  baseURL: string,
  source: ModelSource,
  entry: CatalogEntry,
  modelId: string,
  captureIdentity: boolean,
): Promise<RunCapture> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];
  const requestOrigins = new Set<string>();
  let responseCount = 0;
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) =>
    requestFailures.push(`${request.method()} ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`),
  );
  page.on('request', (request) => {
    try {
      requestOrigins.add(new URL(request.url()).origin);
    } catch {
      requestOrigins.add(request.url());
    }
  });
  page.on('response', () => {
    responseCount += 1;
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

  await page.goto(harnessUrl(source, entry, modelId), { waitUntil: 'domcontentloaded' });
  await page
    .waitForFunction(
      () => {
        const probe = window.__u4;
        return !!probe && (probe.ready === true || probe.failed !== null);
      },
      undefined,
      { timeout: 180_000 },
    )
    .catch((cause: unknown) => {
      throw new Error(
        `harness did not become ready for ${entry.slug}: ${cause instanceof Error ? cause.message : String(cause)}` +
          (requestFailures.length > 0 ? `\nrequest failures:\n${requestFailures.join('\n')}` : ''),
      );
    });

  const probe = (await page.evaluate(() => {
    const current = window.__u4!;
    return {
      ready: current.ready,
      failed: current.failed,
      failedStack: current.failedStack,
      readyMs: current.readyMs,
      bootMs: current.bootMs,
      ifcBytes: current.ifcBytes,
      idMapParts: current.idMapParts,
      versions: current.versions,
      localAssets: current.localAssets,
      importPolicy: current.importPolicy,
      scene: current.scene,
      errors: current.errors,
    };
  })) as ProbeSnapshot;
  if (!probe.ready) {
    throw new Error(
      `harness failed for ${entry.slug}: ${probe.failed ?? 'unknown failure'}\n${probe.failedStack ?? ''}`,
    );
  }

  const resourceBytes = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .reduce((sum, entry) => sum + ((entry as PerformanceResourceTiming).transferSize ?? 0), 0),
  );

  const png = await page.locator('#viewer canvas').first().screenshot();
  const pixelStats = pixelStatsFromPng(png, probe.scene.background);

  let identity: IdentityCapture | null = null;
  if (captureIdentity) {
    identity = (await page.evaluate(async () => {
      const current = window.__u4!;
      // Fragments item data forms a cyclic graph (IsDefinedBy <-> DefinesOccurrence), so the
      // evidence sample is depth-capped and cycle-safe before it crosses the JSON boundary.
      const sanitize = (value: unknown, depth = 0, seen = new WeakSet<object>()): unknown => {
        if (depth > 6) return '[depth]';
        if (value === null || typeof value !== 'object') return value;
        if (seen.has(value)) return '[circular]';
        seen.add(value);
        if (Array.isArray(value)) {
          return value.slice(0, 40).map((child) => sanitize(child, depth + 1, seen));
        }
        const out: Record<string, unknown> = {};
        let count = 0;
        for (const [key, child] of Object.entries(value)) {
          if (count >= 60) {
            out['[truncated]'] = true;
            break;
          }
          count += 1;
          out[key] = sanitize(child, depth + 1, seen);
        }
        return out;
      };
      const all = await current.resolveAll();
      const firstResolved = all.resolutions.find((row) => row.status === 'resolved');
      let sample: unknown = null;
      let samplePartId: string | null = null;
      let crossCheck: Record<string, number[]> | null = null;
      if (firstResolved && firstResolved.ifcGlobalId) {
        samplePartId = firstResolved.partId;
        sample = sanitize(await current.sampleItemData(firstResolved.partId));
        crossCheck = await current.crossCheckGuid(firstResolved.ifcGlobalId);
      }
      return {
        summary: all.summary,
        resolutions: all.resolutions,
        elapsedMs: all.elapsedMs,
        samplePartId,
        sample,
        crossCheck,
      };
    })) as IdentityCapture;
  }

  await context.close();
  return {
    readyMs: probe.readyMs ?? Number.NaN,
    bootMs: probe.bootMs,
    resourceBytes,
    responseCount,
    probe,
    pixelStats,
    identity,
    consoleErrors,
    pageErrors,
    requestFailures,
    requestOrigins: [...requestOrigins].sort(),
    png,
  };
}

function readPackageFacts(names: string[]): Array<{ name: string; version: string; license: string }> {
  return names.map((name) => {
    const file = join(platformRoot, 'node_modules', ...name.split('/'), 'package.json');
    const json = JSON.parse(readFileSync(file, 'utf8')) as { version: string; license?: string };
    return { name, version: json.version, license: json.license ?? 'see package' };
  });
}

interface ModelReport {
  slug: string;
  title: string;
  releaseId: string;
  ifcSource: ModelSource;
  harnessUrl: string;
  runs: Array<{
    readyMs: number;
    bootMs: number;
    resourceBytes: number;
    responseCount: number;
    pixelStats: PixelStats;
  }>;
  timings: { readyMs: number[]; medianReadyMs: number; resourceBytes: number[] };
  probe: ProbeSnapshot | null;
  identity: IdentityCapture | null;
  screenshots: string[];
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
}

const report: {
  run: string;
  generatedAt: string;
  environment: Record<string, string | number>;
  browser: { version: string } | null;
  harness: Record<string, unknown>;
  candidate: { packages: Array<{ name: string; version: string; license: string }>; localAssetPolicy: string[] };
  models: Record<string, ModelReport>;
  limitations: string[];
} = {
  run: 'run-1',
  generatedAt: new Date().toISOString(),
  environment: {
    platform: process.platform,
    osRelease: osRelease(),
    arch: process.arch,
    node: process.version,
    cpu: cpus()[0]?.model ?? 'unknown',
    totalMemoryGiB: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
  },
  browser: null,
  harness: {
    baseURL: `http://127.0.0.1:${process.env.U4_PORT ?? 4399}`,
    viewport: '1280x900 @ dpr 1',
    coldLoadRuns: RUN_COUNT,
    browserCache: 'disabled via CDP Network.setCacheDisabled on every run',
    serverCacheControl: 'no-store',
    timingDefinition: 'performance.now() in the page minus navigation start: DOM -> WASM/worker init -> IFC -> fragments -> first painted frame with visible geometry',
  },
  candidate: {
    packages: readPackageFacts([
      '@thatopen/components',
      '@thatopen/fragments',
      'web-ifc',
      'camera-controls',
      'three',
      'vite',
    ]),
    localAssetPolicy: [
      'fragments worker: local Vite asset from @thatopen/fragments/worker (upstream getWorker() fetches unpkg.com and is not used)',
      'web-ifc WASM: local Vite asset web-ifc/web-ifc.wasm via IfcLoader.settings.wasm + absolute path (upstream autoSetWasm fetches unpkg.com and is not used)',
      'no COOP/COEP headers are served, so web-ifc selects the single-threaded WASM',
    ],
  },
  models: {},
  limitations: [
    'Cold-load timings are single-machine measurements in headless Chromium (SwiftShader software WebGL); they are not a network or hardware benchmark.',
    'The fragments worker fetches are not visible in performance.getEntriesByType("resource"); transferred bytes cover the page/asset/IFC requests only.',
    'Pixel statistics come from element screenshots of a continuously rendering WebGL canvas at one fitted camera pose; they prove non-empty geometry, not visual fidelity.',
  ],
};

test.describe('U4 compositor proof — That Open candidate over published IFC models', () => {
  test.afterAll(async ({ browser }) => {
    report.browser = { version: browser.version() };
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`u4-compositor: report written to ${join(evidenceDir, 'report.json')}`);
  });

  for (const slug of MODEL_SLUGS) {
    test(`${slug}: renders, resolves the identity contract and reports cold-load timing`, async ({
      browser,
      request,
      baseURL,
    }) => {
      test.setTimeout(300_000);
      const entry = await catalogEntry(request, slug);
      const source = await resolveModelSource(request, entry);
      const modelReport: ModelReport = {
        slug,
        title: entry.title,
        releaseId: entry.releaseId,
        ifcSource: source,
        harnessUrl: harnessUrl(source, entry, `u4-${slug}`),
        runs: [],
        timings: { readyMs: [], medianReadyMs: Number.NaN, resourceBytes: [] },
        probe: null,
        identity: null,
        screenshots: [],
        consoleErrors: [],
        pageErrors: [],
        requestFailures: [],
      };
      // Register early so a mid-test failure still yields partial (honest) evidence.
      report.models[slug] = modelReport;

      for (let run = 1; run <= RUN_COUNT; run += 1) {
        const capture = await runOnce(
          browser,
          baseURL!,
          source,
          entry,
          `u4-${slug}`,
          run === 1,
        );

        modelReport.consoleErrors.push(...capture.consoleErrors);
        modelReport.pageErrors.push(...capture.pageErrors);
        modelReport.requestFailures.push(...capture.requestFailures);
        expect(capture.consoleErrors, `${slug} run ${run} console errors`).toEqual([]);
        expect(capture.pageErrors, `${slug} run ${run} page errors`).toEqual([]);
        expect(capture.requestFailures, `${slug} run ${run} failed requests`).toEqual([]);
        // Local-only rule: every request must stay on the harness origin (no unpkg.com).
        expect(capture.requestOrigins, `${slug} run ${run} request origins`).toEqual([
          new URL(baseURL!).origin,
        ]);

        const stats = capture.pixelStats;
        expect(
          stats.modelPixels,
          `${slug} run ${run}: canvas has model pixels (${JSON.stringify(stats)})`,
        ).toBeGreaterThan(2_000);
        expect(stats.coverage, `${slug} run ${run}: model coverage`).toBeGreaterThan(0.02);
        expect(stats.coverage, `${slug} run ${run}: background remains visible`).toBeLessThan(0.98);
        expect(stats.uniqueColors, `${slug} run ${run}: shading variation`).toBeGreaterThan(16);
        expect(
          stats.backgroundPatchDistance,
          `${slug} run ${run}: observed backdrop matches the configured colour`,
        ).toBeLessThan(12);

        modelReport.runs.push({
          readyMs: capture.readyMs,
          bootMs: capture.bootMs,
          resourceBytes: capture.resourceBytes,
          responseCount: capture.responseCount,
          pixelStats: stats,
        });
        modelReport.timings.readyMs.push(capture.readyMs);
        modelReport.timings.resourceBytes.push(capture.resourceBytes);

        if (run === 1) {
          modelReport.probe = capture.probe;
          mkdirSync(evidenceDir, { recursive: true });
          const screenshotName = `${slug}.png`;
          writeFileSync(join(evidenceDir, screenshotName), capture.png);
          modelReport.screenshots.push(screenshotName);

          // Local asset wiring proof (mirrors the no-cloud request-origin assertion).
          expect(capture.probe.localAssets.workerMode).toBe('local-asset');
          expect(capture.probe.localAssets.workerUrl).toMatch(/^\/assets\/.*worker.*\.mjs/);
          expect(capture.probe.localAssets.wasmDir).toMatch(/^\/assets\/$/);
          expect(capture.probe.localAssets.wasmSingleThreaded).toBe(true);
          expect(capture.probe.scene.webgl2).toBe(true);
          expect(capture.probe.scene.tiles).toBeGreaterThan(0);
          expect(capture.probe.scene.itemsWithGeometry ?? 0).toBeGreaterThan(0);

          const identity = capture.identity;
          expect(identity, `${slug}: identity capture must run on run 1`).not.toBeNull();
          modelReport.identity = identity;
          expect(
            identity!.summary.allResolved,
            `${slug}: every published partId must resolve through id-map + Pset_DiyGuide ` +
              `(${JSON.stringify(identity!.summary)})`,
          ).toBe(true);
          expect(identity!.summary.total).toBe(capture.probe.idMapParts);
          expect(identity!.samplePartId, `${slug}: a sample part must exist`).toBeTruthy();
          expect(identity!.crossCheck, `${slug}: FragmentsManager.guidsToModelIdMap cross-check`).toBeTruthy();
        }
      }

      modelReport.timings.medianReadyMs = median(modelReport.timings.readyMs);
      console.log(
        `u4-compositor: ${slug} readyMs runs=${modelReport.timings.readyMs.join(', ')} ` +
          `median=${modelReport.timings.medianReadyMs.toFixed(1)} ms ` +
          `identity=${modelReport.identity?.summary.resolved}/${modelReport.identity?.summary.total}`,
      );
      report.models[slug] = modelReport;
    });
  }
});
