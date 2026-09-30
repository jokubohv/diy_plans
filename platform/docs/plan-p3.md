# P3 plan of record — operative record for this repository

The full P3 plan text ("Reusable DIY BIM guide platform", revision P3, 2026-09-29) was supplied in
the build session. This file records the operative decisions, the current scope, and where the
frozen details live. It is the canonical project decision record alongside
[`architecture.md`](architecture.md).

## Status

- **Implementation authorized** for this session: build the platform and prove **P0** end to end
  with the synthetic fixture, running locally, exercised by real tests.
- **Owner-directed sequencing phase (current):** the authored fixture is being re-authored so the
  guided build starts with the **wall frame** (prepare → cut → layout → assemble → anchor →
  inspect) and cabinet backing begins only after the frame inspection. This is a fixture/content
  change: no R35 data, demonstration-only releases.
- **U4 viewer-selection phase is paused** at the owner's direction. Feasibility/license findings for
  the That Open candidate are recorded in
  `../work/3d-platform/evidence/p0/u4-thatopen/feasibility-paused.md`; no candidate code exists yet.
- **R35 is not present.** Plan §16 inputs (`output/…`, `work/R35…`, permit references) do not exist
  in this repository. P1–P5 cannot start for R35; nothing R35-specific may be invented. The P0
  fixture is explicitly synthetic (`release.scope: demonstration_only`).
- P0 result and deviations are recorded in [`p0-decision.md`](p0-decision.md).

## Decisions in force (plan §1, §18)

| ID | Decision | State |
|---|---|---|
| D1 | BIM/IFC plus an instruction bundle, not a mesh-only JSON model | decided |
| D2 | IfcOpenShell for programmatic BIM creation and checks | decided; installed 0.9.0 |
| D3 | Compare That Open and APS against the same P0 fixture; choose after measured results | That Open candidate not implemented in this session (see p0-decision); APS `not_evaluated` |
| D4 | Static frontend + small publishing service + durable files; no database | decided; publishing service is P4 (not built) |
| D5 | Fasteners/connections/wiring/checks/sources are first-class data | decided |
| D6 | Pantry R35 first reference fixture, never special-case code | decided; source packet absent |
| D7 | Library of plans; agents publish via one shared token; no visitor accounts | decided (P4) |
| D8 | Accepted authored bundle is the sole editable authority; IFC/compiled/viewer derived | decided |

## P0 scope as executed here (plan §15)

- Frozen contracts: schema `0.1.0`, coordinate/identity/hash/status rules, ViewerAdapter/ViewerHost,
  catalogue/release output (`architecture.md`).
- Synthetic fixture with existing surface, asymmetric short wall, three studs, opening, drywall
  panel, cabinet envelope, loose connector demonstration, removable temporary item and a
  non-energized cable-route/terminal schematic; cut → position → fasten → inspect → cover and
  remove transitions; one complete ready operation, one authored held, one falsely-ready
  operation rejected by validation (`fixture-p0.md`).
- Real chain: authored JSON → validation → compiled guide → IFC (IfcOpenShell) → viewer → guide
  UI → library → Playwright journey, all runnable locally.
- Error, publication-token, privacy and documentation checks: only the parts implementable in P0
  are claimed; P4 publication is explicitly not built.

## Requirements tracking (plan §13)

R1–R4, R6–R11, R14–R15 and the R18 *mechanism* (importer/validation semantics on synthetic data)
are in scope for the P0 gate; R5 is demonstrated by namespaced capabilities and trade-tagged
parts; R12/R13/R16/R17 belong to P4 (not built); R18 for the real R35 sources is blocked because
the sources are absent.
