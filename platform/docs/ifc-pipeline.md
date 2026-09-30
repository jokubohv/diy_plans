# IFC pipeline — units, API choices, commands and limits

Packet D (`p0.ifc-e2e`). The pipeline turns the compiled fixture release into an IFC 4.3 file and
re-checks it with IfcOpenShell + ifctester. Everything runs locally; no network calls are made
after `tools/ifc/setup.sh` has created the venv.

```
apps/guide-site/public/data/releases/p0-fixture/<releaseId>/guide.compiled.json
        │  tools/ifc/generate_ifc.py
        ▼
apps/guide-site/public/data/releases/p0-fixture/<releaseId>/model/project.ifc   (regenerated)
        │  tools/ifc/check_ifc.py  +  projects/p0-fixture/0.1.0/model/project.ids
        ▼
work/3d-platform/evidence/p0/bim/run-1/check-report.json
```

## Units and IfcOpenShell API choices

The canonical frame is Z-up millimetres (see [`architecture.md`](architecture.md) §2). The IFC
project length unit is `IfcSIUnit(LENGTHUNIT, MILLI, METRE)` created with
`ifcopenshell.api.unit.assign_unit(file, length={"is_metric": True, "raw": "MILLIMETERS"})`; the
resulting unit scale is `0.001` and `check_ifc.py` re-verifies it on the reopened file.

Two API calls have unit-sensitive parameters. Both were verified against IfcOpenShell 0.9.0
source/tests before use:

| Call | Parameter | Choice | Why |
|---|---|---|---|
| `ifcopenshell.api.geometry.edit_object_placement` | `is_si=False` | The canonical `worldTransform` (16 numbers, translation in **millimetres**) is passed as project units. | The API documents `is_si=False` as "the matrix is given in project units"; the implementation only scales translations when `is_si=True`. Reopening the file returns the exact millimetre translations (control points match with 0.000 mm delta). |
| `ifcopenshell.api.geometry.add_mesh_representation` | `unit_scale=1.0` | Mesh vertices are passed in **millimetres** and stored verbatim in project units. | With `unit_scale=None` the API assumes vertices are SI metres and divides by the project scale. Passing `1.0` disables that conversion; verified by round-tripping a 500 mm coordinate unchanged. |

`edit_object_placement` decomposes the matrix into an `IfcAxis2Placement3D` (origin + Z + X), so
the brace's 37° Z rotation survives the conversion.

## What is generated

- Spatial spine: `IfcProject` → `IfcSite` → `IfcBuilding` → `IfcBuildingStorey`; every product is
  contained in the storey with `IfcRelContainedInSpatialStructure`.
- One product per compiled part whose `ifcClass` is a real product class (18 in the fixture).
  Compiled `overlays` (fastener points, tool proxies, cable routes) are presentation objects and
  never become products.
- Product `GlobalId` values are copied **exactly** from `compiled.idMap.parts`; the spatial
  entities and relationships use deterministic `uuidv5` values from the fixed identity namespace
  in [`../tools/ifc/generate_ifc.py`](../tools/ifc/generate_ifc.py).
- Geometry: box parts become an explicit 8-vertex / 6-quad `IfcPolygonalFaceSet` centred on the
  local origin (the placement positions the centre). The `shape: "path"` cable is approximated by
  one 8-sided prism per polyline segment — there is no swept-circle geometry in P0.
- Every product carries `Pset_DiyGuide` with `partId, role, trade, stage, initialState,
  schemaVersion, contentHash`.

Entity creation order is sorted by part id and the deterministic relationships are created in a
fixed order, so a rebuild produces the same entity body. The STEP `FILE_NAME` header timestamp
still varies, so byte-identical output is not claimed — only deterministic ordering.

## Commands

```bash
bash tools/ifc/setup.sh      # check the venv; create it only if it is missing
bash scripts/ifc.sh          # generate + check, copy the report into the evidence directory
npm run gate:bim             # same as scripts/ifc.sh
```

Direct invocation (paths relative to `platform/`):

```bash
.venv-ifc/bin/python tools/ifc/generate_ifc.py --compiled <guide.compiled.json> --out <model/project.ifc>
.venv-ifc/bin/python tools/ifc/check_ifc.py --ifc <model/project.ifc> --compiled <guide.compiled.json> --ids projects/p0-fixture/0.1.0/model/project.ids --report <report.json>
```

`scripts/ifc.sh` exits `2` and prints `not_run: …` when the venv or the compiled data is missing;
that is reported as not run, never as a pass.

## Checks performed by `check_ifc.py`

| # | Check | Failure means |
|---|---|---|
| 1 | `units` — LENGTHUNIT is `MILLI`/`METRE`, scale 0.001 | the project is not millimetre |
| 2 | `productCounts` — per-class counts equal the compiled parts | a part is missing or an unexpected product exists |
| 3 | `globalIdsExact` — product GlobalIds equal `idMap.parts` exactly | identity drift |
| 4 | `globalIdClasses` — mapped class matches the product class | wrong IFC class |
| 5 | `controlPoints` — three signed world points within 0.1 mm | placement/unit conversion error |
| 6 | `worldTransformDrift` — every product translation matches the compiled transform within 0.1 mm | geometry drift beyond the contract |
| 7 | `psetDiyGuide` — all seven properties present; `partId` and `contentHash` correct | properties lost or stale |
| 8 | `ids` — every IDS 1.0 specification passes and matches IFC4X3_ADD2 | the file does not meet the published requirement |

The three signed control points are `part.wall-a.stud-1` → `[404.15, 126.45, 1219.2]`,
`part.wall-a.cover-panel` → `[956.6, 75.65, 1219.2]` and `part.existing.slab` →
`[1600, 1200, -50]` (millimetres, canonical world frame).

## Limits

- The door rough opening is a contained standalone product; no `IfcRelVoidsElement` boolean is
  created in P0.
- No materials, styles, type objects, schedules or `IfcOpeningElement` filling relationships.
- The cable is a segmented approximation; no swept solid and no electrical semantics beyond the
  part class.
- `check_ifc.py` re-opens the file with IfcOpenShell but does not run a geometry kernel
  validity/watertightness pass beyond the explicit representations it creates.
- Per-class counts are enforced by `check_ifc.py`; the IDS file only requires each expected class
  with a `GlobalId` and `Pset_DiyGuide.partId`.
- Viewing the file in an independent GUI viewer is a manual step; see
  [`bim.md`](bim.md#independent-viewer-inspection-manual-step) and the bounded inspection
  exception recorded in the evidence directory.
