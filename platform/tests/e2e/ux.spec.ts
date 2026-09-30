import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { headingStatusChip, openBuild, openInspect, statusLine } from './support';

/**
 * T05 UX slice (packet D, `p0.ifc-e2e`, extended by the owner UI review).
 *
 * - 1280x720 / 1440x900 / 1920x1080: essential controls visible and not clipped (step rail,
 *   operation card, viewer canvas fit the viewport horizontally; the page has no horizontal
 *   overflow).
 * - 768x1024 and 390x844: task order — current-step context and the viewer must come before the
 *   long step rail / parts tree; no horizontal overflow.
 * - reduced motion: stepping away and back reconstructs the identical DOM-visible state.
 * - WebGL disabled: `viewer-fallback` appears, full text instructions remain and source links
 *   stay operable.
 */

const VIEWPORTS = [
  { name: '1280x720', width: 1280, height: 720, desktop: true },
  { name: '1440x900', width: 1440, height: 900, desktop: true },
  { name: '1920x1080', width: 1920, height: 1080, desktop: true },
  { name: '768x1024', width: 768, height: 1024, desktop: false },
];

async function expectFitsInsideViewport(
  page: Page,
  testid: string,
  viewport: { width: number; height: number },
  options: { allowVerticalScroll?: boolean } = {},
): Promise<void> {
  const locator = page.getByTestId(testid);
  await expect(locator, `${testid} is visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${testid} has a bounding box`).not.toBeNull();
  expect(box!.width, `${testid} has width`).toBeGreaterThan(40);
  expect(box!.height, `${testid} has height`).toBeGreaterThan(20);
  expect(box!.x, `${testid} left edge inside viewport`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${testid} right edge inside viewport`).toBeLessThanOrEqual(
    viewport.width + 1,
  );
  expect(box!.y, `${testid} top edge inside viewport`).toBeGreaterThanOrEqual(0);
  if (!options.allowVerticalScroll) {
    expect(box!.y + box!.height, `${testid} bottom edge inside viewport`).toBeLessThanOrEqual(
      viewport.height + 1,
    );
  } else {
    expect(box!.y, `${testid} starts inside the first screen`).toBeLessThan(viewport.height);
  }
}

async function expectHorizontallyInsideViewport(
  page: Page,
  testid: string,
  viewport: { width: number },
): Promise<void> {
  const locator = page.getByTestId(testid);
  await expect(locator, `${testid} is visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${testid} has a bounding box`).not.toBeNull();
  expect(box!.width, `${testid} has width`).toBeGreaterThan(40);
  expect(box!.x, `${testid} left edge inside viewport`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${testid} right edge inside viewport`).toBeLessThanOrEqual(
    viewport.width + 1,
  );
}

for (const viewport of VIEWPORTS) {
  test(`essential controls are visible without clipping at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openBuild(page);
    // Measure the layout at the top of the guide page (clicking the project's mode button can
    // leave the window scrolled; that is a scroll position, not a layout clip).
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByTestId('step-rail')).toBeVisible();
    if (viewport.desktop) {
      await expect(page.getByTestId('step-rail')).toBeInViewport();
      await expectFitsInsideViewport(page, 'step-rail', viewport);
    } else {
      // Tablet/mobile task order puts step context and the viewer first; the rail sits lower on
      // the page, so only horizontal containment applies.
      await expect(page.getByTestId('viewer-canvas')).toBeInViewport();
      await expectHorizontallyInsideViewport(page, 'step-rail', viewport);
    }
    await expectFitsInsideViewport(page, 'viewer-canvas', viewport);
    await expectFitsInsideViewport(page, 'next-step', viewport);
    await expectFitsInsideViewport(page, 'step-current-title', viewport);
    if (viewport.desktop) {
      // On desktop the operation card starts inside the first screen (the page scrolls for the
      // rest); on tablet/mobile the task order intentionally places it after the viewer.
      await expectFitsInsideViewport(page, 'operation-card-step.survey-wall', viewport, {
        allowVerticalScroll: true,
      });
    } else {
      await expectHorizontallyInsideViewport(page, 'operation-card-step.survey-wall', viewport);
    }

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow, 'no horizontal overflow').toBeLessThanOrEqual(1);
  });
}

/**
 * Owner review finding: at 768px the parts tree used to come before the viewer, forcing users
 * through the whole tree before reaching the model. The viewer must precede the tree (inspect)
 * and the rail (build) at tablet and phone widths.
 */
for (const viewport of [
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
]) {
  test(`viewer precedes the parts tree and step rail at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await openInspect(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const inspectCanvas = await page.getByTestId('viewer-canvas').boundingBox();
    const tree = await page.getByTestId('parts-tree').boundingBox();
    expect(inspectCanvas, 'inspect viewer has a box').not.toBeNull();
    expect(tree, 'parts tree has a box').not.toBeNull();
    expect(
      inspectCanvas!.y,
      'inspect: the viewer must start above the parts tree',
    ).toBeLessThan(tree!.y);

    await openBuild(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const buildCanvas = await page.getByTestId('viewer-canvas').boundingBox();
    const rail = await page.getByTestId('step-rail').boundingBox();
    expect(buildCanvas, 'build viewer has a box').not.toBeNull();
    expect(rail, 'step rail has a box').not.toBeNull();
    expect(buildCanvas!.y, 'build: the viewer must start above the step rail').toBeLessThan(rail!.y);

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow, 'no horizontal overflow').toBeLessThanOrEqual(1);
  });
}

/**
 * Owner review finding: at ~1068px the layout became two columns, the sidebar stayed sticky and
 * could cover the instruction panel while scrolling. These checks scroll the whole page and assert
 * the rail/sidebar never intersects the operation card or source panel.
 */
for (const viewport of [
  { name: '1068x900', width: 1068, height: 900 },
  { name: '1150x900', width: 1150, height: 900 },
]) {
  test(`step rail never covers instruction content at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openBuild(page);
    await page.getByTestId('citation-link-citation.sheet-a.survey').click();
    await expect(page.getByTestId('source-viewer')).toBeVisible();

    const overlaps = async (): Promise<string | null> => {
      const rail = await page.getByTestId('step-rail').boundingBox();
      const operation = await page.getByTestId('operation-card-step.survey-wall').boundingBox();
      const source = await page.getByTestId('source-viewer').boundingBox();
      if (!rail) return 'step rail not visible';
      const intersects = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
        Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
      if (operation && intersects(rail, operation)) return 'rail overlaps the operation card';
      if (source && intersects(rail, source)) return 'rail overlaps the source panel';
      return null;
    };

    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const step = Math.max(200, Math.floor(viewport.height / 2));
    for (let offset = 0; offset <= scrollHeight; offset += step) {
      await page.evaluate((top) => window.scrollTo(0, top), offset);
      await page.waitForTimeout(60);
      expect(await overlaps(), `scroll offset ${offset}`).toBeNull();
    }

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow, 'no horizontal overflow').toBeLessThanOrEqual(1);
  });
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('step navigation still reconstructs the identical final state', async ({ page }) => {
    await openBuild(page);
    expect(
      await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    ).toBe(true);

    await page.getByTestId('step-rail-item-step.position-backing').click();
    await expect(page.getByTestId('step-current-title')).toHaveText('Position backing blocks');
    await expect(headingStatusChip(page)).toHaveAttribute('data-status', 'conditional');
    const conditionalState = await statusLine(page);

    await page.getByTestId('prev-step').click();
    await page.getByTestId('next-step').click();
    expect(await statusLine(page)).toEqual(conditionalState);

    await page.getByTestId('step-rail-item-step.route-cable').click();
    await expect(page.getByTestId('step-current-title')).toHaveText('Route schematic cable');
    await expect(headingStatusChip(page)).toHaveAttribute('data-status', 'ready');
    await expect(page.getByTestId('step-rail-item-step.route-cable')).toHaveAttribute(
      'data-current',
      'true',
    );
    await expect(page.getByTestId('conditional-banner')).toBeHidden();
    await expect(page.getByTestId('held-banner')).toBeHidden();

    await page.getByTestId('prev-step').click();
    await page.getByTestId('next-step').click();
    await expect(page.getByTestId('step-current-title')).toHaveText('Route schematic cable');
  });
});

test.describe('WebGL unavailable', () => {
  test('viewer-fallback keeps the complete instructions and sources operable', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null;
    });
    await openBuild(page);

    await expect(page.getByTestId('viewer-fallback')).toBeVisible();
    await expect(page.getByTestId('viewer-canvas')).toHaveCount(0);

    const fallback = page.getByTestId('viewer-fallback');
    await expect(fallback).toContainText('Verify wall-frame dimensions');
    await expect(fallback).toContainText(
      'Planned wall-frame length and height confirmed at 2438.4 mm against the approved dimension chain',
    );
    await expect(fallback).toContainText(
      'Stop if the build area cannot accept the planned 2438.4 mm frame or the approved dimensions are unavailable.',
    );

    const sourceLink = fallback.getByTestId('fallback-source-citation.sheet-a.survey');
    await expect(sourceLink).toBeVisible();
    const href = await sourceLink.getAttribute('href');
    expect(href).toMatch(/assets\/source-pages\/fixture-sheet-a\.svg$/);
    const response = await page.request.get(new URL(href!, page.url()).toString());
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('svg');

    await page.getByTestId('next-step').click();
    await expect(page.getByTestId('step-current-title')).toHaveText('Prepare frame materials and tools');
    await expect(page.getByTestId('viewer-fallback')).toBeVisible();
    await expect(page.getByTestId('viewer-canvas')).toHaveCount(0);
  });
});
