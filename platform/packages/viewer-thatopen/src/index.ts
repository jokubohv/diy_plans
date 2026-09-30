/**
 * U4 candidate evaluation package (`@diyguide/viewer-thatopen`).
 *
 * `camera` and `identity` are engine-agnostic: they pin the platform's canonical frame and
 * identity contract against the candidate's conventions and are covered by pure unit tests.
 * The browser harness (`index.html` + `src/harness/main.ts`) and the Playwright compositor
 * proof (`e2e/`) exercise the real `@thatopen/components` + `@thatopen/fragments` + `web-ifc`
 * stack. This package is an evaluation candidate; it is not wired into the guide UI.
 */
export * from './camera';
export * from './identity';
export * from './localAssets';
