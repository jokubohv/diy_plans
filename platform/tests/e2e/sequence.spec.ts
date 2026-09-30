/**
 * Sequencing regression: the guide must start with the wall frame, not cabinet backing, and the
 * held chain must stay held. Pins the owner-directed phase ordering and the preparation step's
 * bill of materials / cut list.
 */
import { expect, test, type Page } from '@playwright/test';
import { openBuild, statusLine } from './support';

const PHASES = ['Wall frame', 'Cabinet backing', 'Services & finish'];

async function phaseHeaderOrder(page: Page): Promise<string[]> {
  const headers = page.locator('[data-testid^="phase-header-"]');
  await expect(headers.first()).toBeVisible();
  return (await headers.allTextContents()).map((text) => text.replace(/\s+/g, ' ').trim());
}

test.describe('frame-first sequence', () => {
  test('opens on the survey and lists the frame phase first', async ({ page }) => {
    await openBuild(page);
    await expect(page.getByTestId('step-current-title')).toHaveText('Verify wall-frame dimensions');
    await expect(page.getByTestId('step-rail-item-step.survey-wall')).toHaveAttribute(
      'data-current',
      'true',
    );

    const order = await phaseHeaderOrder(page);
    for (const phase of PHASES) {
      const position = order.findIndex((text) => text.includes(phase));
      expect(position, `phase "${phase}" is present in the step rail`).toBeGreaterThanOrEqual(0);
      if (phase !== PHASES[0]) {
        const previous = order.findIndex((text) => text.includes(PHASES[PHASES.indexOf(phase) - 1]!));
        expect(position, `phase "${phase}" comes after the previous phase`).toBeGreaterThan(previous);
      }
    }

    // The frame work is listed before the first cabinet-backing step.
    const frameStep = page.getByTestId('step-rail-item-step.cut-frame');
    const backingStep = page.getByTestId('step-rail-item-step.cut-backing');
    const frameBox = await frameStep.boundingBox();
    const backingBox = await backingStep.boundingBox();
    expect(frameBox, 'cut-frame step has a box').not.toBeNull();
    expect(backingBox, 'cut-backing step has a box').not.toBeNull();
    expect(frameBox!.y).toBeLessThan(backingBox!.y);
  });

  test('preparation shows the frame bill of materials and cut list before any cut', async ({ page }) => {
    await openBuild(page);
    await page.getByTestId('step-rail-item-step.prepare-frame').click();
    await expect(page.getByTestId('step-rail-item-step.prepare-frame')).toHaveAttribute(
      'data-current',
      'true',
    );
    await expect(page.getByTestId('step-current-title')).toHaveText(/material|gather|prepare/i);

    const bom = page.getByTestId('prepare-bom');
    await expect(bom).toBeVisible();
    await expect(bom).toContainText('2x4x8'); // plate and stud stock labels
    await expect(bom).toContainText('2x6x8'); // header and backing-block stock labels
    await expect(bom).toContainText('Synthetic structural screw');
    await expect(bom).toContainText('Synthetic mechanical anchor');
    // Two screws at every one of the 20 frame joints must be reflected in the bill of materials,
    // and only the three permanent-segment anchors (none inside the door opening).
    await expect(page.getByTestId('prepare-bom-row-material.fastener.frame-screw')).toContainText(
      'Qty 40 each',
    );
    await expect(page.getByTestId('prepare-bom-row-material.fastener.frame-anchor')).toContainText(
      'Qty 3 each',
    );

    const cutList = page.getByTestId('prepare-cut-list');
    await expect(cutList).toBeVisible();
    // Display unit is inches with a 0.125 in precision step.
    await expect(cutList).toContainText('96 in'); // top plate
    await expect(cutList).toContainText('93 in'); // studs
    await expect(cutList).toContainText('80 in'); // jack studs
    await expect(cutList).toContainText('43.5 in'); // header plies and spacer
    await expect(cutList.locator('li')).toHaveCount(17); // plates, studs, kings, jacks, header plies, spacer, cripples, temporary bracing
  });

  test('cabinet backing waits for the frame inspection and stays conditional', async ({ page }) => {
    await openBuild(page);
    await page.getByTestId('step-rail-item-step.inspect-frame').click();
    await expect(page.getByTestId('step-rail-item-step.inspect-frame')).toHaveAttribute(
      'data-current',
      'true',
    );
    await expect(page.getByTestId('held-banner')).toBeHidden();

    await page.getByTestId('step-rail-item-step.cut-backing').click();
    await expect(page.getByTestId('conditional-banner')).toBeVisible();
    const line = await statusLine(page);
    expect(line.headingStatus).toBe('conditional');
  });

  test('the held chain is visible and the released route stays ready', async ({ page }) => {
    await openBuild(page);
    for (const stepId of ['step.fasten-backing', 'step.inspect-backing', 'step.cover-wall', 'step.position-cabinet']) {
      await page.getByTestId(`step-rail-item-${stepId}`).click();
      await expect(
        page.getByTestId('held-banner'),
        `${stepId} must show the held banner`,
      ).toBeVisible();
      await expect(page.getByTestId(`step-rail-item-${stepId}`)).toHaveAttribute(
        'data-current',
        'true',
      );
    }

    await page.getByTestId('step-rail-item-step.route-cable').click();
    await expect(page.getByTestId('held-banner')).toBeHidden();
    await expect(page.getByTestId('conditional-banner')).toBeHidden();

    // Held work is never applied: the backing blocks stay "positioned", not "installed", at the
    // fasten step (the compiler pins the state history; this is the DOM-visible cross-check).
    // The mode switch keeps the current step (continuity), so rewind deterministically first.
    await page.getByTestId('step-rail-item-step.survey-wall').click();
    await page.getByTestId('guide-mode-inspect').click();
    await expect(page.getByTestId('parts-tree')).toBeVisible();
    await expect(page.getByTestId('step-current-title')).toHaveText('Verify wall-frame dimensions');
    // 13 applied steps lead to the held fastening step in the 18-step graph.
    for (let index = 0; index < 13; index += 1) {
      await page.getByTestId('next-step').click();
    }
    await expect(page.getByTestId('step-current-title')).toHaveText('Fasten backing blocks (held)');
    await page.getByTestId('part-node-part.wall-a.backing-a').click();
    const partCard = page.getByTestId('part-properties');
    await expect(partCard).toContainText('part.wall-a.backing-a');
    await expect(partCard).toContainText('positioned');
    await expect(partCard).not.toContainText('installed');
  });
});
