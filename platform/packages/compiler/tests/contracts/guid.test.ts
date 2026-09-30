/**
 * Contract tests: identity (architecture.md §3, frozen).
 *
 * Every vector below is pinned against IfcOpenShell 0.9.0 `guid.compress`; the earlier historical
 * note about a stale `part.wallA.stud1` vector was removed when the manager corrected the
 * documented vectors (architecture.md §3 now lists only verified pairs).
 */
import { describe, expect, it } from 'vitest';
import { IFC_NAMESPACE, ifcCompress, ifcGuidForPart, uuidv5 } from '../../src/index';

describe('uuidv5 + IFC compression', () => {
  it('matches the frozen vectors that use current fixture ids', () => {
    expect(uuidv5('part.existing.slab')).toBe('9d781497-3b47-55c7-bcd2-7a93e60dfc43');
    expect(ifcGuidForPart('part.existing.slab')).toBe('2TU1INEqTLnxpIUfFc3Vn3');

    expect(uuidv5('op.survey-wall')).toBe('0ef25a43-13cc-5eb6-b671-a4819703e5bc');
    expect(ifcGuidForPart('op.survey-wall')).toBe('0Eybf34ynUjhPnf86N0_My');

    expect(uuidv5('overlay.fasten-backing.p1')).toBe('dacf434f-7a58-54b3-b1cc-f651d8409aa5');
    expect(ifcGuidForPart('overlay.fasten-backing.p1')).toBe('3QpqDFUbXKix7Czb7OG9gb');
  });

  it('pins the fourth documented uuid -> guid pair (compress direction)', () => {
    expect(ifcCompress('cf876ef0-e0cd-5e7f-8fde-14ef5831e1c7')).toBe('3FXsxmuCrUVu$U5EzOCU77');
    expect(ifcCompress('CF876EF0-E0CD-5E7F-8FDE-14EF5831E1C7')).toBe('3FXsxmuCrUVu$U5EzOCU77');
  });

  it('documents that the fourth vector name does not match the frozen fixture id', () => {
    // The documented pair derives from the earlier spelling `part.wallA.stud1`, not from
    // `part.wall-a.stud-1`; this is a docs/architecture.md §3 inconsistency, not a compiler bug.
    expect(uuidv5('part.wallA.stud1')).toBe('cf876ef0-e0cd-5e7f-8fde-14ef5831e1c7');
    expect(ifcGuidForPart('part.wall-a.stud-1')).toBe('2fUbmG3d5UvuLEjggLCe8D');
  });

  it('is deterministic and 22 characters long', () => {
    const first = ifcGuidForPart('part.wall-a.stud-1');
    expect(ifcGuidForPart('part.wall-a.stud-1')).toBe(first);
    for (const partId of ['part.wall-a.stud-1', 'part.wall-a.backing', 'part.loose.angle-3']) {
      expect(ifcGuidForPart(partId)).toHaveLength(22);
    }
  });

  it('rejects invalid uuids', () => {
    expect(() => ifcCompress('not-a-uuid')).toThrow();
    expect(() => uuidv5('x', 'not-a-uuid')).toThrow();
  });

  it('uses the frozen IFC namespace', () => {
    expect(IFC_NAMESPACE).toBe('6f8c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f');
  });
});
