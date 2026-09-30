/**
 * Canvas render regression: the 3D viewer must actually draw the model, not just mount.
 *
 * This pins the P0 defect where part geometry was scaled twice (millimetres divided by 1000 and
 * then converted again by the part matrix), which rendered sub-millimetre parts and an empty
 * scene. Playwright screenshots the canvas element and the PNG is decoded in Node; a WebGL canvas
 * cannot be read back asynchronously in the browser because the drawing buffer is not preserved.
 *
 * The compositor thresholds below target the professional BIM workspace: a light neutral
 * backdrop, a contrasted model with crisp CAD edges, professional blue selection, and readable
 * proposed (red) versus released (green) overlay markers. Status is never colour-only in the UI;
 * colour is used here only as a rendering proxy.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

const BACKGROUND_DISTANCE = 30;
const EDGE_LUMINANCE = 150;

interface PixelStats {
  sampled: number;
  modelPixels: number;
  edgePixels: number;
  bluePixels: number;
  background: { red: number; green: number; blue: number };
  /** Best-contrast model pixel, used as a click target for selection checks. */
  focus: { x: number; y: number } | null;
}

async function canvasPixelStats(page: Page): Promise<PixelStats> {
  const buffer = await page.locator('.guide-viewer canvas').first().screenshot();
  const png = PNG.sync.read(buffer);
  // The top-left patch is always workspace backdrop, so it is a stable background reference.
  const patch = Math.min(16, png.width, png.height);
  let redSum = 0;
  let greenSum = 0;
  let blueSum = 0;
  let samples = 0;
  for (let y = 0; y < patch; y += 1) {
    for (let x = 0; x < patch; x += 1) {
      const index = (y * png.width + x) * 4;
      redSum += png.data[index] ?? 0;
      greenSum += png.data[index + 1] ?? 0;
      blueSum += png.data[index + 2] ?? 0;
      samples += 1;
    }
  }
  const background = {
    red: Math.round(redSum / samples),
    green: Math.round(greenSum / samples),
    blue: Math.round(blueSum / samples),
  };
  let modelPixels = 0;
  let edgePixels = 0;
  let bluePixels = 0;
  let focus: { x: number; y: number } | null = null;
  let focusSpread = -1;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const index = (y * png.width + x) * 4;
      const red = png.data[index] ?? 0;
      const green = png.data[index + 1] ?? 0;
      const blue = png.data[index + 2] ?? 0;
      const distance = Math.hypot(red - background.red, green - background.green, blue - background.blue);
      if (distance > BACKGROUND_DISTANCE) {
        modelPixels += 1;
        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        if (luminance < EDGE_LUMINANCE) edgePixels += 1;
        const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
        if (spread > focusSpread) {
          focusSpread = spread;
          focus = { x, y };
        }
      }
      if (blue - red > 80 && blue - green > 40 && blue > 90) bluePixels += 1;
    }
  }
  return {
    sampled: png.width * png.height,
    modelPixels,
    edgePixels,
    bluePixels,
    background,
    focus,
  };
}

async function openGuide(
  page: Page,
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  mode: 'build' | 'inspect',
): Promise<void> {
  const catalog = await (await request.get('/data/catalog.json')).json();
  const entry = catalog.entries[0];
  expect(entry, 'a published plan must exist for this check').toBeTruthy();
  await page.goto(`/plans/${entry.slug}/releases/${entry.releaseId}?mode=${mode}`);
  await page.waitForTimeout(2000);
}

test.describe('viewer renders the model', () => {
  test('the guided build canvas is a light BIM workspace with a contrasted, edged model', async ({
    page,
    request,
  }) => {
    await openGuide(page, request, 'build');
    const stats = await canvasPixelStats(page);
    expect(stats.background.red, `background ${JSON.stringify(stats.background)}`).toBeGreaterThan(200);
    expect(stats.background.green).toBeGreaterThan(200);
    expect(stats.background.blue).toBeGreaterThan(200);
    // Cool neutral backdrop, never the old navy canvas.
    expect(stats.background.blue).toBeGreaterThanOrEqual(stats.background.red);
    const ratio = stats.modelPixels / stats.sampled;
    expect(ratio, `model pixel ratio (model=${stats.modelPixels}/${stats.sampled})`).toBeGreaterThan(0.03);
    // Background must stay visible: no blank canvas, no full-screen overdraw.
    expect(ratio).toBeLessThan(0.9);
    // Crisp CAD edges: dark thin lines inside the model region.
    expect(stats.edgePixels, `edge pixels ${stats.edgePixels}`).toBeGreaterThan(300);
  });

  test('selection renders a professional blue outline on the light canvas', async ({
    page,
    request,
  }) => {
    await openGuide(page, request, 'build');
    // Preview parts are deliberately not pickable; the assemble step installs the wall members.
    await page.getByTestId('step-rail-item-step.assemble-frame').click();
    await page.waitForTimeout(900);
    const before = await canvasPixelStats(page);
    const canvas = page.locator('.guide-viewer canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const candidates: Array<[number, number]> = [
      [0.35, 0.4],
      [0.45, 0.45],
      [0.4, 0.6],
      [0.5, 0.5],
      [0.3, 0.5],
      [0.55, 0.55],
      [0.4, 0.45],
    ];
    let after = before;
    for (const [fractionX, fractionY] of candidates) {
      await page.mouse.click(box!.x + box!.width * fractionX, box!.y + box!.height * fractionY);
      await page.waitForTimeout(350);
      after = await canvasPixelStats(page);
      if (after.bluePixels > before.bluePixels + 80) break;
    }
    expect(
      after.bluePixels,
      `blue outline pixels before=${before.bluePixels} after=${after.bluePixels}`,
    ).toBeGreaterThan(before.bluePixels + 80);
    expect(after.bluePixels).toBeGreaterThan(80);
  });

  test('proposed and released overlay markers stay readable on the light canvas', async ({
    page,
    request,
  }) => {
    await openGuide(page, request, 'build');
    // Proposed fastener points (red wireframe) for the backing connection card.
    await page.getByTestId('step-rail-item-step.fasten-backing').click();
    await page.waitForTimeout(900);
    await page.evaluate(() => {
      const viewer = document.querySelector('.guide-viewer');
      if (viewer) viewer.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(300);
    const proposedBuffer = await page.locator('.guide-viewer canvas').first().screenshot();
    const proposedPng = PNG.sync.read(proposedBuffer);
    let proposedRed = 0;
    for (let index = 0; index < proposedPng.data.length; index += 4) {
      const red = proposedPng.data[index] ?? 0;
      const green = proposedPng.data[index + 1] ?? 0;
      const blue = proposedPng.data[index + 2] ?? 0;
      // 0xef4444 proposed red stays distinguishable from warm lumber on the light canvas.
      if (red > 170 && red - green > 60 && red - blue > 50) proposedRed += 1;
    }
    expect(proposedRed, `proposed overlay red pixels ${proposedRed}`).toBeGreaterThan(40);
  });

  test('the anchor preset frames all three permanent-segment anchors', async ({ page, request }) => {
    const catalog = await (await request.get('/data/catalog.json')).json();
    const entry = catalog.entries[0];
    await page.goto(`/plans/${entry.slug}/releases/${entry.releaseId}?mode=build`);
    await page.waitForTimeout(1500);
    await page.getByTestId('step-rail-item-step.anchor-frame').click();
    await page.waitForTimeout(900);
    await page.getByTestId('camera-preset-view.anchor').click();
    await page.waitForTimeout(900);
    // Scroll the viewer into view so the sticky step heading cannot cover the canvas screenshot.
    await page.evaluate(() => {
      const viewer = document.querySelector('.guide-viewer');
      if (viewer) viewer.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(300);

    const buffer = await page.locator('.guide-viewer canvas').first().screenshot();
    const png = PNG.sync.read(buffer);
    // Released overlay markers render green (0x22c55e). Count green pixels per horizontal third
    // and require three spatially separated clusters so all anchors must be in frame.
    const bands = [0, 0, 0];
    const bandX = [0, 0, 0];
    let green = 0;
    for (let y = 0; y < png.height; y += 1) {
      for (let x = 0; x < png.width; x += 1) {
        const index = (y * png.width + x) * 4;
        const red = png.data[index] ?? 0;
        const g = png.data[index + 1] ?? 0;
        const blue = png.data[index + 2] ?? 0;
        if (g > 100 && g - red > 25 && g - blue > 20) {
          const band = Math.min(2, Math.floor((x / png.width) * 3));
          green += 1;
          bands[band] += 1;
          bandX[band] += x;
        }
      }
    }
    const centroids = bands.map((count, band) => (count === 0 ? null : bandX[band] / count));
    expect(green, `released anchor overlay pixels present (bands ${bands.join('/')})`).toBeGreaterThan(120);
    bands.forEach((count, index) => {
      expect(count, `anchor green pixels in horizontal band ${index + 1} (bands ${bands.join('/')})`).toBeGreaterThan(10);
    });
    const known = centroids.filter((value): value is number => value !== null).sort((a, b) => a - b);
    expect(known).toHaveLength(3);
    expect(known[2]! - known[0]!, 'the three anchors are horizontally separated').toBeGreaterThan(png.width * 0.25);
  });

  test('camera presets keep the model in frame', async ({ page, request }) => {
    await openGuide(page, request, 'inspect');
    for (const preset of ['view.closeup-band', 'view.elevation', 'view.plan']) {
      await page.getByTestId(`camera-preset-${preset}`).click();
      await page.waitForTimeout(700);
      const stats = await canvasPixelStats(page);
      expect(stats.modelPixels, `preset "${preset}" rendered no model pixels`).toBeGreaterThan(500);
    }
  });

  test('the in-canvas BIM toolbar offers stable room navigation, full screen and an orientation cue', async ({
    page,
    request,
  }) => {
    await openGuide(page, request, 'build');
    const fit = page.getByTestId('viewer-fit-model');
    const eyeLevel = page.getByTestId('viewer-eye-level');
    const fullscreen = page.getByTestId('viewer-fullscreen');
    await expect(fit).toBeVisible();
    await expect(eyeLevel).toBeVisible();
    await expect(fullscreen).toBeVisible();
    await expect(fullscreen).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('img', { name: /Z axis is up/i })).toBeVisible();
    await fit.click();
    await page.waitForTimeout(800);
    const stats = await canvasPixelStats(page);
    expect(stats.modelPixels).toBeGreaterThan(1200);

    await eyeLevel.click();
    await page.waitForTimeout(500);
    const eyeLevelStats = await canvasPixelStats(page);
    expect(eyeLevelStats.modelPixels).toBeGreaterThan(500);
    await expect(page.getByText(/Right-drag: floor pan/i)).toBeVisible();

    await fullscreen.click();
    await expect(fullscreen).toHaveAttribute('aria-pressed', 'true');
    const expanded = await page.getByTestId('viewer-canvas').boundingBox();
    expect(expanded?.width ?? 0).toBeGreaterThan(page.viewportSize()!.width * 0.9);
    expect(expanded?.height ?? 0).toBeGreaterThan(page.viewportSize()!.height * 0.9);
    await fullscreen.click();
    await expect(fullscreen).toHaveAttribute('aria-pressed', 'false');
  });
});
