import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import type { ReleaseStatus } from '@diyguide/schema';
import { STATUS_LABEL, StatusChip, statusRank, worstStatus } from '../src/status';
import { extractTag, render, textOf } from './render';

const ALL_STATUSES: ReleaseStatus[] = [
  'ready',
  'conditional',
  'held',
  'superseded',
  'not_applicable',
];

describe('statusRank', () => {
  it('follows the frozen propagation order (higher wins)', () => {
    expect(statusRank('not_applicable')).toBeLessThan(statusRank('ready'));
    expect(statusRank('ready')).toBeLessThan(statusRank('conditional'));
    expect(statusRank('conditional')).toBeLessThan(statusRank('held'));
    expect(statusRank('held')).toBeLessThan(statusRank('superseded'));
  });
});

describe('worstStatus', () => {
  it('returns the highest-ranked status', () => {
    expect(worstStatus(['ready', 'held', 'conditional'])).toBe('held');
    expect(worstStatus(['ready', 'ready'])).toBe('ready');
    expect(worstStatus(['superseded', 'held'])).toBe('superseded');
  });

  it('returns null when there is nothing to rank', () => {
    expect(worstStatus([])).toBeNull();
  });
});

describe('StatusChip', () => {
  for (const status of ALL_STATUSES) {
    it(`renders a visible label and icon for ${status}`, () => {
      const html = render(createElement(StatusChip, { status }));
      expect(html).toContain('data-testid="status-chip"');
      expect(html).toContain(`data-status="${status}"`);
      const iconTag = extractTag(html, 'data-icon');
      expect(iconTag).not.toBe('');
      const icon = /data-icon="([^"]+)"/.exec(iconTag)?.[1];
      expect(icon).toBeTruthy();
      expect(textOf(html)).toContain(STATUS_LABEL[status]);
    });
  }

  it('never distinguishes statuses by colour alone: every status has a distinct icon', () => {
    const icons = new Set<string>();
    for (const status of ALL_STATUSES) {
      const html = render(createElement(StatusChip, { status }));
      const icon = /data-icon="([^"]+)"/.exec(html)?.[1] ?? '';
      expect(icon).not.toBe('');
      icons.add(icon);
    }
    expect(icons.size).toBe(ALL_STATUSES.length);
  });

  it('renders an optional release scope next to the status text', () => {
    const html = render(createElement(StatusChip, { status: 'held', scope: 'demonstration_only' }));
    expect(html).toContain('data-scope="demonstration_only"');
    expect(textOf(html)).toContain('Demonstration only');
  });
});
