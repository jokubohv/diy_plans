# P0 fixture specification — `projects/p0-fixture/0.1.0/`

Synthetic demonstration project. Every value below is invented for pipeline proof; nothing here
is construction guidance. `release.scope` for every record is `demonstration_only`. The wall is a
conventional platform-framed assembly with a supported door rough opening; it is not a structural
design and carries no code-compliance claim.

**Job sequence (frame first):** `Wall frame` (verify → prepare materials/tools and cut list →
remove protection → cut members → lay out flat → assemble flat → raise and fit temporary bracing →
anchor → open the door opening → inspect → remove the bracing) must be complete and inspected
before `Cabinet backing` (cut → position → fasten (held) → inspect) may begin, followed by
`Services & finish` (route cable → cover wall → position cabinet). Effective statuses: **steps
ready 12 / conditional 2 / held 4** (operations 13/2/4).

## Wall anatomy (wall-a local; assembly at world (347, 82, 0))

2438.4 mm (96 in) long and high, 88.9 mm deep; 2x4 members 38.1 x 88.9; door rough opening
952.5 mm wide (between jack studs) and 2070.1 mm high (under the header).

| element | ids | details |
|---|---|---|
| sole plate | `part.wall-a.bottom-plate` (continuous), `part.wall-a.bottom-plate-left`, `part.wall-a.bottom-plate-right` | One continuous plate 2438.4 anchored first; the doorway section is then cut out, and the two **remaining segments** (1244.6 and 241.3) are the post-cut representation (absent until that step). The plate is never claimed as pre-cut. |
| top plate | `part.wall-a.top-plate` | Single top plate, used at full board length (documented synthetic choice). |
| end studs | `part.wall-a.stud-1`, `part.wall-a.stud-4` | Flush with the plate ends (centres 19.05 and 2419.35). |
| field studs | `part.wall-a.stud-2`, `part.wall-a.stud-3` | Centres 406.4 and 812.8 mm — the 16 in module from the wall origin. No other spacing is claimed. |
| opening framing | `part.wall-a.king-left`, `king-right`, `jack-left`, `jack-right` | Kings at 1187.45 / 2254.25 (full height 2362.2); jacks at 1225.55 / 2216.15 (2032). |
| header | `part.wall-a.header-ply-a`, `header-ply-b`, `header-spacer` | **Doubled header**: two 2x6 plies (1104.9 x 38.1 x 139.7, `IfcBeam`) plus a 1/2 in plywood spacer (1104.9 x 12.7 x 139.7). 38.1 + 12.7 + 38.1 = 88.9 = wall depth. Both plies bear on both jacks. |
| cripples | `part.wall-a.cripple-1`, `cripple-2` | 190.5 (7.5 in) between the header and the top plate. |
| opening void | `part.wall-a.opening` | Semantic void, never a solid, excluded from takeoff. |
| backing | `part.wall-a.backing-a`, `backing-b` | 2x6 flat blocks (368.3 and 336.55) fitted in the stud 2→3 and stud 3→king bays. |
| temporary bracing | `part.demo.temp-racking-brace`, `part.demo.temp-plumb-prop` | In-plane diagonal (1336.2, rotated about Y) resisting **racking**; separate out-of-plane prop (2425.9, rotated about X) holding the frame **plumb** from the top of the frame to the floor. Both fitted at the raise step, removed after inspection and stored. |

Existing/schematic/demo parts keep their semantics (slab, cover panel trimmed to the opening,
cabinet envelope, protection panel, schematic cable/box/terminal, three loose brackets parked
clear of the wall footprint). **32 parts**, 31 in takeoff (the void is excluded).

Expected compiled world control points (pinned by tests): stud-1 `[366.05, 126.45, 1219.2]`,
header ply A `[2067.85, 101.05, 2139.95]`, racking brace `[829.9, 62.95, 619.05]`, plumb prop
`[753.4, -219, 1175]`, cover panel `[969.3, 75.65, 1219.2]`, slab `[1600, 1200, -50]`.

## Stock, yields and kerf

Every claimed board yield is checked against `8 ft = 2438.4 mm` with a 3 mm kerf per cut
(`geometry.test.ts`): one board per full-height stud (2362.2); one board per jack (2032) whose
offcut also yields one cripple (190.5); one 2x6x8 board for both header plies (2 x 1104.9); one
board each for the racking brace (1336.2) and plumb prop (2425.9); one 2x6x8 board for both
backing blocks (368.3 + 336.6). The two plate boards are used at **full length with no cut**, and
the doorway section is removed from the anchored plate rather than pre-cut. Materials: plate
stock 2, stud stock 8, header 1, header spacer 1, brace 1, prop 1, block 1, frame screws 40,
anchors 3, plus drywall, protection panel, withheld backing screws (8), cable and brackets.

## Measurements (18)

Wall length/height; opening width 952.5 (conflicted/held) and height 2070.1; stud 2362.2; jack
2032; header ply and spacer 1104.9; cripple 190.5; stud centrelines 19.05 / 406.4 / 812.8 /
2419.35; **remaining plate segments 1244.6 and 241.3** (derived); block lengths 368.3 / 336.55;
cabinet width 609.6.

## Connections

| id | from → to | method | spec | pattern | declared |
|---|---|---|---|---|---|
| `connection.frame.plate-to-stud` | continuous bottom plate → stud-1 (typical joint) | screw | `fastener.frame-screw` | line, 2 per joint, 80 mm apart | ready |
| `connection.frame.plate-to-slab` | continuous bottom plate → slab | mechanical_anchor | `fastener.frame-anchor` | line, 3 anchors (152.4, 762, 2320 mm), pilot 10x60 | ready |
| `connection.backing-a.stud-2` / `connection.backing-b.king-left` | blocks → studs | screw | null | none | **held** |

The 40 frame screws cover 20 joints (14 plate, 2 header, 4 cripple ends); the 3 anchors sit on
permanent plate segments only — none inside the final door opening, and the invariant rejects any
fastener point inside the clear span below the header. The held backing connections carry the
proposed world points (753.4 / 1159.8 / 1159.8 / 1534.45, y 43.9, z 1066.8) and the hold reason.

## Operations (19), steps (18) and the cut list (17 rows)

Frame operations add `op.open-doorway` (removes the continuous plate and installs the two remaining
segments — the explicit pre/post representation) and `op.remove-plumb-prop` beside
`op.remove-brace`; the bracing-removal step owns both remove operations. The preparation step's cut
list has 17 rows (plates at full length with an explicit "not pre-cut" note, studs, kings, jacks,
header plies, spacer, cripples, temporary bracing).

**Flat-assembly presentation.** `cut-frame`, `layout-frame` and `assemble-frame` carry the
presentation-only `layFlat` recipe (rotate the wall members and the opening 90° about the canonical
X axis through the wall origin); the frame is upright from `raise-frame` onward. The adapter resets
to base matrices on every seek, so direct links, back/forward and reduced motion reconstruct the
same pose; the pose never changes data, takeoff or the IFC.

## Views

`view.iso`, `view.elevation`, `view.plan`, `view.closeup-band` (both blocks), `view.installer-eye`,
`view.frame`, `view.frame-flat` (full flat layout), `view.raise` (frame + both temporary members)
and `view.anchor` (permanent-segment anchors).

## Issues

`issue.p0-01` (opening width conflict, major/open), `issue.p0-02` (backing fastener not released,
major/open), `issue.p0-03` (loose parts, info/accepted), `issue.p0-04` (doubled header, spacer,
screws, anchors and temporary bracing are synthetic demonstration values, info/accepted).
Open issues: 2.

## Negative validation fixtures (in-memory mutations)

As before (ready fasten with held connections → `MISSING_FASTENER_PATTERN`; null cut length;
missing citation; dependency cycle; superseded dependency on `connection.backing-a.stud-2`;
coverage before inspection; missing file; unknown capability) plus pointing
`cutOperationIds` at a non-cut operation → `INVALID_CUT_OPERATION_REF`.

## Geometry invariants (pinned, `geometry.test.ts`)

Doubled header assembly fills the wall thickness ply+spacer+ply; stock yields never exceed
2438.4 mm with kerf; the block stock is 2x6 (not 2x4); members inside the wall extents; flush end
studs and the 16/32 in module; the clear opening free of members below the header; both plies
bearing on both jacks; blocks inside their bays; the continuous plate removed and the two remaining
segments installed (nothing crossing the final doorway); anchors on permanent segments only and no
fastener point inside the clear span; racking brace in-plane and plumb prop out-of-plane, neither
blocking the doorway, both with removal operations; all 40 screw points on frame members; BOM =
pattern x joints = authored points for both screws and anchors.
