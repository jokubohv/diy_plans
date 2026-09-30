import { expect, test } from '@playwright/test';
import { headingStatusChip, openBuild, statusLine } from './support';

/**
 * T07 thin journey (packet D, `p0.ifc-e2e`).
 *
 * Library -> project -> guided build -> applied steps -> held step -> citation source viewer ->
 * deterministic back/forward seek -> inspect model -> not-found route. The held step must never
 * show a fastener quantity or an "installed" claim, and the canvas step state is compared
 * through the DOM-visible status line (never pixel comparison).
 */
test.describe('T07 thin journey', () => {
  test('library to inspect with a held step, sources and deterministic seeks', async ({ page }) => {
    await openBuild(page);

    // Step 1 of 9: applied, ready.
    await expect(page.getByTestId('step-current-title')).toHaveText('Verify wall-frame dimensions');
    await expect(page.getByTestId('step-rail-item-step.survey-wall')).toHaveAttribute(
      'data-current',
      'true',
    );
    await expect(headingStatusChip(page)).toHaveAttribute('data-status', 'ready');

    // A citation opens the source viewer with the highlighted region from the compiled guide.
    const citation = page.getByTestId('citation-link-citation.sheet-a.survey');
    await citation.click();
    await expect(page.getByTestId('source-viewer')).toBeVisible();
    const region = page.getByTestId('source-viewer-region');
    await expect(region).toBeVisible();
    await expect(region).toHaveAttribute('x', '60');
    await expect(region).toHaveAttribute('y', '60');
    await expect(region).toHaveAttribute('width', '420');
    await expect(region).toHaveAttribute('height', '240');
    await citation.click(); // toggle the source panel closed again

    // Advance through the applied steps of the frame-first sequence; statuses must match the
    // compiled propagation (cut-backing and position-backing are conditional, not held).
    const applied: Array<{ id: string; title: string; status: string }> = [
      { id: 'step.prepare-frame', title: 'Prepare frame materials and tools', status: 'ready' },
      { id: 'step.remove-temp', title: 'Remove temporary protection', status: 'ready' },
      { id: 'step.cut-frame', title: 'Cut frame members', status: 'ready' },
      { id: 'step.layout-frame', title: 'Lay out the frame (flat)', status: 'ready' },
      { id: 'step.assemble-frame', title: 'Assemble the frame (flat)', status: 'ready' },
      { id: 'step.raise-frame', title: 'Raise the frame and fit the temporary bracing', status: 'ready' },
      { id: 'step.anchor-frame', title: 'Anchor the bottom plate', status: 'ready' },
      { id: 'step.open-doorway', title: 'Open the door rough opening', status: 'ready' },
      { id: 'step.inspect-frame', title: 'Inspect the frame', status: 'ready' },
      { id: 'step.remove-brace', title: 'Remove the temporary bracing', status: 'ready' },
      { id: 'step.cut-backing', title: 'Cut backing blocks', status: 'conditional' },
      { id: 'step.position-backing', title: 'Position backing blocks', status: 'conditional' },
    ];
    for (const step of applied) {
      await page.getByTestId('next-step').click();
      await expect(page.getByTestId('step-current-title')).toHaveText(step.title);
      await expect(page.getByTestId(`step-rail-item-${step.id}`)).toHaveAttribute(
        'data-current',
        'true',
      );
      await expect(headingStatusChip(page)).toHaveAttribute('data-status', step.status);
    }
    await expect(page.getByTestId('conditional-banner')).toBeVisible();
    await expect(page.getByTestId('held-banner')).toBeHidden();

    // Deterministic seek: capture the DOM-visible status line before/after moving away.
    const atPositionBacking = await statusLine(page);

    await page.getByTestId('next-step').click();
    await expect(page.getByTestId('step-current-title')).toHaveText('Fasten backing blocks (held)');
    const atFastenBacking = await statusLine(page);
    expect(atFastenBacking.headingStatus).toBe('held');
    expect(atFastenBacking.railCurrent).toBe('step-rail-item-step.fasten-backing');
    expect(atFastenBacking).not.toEqual(atPositionBacking);

    // The held step banners and never invents fasteners, quantities or installed claims.
    await expect(page.getByTestId('held-banner')).toBeVisible();
    await expect(page.getByTestId('conditional-banner')).toBeHidden();
    const heldCard = page.getByTestId('operation-card-step.fasten-backing');
    await expect(heldCard).toBeVisible();
    await expect(heldCard.getByTestId('status-chip').first()).toHaveAttribute('data-status', 'held');
    await expect(heldCard.locator('[data-testid^="fastener-quantity-"]')).toHaveCount(0);
    await expect(heldCard.locator('[data-testid^="fastener-summary-"]')).toHaveCount(2);
    await expect(heldCard).toContainText('Proposed connection location only');
    await expect(heldCard).toContainText('is not released');
    await expect(heldCard).not.toContainText(/installed/i);
    await expect(heldCard).not.toContainText(/\b12\b/);
    await expect(heldCard).not.toContainText(/fasteners?\s+(per|at|@)/i);
    await expect(heldCard).not.toContainText(/specification:/i);

    // Back/forward returns the identical DOM-visible state (deterministic seek, no pixels).
    await page.getByTestId('prev-step').click();
    await expect(page.getByTestId('step-current-title')).toHaveText('Position backing blocks');
    expect(await statusLine(page)).toEqual(atPositionBacking);
    await expect(page.getByTestId('conditional-banner')).toBeVisible();
    await expect(page.getByTestId('held-banner')).toBeHidden();

    await page.getByTestId('next-step').click();
    await expect(page.getByTestId('step-current-title')).toHaveText('Fasten backing blocks (held)');
    expect(await statusLine(page)).toEqual(atFastenBacking);

    // Browser history: back to the project overview, forward to the guide again.
    await page.goBack();
    await expect(page.getByTestId('project-page')).toBeVisible();
    await page.goForward();
    await expect(page.getByTestId('step-rail')).toBeVisible();
    await expect(page.getByTestId('step-current-title')).toBeVisible();

    // Inspect model: parts tree -> part properties -> section slider -> show-covered toggle.
    await page.goBack();
    await expect(page.getByTestId('project-page')).toBeVisible();
    await page.getByTestId('mode-inspect').click();
    const studNode = page.getByTestId('part-node-part.wall-a.stud-1');
    await expect(studNode).toBeVisible();
    await studNode.click();
    const properties = page.getByTestId('part-properties');
    await expect(properties).toBeVisible();
    await expect(properties).toContainText('part.wall-a.stud-1');
    await expect(properties).toContainText('IfcMember');
    await expect(properties).toContainText('2fUbmG3d5UvuLEjggLCe8D');

    await expect(page.getByTestId('btn-section-clear')).toHaveCount(0);
    const slider = page.getByTestId('section-slider');
    await slider.fill('1500');
    await expect(page.getByTestId('btn-section-clear')).toBeVisible();
    await expect(page.getByTestId('section-axis-z')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('section-axis-x').click();
    await expect(page.getByTestId('section-axis-x')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('section-axis-z')).toHaveAttribute('aria-pressed', 'false');

    const showCovered = page.getByTestId('btn-show-covered');
    await expect(showCovered).not.toBeChecked();
    await showCovered.check();
    await expect(showCovered).toBeChecked();
  });

  test('unknown plan routes report a clear not-found message', async ({ page }) => {
    await page.goto('/plans/no-such-plan');
    await expect(page.getByText('Plan unavailable')).toBeVisible();

    await page.goto('/no-such-route');
    await expect(page.getByText('Page not found')).toBeVisible();
  });
});
