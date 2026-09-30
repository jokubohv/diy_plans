# Pantry R35 reference project

`projects/pantry-r35/R35` is the real-source conversion of the owner's Pantry R35 conditional
manual, built as a **concept** alongside the synthetic `p0-fixture` regression project. It is a
second catalogue entry (`pantry-r35`), not a replacement: the fixture and its gates are unchanged.

## Sources and precedence

The external source tree is read-only. Conversion follows the plan of record (§16,
`pantry-interactive-3d-site-plan.md`): the R35 structured JSON, the 29-page R35 PDF and one-page
layout, the R35 change record and review, the R33 parts CSV (46 rows), R31 cabinet-backing CSV
(25), R34 drywall panel schedule (12) and R35 materials CSV (17), plus the current carry-forward
SVGs and supporting evidence with applicability/privacy limits. R35 supersedes the flat-built
nailer method while retaining older cited geometry. A field-level carry-forward/supersession map
is recorded in `work/r35/carry-forward-map.json`; the permit PDF and address/parcel identity stay
private (sanitized text-only excerpt cards are the public assets; see
`work/r35/private-public-map.json`).

## What is modelled

- W1 candidate 2x4 wall (S01–S12 at source centres, single top plate, treated candidate bottom
  plate) and W2 candidate 2x8 return (S01–S05), built in place — **no header, no door opening**;
  the passage is the separate existing EX1 closet and stays held.
- Existing context: tile-over-slab floor, EX1 wall/closet, retained kitchen-side door/jamb/casing,
  existing column, roof/truss reference band and candidate clearance volumes.
- All 25 flat 2x6 backing blocks (bay/elevation zones, 5.5-in vertical face, 1.5-in cavity depth),
  all 12 drywall panels/faces/endpoints and stock assignment, the cabinet/fridge/shelf/filler
  concept with unknown individual base widths kept schematic, trim zones TR-01…TR-04 and the
  connector candidates (A34/A34Z + SD9112 #9 × 1-1/2 in, 4+4 screws per accepted A34,
  `installedQuantity` null everywhere, no capacity/orientation claims).
- Measurements keep the exact dimension chain (149 in finished inside; ~68 in trial outside;
  ~63.5 in derived clear depth; 156.75 / 157.375 in plate comparisons; W2 8.375 = 7.25 + 0.5 +
  0.625 in; 53–53.125 in; the reported 111-in ceiling is never a stud cut).

## Status parity

Only the non-destructive survey scope and loose-scrap practice are ready; frame cuts, house
assembly/connections, slab drilling, truss attachment, EX1 alteration, drywall close-up, fixture
loading, selective trim removal and new baseboard installation stay held/conditional exactly as
the R35 releases state. Holds propagate transitively; G1–G7 are release/as-built gate records that
no browser action can satisfy.

## Evidence and gates

- Conversion artifacts: `work/r35/` (source inventory with hashes, carry-forward map, coverage
  matrix 29/29 pages represented, reconciliation 100 input rows → 68 represented / 4 excluded /
  28 merged / 0 spare-only, private-to-public map).
- Tests: `packages/compiler/tests/r35/` (sources/hashes, coverage, reconciliation, dimensions,
  geometry, sequence/parity, completeness, determinism).
- IFC: `bash scripts/ifc.sh pantry-r35` → 89 products, all checks pass, IDS 11/11
  (`work/3d-platform/evidence/r35/bim/run-1`).
- Gate: `npm run gate:r35` → `work/3d-platform/evidence/r35/gate/run-1` (unit tests, validate,
  data, IFC, build, captures) and the same BIM visual style as the P0 pass
  (`work/3d-platform/evidence/p0/ui-site/design-review/iter1-r35`).

## Limitations

R35 remains a concept with the source limits explicit: no member heights/elevations (schematic
wall height is labelled as a reported reference, not a cut dimension), no house cut lengths, no
slab layer stack or anchors, no truss chord/attachment, no connector counts/orientation/capacity,
no cabinet seam positions, no electrical/plumbing design. Unknown services and conflicts are held
issues and investigation stop conditions, not modelled installations.
