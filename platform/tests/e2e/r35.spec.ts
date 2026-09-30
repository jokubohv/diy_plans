/**
 * Pantry R35 concept surface: axe at desktop/mobile, keyboard step navigation, held-step
 * semantics, pre-cut guidance and parts-tree/selection DOM parity.
 *
 * R35 is a concept, not a build-ready guide: these checks assert presentation and safety
 * semantics only (held work is never applied, no fastener quantities are inferred).
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const axeSource = readFileSync(
  new URL('../../node_modules/axe-core/axe.min.js', import.meta.url),
  'utf8',
);

async function r35Entry(request: Parameters<Parameters<typeof test>[1]>[0]['request']) {
  const catalog = await (await request.get('/data/catalog.json')).json();
  const entry = catalog.entries.find(
    (candidate: { slug: string }) => candidate.slug === 'pantry-r35',
  );
  expect(entry, 'the pantry-r35 entry must be published next to p0-fixture').toBeTruthy();
  return entry as { slug: string; releaseId: string };
}

test.describe('pantry r35 concept surface', () => {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    test(`no serious axe violations at ${viewport.name}`, async ({ page, request }) => {
      const entry = await r35Entry(request);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const routes = [
        ['project', `/plans/${entry.slug}`],
        ['build', `/plans/${entry.slug}/releases/${entry.releaseId}?mode=build`],
        ['inspect', `/plans/${entry.slug}/releases/${entry.releaseId}?mode=inspect`],
      ];
      for (const [name, path] of routes) {
        await page.goto(path, { waitUntil: 'load' });
        await page.waitForTimeout(1200);
        await page.addScriptTag({ content: axeSource });
        const results = await page.evaluate(async () => {
          // @ts-expect-error injected by axe
          return await window.axe.run(document, {
            resultTypes: ['violations'],
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
          });
        });
        const serious = results.violations.filter(
          (violation: { impact?: string }) =>
            violation.impact === 'serious' || violation.impact === 'critical',
        );
        expect(
          serious,
          `${name} (${viewport.name}) serious/critical axe violations: ${JSON.stringify(
            serious.map(
              (violation: { id: string; nodes: { target: string[]; html: string }[] }) => ({
                id: violation.id,
                nodes: violation.nodes.map((node) => ({
                  target: node.target.join(' '),
                  html: node.html.slice(0, 160),
                })),
              }),
            ),
          )}`,
        ).toEqual([]);
      }
    });
  }

  test('keyboard can reach and change R35 steps', async ({ page, request }) => {
    const entry = await r35Entry(request);
    await page.goto(`/plans/${entry.slug}/releases/${entry.releaseId}?mode=build`);
    const current = page.getByTestId('step-current-title');
    const first = await current.textContent();
    await page.getByTestId('next-step').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('step-rail-item-step.p5-trim-survey')).toHaveAttribute(
      'data-current',
      'true',
    );
    expect(await current.textContent()).not.toBe(first);
  });

  test('held R35 steps show the held banner and never infer quantities', async ({
    page,
    request,
  }) => {
    const entry = await r35Entry(request);
    await page.goto(`/plans/${entry.slug}/releases/${entry.releaseId}?mode=build`);
    await page.getByTestId('step-rail-item-step.p16-base-plates').click();
    await expect(page.getByTestId('held-banner')).toBeVisible();
    await expect(page.getByTestId('held-banner')).toContainText('do not perform this step');
    // The concept surface must not claim measured cuts or installed quantities for held work.
    await expect(page.locator('main.guide-main')).not.toContainText('Fasteners');
  });

  test('EX1 shows the widened held clearance preview without claiming a demolition cut', async ({
    page,
    request,
  }) => {
    const entry = await r35Entry(request);
    await page.goto(`/plans/${entry.slug}/releases/${entry.releaseId}?mode=build`);
    await page.getByTestId('step-rail-item-step.p20-ex1').click();
    const label = page.getByTestId('viewer-preview-label');
    await expect(label).toBeVisible();
    await expect(label).toContainText('WIDTH: 37 in minimum finished clear');
    await expect(label).toContainText('6 7/8 in');
    await expect(label).toContainText('DISPLAY HEIGHT: 80 in only');
    const operation = page.getByTestId('operation-op.open-ex1-passage');
    await expect(operation).toContainText('30 1/8-in span');
    await expect(operation).toContainText('Do not use the 6 7/8-in preview extension as a cut');
    await expect(page.getByTestId('held-banner')).toContainText('do not perform this step');
  });

  test('the setup step surfaces the released cut list before cutting', async ({ page, request }) => {
    const entry = await r35Entry(request);
    await page.goto(`/plans/${entry.slug}/releases/${entry.releaseId}?mode=build`);
    await page.getByTestId('step-rail-item-step.p7-setup').click();
    const plan = page.getByTestId('step-cut-plan');
    await expect(plan).toBeVisible();
    await expect(plan).toContainText('Before you cut');
    await expect(plan).toContainText('2x4x10');
    await expect(plan).toContainText('24 in');
    await expect(plan).toContainText('21 in');
    await expect(plan.locator('.step-cut-plan-list > li')).toHaveCount(5);
    await expect(page.getByTestId('operation-op.stage-tools')).toContainText(
      'only released cut list',
    );
    await expect(page.getByTestId('operation-op.stage-tools')).toContainText(
      'House plates, studs, backing, drywall and trim remain field-fit/held',
    );
  });

  test('wall lengths, schematic height and planning areas are displayed together', async ({
    page,
    request,
  }) => {
    const entry = await r35Entry(request);
    await page.goto(`/plans/${entry.slug}/releases/${entry.releaseId}?mode=build`);
    const summary = page.getByTestId('wall-dimension-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('W1 frame');
    await expect(summary).toContainText('156.75 in');
    await expect(summary).toContainText('W2 frame');
    await expect(summary).toContainText('53.125 in');
    await expect(summary).toContainText('111 in schematic height');
    await expect(summary).toContainText('65.7 sq ft');
    await expect(summary).toContainText('320.8 sq ft');
    await expect(summary).toContainText('not a stud, plate or drywall cut');
  });

  test('the top plate has a dedicated view and selected member dimensions', async ({
    page,
    request,
  }) => {
    const entry = await r35Entry(request);
    await page.goto(`/plans/${entry.slug}/releases/${entry.releaseId}?mode=build`);
    await page.getByTestId('step-rail-item-step.p16-top-restraint').click();
    await page.getByTestId('guide-mode-inspect').click();
    await page.getByTestId('camera-preset-view.top-plates').click();
    await page.waitForTimeout(350);
    const before = await page.getByTestId('viewer-canvas').screenshot();
    const topPlate = page.getByTestId('part-node-part.w1.top-plate');
    await topPlate.scrollIntoViewIfNeeded();
    await topPlate.click();
    await expect(topPlate).toHaveAttribute('aria-selected', 'true');
    const properties = page.getByTestId('part-properties');
    await expect(properties).toContainText('W1 single top plate');
    await expect(page.getByTestId('part-size-summary')).toContainText('156.75 in');
    await expect(page.getByTestId('part-size-summary')).toContainText('3.5 × 1.5 in');
    await expect(page.getByTestId('part-size-summary')).toContainText('111 in reported');
    const after = await page.getByTestId('viewer-canvas').screenshot();
    expect(after.equals(before), 'selected top plate changes the rendered viewport').toBe(false);
  });

  test('selecting a stud shows its dimensions in the 3D viewport without inventing a cut length', async ({
    page,
    request,
  }) => {
    const entry = await r35Entry(request);
    await page.goto(`/plans/${entry.slug}/releases/${entry.releaseId}?mode=inspect`);
    const stud = page.getByTestId('part-node-part.w1.stud-s06');
    await stud.scrollIntoViewIfNeeded();
    await stud.click();

    const dimensions = page.getByTestId('viewer-selection-dimensions');
    await expect(dimensions).toBeVisible();
    await expect(dimensions).toContainText('Vertical stud');
    await expect(dimensions).toContainText('Displayed height');
    await expect(dimensions).toContainText('108 in');
    await expect(dimensions).toContainText('Width');
    await expect(dimensions).toContainText('3.5 in');
    await expect(dimensions).toContainText('Thickness');
    await expect(dimensions).toContainText('1.5 in');
    await expect(dimensions).toContainText('Cut length: UNKNOWN — field-fit');
    await expect(dimensions).toContainText('111 in reported wall-height reference');
  });

  test('parts tree exposes R35 parts and selection shows their properties', async ({
    page,
    request,
  }) => {
    const entry = await r35Entry(request);
    await page.goto(`/plans/${entry.slug}/releases/${entry.releaseId}?mode=inspect`);
    await page.waitForTimeout(1200);
    const node = page.getByTestId('part-node-part.drywall.w1-p-01');
    await node.scrollIntoViewIfNeeded();
    await node.click();
    await expect(node).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('part-properties')).toContainText('Drywall panel W1-P-01');
  });
});
