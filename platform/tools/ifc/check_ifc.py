#!/usr/bin/env python3
"""Reopen a generated IFC and prove it matches the compiled guide and the project IDS.

Packet D (`p0.ifc-e2e`). Checks performed (all blocking, tolerance 0.1 mm):

1. project length unit is MILLIMETRE (``IfcSIUnit`` LENGTHUNIT MILLI/METRE, unit scale 0.001);
2. product count per class equals the compiled parts (overlays never become products, and no
   unexpected product may exist);
3. every product GlobalId matches ``compiled.idMap.parts`` exactly, and every idMap entry is a
   placed product of the mapped class;
4. the three signed control points resolve through the placed product's world placement;
5. every product carries ``Pset_DiyGuide`` with all seven written properties, ``partId`` equal
   to the idMap value and the compiled ``contentHash``;
6. the project IDS validates with ifctester (all specifications pass and match the file's
   IFC4X3_ADD2 schema version);
7. every product placement equals the compiled ``worldTransform`` translation (extra drift
   check; the three signed control points above are the contract).

Exit code 0 = every check passed, 1 = at least one failed. A compact text report is printed,
followed by the full JSON report (also written to ``--report`` when given).
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np

import ifcopenshell
import ifcopenshell.util.placement
import ifcopenshell.util.unit
from ifctester import ids as ids_module

TOLERANCE_MM = 0.1

# Signed control points from the P0 fixture packet (canonical world translations in mm).
FIXTURE_CONTROL_POINTS: dict[str, list[float]] = {
    "part.wall-a.stud-1": [366.05, 126.45, 1219.2],
    "part.wall-a.cover-panel": [969.3, 75.65, 1219.2],
    "part.existing.slab": [1600.0, 1200.0, -50.0],
}


def control_points_for(slug: str, compiled: dict[str, Any]) -> dict[str, list[float]]:
    """Frozen fixture oracle for p0-fixture; a deterministic derived oracle for other projects.

    The generic oracle picks the first, middle and last box parts from the compiled guide and
    compares the authored world translations, so every project gets a signed control-point check
    without inventing per-project constants. The full placement-drift check below still compares
    every single part against the compiled world transform.
    """
    if slug == "p0-fixture":
        return dict(FIXTURE_CONTROL_POINTS)
    box_parts = [
        part
        for part in compiled.get("parts", [])
        if isinstance(part.get("geometry"), dict)
        and part["geometry"].get("shape") == "box"
        and isinstance(part.get("worldTransform"), list)
        and len(part["worldTransform"]) == 16
    ]
    if not box_parts:
        return {}
    picks = [box_parts[0], box_parts[len(box_parts) // 2], box_parts[-1]]
    result: dict[str, list[float]] = {}
    for part in picks:
        result[str(part["id"])] = [
            float(part["worldTransform"][12]),
            float(part["worldTransform"][13]),
            float(part["worldTransform"][14]),
        ]
    return result

EXPECTED_PSET_NAME = "Pset_DiyGuide"
EXPECTED_PSET_PROPERTIES = (
    "partId",
    "role",
    "trade",
    "stage",
    "initialState",
    "schemaVersion",
    "contentHash",
)


def max_abs_delta(actual: list[float], expected: list[float]) -> float:
    return max(abs(a - e) for a, e in zip(actual, expected, strict=True))


def placed_translation(model: ifcopenshell.file, product: Any) -> list[float]:
    matrix = ifcopenshell.util.placement.get_local_placement(product.ObjectPlacement)
    return [float(matrix[0][3]), float(matrix[1][3]), float(matrix[2][3])]


def pset_properties(model: ifcopenshell.file, product: Any, pset_name: str) -> dict[str, Any] | None:
    for relation in getattr(product, "IsDefinedBy", []) or []:
        definition = relation.RelatingPropertyDefinition
        if definition is None or not definition.is_a("IfcPropertySet"):
            continue
        if definition.Name != pset_name:
            continue
        properties: dict[str, Any] = {}
        for prop in definition.HasProperties or []:
            if not prop.is_a("IfcPropertySingleValue"):
                continue
            nominal = prop.NominalValue
            properties[prop.Name] = None if nominal is None else nominal.wrappedValue
        return properties
    return None


def check(
    ifc_path: Path,
    compiled_path: Path,
    ids_path: Path,
    slug: str = "p0-fixture",
) -> dict[str, Any]:
    compiled = json.loads(compiled_path.read_text(encoding="utf-8"))
    model = ifcopenshell.open(str(ifc_path))

    checks: list[dict[str, Any]] = []
    failures: list[str] = []

    def record(check_id: str, ok: bool, detail: str) -> None:
        checks.append({"id": check_id, "ok": bool(ok), "detail": detail})
        if not ok:
            failures.append(f"{check_id}: {detail}")

    # 1. units ---------------------------------------------------------------------------
    unit = ifcopenshell.util.unit.get_project_unit(model, "LENGTHUNIT")
    unit_scale = ifcopenshell.util.unit.calculate_unit_scale(model)
    unit_description = (
        f"{unit.is_a()} UnitType={unit.UnitType} Prefix={unit.Prefix} Name={unit.Name}"
        if unit is not None
        else "missing LENGTHUNIT"
    )
    unit_ok = (
        unit is not None
        and unit.is_a("IfcSIUnit")
        and unit.UnitType == "LENGTHUNIT"
        and unit.Prefix == "MILLI"
        and unit.Name == "METRE"
        and abs(unit_scale - 0.001) <= 1e-12
    )
    record("units", unit_ok, f"scale={unit_scale} ({unit_description})")

    # 2-3. products and identity ---------------------------------------------------------
    parts = [part for part in compiled.get("parts", []) if part.get("ifcClass")]
    expected_counts = Counter(part["ifcClass"] for part in parts)
    products = [
        element
        for element in model.by_type("IfcProduct")
        if not element.is_a("IfcSpatialElement")
    ]
    actual_counts = Counter(element.is_a() for element in products)
    record(
        "productCounts",
        actual_counts == expected_counts,
        f"expected {dict(sorted(expected_counts.items()))}, actual {dict(sorted(actual_counts.items()))}",
    )

    id_map = compiled.get("idMap", {}).get("parts", [])
    id_map_by_gid = {entry["ifcGlobalId"]: entry for entry in id_map}
    actual_gids = Counter(element.GlobalId for element in products)
    duplicate_gids = sorted(gid for gid, count in actual_gids.items() if count > 1)
    record(
        "globalIdsExact",
        set(actual_gids) == set(id_map_by_gid) and not duplicate_gids,
        (
            f"products={len(products)} idMap={len(id_map)} "
            f"missing={sorted(set(id_map_by_gid) - set(actual_gids))[:5]} "
            f"extra={sorted(set(actual_gids) - set(id_map_by_gid))[:5]} duplicates={duplicate_gids[:5]}"
        ),
    )
    mismatched_classes = sorted(
        f"{element.GlobalId}:{element.is_a()}!={id_map_by_gid[element.GlobalId]['ifcClass']}"
        for element in products
        if element.GlobalId in id_map_by_gid
        and id_map_by_gid[element.GlobalId]["ifcClass"] != element.is_a()
    )
    record(
        "globalIdClasses",
        not mismatched_classes,
        f"mismatches={mismatched_classes[:5]}" if mismatched_classes else "all mapped classes match",
    )

    # 4 + 7. placements ------------------------------------------------------------------
    translation_by_part: dict[str, list[float]] = {}
    for part in parts:
        entry = next(
            (candidate for candidate in id_map if candidate["partId"] == part["id"]), None
        )
        if entry is None:
            continue
        product = model.by_guid(entry["ifcGlobalId"])
        if product is None:
            continue
        translation_by_part[part["id"]] = placed_translation(model, product)

    control_details: list[str] = []
    control_ok = True
    control_points = control_points_for(slug, compiled)
    if not control_points:
        control_ok = False
        control_details.append("no control points available for this project")
    for part_id, expected in control_points.items():
        actual = translation_by_part.get(part_id)
        if actual is None:
            control_ok = False
            control_details.append(f"{part_id}: product missing")
            continue
        delta = max_abs_delta(actual, expected)
        control_ok = control_ok and delta <= TOLERANCE_MM
        control_details.append(
            f"{part_id}={[round(value, 4) for value in actual]} "
            f"expected={expected} delta={delta:.6f} mm"
        )
    record("controlPoints", control_ok, "; ".join(control_details))

    drift: list[str] = []
    for part in parts:
        expected_matrix = part.get("worldTransform")
        actual = translation_by_part.get(part["id"])
        if actual is None or not isinstance(expected_matrix, list) or len(expected_matrix) != 16:
            drift.append(f"{part['id']}: missing placement")
            continue
        expected = [float(expected_matrix[12]), float(expected_matrix[13]), float(expected_matrix[14])]
        delta = max_abs_delta(actual, expected)
        if delta > TOLERANCE_MM:
            drift.append(f"{part['id']}: delta={delta:.6f} mm")
    record(
        "worldTransformDrift",
        not drift,
        f"{len(parts)} parts within {TOLERANCE_MM} mm" if not drift else "; ".join(drift[:5]),
    )

    # 5. Pset_DiyGuide ---------------------------------------------------------------------
    pset_failures: list[str] = []
    content_hash = compiled.get("meta", {}).get("contentHash")
    for part in parts:
        entry = next(
            (candidate for candidate in id_map if candidate["partId"] == part["id"]), None
        )
        product = model.by_guid(entry["ifcGlobalId"]) if entry else None
        if product is None:
            pset_failures.append(f"{part['id']}: product missing")
            continue
        properties = pset_properties(model, product, EXPECTED_PSET_NAME)
        if properties is None:
            pset_failures.append(f"{part['id']}: missing {EXPECTED_PSET_NAME}")
            continue
        missing = [name for name in EXPECTED_PSET_PROPERTIES if properties.get(name) in (None, "")]
        if missing:
            pset_failures.append(f"{part['id']}: missing properties {missing}")
            continue
        if properties["partId"] != part["id"]:
            pset_failures.append(f"{part['id']}: partId={properties['partId']!r}")
        if properties["contentHash"] != content_hash:
            pset_failures.append(f"{part['id']}: contentHash={properties['contentHash']!r}")
    record(
        "psetDiyGuide",
        not pset_failures,
        f"{len(parts)} products carry {EXPECTED_PSET_NAME}"
        if not pset_failures
        else "; ".join(pset_failures[:5]),
    )

    # 6. IDS -------------------------------------------------------------------------------
    ids_ok = False
    ids_specs: list[dict[str, Any]] = []
    ids_detail = ""
    try:
        specification = ids_module.open(str(ids_path), validate=True)
        specification.validate(model)
        ids_specs = [
            {
                "name": spec.name,
                "status": spec.status,
                "ifcVersionMatch": spec.is_ifc_version,
                "applicable": len(spec.applicable_entities),
                "failed": len(spec.failed_entities),
            }
            for spec in specification.specifications
        ]
        ids_ok = bool(ids_specs) and all(
            spec["status"] and spec["ifcVersionMatch"] for spec in ids_specs
        )
        ids_detail = f"{sum(1 for spec in ids_specs if spec['status'])}/{len(ids_specs)} specifications pass"
    except Exception as error:  # noqa: BLE001 - IDS parse/validation failure is a check failure
        ids_detail = f"IDS validation error: {error}"
    record("ids", ids_ok, ids_detail)

    report = {
        "ok": not failures,
        "slug": slug,
        "ifc": str(ifc_path),
        "compiled": str(compiled_path),
        "ids": str(ids_path),
        "schema": model.schema_identifier,
        "checks": checks,
        "failures": failures,
        "idsSpecifications": ids_specs,
        "productCounts": dict(sorted(actual_counts.items())),
    }
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check a generated IFC against compiled guide + IDS")
    parser.add_argument("--ifc", required=True, type=Path)
    parser.add_argument("--compiled", required=True, type=Path)
    parser.add_argument("--ids", required=True, type=Path)
    parser.add_argument("--report", type=Path, default=None)
    parser.add_argument(
        "--slug",
        default="p0-fixture",
        help="project slug; controls which frozen control-point oracle is used",
    )
    args = parser.parse_args(argv)

    report = check(args.ifc, args.compiled, args.ids, slug=args.slug)

    for check_entry in report["checks"]:
        marker = "PASS" if check_entry["ok"] else "FAIL"
        print(f"[{marker}] {check_entry['id']}: {check_entry['detail']}")
    print(f"check_ifc: {'OK' if report['ok'] else 'FAILED'} ({len(report['failures'])} failing checks)")
    print(json.dumps(report, indent=2))

    if args.report is not None:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
