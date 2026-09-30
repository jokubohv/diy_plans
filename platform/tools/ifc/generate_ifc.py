#!/usr/bin/env python3
"""Generate an IFC 4.3 model (IFC4X3_ADD2) from a compiled DIY guide.

Packet D (`p0.ifc-e2e`). Contract summary:

- IFC4X3_ADD2 file, project length unit MILLIMETRE.
- ``IfcProject`` -> ``IfcSite`` -> ``IfcBuilding`` -> ``IfcBuildingStorey`` with every product
  contained in the storey.
- exactly one product per compiled part whose ``ifcClass`` is a real product class; compiled
  ``overlays`` (fastener points, tool proxies, routes) never become IFC products.
- product ``GlobalId`` is copied *exactly* from ``compiled.idMap.parts``.
- placement comes from the compiled canonical ``worldTransform`` (column-major 16 numbers,
  translation at indices 12-14) expressed in project units (millimetres); the IfcOpenShell API
  is called with ``is_si=False`` so the matrix is read as project units, not SI.
- box parts become an explicit mesh (``IfcPolygonalFaceSet``); ``shape: "path"`` parts are
  approximated by straight prism segments (one mesh item per polyline segment); ``shape:
  "markers"`` parts (single-point reference markers such as trim zones or a reported ceiling
  reference) become one small reference cube per marker point, so the product count and
  placement stay identical to the compiled guide.
- every product carries ``Pset_DiyGuide`` with ``partId, role, trade, stage, initialState,
  schemaVersion, contentHash``.
- deterministic entity ordering: parts are processed sorted by ``id`` and the spatial spine is
  created first, so a rebuild produces the same entity order (the STEP header timestamp still
  varies, so byte-identical output is not claimed).

Usage:
    python generate_ifc.py --compiled <guide.compiled.json> --out <model/project.ifc>
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path
from typing import Any, Iterable

import numpy as np

import ifcopenshell
import ifcopenshell.api
import ifcopenshell.guid
import ifcopenshell.util.unit
from ifcopenshell.api import aggregate, context, geometry, pset, root, spatial, unit

# Fixed namespace for the deterministic spatial GlobalIds (not part ids; products always use
# the compiled idMap values verbatim).
SPATIAL_NAMESPACE = uuid.UUID("6f8c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f")

# Edge length of the reference cube used to represent a single-point marker part in IFC.
MARKER_REFERENCE_SIZE_MM = 60.0

# Mesh helpers -------------------------------------------------------------------------------


def box_mesh(size_mm: Iterable[float]) -> tuple[list[tuple[float, float, float]], list[list[int]]]:
    """Axis-aligned box centred on the local origin, explicit 8 vertices / 6 quads.

    Faces wind counter-clockwise seen from outside (verified normals by successive-edge cross
    products), so viewers that use winding to derive normals see a closed solid.
    """
    sx, sy, sz = (float(value) for value in size_mm)
    if min(sx, sy, sz) <= 0:
        raise ValueError(f"box sizeMm must be positive, got {size_mm!r}")
    hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0
    vertices = [
        (-hx, -hy, -hz),
        (hx, -hy, -hz),
        (hx, hy, -hz),
        (-hx, hy, -hz),
        (-hx, -hy, hz),
        (hx, -hy, hz),
        (hx, hy, hz),
        (-hx, hy, hz),
    ]
    faces = [
        [0, 3, 2, 1],  # bottom, -Z
        [4, 5, 6, 7],  # top, +Z
        [0, 1, 5, 4],  # front, -Y
        [1, 2, 6, 5],  # right, +X
        [2, 3, 7, 6],  # back, +Y
        [3, 0, 4, 7],  # left, -X
    ]
    return vertices, faces


def _segment_ring(
    start: np.ndarray, end: np.ndarray, radius: float, sides: int = 8
) -> tuple[list[tuple[float, float, float]], list[list[int]]]:
    """One straight prism segment between two local-frame points."""
    direction = end - start
    length = float(np.linalg.norm(direction))
    if length <= 0.0:
        raise ValueError("path segment has zero length")
    axis = direction / length
    reference = np.array([0.0, 0.0, 1.0])
    if abs(float(np.dot(axis, reference))) > 0.9:
        reference = np.array([0.0, 1.0, 0.0])
    e1 = np.cross(axis, reference)
    e1 = e1 / np.linalg.norm(e1)
    e2 = np.cross(axis, e1)  # (e1, e2, axis) is right-handed
    angles = np.linspace(0.0, 2.0 * np.pi, sides, endpoint=False)
    ring = np.array(
        [np.cos(angle) * e1 * radius + np.sin(angle) * e2 * radius for angle in angles]
    )
    first = [tuple(float(component) for component in start + offset) for offset in ring]
    second = [tuple(float(component) for component in end + offset) for offset in ring]
    vertices = first + second
    faces: list[list[int]] = []
    for index in range(sides):
        following = (index + 1) % sides
        faces.append([index, following, sides + following, sides + index])
    faces.append(list(range(sides - 1, -1, -1)))  # start cap, points along -axis
    faces.append(list(range(sides, 2 * sides)))  # end cap, points along +axis
    return vertices, faces


def path_mesh(
    points_mm: list[list[float]], radius_mm: float
) -> tuple[list[list[tuple[float, float, float]]], list[list[list[int]]]]:
    """Approximate a polyline by one prism mesh item per segment (explicit, no sweeps)."""
    if len(points_mm) < 2:
        raise ValueError("path geometry needs at least two points")
    if float(radius_mm) <= 0:
        raise ValueError("path radiusMm must be positive")
    vertex_items: list[list[tuple[float, float, float]]] = []
    face_items: list[list[list[int]]] = []
    compiled_points = [np.array([float(v) for v in point], dtype=float) for point in points_mm]
    for start, end in zip(compiled_points, compiled_points[1:]):
        vertices, faces = _segment_ring(start, end, float(radius_mm))
        vertex_items.append(vertices)
        face_items.append(faces)
    return vertex_items, face_items


def transform_points(
    world: np.ndarray, points_mm: list[list[float]]
) -> list[list[float]]:
    """Map canonical world points into the part's local frame (inverse of worldTransform)."""
    inverse = np.linalg.inv(world)
    result: list[list[float]] = []
    for point in points_mm:
        homogeneous = np.array(
            [float(point[0]), float(point[1]), float(point[2]), 1.0], dtype=float
        )
        local = inverse @ homogeneous
        result.append([float(local[0]), float(local[1]), float(local[2])])
    return result


def matrix_from_world_transform(raw: Any, part_id: str) -> np.ndarray:
    if not isinstance(raw, list) or len(raw) != 16:
        raise ValueError(f"{part_id}: worldTransform must be 16 numbers, got {raw!r}")
    matrix = np.array([float(value) for value in raw], dtype=float).reshape((4, 4), order="F")
    if not np.allclose(matrix[3], [0.0, 0.0, 0.0, 1.0], atol=1e-9):
        raise ValueError(f"{part_id}: worldTransform bottom row must be [0,0,0,1]")
    if not np.all(np.isfinite(matrix)):
        raise ValueError(f"{part_id}: worldTransform contains non-finite values")
    return matrix


def deterministic_guid(key: str) -> str:
    return ifcopenshell.guid.compress(str(uuid.uuid5(SPATIAL_NAMESPACE, key)))


# Generation ---------------------------------------------------------------------------------


def generate(compiled: dict[str, Any], out_path: Path, schema: str) -> dict[str, Any]:
    schema_version = compiled.get("schemaVersion")
    content_hash = compiled.get("meta", {}).get("contentHash")
    if not isinstance(schema_version, str) or not isinstance(content_hash, str):
        raise ValueError("compiled guide is missing schemaVersion or meta.contentHash")

    project = compiled.get("project")
    if not isinstance(project, dict):
        raise ValueError("compiled guide is missing project")

    id_map = compiled.get("idMap", {}).get("parts")
    if not isinstance(id_map, list):
        raise ValueError("compiled guide is missing idMap.parts")
    id_map_by_part = {entry["partId"]: entry for entry in id_map}
    if len(id_map_by_part) != len(id_map):
        raise ValueError("idMap.parts contains duplicate partIds")

    parts = [
        part
        for part in sorted(compiled.get("parts", []), key=lambda candidate: candidate["id"])
        if part.get("ifcClass")
    ]
    for part in parts:
        part_id = part["id"]
        if part_id.startswith("overlay."):
            raise ValueError(f"{part_id}: overlay ids must never become IFC products")
        if part_id not in id_map_by_part:
            raise ValueError(f"{part_id}: no idMap entry")
        mapped = id_map_by_part[part_id]
        if mapped.get("ifcClass") != part["ifcClass"]:
            raise ValueError(
                f"{part_id}: idMap ifcClass {mapped.get('ifcClass')!r} != part ifcClass {part['ifcClass']!r}"
            )
    extra_map_entries = sorted(set(id_map_by_part) - {part["id"] for part in parts})
    if extra_map_entries:
        raise ValueError(f"idMap has entries without products: {extra_map_entries}")

    model = ifcopenshell.file(schema=schema)

    spatial_project = root.create_entity(
        model, ifc_class="IfcProject", name=str(project.get("name") or "DIY guide project")
    )
    spatial_project.GlobalId = deterministic_guid("spatial.project")
    if project.get("description"):
        spatial_project.Description = str(project["description"])

    unit.assign_unit(
        model,
        length={"is_metric": True, "raw": "MILLIMETERS"},
        area={"is_metric": True, "raw": "METERS"},
        volume={"is_metric": True, "raw": "METERS"},
    )
    spatial_context = context.add_context(model, context_type="Model")
    body_context = context.add_context(
        model,
        context_type="Model",
        context_identifier="Body",
        target_view="MODEL_VIEW",
        parent=spatial_context,
    )

    site = root.create_entity(
        model, ifc_class="IfcSite", name=str(project.get("siteName") or "Synthetic site")
    )
    site.GlobalId = deterministic_guid("spatial.site")
    building = root.create_entity(
        model, ifc_class="IfcBuilding", name=str(project.get("buildingName") or "Synthetic building")
    )
    building.GlobalId = deterministic_guid("spatial.building")
    storey = root.create_entity(
        model, ifc_class="IfcBuildingStorey", name=str(project.get("storeyName") or "Finished floor")
    )
    storey.GlobalId = deterministic_guid("spatial.storey")
    storey.Elevation = 0.0

    aggregate.assign_object(model, products=[site], relating_object=spatial_project).GlobalId = deterministic_guid(
        "rel.aggregates.project-site"
    )
    aggregate.assign_object(model, products=[building], relating_object=site).GlobalId = deterministic_guid(
        "rel.aggregates.site-building"
    )
    aggregate.assign_object(model, products=[storey], relating_object=building).GlobalId = deterministic_guid(
        "rel.aggregates.building-storey"
    )

    products: list[Any] = []
    class_counts: dict[str, int] = {}
    for part in parts:
        part_id = part["id"]
        ifc_class = part["ifcClass"]
        mapped = id_map_by_part[part_id]

        product = root.create_entity(model, ifc_class=ifc_class, name=str(part.get("name") or part_id))
        product.GlobalId = str(mapped["ifcGlobalId"])

        world = matrix_from_world_transform(part.get("worldTransform"), part_id)
        geometry.edit_object_placement(model, product=product, matrix=world, is_si=False)

        shape = part.get("geometry", {}).get("shape")
        if shape == "box":
            vertices, faces = box_mesh(part["geometry"]["sizeMm"])
            representation = geometry.add_mesh_representation(
                model,
                context=body_context,
                vertices=[vertices],
                faces=[faces],
                unit_scale=1.0,  # vertices are already project units (mm)
            )
        elif shape == "path":
            local_points = transform_points(world, part["geometry"]["pointsMm"])
            vertex_items, face_items = path_mesh(local_points, part["geometry"]["radiusMm"])
            representation = geometry.add_mesh_representation(
                model,
                context=body_context,
                vertices=vertex_items,
                faces=face_items,
                unit_scale=1.0,
            )
        elif shape == "markers":
            # Reference markers are world-space points; export one small cube per point inside the
            # part's placement so the product count and world placement match the compiled guide.
            marker_points = part["geometry"]["pointsMm"]
            if not marker_points:
                raise ValueError(f"{part_id}: markers geometry has no points")
            local_points = transform_points(world, marker_points)
            vertex_items = []
            face_items = []
            for point in local_points:
                marker_vertices, marker_faces = box_mesh(
                    [
                        MARKER_REFERENCE_SIZE_MM,
                        MARKER_REFERENCE_SIZE_MM,
                        MARKER_REFERENCE_SIZE_MM,
                    ]
                )
                shifted = [
                    (v[0] + float(point[0]), v[1] + float(point[1]), v[2] + float(point[2]))
                    for v in marker_vertices
                ]
                vertex_items.append(shifted)
                face_items.append(marker_faces)
            representation = geometry.add_mesh_representation(
                model,
                context=body_context,
                vertices=vertex_items,
                faces=face_items,
                unit_scale=1.0,
            )
        else:
            raise ValueError(f"{part_id}: unsupported geometry shape {shape!r}")
        geometry.assign_representation(model, product=product, representation=representation)

        part_pset = pset.add_pset(model, product=product, name="Pset_DiyGuide")
        part_pset.GlobalId = deterministic_guid(f"pset.{part_id}")
        for relation in getattr(part_pset, "DefinesOccurrence", None) or []:
            relation.GlobalId = deterministic_guid(f"psetrel.{part_id}")
        pset.edit_pset(
            model,
            pset=part_pset,
            properties={
                "partId": part_id,
                "role": str(part.get("role") or ""),
                "trade": str(part.get("trade") or ""),
                "stage": str(part.get("stage") or ""),
                "initialState": str(part.get("initialState") or ""),
                "schemaVersion": schema_version,
                "contentHash": content_hash,
            },
        )

        products.append(product)
        class_counts[ifc_class] = class_counts.get(ifc_class, 0) + 1

    spatial.assign_container(model, products=products, relating_structure=storey).GlobalId = deterministic_guid(
        "rel.container.storey"
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    model.write(str(out_path))
    return {
        "ok": True,
        "out": str(out_path),
        "schema": model.schema_identifier,
        "productCount": len(products),
        "classCounts": dict(sorted(class_counts.items())),
        "skippedPartsWithoutIfcClass": sorted(
            part["id"] for part in compiled.get("parts", []) if not part.get("ifcClass")
        ),
        "overlayCount": len(compiled.get("overlays", [])),
        "contentHash": content_hash,
        "schemaVersion": schema_version,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate IFC 4.3 from a compiled DIY guide")
    parser.add_argument("--compiled", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--schema", default="IFC4X3")
    args = parser.parse_args(argv)

    compiled = json.loads(args.compiled.read_text(encoding="utf-8"))
    try:
        summary = generate(compiled, args.out, args.schema)
    except Exception as error:  # noqa: BLE001 - compact failure report for the shell script
        print(f"generate_ifc: FAILED: {error}", file=sys.stderr)
        return 1
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
