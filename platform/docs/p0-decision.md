# P0 decision record — contract and local runtime proof (2026-09-29)

Outcome ID: `P0-viewer-decision` (plan §15). This record is written by the manager from observed
evidence. `implemented` is not treated as `verified`; everything below states the level reached.

## Verdict

**P0 is verified for the frozen contract and the local runtime stack on the synthetic `p0-fixture`
project.** The authored bundle → validation → compiled guide → IfcOpenShell IFC → browser viewer →
guide UI → library journey was verified as a sequence of real artefacts with real tools and a real
browser: deterministic hashes, hold-safe status semantics, source traceability, a machine-checked
IFC/IDS result, a canvas render regression test, an axe accessibility gate and a Lighthouse record.
The IFC is emitted into the published data tree and the built site (gate order: data → IFC → site
build); the viewer itself consumes the compiled guide, not the IFC.

**The viewer-selection half of the planned P0 outcome is NOT satisfied and remains open (U4).**
The plan names That Open Components and Autodesk APS as the comparison candidates; neither was
integrated in this session:

- **That Open Components: not implemented.** The local engine is a three.js `ViewerAdapter`
  implementation (`packages/viewer-three`), explicitly the local development adapter, not a
  candidate selection. The plan's condition "That Open must pass to select it" was therefore never
  exercised.
- **Autodesk APS: `not_evaluated`.** No account, credentials, allowance or upload authority were
  available. No mock is presented as a pass. APS is printed `not_evaluated` in every gate summary.

Consequently: the platform contract is chosen and proven usable; the production viewer engine is
still an open decision to be resolved by the same sealed fixture and feature oracle against That
Open (and APS if resources exist).

## Second owner geometry review (corrections applied)

The first corrected frame was rejected again on missed construction contradictions; all eight
findings were fixed and are now pinned by tests (`geometry.test.ts`, 14 invariants):

1. **Header anatomy/BOM mismatch** — the single 88.9 mm-thick "2x6" is replaced by a truthful
   **doubled header**: two 2x6 plies (38.1 x 139.7) plus a 1/2 in plywood spacer, together filling
   the 88.9 mm wall thickness. Parts, material row (`material.lumber.header` 1 board yields both
   plies; `material.panel.header-spacer`), cut list, sheet D, IFC (`IfcBeam` plies) and the
   header bearing invariants all agree.
2. **Impossible stud-stock math** — one 2x4x8 board no longer claims both 2032 mm jacks (2 x 2032 >
   2438.4). Stud stock is 8 boards (one per full-height stud plus one per jack, whose offcut yields
   a cripple); every claimed board yield is tested against 2438.4 mm with a 3 mm kerf per cut, and
   the block material is now correctly labelled 2x6x8.
3. **Plate sequence** — the pre-cut left/infill/right representation is gone. A **continuous sole
   plate** is assembled, raised and anchored, then `open-doorway` removes it and installs the two
   **remaining segments** as explicit post-cut parts; the cut list states "used at full length,
   not pre-cut" and the BOM no longer claims one board yields three segments totalling the board.
4. **Anchors in the removed infill** — anchors are now three (152.4, 762, 2320 mm) on permanent
   plate segments only; the invariant rejects any anchor or fastener point inside the final clear
   span below the header.
5. **Bracing semantics** — the in-plane diagonal is renamed and re-documented as **anti-racking
   bracing** (shear), and a separate **out-of-plane plumb prop** (modeled and tested: reaches the
   floor, leans out of the wall plane) holds the frame plumb. Both are fitted at the raise step and
   removed/stored by two explicit remove operations after inspection, with no invented fastening
   guidance.
6. **End studs and layout** — both end studs are flush (19.05 / 2419.35) and the field studs sit on
   the 16 in module (406.4 / 812.8); the copy avoids claiming standard spacing beyond what is
   authored.
7. **Screenshot evidence** — camera presets were widened (`view.frame-flat`, `view.raise`,
   `view.frame`, `view.closeup-band` retargeted to both blocks), and the capture script now scrolls
   the viewer into view and **fails** when a stage shot does not show the canvas; all 24 stage shots
   show the complete relevant geometry at desktop, tablet and mobile.
8. **1068/1150 fix preserved** — the scroll-position overlap regressions still pass, and the new
   capture set includes `owner-1068-top.png` plus `owner-1068-scrolled.png`.

### Follow-up visual review corrections (v3.1)

Three narrow fixes after the raised-frame and 1068 px work passed visual review:

- **Flat-stage state** — the temporary racking brace and plumb prop are cut stock on the ground
  before the raise step; their upright geometry is now **hidden** in the cut/layout/assemble
  operation views (and shown installed again from `raise-frame`). Pinned by a compiler test that
  walks every pre-raise step state and requires the hiding, plus the existing viewer-core rule test
  that `view.hiddenPartIds` hides a renderable member.
- **Anchor evidence** — `view.anchor` is a wide permanent-segment view, fastener markers render at
  20 mm, and `viewer-render.spec.ts` now decodes the canvas and asserts **three spatially
  separated green clusters** (per-band counts plus centroid separation), so all three anchors must
  be in frame; the refreshed `desktop-anchored.png` shows all three clear of the door span, with
  none inside it (also a compiler invariant).
- **Kerf convention** — one documented convention (one 3 mm kerf per claimed cut) now applies in
  both the material notes and the yield invariant: header `2 x 1104.9 + 2 x 3 = 2215.8`, blocks
  `368.3 + 336.55 + 2 x 3 = 710.85`, stud `2362.2 + 3 = 2365.2`, jack+cripple
  `2032 + 190.5 + 2 x 3 = 2228.5`, brace `1339.2`, prop `2428.9` — each pinned by a test that
  checks the note contains exactly the computed total.

Current identity: **32 parts (31 in takeoff), 19 operations, 18 steps, 55 overlays; steps
ready 12 / conditional 2 / held 4; catalog summary ready 13 / conditional 2 / held 4 (operations);
2 open issues.** Release `sha256:88f82902…ed2bb74`, contentHash
`sha256:7d2a5ddf…30ac8fa989` (the flat-stage hiding and preset changes moved both hashes). Evidence: `../work/3d-platform/evidence/p0/ui-site/design-review/iter5/`
and the gate run below.

## P0 freeze

The synthetic fixture and its P0 gate were **frozen at run-13** (release
`sha256:88f82902…ed2bb74`, contentHash `sha256:7d2a5ddf…30ac8fa989`); run-13 stays as historical
evidence. After that freeze the viewer received a professional BIM presentation pass and the
fixture gained planned-preview reveal semantics, so the **current authoritative P0 gate is
`run-18`** (`p0-fixture sha256:73ad306c…e5ba7b`); runs 14–17 are kept as intermediate history.
The real `pantry-r35` project is gated separately by `npm run gate:r35`
(`work/3d-platform/evidence/r35/gate/run-3`, runs 1–2 history). The U4 That Open candidate was
evaluated and is **not adopted** (see `docs/u4-thatopen.md`). Nothing in R35 may relabel, replace or weaken the
synthetic fixture, and no R35 value may leak into reusable packages.

## What was verified (with evidence)

| Gate | Result | Evidence |
|---|---|---|
| T01 contracts (schema, fractions, GUIDs, transforms, hashes) | green (30 vitest files / 290 tests in the final gate) | `../work/3d-platform/evidence/p0/gate/run-13/` |
| T02 BIM (IFC 4.3, mm, IDS, control points) | green: 8/8 checks, 11/11 IDS specs, control-point deltas 0.000000 mm | `../work/3d-platform/evidence/p0/bim/run-1/` |
| T03 operations (statuses, step states, overlays, 8 negative bundles) | green | `../work/3d-platform/evidence/p0/gate/run-13/` |
| T04 viewer adapter (frame math, host semantics, canvas rendering) | green: unit scope plus a canvas decode test that fails on an empty scene and on lost camera framing | `../work/3d-platform/evidence/p0/gate/run-13/step-08-e2e-viewer-render.log` |
| T05 UX + sequencing (3 desktop viewports, reduced motion, WebGL-disabled fallback, frame-first order, intermediate widths) | green: 14/14 Playwright in the umbrella UX step (viewport clipping at 1280/1440/1920/768, viewer-before-tree ordering at 768/390, **no rail/panel overlap while scrolling at 1068/1150**, reduced motion, fallback, plus the 4 mandatory sequencing checks) | `../work/3d-platform/evidence/p0/gate/run-13/step-07-e2e-ux.log` |
| T07 thin E2E (library → held step → citation → inspect) | green: 2/2 Playwright | `../work/3d-platform/evidence/p0/gate/run-13/step-06-e2e-thin.log` |
| Accessibility (axe-core, 4 surfaces × desktop/mobile) | green: 0 serious/critical violations; landmarks, live region and keyboard tests pass | `../work/3d-platform/evidence/p0/gate/run-13/step-09-e2e-accessibility.log` |
| Lighthouse 12.8.2 (mobile emulation) | project page 97/100/100 (perf/a11y/best-practices); guided build 94/100/100 | `../work/3d-platform/evidence/p0/ui-site/lighthouse/` |
| T08 docs/examples + umbrella gate | green: `npm run gate:p0` 10/10 steps pass | `../work/3d-platform/evidence/p0/gate/run-13/` |

Determinism: compiling the fixture twice produced byte-identical `guide.compiled.json`;
`npm run data` produced a stable `releaseId`. Current accepted release:

- `contentHash` `sha256:9bb949153fad1e92fd84d5db740f5d09f49ce6cf8644217746d7b4e993a18905`
- `releaseId` `sha256:6b232b9c2e82cc434561656fcc0feeeb396361015d6e68ad99b4fdc0cb2734c3`

## Owner correction phase — realistic frame anatomy and intermediate-width UI

The first frame-first fixture was rejected on two grounds: the diagram did not read as credible
frame construction, and at ~1068 px the sticky step rail covered the instruction panel. Both were
corrected and are pinned by tests.

**Geometry (re-authored, not camera-patched).** The wall is now conventional platform framing:
segmented bottom plates with a temporary sole-plate infill across the opening, a single top plate,
five full-height studs (two of them king studs), two jack studs, a 2x6 header bearing on the jacks,
two cripples above the header, a semantic door-opening void (never a solid), and two 2x6 flat
backing blocks fitted inside their stud bays. The phantom brace was replaced by a temporary brace
that rises in the wall plane (rotated about Y, not Z), is fitted at the raise step and removed
after inspection. Fastener points are authored in world coordinates and land on the joints they
claim (36 screws over 18 joints; 4 anchors on the continuous plate before the doorway is cut).
`packages/compiler/tests/operations/geometry.test.ts` pins nine invariants (extents, vertical
studs, clear opening, header bearing, blocks inside bays, no plate in the final doorway, brace
plane, screw/anchor points on members). Counts: **28 parts (27 in takeoff), 18 steps, 52 overlays,
ready 12 / conditional 2 / held 4, 2 open issues.**

**Honest flat-assembly presentation.** `cut-frame`, `layout-frame` and `assemble-frame` carry the
presentation-only `layFlat` recipe (schema revision r3, `architecture.md` §6a): the wall members
and the opening rotate 90° about the canonical X axis through the wall origin for those steps, and
the frame is upright from `raise-frame` onward. The adapter resets to base matrices on every seek,
so direct links, back/forward and reduced motion reconstruct the identical pose; the pose never
touches data, takeoff or the IFC.

**Intermediate-width UI.** The failure was a rule-order defect: the base `.guide-sidebar` sticky
rule sat after the `max-width:1240px` media query, so it always won. The sidebar is now static by
default with a `min-width:1241px` sticky rule at the end of the sheet, and the control cards use
`align-items: start` with 38 px touch targets. New regressions scroll the full page at 1068x900
and 1150x900 and assert the rail never intersects the operation card or source panel; the
screenshots include `owner-1068-scrolled.png` (the reported width and scroll position).

**Safety semantics unchanged:** the backing fastening is still held with proposed placeholders
only, the backing inspection/cover/cabinet remain held through propagation, the conflicted opening
measurement remains held with its issue, and no held step is ever applied.

## Sequencing phase (frame-first fixture, owner-directed)

*(Superseded in detail by the owner correction phase below: the anatomy was re-authored to
conventional platform framing and the graph grew to 18 steps. Kept as the record of the first
sequencing attempt and its review.)*

The guided build now begins with the **wall frame**, not cabinet backing. The authored fixture was
re-authored to a 15-step graph with three phases — `Wall frame` (8 steps: verify planned dimensions
→ prepare materials/tools and the cut list → remove protection → cut → lay out → assemble → anchor →
inspect), `Cabinet backing` (4 steps) and `Services & finish` (3 steps) — with effective statuses
**ready 9 / conditional 2 / held 4**, 11 of 15 steps applied in the preview timeline, 27 overlays and
2 open issues. Cabinet-backing work transitively depends on `step.inspect-frame`; the backing
fastening hold still propagates to the backing inspection, the cover and the cabinet.

Owner-review corrections applied after the first fixture attempt, all verified:

1. **Frame screw quantities agree end to end** — sheet D, the material row (12), the connection
   pattern (2 per joint), the 12 authored screw points and the derived overlays all state
   2 screws × 6 joints = 12; the overlay points are per fastener, not per joint.
2. **The first task is verification of the build area and planned dimensions**, not a survey of a
   nonexistent frame: recommended copy "Verify wall-frame dimensions", targets only existing
   context parts, and the rough opening no longer starts installed (it becomes installed at frame
   assembly; the generated IFC carries `initialState: absent` for every frame product).
3. **Measurement truthfulness** — the false "stud spacing 42 in" was replaced by stud-centreline
   datums (stud 1 at 57.15, stud 2 at 1066.8, stud 3 at 2057.4 mm).
4. **Cabinet positioning depends on the completed wall covering** (`op.cover-drywall` /
   `step.cover-wall`), and therefore on the covering's inspection and service prerequisites.
5. **The displayed order is enforced by the graph** — cutting cannot bypass the temporary-protection
   removal (`step.cut-frame` requires `step.remove-temp`).
6. **Frame-first user-facing title** — "Wall Frame & Cabinet Backing" in the listing, project and
   thumbnail.
7. **E2E drift resolved**; `tests/e2e/sequence.spec.ts` pins the initial task, the phase order, the
   BOM/cut list before cuts, the 12-screw quantities, the frame-inspection gate and the held chain.
8. **Precise diagnostic** — `INVALID_CUT_OPERATION_REF` added to the frozen error contract (code
   union, blocking set, architecture §6 table) with a test; a wrong-kind `cutOperationIds` entry no
   longer masquerades as `DANGLING_REF`.
9. **IFC/state verification** — IfcOpenShell reopen shows `part.wall-a.stud-1`,
   `part.wall-a.opening` and `part.wall-a.backing` with `initialState: absent`; the first frame
   steps were human-reviewed in the live viewer (screenshots below).

Second owner visual review corrections:

- Mobile project hero now uses a contain layout: the full thumbnail artwork (title and subtitle) is
  visible at 390px.
- `SourceViewer` zooms to the authored `citation.region` with proportional padding and a
  "Show the full sheet" toggle, so the joint schedule and the 12-screw evidence are legible
  (`regionViewBox` clamp/pad behaviour pinned by unit tests); the source caption and accessibility
  labels are retained.
- Duplicate instruction copy removed: checks and stop conditions live on the operations (steps now
  carry no duplicated entries), and the card collapses near-duplicates when both levels provide
  text. The stale "Framed length reads 96 in" copy is gone.

Evidence: `../work/3d-platform/evidence/p0/seq-fixture/` (fixture/compiler),
`../work/3d-platform/evidence/p0/seq-ui/` (UI), `../work/3d-platform/evidence/p0/ui-site/design-review/iter3/`
(18 screenshots: project, initial frame task, preparation BOM/cut list, assembly, source crop and
inspect at 1440/768/390) and `../work/3d-platform/evidence/p0/gate/run-13/`.

Fixture semantics proven: 18 parts (17 in takeoff), 9 steps; `ready 3 / conditional 2 / held 4`;
held fastening is never applied and no fastener value is invented; the conditional cut propagates
its condition to the position step while still being applied as a labeled preview; the cable route
schematic is released and marked non-energized; conflicted opening width stays held with an open
issue; overlays are never part of takeoff.

## Deviations, corrections and contract notes

1. **Status propagation reconciled (contract fix).** Frozen architecture initially followed the
   draft fixture table (only hold propagated); plan §5 requires conditional dependencies to
   propagate conditions. The contract, fixture table, compiler and tests were updated so
   `step.position-backing` is effectively `conditional` (preview applied); the hold chain remains
   `fasten → inspect → cover → cabinet`. Recorded in `architecture.md` §5 and `fixture-p0.md`.
2. **Stale GUID test vector corrected.** The architecture document's first IFC-GUID vector was
   generated from a different name string; the document now carries the verified vectors. The
   compiler algorithm itself matched IfcOpenShell exactly from the start.
3. **UI defect found by T07 and fixed.** `PartCard` did not render the canonical `part.id`; a
   `Part id` row was added. The E2E assertion was not weakened.
4. **Contract gaps carried forward** (documented in `architecture.md`): `ViewerHost` does not
   expose adapter capabilities (app supplies them today); `ViewerAdapter` route/fastener overlays
   lack part/connection ids; `releaseId` URL colons must not be percent-encoded.
5. **Bounded inspection exceptions (plan §15).** Independent promotion-viewer inspection of the
   generated IFC was `not_run` (no GUI application available); the machine substitutes (IfcOpenShell
   reopen, geometry checks, IDS, signed control points) did run. Human legibility review of the
   three desktop sizes was replaced by machine assertions, not by a human inspection.
6. **Recovery budget.** Umbrella executions: run-1 and run-2 failed on two single, distinct
   defects (a missing UI field and the missing manager decision doc), each corrected with a focused
   fix and no oracle weakened; run-3 was green but the umbrella was still missing the T08 docs
   check, so the manager completed the gate (a completeness change with the reason recorded here,
   not a re-run of a failed check); run-4 was green at 8 steps; run-5..run-9 were green while the
   sequencing phase and its owner-review corrections were folded in; run-10 was green before the
   second geometry review, run-11 failed only at the
   IFC control-point check because the checker still carried the pre-correction fixture coordinates
   (stud-1 404.15 instead of 366.05, cover panel 956.6 instead of 969.3) — the check worked, the
   expectation was stale, and run-12 was green after updating it. No behaviour-affecting oracle was
   relaxed at any point.
7. **Independent reviewer findings dispositioned (all 12, one consolidated batch).** The fresh
   read-only review returned no blocking findings. Fixes applied: IFC preservation in the built
   tree (gate order `data → ifc → site build`, see finding 1); canvas rendering now has its own
   automated regression test (findings 2 and the double-scale defect the owner review surfaced);
   evidence citations corrected and superseded run-1 reports annotated (3); reserved release file
   names rejected (`UNSAFE_PATH`) with a test (4); trusted-bundle/lexical-containment and retained
   private metadata documented in `architecture.md` §7 (5, 6); tool proxies now derive a position
   and are covered by a test (7); held-banner wording prefers the compiled step-state reason (8);
   §5 wording tightened to "dependencies at or above conditional propagate" (9); canonical-JSON key
   order documented (10); direct schema validator tests added (11); stale GUID-test comment removed
   (12). Review found a real defect in the release record (`publishable` hard-coded true while
   errors existed), fixed and pinned by a new test.
8. **Owner-directed UI/UX polish pass** (holistic, not cosmetic): app shell and design tokens,
   user-facing copy with provenance demoted, compact project hero with one safety summary, short
   release id with copy action, viewer-dominant workspace with sticky step navigation and progress,
   mobile task ordering (viewer before the parts tree) with zero horizontal overflow at 390/768/1440,
   styled controls with pressed/focus/disabled states, and accessibility fixes found by axe
   (contrast, `dl` structure, listbox name, scrollable-region focus, heading order). A follow-up
   owner review at 768px found the task-order reflow still started below 760px; the ordering rules
   moved to ≤900px and `ux.spec.ts` now pins the viewer-before-tree/rail order at 768 and 390.
   Evidence: `../work/3d-platform/evidence/p0/ui-site/design-review/` (12 screenshots) and
   `../.../lighthouse/`.

## Requirements coverage for this P0 slice (plan §13)

| ID | Status in this build |
|---|---|
| R1 project-agnostic bundle | verified on the synthetic fixture only; a second fixture is still required before v1 is called reusable |
| R2 professional BIM output | verified by IfcOpenShell reopen + IDS; independent GUI inspection `not_run` |
| R3 dimensional fidelity | verified: control points and chains within 0.1 mm budget |
| R4 installation detail | verified: held connection exposes no invented values; released route exposes its path |
| R5 trade extensibility | demonstrated via capabilities and trade-tagged parts; one electrical demonstration only |
| R6 clickable model | list selection verified by T07; canvas rendering verified by the viewer-render pixel test; canvas-driven selection is exercised by the adapter tests, not by a pixel-click E2E |
| R7 guided sequence | verified deterministically (forward/back/direct) |
| R8 professional inspection | section/isolate/x-ray/measure/properties verified by tests and T07 |
| R9 desktop UX | verified at 1280×720, 1440×900, 1920×1080 plus 768/390 mobile captures (machine assertions) |
| R10 accessibility/fallback | axe-core gate green at desktop and mobile; keyboard and landmarks tests pass; WebGL-disabled fallback verified by T05 |
| R11 source traceability | verified: citations open exact regions of the synthetic sheets |
| R12 fast deployment | not proven; no host/publishing deployment exists yet |
| R13 minimal publishing authorization | not in scope (P4) |
| R14 predictable failures/privacy | failure paths and private-asset exclusion verified in compiler/UI tests; not a full redaction audit |
| R15 reproducible handoff | verified: hashes, id map, compiler identity and release manifest agree |
| R16 plan library | read side verified with one fixture; second fixture pending |
| R17 reliable agent push | not in scope (P4) |
| R18 R35 source conversion | blocked: the R35 source packet is absent from this repository |

## Next steps (recommended order)

1. **Integrate the That Open adapter** against the sealed fixture and run the same T04/T07 oracle;
   then either select it or record its measured failure.
2. Add a **second, distinct fixture** through the same pipeline to make the reuse claim real.
3. If publishing is wanted next, start **P4** (shared-token service, durable storage, idempotent
   receipts) only after a host capability probe.
4. **P1 remains blocked** until the R35 source packet (plan §16) exists in the repository; no
   R35-specific value may be invented in the meantime.
