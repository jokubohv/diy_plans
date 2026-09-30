/**
 * Session release pinning: once a release is chosen for a slug, the site keeps it for the rest
 * of the session ("latest per session; never switch under the user"). An explicit release id
 * from a direct link is always honoured.
 */
import type { CatalogEntry } from '@diyguide/guide-ui';

export interface ReleaseResolution {
  entry: CatalogEntry;
  releaseId: string;
  /** True when this call pinned the release for the session. */
  newlyPinned: boolean;
}

export class SessionReleasePins {
  private readonly pins = new Map<string, string>();

  pinnedReleaseId(slug: string): string | null {
    return this.pins.get(slug) ?? null;
  }

  /**
   * Choose the release to load for a slug: explicit `requestedReleaseId` wins, then the session
   * pin, then the entry's own releaseId (which is then pinned).
   */
  resolve(
    entries: readonly CatalogEntry[],
    slug: string,
    requestedReleaseId?: string | null,
  ): ReleaseResolution | null {
    const entry = entries.find((candidate) => candidate.slug === slug) ?? null;
    const pinned = this.pins.get(slug) ?? null;
    const releaseId = requestedReleaseId ?? pinned ?? entry?.releaseId ?? null;
    if (releaseId === null) return null;
    const resolvedEntry =
      entries.find(
        (candidate) => candidate.slug === slug && candidate.releaseId === releaseId,
      ) ??
      entry ??
      null;
    if (!resolvedEntry) return null;
    const newlyPinned = pinned === null;
    if (newlyPinned) this.pins.set(slug, releaseId);
    return { entry: resolvedEntry, releaseId, newlyPinned };
  }
}
