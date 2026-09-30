import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Shared helpers for the packet D Playwright specs. Every locator here comes from the frozen
 * `data-testid` contract in packet C; the one implementation testid used for scoping is
 * `operation-card-<stepId>` (rendered by `OperationCard`, used only to bound text assertions so
 * held-step content cannot hide behind unrelated page text).
 */

export const FIXTURE_SLUG = 'p0-fixture';

export function catalogCard(page: Page): Locator {
  return page.getByTestId(`catalog-card-${FIXTURE_SLUG}`);
}

/** Library -> project -> guided build, the frozen T07 entry path. */
export async function openBuild(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('library-page')).toBeVisible();
  await catalogCard(page).getByRole('link').click();
  await expect(page.getByTestId('project-page')).toBeVisible();
  await page.getByTestId('mode-build').click();
  await expect(page.getByTestId('step-rail')).toBeVisible();
  await expect(page.getByTestId('step-current-title')).toBeVisible();
}

/** Library -> project -> inspect mode. */
export async function openInspect(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('library-page')).toBeVisible();
  await catalogCard(page).getByRole('link').click();
  await expect(page.getByTestId('project-page')).toBeVisible();
  await page.getByTestId('mode-inspect').click();
  await expect(page.getByTestId('parts-tree')).toBeVisible();
  await expect(page.getByTestId('part-select-hint')).toBeVisible();
}

/** Status chip in the current-step heading (the DOM-visible status line). */
export function headingStatusChip(page: Page): Locator {
  return page.getByTestId('step-current-title').locator('..').getByTestId('status-chip');
}

export interface StatusLine {
  title: string | null;
  headingStatus: string | null;
  railCurrent: string | null;
  chips: Array<{ status: string | null; text: string }>;
}

/**
 * DOM-visible status line for the current step: title, heading status, the rail's current item
 * and every status chip (status + text, in DOM order). Used to prove that stepping away and
 * back reconstructs the identical state without any pixel comparison.
 */
export async function statusLine(page: Page): Promise<StatusLine> {
  const title = await page.getByTestId('step-current-title').textContent();
  const headingStatus = await headingStatusChip(page).getAttribute('data-status');
  const railCurrent = await page
    .locator('[data-testid^="step-rail-item-"][data-current="true"]')
    .getAttribute('data-testid');
  const chips = await page.getByTestId('status-chip').evaluateAll((nodes) =>
    nodes.map((node) => ({
      status: node.getAttribute('data-status'),
      text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
    })),
  );
  return {
    title: title?.trim() ?? null,
    headingStatus,
    railCurrent,
    chips,
  };
}
