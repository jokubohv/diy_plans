# DIY Guide Platform — Architecture and Frozen Contracts (P0, 2026-09-29)

Implementation root for the plan `docs/plan-p3.md`. This session's authorized scope is **P0
("contract and professional stack proof")** with the synthetic `p0-fixture` project. The R35
source packet described in plan section 16 is **not present in this repository**; P1+ cannot
start until those sources exist. No Pantry R35 measurement may appear in reusable packages.

Status of this document: frozen contracts for P0 workers. Changing a contract requires the
manager to update this file and re-issue dependent work; workers must not change frozen
contracts on their own.

## 1. Layout

```
platform/
  packages/schema/       canonical JSON Schema + TS types + Ajv validators      (manager)
  packages/compiler/     authored bundle -> compiled guide, hashes, releases    (worker A)
  packages/viewer-core/  ViewerAdapter/ViewerHost contracts, step state logic   (worker B)
  packages/viewer-three/ local development adapter implemented with three.js    (worker B)
  packages/guide-ui/     reusable React components                              (worker C)
  apps/guide-site/       static site: library, project, embed routes            (worker C)
  projects/p0-fixture/   authored + compiled synthetic fixture                  (worker A)
  tools/ifc/             IfcOpenShell generation and checking (Python)          (worker D)
  scripts/               gate scripts                                           (worker D + manager)
  docs/                  contracts, decisions, guides                           (manager)
  tests/e2e/             Playwright end-to-end tests                            (worker D)
  work/3d-platform/evidence/p0/<packet>/<run>/   evidence as required by plan §15
```

`path` in JSON is always relative to the directory holding the released `guide.compiled.json`
(e.g. `assets/source-pages/x.svg`), so the site can serve `/data/releases/<slug>/<releaseId>/`
statically.

## 2. Coordinate contract (frozen)

- Canonical frame: right-handed, **Z-up**, millimetres. X along the primary wall datum, Y the
  named horizontal depth datum, Z up from the finished floor. Each project states its origin.
- Authored `placement`: `translationMm`, optional `rotationEulerDeg` `[rx,ry,rz]` degrees
  applied as `R = Rz * Ry * Rx` (X first) to column vectors, optional uniform/axis `scale`.
- `world = parentWorld * local`; matrices are column-major 16-number arrays with translation at
  indices 12-14 and bottom row `[0,0,0,1]` (classic OpenGL layout).
- Viewer boundary mapping for a Y-up metre engine:
  `viewer = [x/1000, z/1000, -y/1000]`, inverse `canonical = [vx*1000, -vz*1000, vy*1000]`.
  Handedness is preserved. Round-trip and section-plane conversion are pinned by tests.
- Measurement error budget for software conversion: **<= 0.1 mm** at fixture scale. Installation
  tolerance, display rounding and evidence confidence are separate concepts and never merged.

## 3. Identity contract (frozen)

- Every entity has a stable dotted `id` (schema pattern). Ids never change across package
  revisions; inserting a part must not renumber others.
- IFC identity: `uuid = uuidv5(namespace 6f8c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f, partId)`, then
  `ifcGlobalId = ifcCompress(uuid)` where ifcCompress is exactly IfcOpenShell
  `ifcopenshell.guid.compress`: hex string with `"0000"` prefix, standard base64, drop first two
  characters, translate through `STD="ABC…Zabc…z0-9+/"` -> `IFC="0123456789ABC…Zabc…z_$"`.
  Test vectors (namespace above; verified against IfcOpenShell 0.9.0 and pinned in compiler tests):
  - `part.wall-a.stud-1` -> uuid `a97a5c10-0e71-5ee7-854e-b6aa9532820d` -> `2fUbmG3d5UvuLEjggLCe8D`
  - `part.wall-a.backing` -> uuid `1d3cdde2-2321-53fe-83a3-da36be0ef0ad` -> `0TFDtY8o5J$eEZsZQ_3l2j`
  - `part.existing.slab` -> uuid `9d781497-3b47-55c7-bcd2-7a93e60dfc43` -> `2TU1INEqTLnxpIUfFc3Vn3`
  - `op.survey-wall` -> uuid `0ef25a43-13cc-5eb6-b671-a4819703e5bc` -> `0Eybf34ynUjhPnf86N0_My`
  - `overlay.fasten-backing.p1` -> uuid `dacf434f-7a58-54b3-b1cc-f651d8409aa5` -> `3QpqDFUbXKix7Czb7OG9gb`
- Overlay ids (`overlay.*`), tool proxies and schematic routes are presentation objects with
  stable ids; they are never part of material takeoff and never appear as IFC products.

## 4. Hash contract (frozen)

Canonical JSON: recursively sort object keys, preserve array order, `JSON.stringify` scalar
encoding (`sourceSetHash`/`contentHash` are `sha256:<64 lowercase hex>`).

- `sourceSetHash` = sha256 of the newline-joined lines
  `sha256:<hex of file><two spaces><path relative to the bundle dir>` over every authored file
  and every file referenced by a public source `assetPath`, **sorted by relative path**
  (byte-order).
- `canonicalJson` key order is the JavaScript `Object.keys(...).sort()` order (lexicographic UTF-16),
  which is stable for the string keys used in this schema. A reimplementation in another language
  must reproduce that exact order; integer-like object keys are not used anywhere in the bundle.
- `contentHash` = sha256 of canonical JSON of the semantic subset of the compiled guide:
  `project, datums, sources, citations, measurements, assemblies, parts, materials, tools,
  systems, connections, fastenerSpecs, operations, steps, views, issues, overlays, stepStates`.
  Excluded deliberately: `meta` (contains the hash and compiler identity), `stats`, `idMap`
  (derived), any timestamp or provider URN.
- `releaseId` = `sha256:` + sha256 of canonical JSON of `release-manifest.json` with its own
  `releaseId` field removed. A rebuild for a new viewer produces a new releaseId while
  `contentHash` stays identical.
- Compilation is deterministic: compiling the same bundle twice must produce byte-identical
  `guide.compiled.json`.

## 5. Status model (frozen)

Evidence states (`evidenceStatus`): `field_verified, document_verified, manufacturer_verified,
reported, derived, candidate, conflicted, unknown`. Release states (`releaseStatus`): `ready,
conditional, held, superseded, not_applicable`, with `ready` always scoped (`release.scope`:
`demonstration_only, practice_on_loose_scrap, site_installation, design_review`).

Rank used for propagation (higher wins): `not_applicable 0 < ready 1 < conditional 2 < held 3 <
superseded 4`.

- `operation.effectiveReleaseStatus = max(declared, max(dependency ops effective))` over the full
  rank order: a conditional dependency propagates a condition, a held dependency propagates a hold
  (plan §5). "Propagates" means dependencies ranked `conditional` or stricter are merged with the
  declared status; `ready` and `not_applicable` dependencies do not change the result. A chain that
  starts conditional therefore stays conditional downstream, and any hold dominates everything
  downstream of it.
- `step.effectiveReleaseStatus = max(declared, max(ops effective), max(prerequisites effective))`.
- `connection.effectiveReleaseStatus = declared` in P0 (no upstream graph yet).
- A `ready` operation with a missing/incomplete required parameter is a **blocking validation
  error**, never a silent downgrade: codes `READY_OP_MISSING_PARAMETERS` /
  `MISSING_FASTENER_PATTERN` / `MISSING_CONNECTION_SPEC`.
- Held dependencies propagate hold; conditional dependencies propagate conditional. A required
  dependency on a `superseded` record is a blocking error (`SUPERSEDED_DEPENDENCY`).

### Step state application (frozen)

`stepStates[i].before` is the previous step's preview snapshot; `.after` adds this step's state
effects when `applied` is true. Effects are applied when
`step.effectiveReleaseStatus in {ready, conditional}` **and** every operation of the step has
complete released parameters (guaranteed by validation for authored statuses). Otherwise
`applied=false` with a `reason` and the snapshot is unchanged.

- `ready` = performed in the guide.
- `conditional` = **preview only**: sourced geometry may be shown with a CONDITIONAL label;
  conditions must be resolved by an authorized content revision before real work.
- `held`/`superseded` = never applied; no entity may invent fasteners, quantities or values.
  A held step may still show proposed connection locations as dashed placeholders.

Coverage rule (blocking, `COVERAGE_BEFORE_INSPECTION`): an operation whose state effects set a
part to `covered` must have an `inspect` operation with `evidenceRequired != none` in its
dependency closure targeting the covered parts' assembly.

## 6. Compiled guide contract

`CompiledGuide` is validated by `diy-guide-compiled-0.1.0.schema.json`. Key additions over the
authored bundle: resolved `worldTransform` + `boundsMm` per part, `effectiveReleaseStatus` on
operations/steps/connections, derived `overlays`, `stepStates`, `stats`, `idMap`, `meta` with
hashes. The viewer never reads authored files.

Compiler validation (blocking unless noted):

| Code | Meaning |
|---|---|
| `MISSING_FILE` | authored file absent |
| `SCHEMA_INVALID` | Ajv violation (carry `jsonPath`) |
| `DUPLICATE_ID` | id used twice across collections |
| `DANGLING_REF` | unknown id reference |
| `UNSAFE_PATH` | asset path absolute/escaping/private source in public output |
| `MISSING_CITATION` | construction-significant fact without citation/derivation |
| `READY_OP_MISSING_PARAMETERS` | declared ready but required parameter null/empty |
| `MISSING_FASTENER_PATTERN` | fasten-ready operation with a connection lacking spec/pattern |
| `INVALID_CUT_OPERATION_REF` | `prepare.parameters.cutOperationIds` resolves to an operation that is not a `cut` |
| `CONFLICTED_MEASUREMENT_WITHOUT_ISSUE` | `conflicted` measurement with no open issue |
| `CYCLIC_DEPENDENCY` | operation or step dependency cycle |
| `COVERAGE_BEFORE_INSPECTION` | cover without prerequisite inspection |
| `SUPERSEDED_DEPENDENCY` | required dependency on superseded record |
| `UNSUPPORTED_CAPABILITY` | required capability not provided by builder 0.1.0 |
| `ACCEPTANCE_REJECTED` | acceptance.json status rejected |
| `SCHEDULE_INCONSISTENT` (warning) | step sequence not strictly increasing by dependency |
| `TAKEOFF_DOUBLE_COUNT` (warning) | assembly and child both contribute takeoff |

Error object shape (plan §9): `{ code, file, jsonPath, objectId, expected, actual, sourceRefIds }`.

Supported capabilities for builder 0.1.0: `woodFraming:1, drywall:1, cabinetry:1,
electricalUS:1, demonstrationOverlays:1`.

## 6a. Schema revision log (0.1.0, all additive)

| Revision | Change | Reason |
|---|---|---|
| r1 | `prepare` operation kind (`materialIds`, `toolIds`, `instruction`, optional `cutOperationIds`) | The owner-directed sequencing phase requires a preparation step that shows the phase bill of materials and cut list before any cutting. |
| r2 | Optional `step.phaseLabel` | Steps group into user-facing phases (wall frame → cabinet backing → services & finish) for the build-sequence overview and the grouped step rail. |
| r3 | Optional `recipe.layFlat` presentation pose (`partIds`, `axis`, `angleDeg`, `pivotMm`) | The owner-directed geometry phase requires an honest "assembled flat" stage for platform framing. The pose is presentation-only: adapters reset to base matrices on every seek (direct, back/forward, reduced motion all reconstruct it identically), and it never changes data, takeoff or the IFC. |
| r4 | Optional `recipe.schematicElevation` and `recipe.boxTransforms` presentation poses; `recipe.reveal` now renders absent context as a labelled translucent preview | Field-fit R35 wall footprints must read as walls without asserting a cut height, and loose/mock items must read in their instructional pose without rewriting canonical geometry. The adapter resets these poses on every seek and excludes their non-canonical surfaces from measurement; dimensions, states, takeoff and IFC remain canonical. |

These changes are additive: older bundles remain valid, and the compiler treats the new fields as
plain data. The authored `p0-fixture` and `pantry-r35` bundles are the presentation-pose
references.

## 7. Release output contract (`diy-guide data`)

```
<out>/
  catalog.json
  releases/<slug>/<releaseId>/
    guide.compiled.json
    release-manifest.json
    id-map.json
    assets/…                  # approved public assets only, paths preserved from the bundle
```

`catalog.json`:

```json
{
  "catalogVersion": 1,
  "generatedBy": { "name": "diy-guide-compiler", "version": "0.1.0" },
  "entries": [
    {
      "slug": "p0-fixture",
      "title": "…",
      "summary": "…",
      "projectType": "fixture_demo",
      "scope": "concept",
      "revision": "0.1.0",
      "updated": "2026-09-29",
      "releaseId": "sha256:…",
      "contentHash": "sha256:…",
      "thumbnailPath": "releases/p0-fixture/<releaseId>/assets/thumbnails/p0-fixture.svg",
      "route": "/plans/p0-fixture/releases/<releaseId>",
      "statusSummary": { "ready": 0, "conditional": 0, "held": 0, "superseded": 0 },
      "openIssueCount": 0
    }
  ]
}
```

`release-manifest.json`: `{ releaseId, slug, contentVersion, packageRevision, contentHash,
schemaVersion, builder, acceptanceStatus, publicationScope, publishable,
privateSourcesExcluded, files: [{path, sha256, bytes}], listing }`. Files list covers every
emitted file except the manifest itself. `publishable` is false when acceptance is rejected or
blocking errors exist. Private sources (`privacy: private`) are never copied; `excerpt_only`
sources may be copied as assets. Bundle assets are trusted content: containment is lexical
(`resolve` + prefix check) and the release writer rejects asset paths that would collide with its
own reserved file names (`guide.compiled.json`, `id-map.json`, `release-manifest.json`). The
compiled guide retains source *records* (id/title/assetPath) for traceability, including private
ones; sanitising those records for public publication is a P4 policy decision, not a P0 behaviour.

**URL note (contract):** `releaseId` is `sha256:<hex>`, so release URLs contain a literal colon.
The colon is a legal path character and must NOT be percent-encoded when building fetch URLs or
links (Vite's preview/static server does not decode `%3A` and would serve the SPA fallback).
Pinned by guide-ui tests.

## 8. Viewer contract (frozen)

`packages/viewer-core/src/types.ts` defines `ViewerAdapter` (engine) and `ViewerHost` (UI).
Rules: the UI only talks to `ViewerHost`; selection events return canonical part ids; one engine
owns the WebGL canvas; `applyState(snapshot, {animate, reducedMotion, recipe})` is a deterministic
seek (reset then apply) so back/forward/direct links/reduced-motion reconstruct identical state.

`recordingHost.ts` provides a headless `ViewerHost` for tests and for the text/2D fallback path
(no WebGL). `viewer-three` is the local development adapter: it is a P0 comparison implementation,
not the final engine decision; That Open remains the candidate to evaluate against the same
fixture (plan §12/§15).

**Known contract gap (P0, accepted):** `ViewerHost` does not expose adapter capabilities, so the
guide UI receives a `viewerCapabilities` prop from the app and mirrors recording-host values for
the no-WebGL path. Extend the frozen contract with a capability getter before a second engine
adapter is integrated (P0 decision record).

Visibility mapping: `absent`, `removed` hidden; `covered` hidden unless `showCovered` (then
ghosted); all other states visible. `xrayPartIds` render transparent; `isolatedPartIds` hides
everything else.

## 9. Commands (frozen for P0 evidence)

```
npm run typecheck                 # all workspaces
npm test                          # vitest (unit/contract/integration, not e2e)
npm run gate:contracts            # T01 slice
npm run gate:operations           # T03 slice
npm run gate:viewer               # T04 slice
npm run gate:bim                  # T02 slice (python venv + IfcOpenShell)
npm run build                     # data + vite build
npm run gate:thin-e2e             # T07 slice (playwright)
npm run gate:ux                   # T05 slice (playwright)
npx playwright test tests/e2e/viewer-render.spec.ts      # canvas render regression
npx playwright test tests/e2e/accessibility.spec.ts      # axe + landmarks + keyboard
npm run gate:docs                 # T08 slice (docs/examples)
npm run gate:p0                   # umbrella, runs the mandatory checks
```

The umbrella executes, in order: typecheck, unit tests, data, IFC generation/checks, the Vite site
build (after `data`/`ifc` so the model stays in the published tree), the four Playwright commands
(thin journey; UX **plus the mandatory sequencing suite**; canvas render; accessibility) and the
docs gate. `scripts/gate-p0.mjs` refuses to run if any spec listed in its `MANDATORY_E2E_SPECS`
guard is not covered by a mandatory step, so the recorded oracle cannot silently shrink. APS is
always reported as `not_evaluated` until an account exists.

## 10. Working rules for P0 workers

- Disjoint ownership: worker A owns `packages/compiler`, `projects/**`; worker B owns
  `packages/viewer-core`, `packages/viewer-three`; worker C owns `packages/guide-ui`,
  `apps/guide-site`; worker D owns `tools/ifc`, `scripts`, `tests/e2e`, `playwright.config.ts`.
  Nobody edits `packages/schema` or this document; return a proposal to the manager instead.
- Tests first where behavior exists: write the failing test, run it, then implement. Do not
  weaken an assertion to make a test pass; report to the manager.
- Never edit generated output by hand (`compiled/`, `public/data`, `dist/`).
- Evidence: record command, environment, expected/actual in
  `work/3d-platform/evidence/p0/<packet>/<run>/README.md` and keep it factual.
- `implemented` never means `verified`; only a green gate counts.
