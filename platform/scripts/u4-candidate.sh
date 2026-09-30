#!/usr/bin/env bash
# U4 candidate evaluation entrypoint (packet U4).
#
# Local-only, no deployment: verifies/installs the candidate workspace dependencies, runs the
# package unit tests and typecheck, builds the standalone harness, records bundle bytes,
# ensures+validates the published/regenerated IFC artifacts, runs the Playwright compositor
# proof (non-empty render + identity contract + cold-load timings) and verifies the exact bytes
# that were rendered against the published compiled guide and IDS.
#
# Exit codes: 0 = evaluation passed; 1 = a real check failed; 2 = not_run (missing registry
# access, missing .venv-ifc toolchain or a missing harness asset) — printed with the reason,
# never disguised as a pass.
#
# Usage: bash scripts/u4-candidate.sh
# Env:   U4_EVIDENCE_DIR (default work/3d-platform/evidence/p0/u4-thatopen/run-1)
#        U4_PORT (default 4399)
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "${here}/.." && pwd)"
cd "${root}"

evidence="${U4_EVIDENCE_DIR:-${root}/work/3d-platform/evidence/p0/u4-thatopen/run-1}"
models="${evidence}/models"
port="${U4_PORT:-4399}"
export U4_EVIDENCE_DIR="${evidence}"
export U4_MODELS_DIR="${models}"
export U4_PORT="${port}"
mkdir -p "${evidence}"

step() { printf '\n== u4-candidate: %s ==\n' "$1"; }

not_run() {
  echo "not_run: $1" >&2
  exit 2
}

dep_check() {
  node -e '
    const fs = require("node:fs");
    const path = require("node:path");
    const root = process.cwd();
    const read = (name) => {
      try {
        return JSON.parse(
          fs.readFileSync(path.join(root, "node_modules", ...name.split("/"), "package.json"), "utf8"),
        );
      } catch {
        return null;
      }
    };
    const want = [
      ["@thatopen/components", "3.4.8"],
      ["@thatopen/fragments", "3.4.7"],
      ["web-ifc", "0.0.77"],
      ["camera-controls", null],
      ["three", "0.186.1"],
    ];
    const bad = [];
    for (const [name, version] of want) {
      const pkg = read(name);
      if (!pkg) bad.push(`${name}: missing`);
      else if (version && pkg.version !== version) bad.push(`${name}: ${pkg.version} != ${version}`);
    }
    if (bad.length > 0) {
      console.error(bad.join("\n"));
      process.exit(1);
    }
    console.log(want.map(([name]) => `${name}@${read(name).version}`).join(" "));
  '
}

step "1/8 dependency check"
if ! dep_check; then
  step "1/8 installing workspace dependencies"
  npm install --no-audit --no-fund || not_run "npm install failed (registry unavailable?)"
  dep_check || not_run "candidate dependencies are still unavailable after npm install"
fi

step "2/8 package unit tests (camera mapping, identity contract, local-asset policy)"
npx vitest run packages/viewer-thatopen

step "3/8 package typecheck (src + harness + e2e)"
npm run -w @diyguide/viewer-thatopen typecheck

step "4/8 ensure renderable IFC artifacts (published release or deterministic regeneration)"
node scripts/u4-prepare-models.mjs ensure --evidence "${evidence}"

step "5/8 build harness (vite build)"
npm run -w @diyguide/viewer-thatopen build

if [[ ! -f "${root}/packages/viewer-thatopen/dist/assets/web-ifc.wasm" ]]; then
  not_run "harness build has no local web-ifc WASM asset (packages/viewer-thatopen/dist/assets/web-ifc.wasm)"
fi
if [[ ! -f "${root}/packages/viewer-thatopen/dist/assets/worker.mjs" ]]; then
  not_run "harness build has no local fragments worker asset (packages/viewer-thatopen/dist/assets/worker.mjs)"
fi

step "6/8 bundle bytes"
node scripts/u4-bundle-report.mjs "${evidence}/bundle-report.json"

step "7/8 compositor proof (non-empty render, identity contract, 3 cold-load runs per model)"
npx playwright test -c packages/viewer-thatopen/playwright.config.ts

step "8/8 verify served IFC bytes against published compiled guide + IDS"
node scripts/u4-prepare-models.mjs verify --evidence "${evidence}"

step "evidence"
ls -la "${evidence}"
echo "u4-candidate: OK"
