# That Open Engine candidate (U4) — decision record

**Status: evaluated; not adopted as the default viewer. Recommended follow-up only if an
IFC-first viewing requirement appears.**

The candidate phase (previously paused) was completed as a bounded, local-only evaluation:
`@thatopen/components` 3.4.8 + `@thatopen/fragments` 3.4.7 + `web-ifc` (pin 0.0.77) +
`camera-controls`, rendering the platform's own generated IFC for both projects.

## What was proven

- A standalone harness (`packages/viewer-thatopen`, not wired into the guide UI) initialises
  Components/Worlds/IfcLoader/FragmentsManager with a local worker URL and camera-controls, and
  renders both published models headlessly.
- Identity contract holds: every product resolves through `id-map.json`
  (`partId ↔ ifcGlobalId`) and `Pset_DiyGuide` — **32/32** (P0) and **89/89** (R35).
- Compositor proof: non-empty model renders with no console/page/request errors
  (`p0-fixture.png`, `pantry-r35.png` in the evidence run); served IFC bytes re-hashed and
  `check_ifc` (8/8) + IDS (11/11) pass for both regenerated models.
- 32 candidate unit tests (camera mapping, identity index, local-asset policy) and the full
  platform suite (411 tests) stay green.

## Measurements (1280×900, cache disabled)

| | P0 (32 parts) | R35 (89 parts) |
|---|---|---|
| Model pixels (3 runs) | 117,180 / 117,180 / 130,522 | 33,112 / 31,113 / 31,038 |
| Cold load (3 runs, median) | 1053.9 ms (median 1053.9) | 809.4 ms (median 809.4) |
| Bundle | 10,545,627 B raw / **1,952,691 B gzip** total | — |
| `viewer-three` baseline | ~148 KB gzip | — |

Licenses: MIT except **`web-ifc` MPL-2.0** (file-level copyleft; WASM dynamic link). Distribution
posture must be decided before any adoption.

## Notable findings

- `web-ifc@0.0.78` browser build is broken (`StreamMeshes` argument mismatch → BindingError);
  pin **0.0.77**.
- Fragments 3.4.7 excludes `IfcOpeningElement` by default; a public-API opt-in restores it
  (31/32 → 32/32 products).
- Upstream worker/WASM defaults fetch `unpkg.com`; replaced with local Vite assets — the harness
  made no off-origin requests.
- Interactive capabilities (picking, sections, x-ray, measurement, visibility, overlays,
  animations) were **not implemented**; only render, identity and camera fit were proven.

## Decision

Keep `viewer-three` as the default viewer (smaller, contract-complete, fully gated). Revisit the
candidate only if an IFC-first requirement appears; the follow-up scope is: implement the
remaining `ViewerAdapter` capabilities, keep the 0.0.77 pin + opening opt-in + local wiring,
decide the MPL-2.0 posture, and reuse this proof as a regression gate.

**Evidence:** `work/3d-platform/evidence/p0/u4-thatopen/run-1/` (README, report.json,
bundle-report.json, models manifest + check reports, compositor PNGs).
**Candidate code:** `packages/viewer-thatopen/`; **runner:** `bash scripts/u4-candidate.sh`.
