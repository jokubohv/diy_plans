/**
 * Local-only asset policy for the U4 candidate harness.
 *
 * Upstream defaults violate the packet's "local packages only, no cloud services" rule:
 * `FragmentsManager.getWorker()` fetches the worker from `unpkg.com` and
 * `IfcLoader.autoSetWasm = true` resolves the web-ifc WASM through `unpkg.com` too. The
 * harness must therefore (a) emit the worker bundled with the installed `@thatopen/fragments`
 * package as a local asset and (b) point web-ifc at the local `web-ifc.wasm`. These helpers
 * keep that policy testable and fail loudly when a remote URL would be used.
 */

/** True when a URL would leave the origin (protocol-absolute or protocol-relative). */
export function isRemoteAssetUrl(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//');
}

/**
 * Reject remote asset URLs. `context` names the asset for the error message.
 * Only same-origin/relative URLs (including Vite's absolute `/assets/...` output) pass.
 */
export function assertLocalAssetUrl(url: string, context: string): string {
  if (isRemoteAssetUrl(url)) {
    throw new Error(`${context} must be a local asset URL, got remote URL: ${url}`);
  }
  return url;
}

/**
 * Directory prefix for `web-ifc`'s `SetWasmPath(path, absolute=true)` from a local asset URL:
 * web-ifc then appends the WASM file name (`web-ifc.wasm`) to this prefix.
 */
export function wasmDirectoryFromAssetUrl(url: string): string {
  const cut = url.lastIndexOf('/');
  if (cut < 0) {
    throw new Error(`local wasm asset URL has no directory segment: ${url}`);
  }
  return url.slice(0, cut + 1);
}
