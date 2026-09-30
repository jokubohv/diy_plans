# BIM / IFC — what the fixture model contains

Synthetic P0 fixture only. Every value comes from `projects/p0-fixture/0.1.0` and is invented for
pipeline proof; no part of this file is construction guidance. Generation details, units and
limits live in [`ifc-pipeline.md`](ifc-pipeline.md); the fixture itself is specified in
[`fixture-p0.md`](fixture-p0.md).

## Contents

`model/project.ifc` is an IFC 4.3 (`IFC4X3_ADD2`) file with millimetre project units:

- **Spatial spine:** `IfcProject` → `IfcSite` → `IfcBuilding` → `IfcBuildingStorey` ("Finished
  floor"). Every product is contained in the storey.
- **Products:** 18 — exactly one per compiled guidance part with a real `ifcClass`. Compiled
  overlays (proposed fastener points, tool proxies, route paths) are presentation objects and are
  never written to the IFC.

| IFC class | Count | Example part | Material |
|---|---|---|---|
| `IfcSlab` | 1 | `part.existing.slab` (existing surface) | — |
| `IfcPlate` | 3 | `part.wall-a.bottom-plate`, `part.wall-a.top-plate`, `part.wall-a.backing` | lumber |
| `IfcMember` | 4 | `part.wall-a.stud-1`, `part.wall-a.stud-2`, `part.wall-a.stud-3`, `part.wall-a.brace` | lumber |
| `IfcOpeningElement` | 1 | `part.wall-a.opening` (door rough opening) | — |
| `IfcCovering` | 1 | `part.wall-a.cover-panel` (drywall) | gypsum panel |
| `IfcFurniture` | 1 | `part.cabinet.envelope` | — |
| `IfcBuildingElementProxy` | 1 | `part.demo.temp-panel` (removable protection) | temporary panel |
| `IfcCableSegment` | 1 | `part.demo.cable` (non-energized schematic route) | — |
| `IfcJunctionBox` | 1 | `part.demo.junction-box` | — |
| `IfcOutlet` | 1 | `part.demo.terminal` | — |
| `IfcDiscreteAccessory` | 3 | `part.loose.angle-1`, `part.loose.angle-2`, `part.loose.angle-3` | loose demonstration connectors |

- **Identity:** every product `GlobalId` is the compiled `ifcGlobalId`
  (`uuidv5` + IFC compression of the dotted part id, [`architecture.md`](architecture.md) §3).
- **Placement:** the compiled canonical `worldTransform` (Z-up millimetres) placed with
  `is_si=False`; box products are centred-on-origin meshes, the cable is a per-segment prism
  approximation.
- **Properties:** every product has `Pset_DiyGuide` with `partId`, `role`, `trade`, `stage`,
  `initialState`, `schemaVersion`, `contentHash`. `partId` is the dotted guide id; the other
  fields mirror the compiled part and release meta.

Attached requirement: [`../projects/p0-fixture/0.1.0/model/project.ids`](../projects/p0-fixture/0.1.0/model/project.ids)
is a minimal IDS 1.0 file with one specification per expected class, requiring a `GlobalId` and
`Pset_DiyGuide.partId`. `check_ifc.py` runs it with ifctester and fails when any specification
fails.

## How to inspect it

Machine-checked (default, run by `bash scripts/ifc.sh`):

```bash
.venv-ifc/bin/python tools/ifc/check_ifc.py --ifc <project.ifc> --compiled <guide.compiled.json> --ids projects/p0-fixture/0.1.0/model/project.ids
```

Any scripted inspection can use IfcOpenShell directly:

```bash
.venv-ifc/bin/python -c "import ifcopenshell; model = ifcopenshell.open('apps/guide-site/public/data/releases/p0-fixture/<releaseId>/model/project.ifc'); print(model.schema, len(model.by_type('IfcProduct')))"
```

## Independent viewer inspection (manual step)

Opening the file in an independent GUI/engine viewer (for example That Open Engine, a BIM authoring
tool, or an online IFC viewer) is a **manual** step. It was **not run** in this environment
because it needs interactive software that is not part of this repository, and no network access
is allowed. This is a bounded inspection exception, recorded honestly in
`work/3d-platform/evidence/p0/bim/run-1/README.md`:

- machine substitutes that did run: the eight `check_ifc.py` checks, the 11 IDS specifications,
  and the three signed control points;
- not run: an independent GUI viewer render and a human visual review of the model.
