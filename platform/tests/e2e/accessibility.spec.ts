/**
 * Accessibility checks (axe-core) for the four site surfaces at desktop and mobile widths.
 *
 * Serious and critical violations fail the test. Console-level checks (landmarks, labels) are
 * covered by axe rules; the assertions below additionally pin the semantics we rely on.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const axeSource = readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

const routes = (slug: string, releaseId: string) => [
  ['library', '/'],
  ['project', `/plans/${slug}`],
  ['build', `/plans/${slug}/releases/${releaseId}?mode=build`],
  ['inspect', `/plans/${slug}/releases/${releaseId}?mode=inspect`],
];

test.describe('accessibility', () => {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    test(`no serious axe violations at ${viewport.name}`, async ({ page, request }) => {
      const catalog = await (await request.get('/data/catalog.json')).json();
      const entry = catalog.entries[0];
      expect(entry, 'a published plan must exist for this check').toBeTruthy();

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const [name, path] of routes(entry.slug, entry.releaseId)) {
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
            serious.map((violation: { id: string; nodes: { target: string[]; html: string }[] }) => ({
              id: violation.id,
              nodes: violation.nodes.map((node) => ({
                target: node.target.join(' '),
                html: node.html.slice(0, 160),
              })),
            })),
          )}`,
        ).toEqual([]);
      }
    });
  }

  test('landmarks and live regions exist on the guide page', async ({ page, request }) => {
    const catalog = await (await request.get('/data/catalog.json')).json();
    const entry = catalog.entries[0];
    await page.goto(`/plans/${entry.slug}/releases/${entry.releaseId}?mode=build`);
    await expect(page.locator('header.app-bar')).toBeVisible();
    await expect(page.locator('main.guide-main')).toBeVisible();
    await expect(page.locator('nav.guide-sidebar')).toBeVisible();
    await expect(page.locator('aside.guide-panel')).toBeVisible();
    await expect(page.locator('.guide-step-context[aria-live="polite"]')).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Guide progress' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'View mode' })).toBeVisible();
  });

  test('keyboard can reach and change steps', async ({ page, request }) => {
    const catalog = await (await request.get('/data/catalog.json')).json();
    const entry = catalog.entries[0];
    await page.goto(`/plans/${entry.slug}/releases/${entry.releaseId}?mode=build`);
    const current = page.getByTestId('step-current-title');
    const first = await current.textContent();
    await page.getByTestId('next-step').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('step-rail-item-step.prepare-frame')).toHaveAttribute(
      'data-current',
      'true',
    );
    expect(await current.textContent()).not.toBe(first);
  });
});
